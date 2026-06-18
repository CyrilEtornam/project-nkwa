from fastapi import APIRouter, status

from shared.models import MessageResponse

router = APIRouter()


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.post("/verify-otp", response_model=MessageResponse)
async def verify_otp() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.post("/login", response_model=MessageResponse)
async def login() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.post("/dispatcher/login", response_model=MessageResponse)
async def dispatcher_login() -> MessageResponse:
    return MessageResponse(message="Not implemented")
