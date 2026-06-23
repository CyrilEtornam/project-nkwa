from __future__ import annotations

from fastapi import APIRouter, status

from shared.models import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendOTPRequest,
    TokenResponse,
    VerifyOTPRequest,
)

router = APIRouter()

# BYPASS: auth temporarily disabled per supervisor feedback.
# All endpoints return stub responses without touching DynamoDB or SNS.

_BYPASS_TOKEN = TokenResponse(
    token="bypass-token",
    user={"user_id": "mock-dispatcher-001", "full_name": "Mock Dispatcher", "role": "dispatcher"},
)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> dict:
    return {"user_id": "mock-dispatcher-001", "message": "Auth bypassed — registration skipped"}


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: VerifyOTPRequest) -> TokenResponse:
    return _BYPASS_TOKEN


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(body: ResendOTPRequest) -> MessageResponse:
    return MessageResponse(message="OTP resent (bypassed)")


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    return _BYPASS_TOKEN


@router.post("/dispatcher/login", response_model=TokenResponse)
async def dispatcher_login(body: LoginRequest) -> TokenResponse:
    return _BYPASS_TOKEN
