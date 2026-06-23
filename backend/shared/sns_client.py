from __future__ import annotations
import asyncio
import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
SNS_ALERT_TOPIC_ARN = os.getenv("SNS_ALERT_TOPIC_ARN", "")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

_sns = boto3.client("sns", region_name=AWS_REGION)


async def send_otp(phone: str, otp: str) -> None:
    # BYPASS: SNS temporarily disabled
    print(f"[BYPASS] SNS send_otp skipped -> {phone}")


async def send_critical_alert(incident_type: str, landmark_name: str, unit: str) -> None:
    # BYPASS: SNS temporarily disabled
    print(f"[BYPASS] SNS send_critical_alert skipped: {incident_type} near {landmark_name}")


async def send_sos_alert(phone: str, caller_name: str, lat: float, lon: float) -> None:
    # BYPASS: SNS temporarily disabled
    print(f"[BYPASS] SNS send_sos_alert skipped -> {phone}")
