"""Repository adapters translate infrastructure failures into domain errors."""
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import ApplicationLimitExceeded, RepositoryError
from app.domain.entities import User
from app.infrastructure.repositories.identity import SqlAlchemyUserRepository


class _BrokenSession:
    def __init__(self) -> None:
        self.rolled_back = False

    def add(self, _row) -> None:
        pass

    def commit(self) -> None:
        raise SQLAlchemyError("driver exploded")

    def rollback(self) -> None:
        self.rolled_back = True


class _RecordingSession:
    def __init__(self) -> None:
        self.commits = 0
        self.flushes = 0

    def add(self, _row) -> None:
        pass

    def commit(self) -> None:
        self.commits += 1

    def flush(self) -> None:
        self.flushes += 1

    def rollback(self) -> None:
        pass


def _user() -> User:
    return User(id="u1", email="u1@example.com", name="U", role="student", password_hash="h")


def test_sqlalchemy_failure_becomes_repository_error_and_rolls_back():
    session = _BrokenSession()
    repo = SqlAlchemyUserRepository(session)

    with pytest.raises(RepositoryError):
        repo.add(_user())

    assert session.rolled_back is True


def test_autocommit_false_defers_to_flush_for_the_unit_of_work():
    session = _RecordingSession()
    repo = SqlAlchemyUserRepository(session, autocommit=False)

    repo.add(_user())

    assert session.commits == 0
    assert session.flushes == 1


def test_application_limit_error_keeps_structured_fields():
    error = ApplicationLimitExceeded(
        current=31, limit=30, unpaid_invoice="inv_1", reason="Pay your invoice"
    )

    assert error.current == 31
    assert error.limit == 30
    assert error.unpaid_invoice == "inv_1"
    assert str(error) == "Pay your invoice"
