from fastapi import APIRouter, status

from shared.models import MessageResponse

router = APIRouter()


@router.get("", response_model=MessageResponse)
async def list_contacts() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def add_contact() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.patch("/{contact_id}", response_model=MessageResponse)
async def update_contact(contact_id: str) -> MessageResponse:
    return MessageResponse(message=f"Not implemented: {contact_id}")


@router.delete("/{contact_id}", response_model=MessageResponse)
async def delete_contact(contact_id: str) -> MessageResponse:
    return MessageResponse(message=f"Not implemented: {contact_id}")
