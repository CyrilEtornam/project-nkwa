from __future__ import annotations
import os

from fastapi import APIRouter, Depends, HTTPException, status

from shared import auth_utils, dynamo_client

router = APIRouter()

FIRSTAID_TABLE = os.getenv("DYNAMO_FIRSTAID_TABLE", "nkwa-first-aid")


@router.get("")
async def list_first_aid_guides(user: dict = Depends(auth_utils.get_current_user)) -> dict:
    guides = dynamo_client.scan_table(FIRSTAID_TABLE)
    summary = [
        {
            "guide_id": g.get("guide_id"),
            "title": g.get("title"),
            "category": g.get("category"),
            "overview": g.get("overview"),
            "steps_count": g.get("steps_count"),
            "offline_available": g.get("offline_available", True),
        }
        for g in guides
    ]
    return {"guides": summary}


@router.get("/{guide_id}")
async def first_aid_guide(
    guide_id: str,
    user: dict = Depends(auth_utils.get_current_user),
) -> dict:
    item = dynamo_client.get_item(FIRSTAID_TABLE, {"guide_id": guide_id})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")
    return item
