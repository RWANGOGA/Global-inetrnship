"""Advisor unit tests — pure prompt composition + service wiring, no DB, no LLM."""
from app.application.advisor import AdvisorService, compose_prompt
from app.domain.entities import Organisation, Placement
from app.domain.matching import MatchResult, RankedPlacement
from tests.fakes import FakeLLM


def _ranked():
    org = Organisation("o4", "Lumen Labs", "Company", "Design", "Remote", "LL")
    p = Placement("p1", "Product Design Intern", "o4", courses=["Design"], grade="CGPA 3.0+", org=org)
    m = MatchResult(
        score=55,
        matched=["Figma"],
        missing=["UI Design", "Prototyping", "Design Systems"],
        course_fit=True,
        grade_fit=True,
    )
    return [RankedPlacement(p, m)]


def test_compose_prompt_is_grounded_in_matches():
    pr = compose_prompt("What should I do?", ["Figma"], "Design", 3.5, _ranked())
    assert "Product Design Intern @ Lumen Labs" in pr
    assert "55%" in pr
    assert "missing: UI Design" in pr
    assert "What should I do?" in pr


def test_compose_prompt_handles_empty_profile():
    pr = compose_prompt("hi", [], "", 0.0, _ranked())
    assert "none listed" in pr


class _StubMatching:
    def __init__(self, ranked):
        self._ranked = ranked
        self.kwargs = None

    def rank(self, **kw):
        self.kwargs = kw
        return self._ranked


def test_advisor_service_builds_prompt_and_calls_llm_once():
    stub = _StubMatching(_ranked())
    fake = FakeLLM(canned="Target p1")
    svc = AdvisorService(stub, fake)
    out = svc.answer(message="next step?", skills=["Figma"], course="Design", cgpa=3.5)
    assert out == "Target p1"
    assert fake.calls == 1
    assert "next step?" in fake.last_prompt
    assert stub.kwargs["student_skills"] == ["Figma"]
