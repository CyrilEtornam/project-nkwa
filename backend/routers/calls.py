from __future__ import annotations
import asyncio
import base64
import os
import time
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from shared import auth_utils, bedrock_client, dynamo_client, khaya_client, location_client, s3_client, sns_client
from shared.models import CallInitiateRequest, CallInitiateResponse, CallStatusResponse, MessageResponse
from shared.ws_manager import manager

router = APIRouter()

CALLS_TABLE = os.getenv("DYNAMO_CALLS_TABLE", "nkwa-calls")


@router.post("/initiate", response_model=CallInitiateResponse, status_code=status.HTTP_202_ACCEPTED)
async def initiate_call(
    payload: CallInitiateRequest,
    user: dict = Depends(auth_utils.get_current_user),
) -> CallInitiateResponse:
    call_id = str(uuid4())
    start_time = time.time()
    failure_stage: str | None = None

    try:
        # Steps 1-2: push CALL_RECEIVED immediately
        failure_stage = "CALL_RECEIVED"
        await manager.push_event("CALL_RECEIVED", call_id, {
            "status": "PROCESSING",
            "service_type": payload.service_type,
            "language": payload.language,
            "gps": {"lat": payload.gps_lat, "lon": payload.gps_lon},
            "user_id": user["user_id"],
        })

        # Step 3: decode audio, detect format, save to S3
        failure_stage = "AUDIO_UPLOAD"
        audio_bytes = base64.b64decode(payload.audio_base64)
        content_type, _, ext = khaya_client.detect_audio_format(audio_bytes)
        audio_key = f"calls/{call_id}/audio.{ext}"
        await s3_client.upload_bytes(audio_key, audio_bytes, content_type)

        # Step 4: transcribe
        failure_stage = "TRANSCRIBE"
        transcription_original = await khaya_client.transcribe(audio_bytes, language=payload.language)

        # Steps 5-6: translate to English
        failure_stage = "TRANSLATE"
        transcription_translated = await khaya_client.translate(transcription_original, source_lang=payload.language)

        # Step 7: push TRANSCRIPTION_READY
        await manager.push_event("TRANSCRIPTION_READY", call_id, {
            "detected_language": payload.language,
            "transcription_original": transcription_original,
            "transcription_translated": transcription_translated,
        })

        # Step 8: Bedrock triage
        failure_stage = "TRIAGE"
        triage = await bedrock_client.run_triage(
            transcription_translated,
            payload.language,
            payload.gps_lat,
            payload.gps_lon,
            payload.service_type,
        )

        # Step 9: push TRIAGE_COMPLETE
        await manager.push_event("TRIAGE_COMPLETE", call_id, {
            "severity": triage.get("severity"),
            "call_classification": triage.get("call_classification"),
            "is_prank": triage.get("is_prank"),
            "incident_type": triage.get("incident_type"),
            "confidence": triage.get("confidence"),
            "triage_model_id": triage.get("triage_model_id"),
        })

        # Step 10: early return for pranks
        if triage.get("is_prank"):
            failure_stage = "PRANK_SAVE"
            dynamo_client.put_item(CALLS_TABLE, {
                "call_id": call_id,
                "user_id": user["user_id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "PRANK",
                "language": payload.language,
                "service_type": payload.service_type,
                "severity": None,
                "call_classification": triage.get("call_classification"),
                "incident_type": None,
                "is_prank": True,
                "prank_confidence": str(triage.get("prank_confidence", 0)),
                "confidence": str(triage.get("confidence", 0)),
                "transcription_original": transcription_original,
                "transcription_translated": transcription_translated,
                "gps_lat": str(payload.gps_lat),
                "gps_lon": str(payload.gps_lon),
                "triage_model_id": triage.get("triage_model_id") or "",
                "failure_stage": None,
            })
            await manager.push_event("PRANK_DETECTED", call_id, {
                "prank_confidence": triage.get("prank_confidence"),
                "call_classification": triage.get("call_classification"),
            })
            return CallInitiateResponse(call_id=call_id, status="PRANK_DETECTED")

        # Step 11: start location resolution concurrently
        failure_stage = "LOCATION_RESOLVE"
        location_task = asyncio.create_task(
            location_client.resolve_location(payload.gps_lat, payload.gps_lon)
        )
        first_aid_task = asyncio.create_task(
            bedrock_client.generate_first_aid_guidance(
                transcription_translated,
                payload.language,
                triage,
                payload.service_type,
            )
        )

        # Step 12: TTS first-aid audio (skip if no script — e.g. NON_EMERGENCY calls)
        failure_stage = "FIRST_AID_GUIDANCE"
        first_aid = await first_aid_task
        first_aid_script = first_aid.get("first_aid_script") or ""
        first_aid_script_translated = ""
        tts_script = first_aid_script
        first_aid_audio_url = None
        if first_aid_script.strip():
            if khaya_client.normalize_language_code(payload.language) != "en":
                failure_stage = "FIRST_AID_TRANSLATE"
                first_aid_script_translated = await khaya_client.translate(
                    first_aid_script,
                    source_lang="en",
                    target_lang=payload.language,
                )
                tts_script = first_aid_script_translated or first_aid_script

            failure_stage = "TTS"
            tts_audio = await khaya_client.synthesize(tts_script, language=payload.language)

            # Step 13: save TTS to S3 as public file
            failure_stage = "TTS_UPLOAD"
            tts_key = f"calls/{call_id}/first_aid_{payload.language}.mp3"
            first_aid_audio_url = await s3_client.upload_public(tts_key, tts_audio, "audio/mp3")

        # Step 14: await location result
        failure_stage = "LOCATION_AWAIT"
        location = await location_task

        # Step 15: push LOCATION_RESOLVED
        await manager.push_event("LOCATION_RESOLVED", call_id, {
            "landmark_name": location.get("landmark_name"),
            "directions_narrative": location.get("directions_narrative"),
            "map_pin": location.get("map_pin"),
        })

        # Step 16: calculate duration
        pipeline_duration = time.time() - start_time

        # Step 17: save full call record
        failure_stage = "CALL_SAVE"
        dynamo_client.put_item(CALLS_TABLE, {
            "call_id": call_id,
            "user_id": user["user_id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "COMPLETE",
            "severity": triage.get("severity"),
            "call_classification": triage.get("call_classification"),
            "incident_type": triage.get("incident_type"),
            "is_prank": False,
            "prank_confidence": str(triage.get("prank_confidence", 0)),
            "confidence": str(triage.get("confidence", 0)),
            "language": payload.language,
            "service_type": payload.service_type,
            "transcription_original": transcription_original,
            "transcription_translated": transcription_translated,
            "gps_lat": str(payload.gps_lat),
            "gps_lon": str(payload.gps_lon),
            "landmark_name": location.get("landmark_name", ""),
            "district": location.get("district", ""),
            "region": location.get("region", ""),
            "directions_narrative": location.get("directions_narrative", ""),
            "first_aid_script": first_aid_script,
            "first_aid_script_translated": first_aid_script_translated,
            "first_aid_audio_url": first_aid_audio_url,
            "dispatcher_brief": triage.get("dispatcher_brief") or "",
            "recommended_response_unit": triage.get("recommended_response_unit") or "NONE",
            "triage_model_id": triage.get("triage_model_id") or "",
            "first_aid_model_id": first_aid.get("first_aid_model_id") or "",
            "knowledge_source": first_aid.get("knowledge_source") or "",
            "knowledge_source_ids": first_aid.get("knowledge_source_ids") or first_aid.get("source_ids") or [],
            "kb_result_scores": [str(score) for score in first_aid.get("kb_result_scores", [])],
            "source_confidence": str(first_aid.get("source_confidence", 0)),
            "pipeline_duration_seconds": str(pipeline_duration),
            "failure_stage": None,
        })

        # Step 18: push BRIEF_READY
        await manager.push_event("BRIEF_READY", call_id, {
            "severity": triage.get("severity"),
            "call_classification": triage.get("call_classification"),
            "incident_type": triage.get("incident_type"),
            "dispatcher_brief": triage.get("dispatcher_brief"),
            "recommended_response_unit": triage.get("recommended_response_unit"),
            "first_aid_audio_url": first_aid_audio_url,
            "first_aid_script": first_aid_script,
            "first_aid_script_translated": first_aid_script_translated,
            "knowledge_source": first_aid.get("knowledge_source"),
            "knowledge_source_ids": first_aid.get("knowledge_source_ids") or first_aid.get("source_ids"),
            "first_aid_model_id": first_aid.get("first_aid_model_id"),
            "landmark_name": location.get("landmark_name"),
            "directions_narrative": location.get("directions_narrative"),
            "map_pin": location.get("map_pin"),
            "pipeline_duration_seconds": pipeline_duration,
        })

        # Step 19: CRITICAL SNS alert
        if triage.get("severity") == "CRITICAL":
            failure_stage = "SNS_ALERT"
            await sns_client.send_critical_alert(
                triage.get("incident_type", "Unknown incident"),
                location.get("landmark_name", "Unknown"),
                triage.get("recommended_response_unit", "AMBULANCE"),
            )
            await manager.push_event("SNS_ALERT_SENT", call_id, {
                "alert_type": "CRITICAL",
                "message_preview": f"CRITICAL — {triage.get('incident_type')} near {location.get('landmark_name')}",
            })

        # Step 20: return
        return CallInitiateResponse(
            call_id=call_id,
            status="PROCESSING",
            first_aid_audio_url=first_aid_audio_url,
        )

    except Exception as exc:
        try:
            dynamo_client.put_item(CALLS_TABLE, {
                "call_id": call_id,
                "user_id": user["user_id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "FAILED",
                "language": payload.language,
                "service_type": payload.service_type,
                "gps_lat": str(payload.gps_lat),
                "gps_lon": str(payload.gps_lon),
                "failure_stage": failure_stage or "UNKNOWN",
            })
        except Exception:
            pass

        await manager.push_event("ERROR", call_id, {
            "code": "PIPELINE_FAILURE",
            "message": str(exc),
            "recoverable": False,
            "failure_stage": failure_stage,
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline failed at {failure_stage}: {exc}",
        )


# /stats must be declared before /{call_id} so FastAPI matches it correctly
@router.get("/stats")
async def call_stats(user: dict = Depends(auth_utils.get_current_user)) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    all_calls = dynamo_client.scan_table(CALLS_TABLE)
    today_calls = [c for c in all_calls if c.get("timestamp", "").startswith(today)]

    real_emergencies = [c for c in today_calls if not c.get("is_prank") and c.get("status") != "PRANK"]
    pranks = [c for c in today_calls if c.get("is_prank") or c.get("status") == "PRANK"]
    critical_active = [
        c for c in today_calls
        if c.get("severity") == "CRITICAL" and c.get("status") not in {"ENDED", "FAILED"}
    ]

    durations = []
    for c in today_calls:
        raw = c.get("pipeline_duration_seconds")
        if raw:
            try:
                durations.append(float(raw))
            except (TypeError, ValueError):
                pass

    avg_duration = sum(durations) / len(durations) if durations else 0.0

    return {
        "total_calls_today": len(today_calls),
        "real_emergencies_today": len(real_emergencies),
        "pranks_filtered_today": len(pranks),
        "avg_pipeline_duration_seconds": round(avg_duration, 2),
        "critical_active": len(critical_active),
    }


@router.get("")
async def list_calls(
    user: dict = Depends(auth_utils.get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    severity: str | None = Query(default=None),
    classification: str | None = Query(default=None),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
) -> dict:
    all_calls = dynamo_client.scan_table(CALLS_TABLE)

    if severity:
        all_calls = [c for c in all_calls if c.get("severity") == severity]
    if classification:
        all_calls = [c for c in all_calls if c.get("call_classification") == classification]
    if from_date:
        all_calls = [c for c in all_calls if c.get("timestamp", "") >= from_date]
    if to_date:
        all_calls = [c for c in all_calls if c.get("timestamp", "") <= to_date]

    all_calls.sort(key=lambda c: c.get("timestamp", ""), reverse=True)
    total = len(all_calls)
    results = all_calls[offset: offset + limit]

    return {"total": total, "limit": limit, "offset": offset, "results": results}


@router.get("/{call_id}/status", response_model=CallStatusResponse)
async def call_status(
    call_id: str,
    user: dict = Depends(auth_utils.get_current_user),
) -> CallStatusResponse:
    item = dynamo_client.get_item(CALLS_TABLE, {"call_id": call_id})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return CallStatusResponse(
        call_id=call_id,
        status=item.get("status", "UNKNOWN"),
        first_aid_audio_url=item.get("first_aid_audio_url"),
        first_aid_text=item.get("first_aid_script"),
    )


@router.post("/{call_id}/end", response_model=MessageResponse)
async def end_call(
    call_id: str,
    user: dict = Depends(auth_utils.get_current_user),
) -> MessageResponse:
    item = dynamo_client.get_item(CALLS_TABLE, {"call_id": call_id})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    dynamo_client.update_item(CALLS_TABLE, {"call_id": call_id}, {"status": "ENDED"})
    return MessageResponse(message=f"Call {call_id} ended")


@router.get("/{call_id}")
async def call_details(
    call_id: str,
    user: dict = Depends(auth_utils.get_current_user),
) -> dict:
    item = dynamo_client.get_item(CALLS_TABLE, {"call_id": call_id})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return item
