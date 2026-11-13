"""B4 service unit tests — real business rules, exercised offline via fakes.

No database, no HTTP: the use cases depend on ports, so we drive them with the
in-memory repository doubles in tests/fakes.py.
"""
import pytest

from app.application.services import ApplicationService, BillingService, SavedService
from app.core.errors import PlacementNotFound, PlacementNotOpen
from app.domain.entities import Placement, Subscription
from tests.fakes import (
    InMemoryApplicationRepository,
    InMemoryPlacementRepository,
    InMemorySavedRepository,
    InMemorySubscriptionRepository,
)


def _placement(pid: str, status: str = "Open") -> Placement:
    return Placement(id=pid, title="t", org_id="o", status=status)


# ---- ApplicationService ----------------------------------------------------


def test_apply_creates_submitted_application():
    placements = InMemoryPlacementRepository([_placement("p1")])
    apps = InMemoryApplicationRepository()
    service = ApplicationService(placements, apps)

    result = service.apply(user_id="u1", placement_id="p1", statement="hi")

    assert result.status == "Submitted"
    assert result.user_id == "u1"
    assert result.placement_id == "p1"
    assert result.statement == "hi"
    assert result.id  # generated
    assert apps.list_for_user("u1") == [result]


def test_apply_is_idempotent_for_same_user_and_placement():
    placements = InMemoryPlacementRepository([_placement("p1")])
    apps = InMemoryApplicationRepository()
    service = ApplicationService(placements, apps)

    first = service.apply(user_id="u1", placement_id="p1")
    second = service.apply(user_id="u1", placement_id="p1")

    assert first.id == second.id
    assert len(apps.list_for_user("u1")) == 1


def test_apply_rejects_unknown_placement():
    placements = InMemoryPlacementRepository([_placement("p1")])
    service = ApplicationService(placements, InMemoryApplicationRepository())

    with pytest.raises(PlacementNotFound):
        service.apply(user_id="u1", placement_id="nope")


def test_apply_rejects_closed_placement():
    placements = InMemoryPlacementRepository([_placement("p1", status="Closed")])
    service = ApplicationService(placements, InMemoryApplicationRepository())

    with pytest.raises(PlacementNotOpen):
        service.apply(user_id="u1", placement_id="p1")


def test_list_for_placement_reflects_applications():
    placements = InMemoryPlacementRepository([_placement("p1"), _placement("p2")])
    apps = InMemoryApplicationRepository()
    service = ApplicationService(placements, apps)

    service.apply(user_id="u1", placement_id="p1")
    service.apply(user_id="u2", placement_id="p1")
    service.apply(user_id="u3", placement_id="p2")

    assert len(service.list_for_placement("p1")) == 2
    assert len(service.list_for_placement("p2")) == 1


# ---- SavedService ----------------------------------------------------------


def test_saved_toggle_returns_state_and_ids():
    repo = InMemorySavedRepository()
    service = SavedService(repo)

    now_saved, ids = service.toggle("u1", "p1")
    assert now_saved is True
    assert ids == ["p1"]

    now_saved, ids = service.toggle("u1", "p3")
    assert now_saved is True
    assert ids == ["p1", "p3"]

    now_saved, ids = service.toggle("u1", "p1")
    assert now_saved is False
    assert ids == ["p3"]
    assert service.is_saved("u1", "p3") is True


# ---- BillingService --------------------------------------------------------


def make_billing_service() -> BillingService:
    from tests.fakes import (
        InMemorySubscriptionRepository,
        InMemoryInvoiceRepository,
        InMemoryTransactionRepository,
        InMemoryStudentUsageRepository,
        FakeGatewayFactory,
    )
    return BillingService(
        session=None,  # Not used in tests with in-memory repos
        subscription_repo=InMemorySubscriptionRepository(),
        invoice_repo=InMemoryInvoiceRepository(),
        transaction_repo=InMemoryTransactionRepository(),
        gateway_factory=FakeGatewayFactory(),
        student_usage_repo=InMemoryStudentUsageRepository(),
    )


def test_billing_defaults_to_free_for_unknown_org():
    service = make_billing_service()
    sub = service.get_subscription("o1")
    assert sub.plan == "Free"
    assert sub.is_premium is False


def test_billing_activate_marks_premium_and_clamps_seats():
    service = make_billing_service()
    sub = service.create_subscription("o1", plan="Pro", billing_cycle="monthly")

    assert sub.plan == "Pro"
    assert sub.is_premium is True
    assert sub.seats == 1
    assert sub.since
    assert service.get_subscription("o1").plan == "Pro"


def test_billing_cancel_sets_cancel_at_period_end():
    service = make_billing_service()
    service.create_subscription("o1", plan="Pro", billing_cycle="monthly")

    sub = service.cancel_subscription("o1")
    # Cancellation is at period end: the paid plan stays active until then
    assert sub.plan == "Pro"
    assert sub.is_premium is True
    assert sub.cancel_at_period_end is True
    assert sub.status == "active"


def test_billing_cancel_free_plan_is_noop():
    service = make_billing_service()
    sub = service.cancel_subscription("o1")
    assert sub.plan == "Free"
    assert sub.cancel_at_period_end is False


# ---- Subscription value object --------------------------------------------


def test_subscription_is_premium_property():
    assert Subscription(org_id="o1", plan="Free").is_premium is False
    assert Subscription(org_id="o1", plan="Enterprise").is_premium is True
