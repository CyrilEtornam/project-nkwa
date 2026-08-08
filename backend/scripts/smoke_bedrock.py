"""
Opt-in live smoke test for the Bedrock triage, Knowledge Base, and guidance path.

This script does not call Khaya, S3, DynamoDB, Location, or SNS. It only checks
the Bedrock layer with a canned transcript.

Usage from backend/ with real AWS credentials and env loaded:
    USE_MOCK=false python scripts/smoke_bedrock.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from shared import bedrock_client


async def main() -> None:
    if os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}:
        raise SystemExit("Set USE_MOCK=false to run the live Bedrock smoke test.")

    transcript = "My brother collapsed and he is not breathing."
    triage = await bedrock_client.run_triage(transcript, "en", 5.6037, -0.1870, "AMBULANCE")
    guidance = await bedrock_client.generate_first_aid_guidance(transcript, "en", triage, "AMBULANCE")

    print("Triage:")
    print(triage)
    print("\nFirst aid guidance:")
    print(guidance)


if __name__ == "__main__":
    asyncio.run(main())
