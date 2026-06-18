from fastapi import APIRouter

from shared.models import MessageResponse

router = APIRouter()


@router.get("/me", response_model=MessageResponse)
async def get_me() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.patch("/me", response_model=MessageResponse)
async def update_me() -> MessageResponse:
    return MessageResponse(message="Not implemented")
