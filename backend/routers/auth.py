from __future__ import annotations
import os
import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status

from shared import auth_utils, dynamo_client, sns_client
from shared.models import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendOTPRequest,
    TokenResponse,
    VerifyOTPRequest,
)

router = APIRouter()

USERS_TABLE = os.getenv("DYNAMO_USERS_TABLE", "nkwa-users")


def _generate_otp() -> tuple[str, str]:
    otp = str(random.randint(100000, 999999))
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    return otp, expiry


def _generate_nkwa_id() -> str:
    return f"GA-{random.randint(100, 999)}-{random.randint(1000, 9999)}"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> dict:
    otp, otp_expiry = _generate_otp()
    user_id = str(uuid4())
    item = {
        "user_id": user_id,
        "full_name": body.full_name,
        "email": body.email,
        "phone": body.phone,
        "region": body.region,
        "home_address": body.home_address,
        "nkwa_id": _generate_nkwa_id(),
        "password_hash": auth_utils.hash_password(body.password),
        "role": "caller",
        "otp": otp,
        "otp_expiry": otp_expiry,
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    dynamo_client.put_item(USERS_TABLE, item)
    await sns_client.send_otp(body.phone, otp)
    return {"user_id": user_id, "message": "OTP sent to phone"}


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: VerifyOTPRequest) -> TokenResponse:
    items = dynamo_client.scan_table(USERS_TABLE)
    user = next((u for u in items if u.get("phone") == body.phone), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.get("otp") != body.otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")

    expiry = user.get("otp_expiry", "")
    if expiry and datetime.fromisoformat(expiry) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    dynamo_client.update_item(USERS_TABLE, {"user_id": user["user_id"]}, {"verified": True})
    token = auth_utils.create_token(user["user_id"], user.get("role", "caller"))
    return TokenResponse(token=token, user={"user_id": user["user_id"], "full_name": user.get("full_name", "")})


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(body: ResendOTPRequest) -> MessageResponse:
    items = dynamo_client.scan_table(USERS_TABLE)
    user = next((u for u in items if u.get("phone") == body.phone), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    otp, otp_expiry = _generate_otp()
    dynamo_client.update_item(USERS_TABLE, {"user_id": user["user_id"]}, {"otp": otp, "otp_expiry": otp_expiry})
    await sns_client.send_otp(body.phone, otp)
    return MessageResponse(message="OTP resent")


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    items = dynamo_client.scan_table(USERS_TABLE)
    user = next((u for u in items if u.get("email") == body.email), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not auth_utils.verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = auth_utils.create_token(user["user_id"], user.get("role", "caller"))
    return TokenResponse(
        token=token,
        user={"user_id": user["user_id"], "full_name": user.get("full_name", ""), "role": user.get("role", "caller")},
    )


@router.post("/dispatcher/login", response_model=TokenResponse)
async def dispatcher_login(body: LoginRequest) -> TokenResponse:
    items = dynamo_client.scan_table(USERS_TABLE)
    user = next((u for u in items if u.get("email") == body.email), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not auth_utils.verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.get("role") != "dispatcher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a dispatcher account")

    token = auth_utils.create_token(user["user_id"], "dispatcher")
    return TokenResponse(token=token, user={"user_id": user["user_id"], "full_name": user.get("full_name", "")})
