"""Domain event bus and event publishing tests."""
from app.application.event_bus import EventBus
from app.application.services import ApplicationService
from app.domain.entities import Placement
from app.domain.events import ApplicationSubmitted, DomainEvent
from tests.fakes import InMemoryApplicationRepository, InMemoryPlacementRepository


def test_event_bus_dispatches_to_exact_type():
    bus = EventBus()
    seen = []
    bus.subscribe(ApplicationSubmitted, seen.append)

    event = ApplicationSubmitted(application_id="a1", user_id="u1", placement_id="p1")
    bus.publish(event)

    assert seen == [event]
    assert bus.handler_count(ApplicationSubmitted) == 1


def test_event_bus_dispatches_to_base_type_handler():
    bus = EventBus()
    everything: list[DomainEvent] = []
    bus.subscribe(DomainEvent, everything.append)

    event = ApplicationSubmitted(application_id="a1", user_id="u1", placement_id="p1")
    bus.publish(event)

    assert everything == [event]


def test_event_bus_unsubscribe_stops_delivery():
    bus = EventBus()
    seen = []
    bus.subscribe(ApplicationSubmitted, seen.append)
    bus.unsubscribe(ApplicationSubmitted, seen.append)

    bus.publish(ApplicationSubmitted(application_id="a1", user_id="u1", placement_id="p1"))

    assert seen == []
    assert bus.handler_count(ApplicationSubmitted) == 0


def test_apply_publishes_application_submitted():
    bus = EventBus()
    seen = []
    bus.subscribe(ApplicationSubmitted, seen.append)
    service = ApplicationService(
        InMemoryPlacementRepository([Placement(id="p1", title="t", org_id="o")]),
        InMemoryApplicationRepository(),
        events=bus,
    )

    application = service.apply(user_id="u1", placement_id="p1")

    assert len(seen) == 1
    assert seen[0].application_id == application.id
    assert seen[0].user_id == "u1"
    assert seen[0].placement_id == "p1"
