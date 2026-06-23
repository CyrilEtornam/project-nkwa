from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from shared.models import SOSRequest, SOSResponse

router = APIRouter()

# BYPASS: SOS temporarily disabled per supervisor feedback.


@router.post("/sos", response_model=SOSResponse)
async def trigger_sos(body: SOSRequest) -> None:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Feature temporarily disabled",
    )
