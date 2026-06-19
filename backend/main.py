from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect

from routers.auth import router as auth_router
from routers.calls import router as calls_router
from routers.contacts import router as contacts_router
from routers.first_aid import router as first_aid_router
from routers.sos import router as sos_router
from routers.users import router as users_router
from shared.ws_manager import manager

app = FastAPI(title="Nkwa Backend API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(contacts_router, prefix="/api/v1/contacts", tags=["contacts"])
app.include_router(calls_router, prefix="/api/v1/calls", tags=["calls"])
app.include_router(sos_router, prefix="/api/v1", tags=["sos"])
app.include_router(first_aid_router, prefix="/api/v1/first-aid", tags=["first-aid"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "PING":
                await manager.send_to(websocket, {
                    "type": "PONG",
                    "call_id": None,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "payload": {}
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
