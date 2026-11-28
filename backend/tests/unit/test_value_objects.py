"""Value object invariants and matching policy injection."""
import pytest

from app.domain.matching import (
    DEFAULT_MATCHING_POLICY,
    MatchingPolicy,
    ScoringWeights,
    match_placement,
)
from app.domain.entities import Placement
from app.domain.values import Email, Grade, Money, Period
from datetime import datetime, timedelta


# ---- Money ----------------------------------------------------------------


def test_money_validates_and_normalizes_currency():
    money = Money(1000, "usd")
    assert money.amount_cents == 1000
    assert money.currency == "USD"
    assert money.major == 10


def test_money_rejects_negative_or_non_integer_amounts():
    with pytest.raises(ValueError):
        Money(-1)
    with pytest.raises(ValueError):
        Money(10.5)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        Money(100, "US")


def test_money_arithmetic_requires_same_currency():
    assert Money(1000).add(Money(500)) == Money(1500)
    assert Money(1000).subtract(Money(400)) == Money(600)
    assert Money(1000).multiply(3) == Money(3000)
    with pytest.raises(ValueError):
        Money(1000, "USD").add(Money(1000, "EUR"))


def test_money_from_major_rounds_to_cents():
    assert Money.from_major("10.005") == Money(1001)
    assert Money.from_major(9.99).amount_cents == 999


# ---- Email ----------------------------------------------------------------


def test_email_normalizes_and_exposes_domain():
    email = Email("  Amina@Makerere.AC.UG ")
    assert email.value == "amina@makerere.ac.ug"
    assert email.domain == "makerere.ac.ug"
    assert email.is_academic
    assert str(email) == "amina@makerere.ac.ug"


def test_email_rejects_malformed_addresses():
    for invalid in ("", "not-an-email", "a@b", "a b@example.com"):
        with pytest.raises(ValueError):
            Email(invalid)


def test_non_academic_email_is_flagged():
    assert not Email("hiring@lumenlabs.example").is_academic


# ---- Grade / Period -------------------------------------------------------


def test_grade_band_rank_and_meets():
    assert Grade("CGPA 3.4+").rank == 3.4
    assert Grade("CGPA 3.0+").meets(3.1)
    assert not Grade("CGPA 3.6+").meets(3.5)
    with pytest.raises(ValueError):
        Grade("First Class")


def test_unknown_stored_grade_means_no_requirement():
    assert Grade.rank_of("") == 0.0
    assert Grade.rank_of("Unranked") == 0.0


def test_period_validates_order_and_cycle_lengths():
    start = datetime(2026, 1, 1)
    monthly = Period.for_cycle(start, "monthly")
    annual = Period.for_cycle(start, "annually")

    assert monthly.days == 30
    assert annual.days == 365
    assert monthly.contains(start)
    assert monthly.is_over(start + timedelta(days=30))
    with pytest.raises(ValueError):
        Period(start, start)
    with pytest.raises(ValueError):
        Period.for_cycle(start, "weekly")


# ---- Matching policy injection --------------------------------------------


def _placement(**overrides):
    base = dict(
        id="p1",
        title="t",
        org_id="o",
        courses=["Computer Science"],
        grade="CGPA 3.0+",
        opportunity_type="internship",
        skills_required=["Python", "SQL"],
    )
    base.update(overrides)
    return Placement(**base)


def test_default_policy_keeps_the_documented_weights():
    weights = DEFAULT_MATCHING_POLICY.weights_for("internship")
    assert (weights.skills, weights.course, weights.grade) == (0.6, 0.25, 0.15)


def test_custom_policy_changes_the_score_without_touching_the_matcher():
    placement = _placement()
    # Skills-only policy vs the default weighting.
    skills_only = MatchingPolicy(
        weights={"internship": ScoringWeights(skills=1.0), "gig": ScoringWeights(skills=1.0), "entry_level": ScoringWeights(skills=1.0)}
    )

    default_match = match_placement(placement, ["Python", "SQL"], "Computer Science", 3.5)
    strict_match = match_placement(
        placement,
        ["Python", "SQL"],
        "Computer Science",
        3.5,
        policy=skills_only,
    )

    assert default_match.score == 100
    assert strict_match.score == 100
    assert strict_match.course_fit is True

    partial = match_placement(placement, ["Python"], "Computer Science", 3.5, policy=skills_only)
    assert partial.score == 50


def test_scoring_weights_must_sum_to_one():
    with pytest.raises(ValueError):
        ScoringWeights(skills=0.9, course=0.2)
    with pytest.raises(ValueError):
        ScoringWeights(skills=-1.0, course=2.0)
