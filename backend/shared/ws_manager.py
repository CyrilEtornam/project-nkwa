from __future__ import annotations
import json
from datetime import datetime, timezone
from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await self.send_to(websocket, {
            "type": "CONNECTION_ACK",
            "call_id": None,
            "timestamp": _now(),
            "payload": {"message": "Connected to Nkwa dispatch feed"}
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                dead.append(connection)
        for d in dead:
            self.disconnect(d)

    async def send_to(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            self.disconnect(websocket)

    async def push_event(self, event_type: str, call_id: str | None, payload: dict):
        await self.broadcast({
            "type": event_type,
            "call_id": call_id,
            "timestamp": _now(),
            "payload": payload,
        })


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


manager = WebSocketManager()
