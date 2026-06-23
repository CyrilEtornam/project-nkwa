from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from shared.models import AddContactRequest, MessageResponse, UpdateContactRequest

router = APIRouter()

# BYPASS: contacts temporarily disabled per supervisor feedback.

_DISABLED = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail="Feature temporarily disabled",
)


@router.get("")
async def list_contacts() -> dict:
    return {"total": 0, "contacts": [], "message": "Feature temporarily disabled"}


@router.post("", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def add_contact(body: AddContactRequest) -> None:
    raise _DISABLED


@router.patch("/{contact_id}", response_model=MessageResponse)
async def update_contact(contact_id: str, body: UpdateContactRequest) -> None:
    raise _DISABLED


@router.delete("/{contact_id}", response_model=MessageResponse)
async def delete_contact(contact_id: str) -> None:
    raise _DISABLED
