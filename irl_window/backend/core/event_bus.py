"""
Central async event bus. All modules communicate through here.
Each event has a type string and arbitrary payload.
Subscribers register a callback for specific event types (or '*' for all).
"""

import asyncio
from typing import Callable, Any
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)
        self._queue: asyncio.Queue = asyncio.Queue()
        self._running = False

    def subscribe(self, event_type: str, callback: Callable):
        """Register a callback for an event type. Use '*' to receive all events."""
        self._subscribers[event_type].append(callback)
        logger.debug(f"[EventBus] Subscribed to '{event_type}': {callback.__name__}")

    def unsubscribe(self, event_type: str, callback: Callable):
        self._subscribers[event_type].remove(callback)

    async def publish(self, event_type: str, payload: Any = None):
        """Publish an event. Fires all matching subscribers plus '*' subscribers."""
        event = {"type": event_type, "payload": payload}
        await self._queue.put(event)

    async def start(self):
        """Start the event dispatch loop."""
        self._running = True
        logger.info("[EventBus] Started")
        asyncio.create_task(self._dispatch_loop())

    async def _dispatch_loop(self):
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                await self._dispatch(event)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"[EventBus] Dispatch error: {e}")

    async def _dispatch(self, event: dict):
        event_type = event["type"]
        payload = event["payload"]
        handlers = self._subscribers.get(event_type, []) + self._subscribers.get("*", [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event_type, payload)
                else:
                    handler(event_type, payload)
            except Exception as e:
                logger.error(f"[EventBus] Handler '{handler.__name__}' failed for '{event_type}': {e}")

    def stop(self):
        self._running = False


# Singleton instance
bus = EventBus()
