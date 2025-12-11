"""Event bus for internal communication between components."""
from typing import Callable, Dict, List, Any
import asyncio
from .logger import log


class EventBus:
    """Simple async event bus for decoupled communication."""

    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        """Subscribe a handler to an event type.

        Args:
            event_type: The event type to subscribe to.
            handler: Async or sync callable to handle the event.
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        log.debug("Subscribed to event", event_name=event_type, handler=handler.__name__)

    def unsubscribe(self, event_type: str, handler: Callable):
        """Unsubscribe a handler from an event type.

        Args:
            event_type: The event type to unsubscribe from.
            handler: The handler to remove.
        """
        if event_type in self._subscribers:
            self._subscribers[event_type] = [
                h for h in self._subscribers[event_type] if h != handler
            ]

    async def emit(self, event_type: str, data: Dict[str, Any]):
        """Emit an event to all subscribers.

        Args:
            event_type: The event type being emitted.
            data: Event data to pass to handlers.
        """
        handlers = self._subscribers.get(event_type, [])

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event_type, data)
                else:
                    handler(event_type, data)
            except Exception as e:
                log.error(
                    "Event handler error",
                    event_name=event_type,
                    handler=handler.__name__,
                    error=str(e)
                )


class Events:
    """Event type constants."""

    # Signal events
    SIGNAL_RECEIVED = "signal.received"
    SIGNAL_PARSED = "signal.parsed"
    SIGNAL_VALIDATED = "signal.validated"
    SIGNAL_SKIPPED = "signal.skipped"
    SIGNAL_FAILED = "signal.failed"

    # Trade events
    TRADE_OPENED = "trade.opened"
    TRADE_UPDATED = "trade.updated"
    TRADE_CLOSED = "trade.closed"

    # System events
    ACCOUNT_UPDATED = "account.updated"
    ERROR = "error"
    SYSTEM_STATUS = "system.status"


# Global event bus instance
event_bus = EventBus()
