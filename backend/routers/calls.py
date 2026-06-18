from fastapi import APIRouter

from shared.models import MessageResponse

router = APIRouter()


@router.post("/initiate", response_model=MessageResponse)
async def initiate_call() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.get("/{call_id}/status", response_model=MessageResponse)
async def call_status(call_id: str) -> MessageResponse:
    return MessageResponse(message=f"Not implemented: {call_id}")


@router.post("/{call_id}/end", response_model=MessageResponse)
async def end_call(call_id: str) -> MessageResponse:
    return MessageResponse(message=f"Not implemented: {call_id}")


@router.get("", response_model=MessageResponse)
async def list_calls() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.get("/stats", response_model=MessageResponse)
async def call_stats() -> MessageResponse:
    return MessageResponse(message="Not implemented")


@router.get("/{call_id}", response_model=MessageResponse)
async def call_details(call_id: str) -> MessageResponse:
    return MessageResponse(message=f"Not implemented: {call_id}")
