from fastapi import APIRouter

from shared.models import MessageResponse

router = APIRouter()


@router.post("/sos", response_model=MessageResponse)
async def trigger_sos() -> MessageResponse:
    return MessageResponse(message="Not implemented")
