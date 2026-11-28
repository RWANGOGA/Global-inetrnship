"""Shared repository plumbing.

Repositories commit by default so every existing call-site keeps its behaviour.
A ``UnitOfWork`` constructs them with ``autocommit=False``: writes are only
flushed, and the unit of work owns the single ``commit``/``rollback`` for the
whole business operation (DDD: one transaction per use case).
"""
from sqlalchemy.orm import Session


class AutocommitMixin:
    """Gives a repository a session plus commit policy."""

    _autocommit: bool = True

    def _init_session(self, session: Session, autocommit: bool) -> None:
        self._session = session
        self._autocommit = autocommit

    def _persist(self) -> None:
        """Commit immediately (default) or defer to the enclosing unit of work."""
        if self._autocommit:
            self._session.commit()
        else:
            self._session.flush()
