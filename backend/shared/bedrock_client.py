from __future__ import annotations
import asyncio
import json
import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-6")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

_bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

SYSTEM_PROMPT = """You are an emergency call triage AI for Ghana's 112 emergency dispatch system.

You will receive a transcribed and translated emergency call in English. Analyse it and classify it.

You must respond with ONLY valid JSON. No preamble. No explanation. No markdown code blocks. Just the raw JSON object. If your response cannot be parsed as JSON, it is wrong.

WHO BASIC EMERGENCY CARE FIRST-AID PROTOCOLS:

Cardiac arrest: Tell the caller to lay the person flat on a firm surface. Tilt the head back to open the airway. Check if breathing. If not breathing: begin CPR — 30 chest compressions hard and fast, then 2 rescue breaths. Repeat until help arrives.

Choking adult: Ask if they can cough or speak. If yes, encourage coughing. If no: stand behind them, give 5 firm back blows between shoulder blades. Then 5 abdominal thrusts (Heimlich). Repeat until object dislodges or person loses consciousness.

Severe bleeding: Press firmly on the wound with a clean cloth. Do not lift the cloth. If limb, elevate above heart level. Maintain pressure until help arrives.

Burns: Remove from heat source. Cool under clean running water for 20 minutes. Do not use ice, butter, toothpaste, or any substance. Cover loosely with clean cloth.

Fracture: Do not try to straighten. Immobilise in position found. Support above and below the injury. Do not give food or water.

Drowning: Remove from water safely. Check breathing. If not breathing: tilt head back, give 5 rescue breaths, then begin CPR 30:2. Continue until help arrives.

Fire: Get everyone out immediately. Stay low under smoke. Do not use lifts. Close doors behind you. Once outside, call 112. Do not go back in.

Stroke: Use FAST — Face drooping on one side, Arm weakness when raised, Speech slurred or confused, Time to call 112 immediately. Lay person down, do not give food or water.

Seizure: Do not restrain. Clear the area of dangerous objects. Time the seizure. Do not put anything in mouth. When seizure ends, place in recovery position on their side.

Poisoning: Do not induce vomiting unless instructed by medical professional. Identify substance if safely possible. Keep calm. Call 112.

Snake bite: Keep person still, immobilise bitten limb below heart level. Remove jewellery near bite. Do not cut, suck, or apply tourniquet. Get to hospital immediately.

Allergic reaction: If person has epinephrine auto-injector, use it immediately on outer thigh. Lay person flat with legs raised unless difficulty breathing. Call 112.

Road accident: Do not move injured person unless in immediate danger. Turn off vehicle engine. Check consciousness. Control bleeding with pressure. Keep person warm and still.

Respond with exactly this JSON structure and no other text:
{
  "severity": "CRITICAL or URGENT or NON_EMERGENCY",
  "call_classification": "REAL_EMERGENCY or PRANK or UNCERTAIN",
  "incident_type": "short description of incident or null if prank",
  "is_prank": true or false,
  "prank_confidence": 0.0 to 1.0,
  "confidence": 0.0 to 1.0,
  "first_aid_script": "step by step first-aid instructions in English, null if prank",
  "first_aid_script_translated": "same instructions in the caller language specified below, null if prank or English",
  "dispatcher_brief": "one concise paragraph for the dispatcher — severity, incident, location hint, action",
  "recommended_response_unit": "AMBULANCE or FIRE or POLICE or NONE"
}

SEVERITY RULES:
CRITICAL — immediate risk of death: cardiac arrest, severe trauma, drowning, fire with people trapped, choking with loss of consciousness, major road accident with injuries, snake bite.
URGENT — serious but stable: fractures, moderate bleeding, burns under 10% body, breathing difficulty, stroke symptoms, seizure.
NON_EMERGENCY — minor or unclear: small cuts, mild pain, non-urgent queries, accidental calls, unclear audio.
PRANK — clear indicators: caller laughing, speaking nonsense, children playing, deliberate fake distress, singing, making sounds with friends in background, repeated testing.

When in doubt between CRITICAL and URGENT, choose CRITICAL. A wrong URGENT is better than a missed CRITICAL."""

_MOCK_TRIAGE = {
    "severity": "CRITICAL",
    "call_classification": "REAL_EMERGENCY",
    "incident_type": "Cardiac arrest",
    "is_prank": False,
    "prank_confidence": 0.02,
    "confidence": 0.95,
    "first_aid_script": "Stay calm. Lay the person flat on a firm surface. Tilt their head back to open the airway. Check if they are breathing. If not, begin CPR: 30 hard chest compressions then 2 rescue breaths. Repeat until help arrives.",
    "first_aid_script_translated": "Gyae suro. Fa obi da no fam wɔ ne akyi wɔ ase a emu yɛ den. Fa ne ti kyi so na bue ne kwan. Hwɛ sɛ ɔhome. Sɛ ɔnhome a, hyɛ ase CPR: mfomsoɔ 30 a wɔyɛ den na mfomsoɔ no yɛ ntɛm, na afei hơm abien. Ma so de saa kwan no toaa so kosi sɛ mmoa bɛduru.",
    "dispatcher_brief": "CRITICAL — Cardiac arrest. Caller speaking Twi. Caller reports patient is unresponsive and not breathing. First-aid CPR guidance delivered to caller. Dispatch AMBULANCE immediately.",
    "recommended_response_unit": "AMBULANCE",
}


async def run_triage(english_text: str, language: str, gps_lat: float, gps_lon: float, service_type: str) -> dict:
    if USE_MOCK:
        return _MOCK_TRIAGE.copy()

    user_message = (
        f"Emergency call transcription (English): {english_text}\n"
        f"Original language: {language}\n"
        f"Caller GPS: {gps_lat}, {gps_lon}\n"
        f"Service requested: {service_type}\n\n"
        "Classify this call."
    )

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_message}],
    })

    response = await asyncio.to_thread(
        _bedrock.invoke_model,
        modelId=BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    response_body = json.loads(response["body"].read())
    raw_text = response_body["content"][0]["text"].strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        simple_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 512,
            "messages": [{"role": "user", "content": f"Classify this emergency call as JSON only: {english_text}"}],
        })
        retry = await asyncio.to_thread(
            _bedrock.invoke_model,
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=simple_body,
        )
        retry_body = json.loads(retry["body"].read())
        return json.loads(retry_body["content"][0]["text"].strip())
