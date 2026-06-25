from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any

import boto3
from pydantic import ValidationError

from shared.models import FirstAidGuidance, KnowledgeSnippet, TriageDecision

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-opus-4-6-v1")
BEDROCK_FIRST_AID_MODEL_ID = os.getenv("BEDROCK_FIRST_AID_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
BEDROCK_FIRST_AID_FAST_MODEL_ID = os.getenv(
    "BEDROCK_FIRST_AID_FAST_MODEL_ID",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
)
BEDROCK_KB_ID = os.getenv("BEDROCK_KB_ID", "")
BEDROCK_KB_ENABLED = os.getenv("BEDROCK_KB_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
BEDROCK_KB_NUMBER_OF_RESULTS = int(os.getenv("BEDROCK_KB_NUMBER_OF_RESULTS", "3"))
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

_bedrock_runtime = None
_bedrock_agent_runtime = None
_GUIDES_CACHE: list[dict[str, Any]] | None = None

_DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "first_aid_guides.json"

TRIAGE_SYSTEM_PROMPT = """You are an emergency call triage AI for Ghana's 112 emergency dispatch system.

You receive an English emergency-call transcript after speech recognition and translation.
Classify the call for dispatch. Do not write first-aid instructions.

Return ONLY a valid JSON object with this exact shape:
{
  "severity": "CRITICAL or URGENT or NON_EMERGENCY",
  "call_classification": "REAL_EMERGENCY or PRANK or UNCERTAIN",
  "incident_type": "short incident description, or null for prank",
  "is_prank": true or false,
  "prank_confidence": 0.0,
  "confidence": 0.0,
  "dispatcher_brief": "one concise paragraph for the dispatcher",
  "recommended_response_unit": "AMBULANCE or FIRE or POLICE or NONE"
}

Severity rules:
CRITICAL means immediate risk of death or rapid deterioration.
URGENT means serious but apparently stable.
NON_EMERGENCY means minor, unclear, accidental, or non-urgent.
PRANK indicators include laughing, nonsense, deliberate fake distress, singing, children playing, repeated testing, or clear non-emergency behavior.

When in doubt between CRITICAL and URGENT, choose CRITICAL.
"""

FIRST_AID_SYSTEM_PROMPT = """You write caller-safe first-aid guidance for Ghana's 112 emergency dispatch system.

Use ONLY the approved guide excerpts supplied by the backend. Do not add medical steps that are not present in those excerpts.
Write short, calm, actionable English instructions that a caller can follow while help is coming.
If the excerpts are insufficient, say only the safe basics found in the excerpts and tell the caller to stay on the line with emergency services.

Return ONLY a valid JSON object with this exact shape:
{
  "first_aid_script": "caller-facing English first-aid instructions",
  "source_ids": ["guide ids used"],
  "source_confidence": 0.0
}
"""

_MOCK_TRIAGE = {
    "severity": "CRITICAL",
    "call_classification": "REAL_EMERGENCY",
    "incident_type": "Cardiac arrest",
    "is_prank": False,
    "prank_confidence": 0.02,
    "confidence": 0.95,
    "dispatcher_brief": (
        "CRITICAL - Cardiac arrest. Caller reports a patient is unresponsive and not breathing. "
        "Dispatch AMBULANCE immediately."
    ),
    "recommended_response_unit": "AMBULANCE",
}


def _get_runtime_client():
    global _bedrock_runtime
    if _bedrock_runtime is None:
        _bedrock_runtime = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    return _bedrock_runtime


def _get_agent_runtime_client():
    global _bedrock_agent_runtime
    if _bedrock_agent_runtime is None:
        _bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=AWS_REGION)
    return _bedrock_agent_runtime


def _model_dump(model) -> dict:
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


def _json_object_from_text(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        payload = json.loads(cleaned[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("Model response was not a JSON object")
    return payload


async def _invoke_model_text(model_id: str, system_prompt: str, user_message: str, max_tokens: int) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
    })
    response = await asyncio.to_thread(
        _get_runtime_client().invoke_model,
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=body,
    )
    response_body = json.loads(response["body"].read())
    return response_body["content"][0]["text"].strip()


async def _invoke_model_json(
    model_id: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int,
    repair_label: str,
) -> dict:
    raw_text = await _invoke_model_text(model_id, system_prompt, user_message, max_tokens)
    try:
        return _json_object_from_text(raw_text)
    except Exception:
        repair_message = (
            f"The previous {repair_label} response was not valid JSON.\n"
            f"Return only the corrected JSON object for this request.\n\n"
            f"Original request:\n{user_message}\n\n"
            f"Invalid response:\n{raw_text}"
        )
        retry_text = await _invoke_model_text(model_id, system_prompt, repair_message, max_tokens)
        return _json_object_from_text(retry_text)


def _short_audio_note(english_text: str) -> str:
    words = [word for word in english_text.strip().split() if word]
    if len(words) >= 3:
        return ""
    return "Note: the transcript is very short, empty, or unclear. Treat accidental call or prank as possible."


def _build_triage_user_message(
    english_text: str,
    language: str,
    gps_lat: float,
    gps_lon: float,
    service_type: str,
) -> str:
    note = _short_audio_note(english_text)
    return (
        f"Emergency call transcription (English): {english_text}\n"
        f"Original language: {language}\n"
        f"Caller GPS: {gps_lat}, {gps_lon}\n"
        f"Service requested: {service_type}\n"
        f"{note}\n\n"
        "Classify this call for dispatch. Do not write first-aid instructions."
    )


async def run_triage(english_text: str, language: str, gps_lat: float, gps_lon: float, service_type: str) -> dict:
    if USE_MOCK:
        triage = TriageDecision.model_validate({**_MOCK_TRIAGE, "triage_model_id": BEDROCK_MODEL_ID})
        return _model_dump(triage)

    user_message = _build_triage_user_message(english_text, language, gps_lat, gps_lon, service_type)
    payload = await _invoke_model_json(
        BEDROCK_MODEL_ID,
        TRIAGE_SYSTEM_PROMPT,
        user_message,
        max_tokens=700,
        repair_label="triage",
    )

    try:
        triage = TriageDecision.model_validate({**payload, "triage_model_id": BEDROCK_MODEL_ID})
    except ValidationError as exc:
        repair_message = (
            "The prior triage JSON failed backend schema validation. "
            "Return a corrected JSON object with only the required triage fields.\n\n"
            f"Validation error:\n{exc}\n\n"
            f"Call transcript:\n{english_text}"
        )
        repaired = await _invoke_model_json(
            BEDROCK_MODEL_ID,
            TRIAGE_SYSTEM_PROMPT,
            repair_message,
            max_tokens=700,
            repair_label="triage repair",
        )
        triage = TriageDecision.model_validate({**repaired, "triage_model_id": BEDROCK_MODEL_ID})

    return _model_dump(triage)


def _load_guides() -> list[dict[str, Any]]:
    global _GUIDES_CACHE
    if _GUIDES_CACHE is None:
        _GUIDES_CACHE = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    return _GUIDES_CACHE


def _guide_text(guide: dict[str, Any]) -> str:
    lines = [
        f"Title: {guide.get('title', '')}",
        f"Category: {guide.get('category', '')}",
        f"Overview: {guide.get('overview', '')}",
        "Steps:",
    ]
    for step in guide.get("steps", []):
        lines.append(f"{step.get('step_number')}. {step.get('title')}: {step.get('description')}")
    return "\n".join(lines)


def _guide_to_snippet(guide: dict[str, Any], knowledge_source: str = "local_fallback") -> KnowledgeSnippet:
    return KnowledgeSnippet(
        source_id=str(guide.get("guide_id") or guide.get("title") or "local-guide"),
        text=_guide_text(guide),
        score=1.0 if knowledge_source in {"local_fallback", "mock"} else None,
        source_uri=None,
        metadata={
            "guide_id": guide.get("guide_id"),
            "title": guide.get("title"),
            "category": guide.get("category"),
        },
        knowledge_source=knowledge_source,
    )


def _matching_local_guide(english_text: str, triage: dict) -> KnowledgeSnippet:
    haystack = " ".join([
        str(triage.get("incident_type") or ""),
        str(triage.get("dispatcher_brief") or ""),
        english_text,
    ]).lower()
    aliases = {
        "Cardiac Arrest": ["cardiac", "arrest", "unresponsive", "not breathing", "cpr"],
        "Choking (Adult)": ["choking", "choke", "blocked airway", "cannot breathe"],
        "Severe Bleeding": ["bleeding", "blood", "wound", "cut"],
        "Burns": ["burn", "burns", "fire injury", "scald"],
        "Fracture (Broken Bone)": ["fracture", "broken bone", "broke", "arm", "leg"],
        "Drowning": ["drowning", "drowned", "water"],
        "Fire": ["fire", "smoke", "burning", "trapped"],
        "Stroke": ["stroke", "face drooping", "slurred", "weakness"],
        "Seizure": ["seizure", "convulsion", "fits"],
        "Poisoning": ["poison", "poisoning", "swallowed", "toxic"],
        "Snake Bite": ["snake", "bite", "venom"],
        "Road Accident": ["road accident", "accident", "car crash", "collision", "vehicle"],
    }

    guides = _load_guides()
    best_guide = guides[0]
    best_score = -1
    for guide in guides:
        title = str(guide.get("title", ""))
        terms = [title.lower(), str(guide.get("category", "")).lower()]
        for alias_title, alias_terms in aliases.items():
            if alias_title.lower() in title.lower():
                terms.extend(alias_terms)
        score = sum(1 for term in terms if term and term in haystack)
        if score > best_score:
            best_score = score
            best_guide = guide

    return _guide_to_snippet(best_guide)


def _build_knowledge_query(english_text: str, triage: dict, service_type: str) -> str:
    return (
        f"Incident type: {triage.get('incident_type')}\n"
        f"Severity: {triage.get('severity')}\n"
        f"Service requested: {service_type}\n"
        f"Transcript: {english_text}\n"
        "Find approved first-aid guidance for this emergency."
    )


def _snippet_from_kb_result(result: dict) -> KnowledgeSnippet | None:
    content = result.get("content") or {}
    text = content.get("text") if isinstance(content, dict) else None
    if not isinstance(text, str) or not text.strip():
        return None

    metadata = result.get("metadata") or {}
    location = result.get("location") or {}
    source_uri = None
    if isinstance(location, dict):
        s3_location = location.get("s3Location") or {}
        web_location = location.get("webLocation") or {}
        source_uri = s3_location.get("uri") or web_location.get("url")

    source_id = (
        metadata.get("guide_id")
        or metadata.get("source_id")
        or metadata.get("x-amz-bedrock-kb-source-uri")
        or source_uri
        or f"kb-result-{abs(hash(text))}"
    )
    score = result.get("score")
    return KnowledgeSnippet(
        source_id=str(source_id),
        text=text,
        score=float(score) if isinstance(score, (int, float)) else None,
        source_uri=source_uri,
        metadata=metadata,
        knowledge_source="bedrock_kb",
    )


async def retrieve_first_aid_knowledge(english_text: str, triage: dict, service_type: str) -> list[KnowledgeSnippet]:
    if USE_MOCK:
        snippet = _matching_local_guide(english_text, triage)
        return [snippet.model_copy(update={"knowledge_source": "mock"})]

    if not BEDROCK_KB_ENABLED or not BEDROCK_KB_ID:
        return [_matching_local_guide(english_text, triage)]

    query = _build_knowledge_query(english_text, triage, service_type)
    try:
        response = await asyncio.to_thread(
            _get_agent_runtime_client().retrieve,
            knowledgeBaseId=BEDROCK_KB_ID,
            retrievalQuery={"text": query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {
                    "numberOfResults": BEDROCK_KB_NUMBER_OF_RESULTS,
                }
            },
        )
    except Exception:
        return [_matching_local_guide(english_text, triage)]

    snippets = [
        snippet
        for result in response.get("retrievalResults", [])
        for snippet in [_snippet_from_kb_result(result)]
        if snippet is not None
    ]
    return snippets or [_matching_local_guide(english_text, triage)]


def _format_snippets(snippets: list[KnowledgeSnippet]) -> str:
    blocks = []
    for snippet in snippets:
        blocks.append(
            f"Source ID: {snippet.source_id}\n"
            f"Score: {snippet.score}\n"
            f"Text:\n{snippet.text}"
        )
    return "\n\n---\n\n".join(blocks)


def _deterministic_guidance_from_snippets(snippets: list[KnowledgeSnippet]) -> FirstAidGuidance:
    snippet = snippets[0]
    steps = []
    for line in snippet.text.splitlines():
        if re.match(r"^\d+\.", line.strip()):
            steps.append(line.strip())
    script = " ".join(steps) if steps else snippet.text
    source_ids = [item.source_id for item in snippets]
    scores = [item.score for item in snippets if item.score is not None]
    source = snippets[0].knowledge_source if snippets else "local_fallback"
    return FirstAidGuidance(
        first_aid_script=script,
        source_ids=source_ids,
        source_confidence=0.75,
        knowledge_source=source,
        knowledge_source_ids=source_ids,
        kb_result_scores=scores,
        first_aid_model_id=None,
    )


async def generate_first_aid_guidance(
    english_text: str,
    language: str,
    triage: dict,
    service_type: str,
) -> dict:
    snippets = await retrieve_first_aid_knowledge(english_text, triage, service_type)

    if USE_MOCK:
        guidance = _deterministic_guidance_from_snippets(snippets)
        guidance.first_aid_model_id = BEDROCK_FIRST_AID_MODEL_ID
        guidance.knowledge_source = "mock"
        return _model_dump(guidance)

    user_message = (
        f"Caller language code: {language}\n"
        f"Emergency call transcription (English): {english_text}\n"
        f"Triage summary: {json.dumps(triage, ensure_ascii=False)}\n\n"
        f"Approved guide excerpts:\n{_format_snippets(snippets)}\n\n"
        "Write first-aid instructions grounded only in the approved guide excerpts."
    )

    try:
        payload = await _invoke_model_json(
            BEDROCK_FIRST_AID_MODEL_ID,
            FIRST_AID_SYSTEM_PROMPT,
            user_message,
            max_tokens=800,
            repair_label="first-aid guidance",
        )
        source_ids = [str(item) for item in payload.get("source_ids", [])]
        guidance = FirstAidGuidance(
            first_aid_script=str(payload.get("first_aid_script", "")).strip(),
            source_ids=source_ids,
            source_confidence=float(payload.get("source_confidence", 0.0)),
            knowledge_source=snippets[0].knowledge_source,
            knowledge_source_ids=[item.source_id for item in snippets],
            kb_result_scores=[item.score for item in snippets if item.score is not None],
            first_aid_model_id=BEDROCK_FIRST_AID_MODEL_ID,
        )
        if not guidance.first_aid_script:
            raise ValueError("First-aid model returned an empty script")
        return _model_dump(guidance)
    except Exception:
        guidance = _deterministic_guidance_from_snippets(snippets)
        guidance.first_aid_model_id = None
        return _model_dump(guidance)


__all__ = [
    "BEDROCK_MODEL_ID",
    "BEDROCK_FIRST_AID_MODEL_ID",
    "BEDROCK_FIRST_AID_FAST_MODEL_ID",
    "BEDROCK_KB_ID",
    "BEDROCK_KB_ENABLED",
    "BEDROCK_KB_NUMBER_OF_RESULTS",
    "USE_MOCK",
    "run_triage",
    "retrieve_first_aid_knowledge",
    "generate_first_aid_guidance",
]
