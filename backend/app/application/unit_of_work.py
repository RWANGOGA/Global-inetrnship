"""Unit of Work port.

A use case that touches more than one aggregate (e.g. settle an invoice and
activate a subscription) opens one unit of work, uses the repositories it
needs, and commits once. Repositories handed out by a unit of work never
commit on their own — the unit of work does (DDD aggregate/transaction
boundary, SOLID: DIP).
"""
from abc import ABC, abstractmethod
from types import TracebackType
from typing import Optional, Type


class UnitOfWork(ABC):
    """Coordinates one business transaction across repositories."""

    @abstractmethod
    def commit(self) -> None:
        """Persist every change made through this unit of work."""

    @abstractmethod
    def rollback(self) -> None:
        """Discard every change made through this unit of work."""

    @abstractmethod
    def close(self) -> None:
        """Release the underlying session/connection."""

    def __enter__(self) -> "UnitOfWork":
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc: Optional[BaseException],
        tb: Optional[TracebackType],
    ) -> None:
        try:
            if exc_type is not None:
                self.rollback()
        finally:
            self.close()
