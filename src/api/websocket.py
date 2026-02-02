"""WebSocket manager for real-time updates."""
from typing import List
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect

from ..utils.logger import log
from ..utils.events import event_bus, Events


class ConnectionManager:
    """Manage WebSocket connections and broadcasting."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and register a new WebSocket connection.

        Args:
            websocket: WebSocket connection to register.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        log.info("WebSocket client connected", total=len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection.

        Args:
            websocket: WebSocket connection to remove.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        log.info("WebSocket client disconnected", total=len(self.active_connections))

    async def broadcast(self, event_type: str, data: dict):
        """Broadcast a message to all connected clients.

        Args:
            event_type: Type of event being broadcast.
            data: Event data to send.
        """
        if not self.active_connections:
            return

        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)


# Global manager instance
manager = ConnectionManager()


async def broadcast_handler(event_type: str, data: dict):
    """Event handler that broadcasts to WebSocket clients.

    Args:
        event_type: Type of event.
        data: Event data.
    """
    await manager.broadcast(event_type, data)


def setup_websocket_events():
    """Subscribe to all events for WebSocket broadcasting."""
    event_types = [
        Events.SIGNAL_RECEIVED,
        Events.SIGNAL_PARSED,
        Events.SIGNAL_VALIDATED,
        Events.SIGNAL_PENDING_CONFIRMATION,
        Events.SIGNAL_EXECUTED,
        Events.SIGNAL_SKIPPED,
        Events.SIGNAL_FAILED,
        Events.TRADE_OPENED,
        Events.TRADE_UPDATED,
        Events.TRADE_CLOSED,
        Events.ACCOUNT_UPDATED,
        Events.ERROR,
        Events.SYSTEM_STATUS,
        Events.PROVISIONING_PROGRESS,
    ]

    for event in event_types:
        event_bus.subscribe(event, broadcast_handler)

    log.debug("WebSocket event handlers registered")


async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint handler.

    Args:
        websocket: Incoming WebSocket connection.
    """
    import json

    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle client messages
            data = await websocket.receive_text()

            # Handle ping/pong for keep-alive
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
            except json.JSONDecodeError:
                pass

            log.debug("WebSocket message received", data=data[:100])
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        log.error("WebSocket error", error=str(e))
        manager.disconnect(websocket)
