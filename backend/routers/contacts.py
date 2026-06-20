from __future__ import annotations
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from shared import auth_utils, dynamo_client
from shared.models import AddContactRequest, MessageResponse, UpdateContactRequest

router = APIRouter()

CONTACTS_TABLE = os.getenv("DYNAMO_CONTACTS_TABLE", "nkwa-contacts")


@router.get("")
async def list_contacts(user: dict = Depends(auth_utils.get_current_user)) -> dict:
    contacts = dynamo_client.query_by_partition(CONTACTS_TABLE, "user_id", user["user_id"])
    return {"total": len(contacts), "contacts": contacts}


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_contact(
    body: AddContactRequest,
    user: dict = Depends(auth_utils.get_current_user),
) -> dict:
    contact_id = str(uuid4())
    item = {
        "user_id": user["user_id"],
        "contact_id": contact_id,
        "full_name": body.full_name,
        "relationship": body.relationship,
        "phone": body.phone,
        "notify": True,
    }
    if body.email:
        item["email"] = body.email
    dynamo_client.put_item(CONTACTS_TABLE, item)
    return {"contact_id": contact_id, "full_name": body.full_name, "message": "Contact added"}


@router.patch("/{contact_id}", response_model=MessageResponse)
async def update_contact(
    contact_id: str,
    body: UpdateContactRequest,
    user: dict = Depends(auth_utils.get_current_user),
) -> MessageResponse:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        dynamo_client.update_item(
            CONTACTS_TABLE,
            {"user_id": user["user_id"], "contact_id": contact_id},
            updates,
        )
    return MessageResponse(message="Contact updated")


@router.delete("/{contact_id}", response_model=MessageResponse)
async def delete_contact(
    contact_id: str,
    user: dict = Depends(auth_utils.get_current_user),
) -> MessageResponse:
    dynamo_client.delete_item(
        CONTACTS_TABLE,
        {"user_id": user["user_id"], "contact_id": contact_id},
    )
    return MessageResponse(message="Contact removed")
