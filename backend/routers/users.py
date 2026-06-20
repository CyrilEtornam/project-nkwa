from __future__ import annotations
import os

from fastapi import APIRouter, Depends, HTTPException, status

from shared import auth_utils, dynamo_client
from shared.models import MessageResponse, UpdateProfileRequest, UserProfile

router = APIRouter()

USERS_TABLE = os.getenv("DYNAMO_USERS_TABLE", "nkwa-users")

_EXCLUDED = {"password_hash", "otp", "otp_expiry"}


@router.get("/me", response_model=UserProfile)
async def get_me(user: dict = Depends(auth_utils.get_current_user)) -> UserProfile:
    item = dynamo_client.get_item(USERS_TABLE, {"user_id": user["user_id"]})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    clean = {k: v for k, v in item.items() if k not in _EXCLUDED}
    return UserProfile(**clean)


@router.patch("/me", response_model=MessageResponse)
async def update_me(
    body: UpdateProfileRequest,
    user: dict = Depends(auth_utils.get_current_user),
) -> MessageResponse:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        dynamo_client.update_item(USERS_TABLE, {"user_id": user["user_id"]}, updates)
    return MessageResponse(message="Profile updated")
