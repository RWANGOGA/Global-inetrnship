"""Update commands constrain which fields a caller may change (ISP)."""
from app.domain.commands import (
    ChatGroupUpdate,
    JobUpdate,
    PlacementUpdate,
    UserUpdate,
)


def test_only_declared_fields_are_accepted():
    command = PlacementUpdate.from_dict(
        {"title": "New", "slots": 2, "not_a_real_column": "ignored"}
    )
    assert command.changed_fields() == {"title": "New", "slots": 2}


def test_none_means_leave_unchanged():
    command = PlacementUpdate(title="Changed", grade=None)
    assert command.changed_fields() == {"title": "Changed"}


def test_false_and_empty_collections_are_real_values():
    command = JobUpdate(status="Closed", requirements=[])
    assert command.changed_fields() == {"status": "Closed", "requirements": []}

    user = UserUpdate(deleted=False)
    assert user.changed_fields() == {"deleted": False}


def test_from_dict_on_every_command_filters_unknown_keys():
    for command_type in (PlacementUpdate, JobUpdate, UserUpdate, ChatGroupUpdate):
        value = command_type.from_dict({"unknown": 1, "name": "x"})
        assert value.changed_fields() == ({"name": "x"} if hasattr(value, "name") else {})
