"""Application business rules: deadlines, slot capacity, reactivation."""
import pytest

from app.application.services import ApplicationService
from app.core.errors import (
    ApplicationDeadlinePassed,
    ApplicationLimitExceeded,
    NoSlotsAvailable,
)
from app.domain.entities import Application, Placement
from tests.fakes import InMemoryApplicationRepository, InMemoryPlacementRepository


def _placement(**overrides) -> Placement:
    base = dict(id="p1", title="t", org_id="o")
    base.update(overrides)
    return Placement(**base)


def _service(placement: Placement, apps: InMemoryApplicationRepository | None = None):
    return ApplicationService(
        InMemoryPlacementRepository([placement]), apps or InMemoryApplicationRepository()
    )


def test_apply_rejects_past_deadline():
    service = _service(_placement(deadline="2000-01-01"))

    with pytest.raises(ApplicationDeadlinePassed):
        service.apply(user_id="u1", placement_id="p1")


def test_unparsable_deadline_does_not_block_application():
    service = _service(_placement(deadline="rolling admissions"))

    application = service.apply(user_id="u1", placement_id="p1")

    assert application.status == "Submitted"


def test_apply_rejects_when_every_slot_is_accepted():
    apps = InMemoryApplicationRepository()
    apps.add(Application(id="a0", user_id="u0", placement_id="p1", status="Accepted"))
    service = _service(_placement(slots=1), apps)

    with pytest.raises(NoSlotsAvailable):
        service.apply(user_id="u1", placement_id="p1")


def test_slots_count_only_accepted_applications():
    apps = InMemoryApplicationRepository()
    apps.add(Application(id="a0", user_id="u0", placement_id="p1", status="In Review"))
    service = _service(_placement(slots=1), apps)

    application = service.apply(user_id="u1", placement_id="p1")

    assert application.status == "Submitted"


def test_apply_raises_structured_limit_error_when_billing_blocks():
    class BlockingBilling:
        def check_student_application_limit(self, user_id: str) -> dict:
            return {
                "allowed": False,
                "current": 31,
                "limit": 30,
                "reason": "Pay your overage invoice",
                "unpaid_invoice": {"id": "inv_1"},
            }

    service = ApplicationService(
        InMemoryPlacementRepository([_placement()]),
        InMemoryApplicationRepository(),
        billing=BlockingBilling(),
    )

    with pytest.raises(ApplicationLimitExceeded) as excinfo:
        service.apply(user_id="u1", placement_id="p1")

    assert excinfo.value.current == 31
    assert excinfo.value.limit == 30
    assert excinfo.value.unpaid_invoice == {"id": "inv_1"}


def test_withdrawn_application_can_be_reactivated():
    apps = InMemoryApplicationRepository()
    service = _service(_placement(), apps)

    first = service.apply(user_id="u1", placement_id="p1")
    service.withdraw(user_id="u1", application_id=first.id)
    again = service.apply(user_id="u1", placement_id="p1")

    assert again.id == first.id
    assert again.status == "Submitted"
    assert len(apps.list_for_user("u1")) == 1
