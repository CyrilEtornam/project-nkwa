"""
Seed the nkwa-first-aid DynamoDB table with WHO emergency protocols.
Run once after creating the table. Safe to re-run — existing items are overwritten.

Usage (from the backend/ directory with venv activated and env vars loaded):
    python scripts/seed_first_aid.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make sure shared/ is importable when running from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared import dynamo_client

TABLE = os.getenv("DYNAMO_FIRSTAID_TABLE", "nkwa-first-aid")
DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "first_aid_guides.json"


def main() -> None:
    if not DATA_FILE.exists():
        print(f"ERROR: data file not found at {DATA_FILE}")
        sys.exit(1)

    guides = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"Seeding {len(guides)} guides into '{TABLE}'...")

    for guide in guides:
        dynamo_client.put_item(TABLE, guide)
        print(f"  ✓ {guide['guide_id']} — {guide['title']}")

    print(f"\nDone. {len(guides)} guides written to DynamoDB.")


if __name__ == "__main__":
    main()
