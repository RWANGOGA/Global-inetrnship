"""In-process domain event dispatcher.

The application layer publishes facts; handlers subscribe to the events they
care about (audit trail, email, analytics). Handlers run synchronously inside
the use case, so a failing handler fails the business operation instead of
silently losing a side effect (DDD domain events, SOLID: OCP).
"""
from collections import defaultdict
from typing import Callable, DefaultDict, Iterable

from app.domain.events import DomainEvent

EventHandler = Callable[[DomainEvent], None]


class EventBus:
    """Registers handlers by event type and dispatches events to them."""

    def __init__(self) -> None:
        self._handlers: DefaultDict[type[DomainEvent], list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: type[DomainEvent], handler: EventHandler) -> None:
        if handler not in self._handlers[event_type]:
            self._handlers[event_type].append(handler)

    def unsubscribe(self, event_type: type[DomainEvent], handler: EventHandler) -> None:
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)

    def publish(self, event: DomainEvent) -> None:
        # Subscribers registered for the concrete type first, then base classes.
        for event_type in type(event).__mro__:
            if not issubclass(event_type, DomainEvent):
                continue
            for handler in list(self._handlers.get(event_type, ())):
                handler(event)

    def publish_all(self, events: Iterable[DomainEvent]) -> None:
        for event in events:
            self.publish(event)

    def handler_count(self, event_type: type[DomainEvent]) -> int:
        return len(self._handlers.get(event_type, ()))


# Default bus used when a service is constructed without an explicit one.
# Empty by default, so publishing is a no-op until a handler subscribes.
default_event_bus = EventBus()
