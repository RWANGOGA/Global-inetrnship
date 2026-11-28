"""Value objects — validated, immutable domain primitives.

Primitive obsession (a bare ``int`` cents value, a raw email string, a stringly
typed date range) lets invalid values travel through the system. These small
immutable types validate once at the boundary and then guarantee their
invariants everywhere else (DDD value objects).
"""
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
_ACADEMIC_SUFFIXES = (".ac.ug", ".edu", ".ac.ke", ".ac.tz")

# Grade label -> minimum CGPA it implies (single source of truth).
GRADE_RANK: dict[str, float] = {
    "CGPA 3.6+": 3.6,
    "CGPA 3.4+": 3.4,
    "CGPA 3.0+": 3.0,
    "Second Class Upper": 3.3,
    "Second Class Lower": 2.7,
}


@dataclass(frozen=True)
class Money:
    """An immutable amount in minor units plus a currency code."""

    amount_cents: int
    currency: str = "USD"

    def __post_init__(self) -> None:
        if isinstance(self.amount_cents, bool) or not isinstance(self.amount_cents, int):
            raise ValueError("amount_cents must be an integer number of minor units")
        if self.amount_cents < 0:
            raise ValueError("amount_cents cannot be negative")
        normalized = self.currency.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError(f"invalid currency code: {self.currency!r}")
        object.__setattr__(self, "currency", normalized)

    @classmethod
    def from_major(cls, amount: float | str | Decimal, currency: str = "USD") -> "Money":
        """Build from a major-unit amount (e.g. 10.00 -> 1000 cents)."""
        try:
            value = Decimal(str(amount))
        except InvalidOperation as exc:
            raise ValueError(f"invalid money amount: {amount!r}") from exc
        cents = int((value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return cls(cents, currency)

    @property
    def major(self) -> Decimal:
        """The amount in major units."""
        return (Decimal(self.amount_cents) / 100).quantize(Decimal("0.01"))

    def add(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self.amount_cents + other.amount_cents, self.currency)

    def subtract(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self.amount_cents - other.amount_cents, self.currency)

    def multiply(self, quantity: int) -> "Money":
        if quantity < 0:
            raise ValueError("quantity cannot be negative")
        return Money(self.amount_cents * quantity, self.currency)

    def _assert_same_currency(self, other: "Money") -> None:
        if self.currency != other.currency:
            raise ValueError(
                f"cannot combine {self.currency} with {other.currency}"
            )


@dataclass(frozen=True)
class Email:
    """A normalized, validated email address."""

    value: str

    def __post_init__(self) -> None:
        normalized = self.value.strip().lower()
        if not _EMAIL_PATTERN.match(normalized):
            raise ValueError(f"invalid email address: {self.value!r}")
        object.__setattr__(self, "value", normalized)

    @property
    def domain(self) -> str:
        return self.value.rsplit("@", 1)[-1]

    @property
    def is_academic(self) -> bool:
        return self.domain.endswith(_ACADEMIC_SUFFIXES)

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class Grade:
    """A known grade band backed by its minimum CGPA."""

    label: str

    def __post_init__(self) -> None:
        if self.label not in GRADE_RANK:
            raise ValueError(f"unknown grade band: {self.label!r}")
        object.__setattr__(self, "label", self.label)

    @property
    def rank(self) -> float:
        return GRADE_RANK[self.label]

    @classmethod
    def rank_of(cls, label: str) -> float:
        """Lenient lookup for stored data: unknown/blank means no requirement."""
        return GRADE_RANK.get(label, 0.0)

    def meets(self, cgpa: float) -> bool:
        return cgpa >= self.rank


@dataclass(frozen=True)
class Period:
    """A half-open-ish billing period with an ordered start and end."""

    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if not isinstance(self.start, datetime) or not isinstance(self.end, datetime):
            raise ValueError("period bounds must be datetimes")
        if self.end <= self.start:
            raise ValueError("period end must be after its start")

    @classmethod
    def for_cycle(cls, start: datetime, cycle: str) -> "Period":
        days = 30 if cycle == "monthly" else 365
        if cycle not in ("monthly", "annually"):
            raise ValueError(f"unknown billing cycle: {cycle!r}")
        return cls(start, start + timedelta(days=days))

    @property
    def days(self) -> int:
        return (self.end - self.start).days

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment < self.end

    def is_over(self, moment: datetime) -> bool:
        return moment >= self.end
