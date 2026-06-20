from __future__ import annotations
import asyncio
import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
SNS_ALERT_TOPIC_ARN = os.getenv("SNS_ALERT_TOPIC_ARN", "")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

_sns = boto3.client("sns", region_name=AWS_REGION)


async def send_otp(phone: str, otp: str) -> None:
    if USE_MOCK:
        print(f"[MOCK SNS] OTP {otp} -> {phone}")
        return
    await asyncio.to_thread(
        _sns.publish,
        PhoneNumber=phone,
        Message=f"Your Nkwa OTP code is {otp}. It expires in 10 minutes.",
    )


async def send_critical_alert(incident_type: str, landmark_name: str, unit: str) -> None:
    if USE_MOCK:
        print(f"[MOCK SNS] CRITICAL: {incident_type} near {landmark_name} -> dispatch {unit}")
        return
    if not SNS_ALERT_TOPIC_ARN:
        return
    await asyncio.to_thread(
        _sns.publish,
        TopicArn=SNS_ALERT_TOPIC_ARN,
        Message=f"CRITICAL — {incident_type} near {landmark_name}. Dispatch {unit} immediately.",
    )


async def send_sos_alert(phone: str, caller_name: str, lat: float, lon: float) -> None:
    if USE_MOCK:
        print(f"[MOCK SNS] SOS: {caller_name} -> {phone}")
        return
    await asyncio.to_thread(
        _sns.publish,
        PhoneNumber=phone,
        Message=f"SOS ALERT: {caller_name} needs help. Location: https://maps.google.com/?q={lat},{lon}",
    )
