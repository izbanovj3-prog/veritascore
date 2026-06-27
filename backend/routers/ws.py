"""WebSocket endpoint that streams live audit events to the dashboard.

The handler subscribes to the event bus for the given audit. The bus replays any
events that were published before the client connected, then forwards live ones,
so a dashboard that opens the socket a moment after starting the audit still sees
every probe result. The loop ends on the ``complete`` event.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.tasks.event_bus import get_event_bus

router = APIRouter()


@router.websocket("/ws/audit/{audit_id}")
async def ws_audit(websocket: WebSocket, audit_id: str) -> None:
    await websocket.accept()
    bus = get_event_bus()
    try:
        async for event in bus.subscribe(audit_id):
            await websocket.send_json(event)
            if event.get("type") == "complete":
                break
    except WebSocketDisconnect:
        return
    except Exception:
        return
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
