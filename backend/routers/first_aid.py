from fastapi import APIRouter

from shared.models import MessageResponse

router = APIRouter()


@router.get("", response_model=MessageResponse)
async def list_first_aid_guides() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.get("/{guide_id}", response_model=MessageResponse)
async def first_aid_guide(guide_id: str) -> MessageResponse:
    return MessageResponse(message=f"Not implemented: {guide_id}")
