from __future__ import annotations
import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends

from shared import auth_utils, dynamo_client, sns_client
from shared.models import SOSRequest, SOSResponse
from shared.ws_manager import manager

router = APIRouter()

CONTACTS_TABLE = os.getenv("DYNAMO_CONTACTS_TABLE", "nkwa-contacts")
USERS_TABLE = os.getenv("DYNAMO_USERS_TABLE", "nkwa-users")


@router.post("/sos", response_model=SOSResponse)
async def trigger_sos(
    body: SOSRequest,
    user: dict = Depends(auth_utils.get_current_user),
) -> SOSResponse:
    sos_id = str(uuid4())

    user_item = dynamo_client.get_item(USERS_TABLE, {"user_id": user["user_id"]})
    caller_name = user_item.get("full_name", "Unknown") if user_item else "Unknown"

    contacts = dynamo_client.query_by_partition(CONTACTS_TABLE, "user_id", user["user_id"])
    notify_contacts = [c for c in contacts if c.get("notify", True)]

    alerted = 0
    for contact in notify_contacts:
        phone = contact.get("phone")
        if phone:
            await sns_client.send_sos_alert(phone, caller_name, body.gps_lat, body.gps_lon)
            alerted += 1

    await manager.push_event("SOS_TRIGGERED", sos_id, {
        "user_id": user["user_id"],
        "caller_name": caller_name,
        "gps": {"lat": body.gps_lat, "lon": body.gps_lon},
        "message": body.message,
        "contacts_alerted": alerted,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return SOSResponse(sos_id=sos_id, contacts_alerted=alerted, dispatcher_notified=True)
