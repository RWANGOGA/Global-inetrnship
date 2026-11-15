"""Unit tests for bio -> taxonomy skill matching. No HTTP, no network."""
from app.application.skill_intake import (
    MAX_MATCHES,
    SkillIntakeService,
    keyword_matches,
    parse_matches,
)
from app.core.errors import LLMNotConfigured


class _Boom:
    """An LLMClient stand-in that fails the way a network outage does."""

    def complete(self, prompt: str) -> str:
        raise RuntimeError("connection reset")


class _Canned:
    def __init__(self, answer: str) -> None:
        self.answer = answer
        self.prompt = ""

    def complete(self, prompt: str) -> str:
        self.prompt = prompt
        return self.answer


class _Unconfigured:
    def complete(self, prompt: str) -> str:
        raise LLMNotConfigured("no key")


def test_names_are_mapped_onto_the_taxonomy_spelling():
    matches = parse_matches(
        '{"skills": [{"name": "next.js", "level": 2}, {"name": "power bi"}]}'
    )
    assert [m.name for m in matches] == ["React", "Dashboards"]
    assert matches[0].category == "Engineering"


def test_skills_outside_the_taxonomy_are_dropped_not_kept_as_written():
    matches = parse_matches(
        '{"skills": [{"name": "Kubernetes"}, {"name": "Figma"}, {"name": "Quantum Bee"}]}'
    )
    assert [m.name for m in matches] == ["Figma"]


def test_duplicates_and_owned_skills_are_removed():
    matches = parse_matches(
        '{"skills": [{"name": "Figma"}, {"name": "figma"}, {"name": "SQL"}]}',
        owned=["SQL"],
    )
    assert [m.name for m in matches] == ["Figma"]


def test_proficiency_is_clamped_to_the_three_levels_the_profile_offers():
    matches = parse_matches(
        '{"skills": [{"name": "Figma", "level": 9}, {"name": "SQL", "level": "2"}]}'
    )
    assert [m.level for m in matches] == [0, 2]


def test_a_fenced_answer_is_still_read():
    matches = parse_matches('```json\n{"skills": [{"name": "Git"}]}\n```')
    assert [m.name for m in matches] == ["Git"]


def test_a_truncated_answer_keeps_what_did_arrive():
    # The adapter caps the answer length, so a long reply can lose its tail.
    truncated = '{"skills": [{"name": "Figma"}, {"name": "SQL"}, {"name": "Da'
    assert [m.name for m in parse_matches(truncated)] == ["Figma", "SQL"]


def test_the_answer_budget_is_capped():
    entries = ", ".join(
        f'{{"name": "{name}"}}'
        for name in ["Figma", "SQL", "React", "Python", "Git", "Excel", "Typing", "Communication"]
    )
    assert len(parse_matches(f'{{"skills": [{entries}]}}')) <= MAX_MATCHES


def test_keyword_fallback_reports_no_proficiency():
    # The fallback is the existing deterministic extractor, unchanged: it matches
    # the keywords the catalogue already lists, so the plural form misses.
    items = keyword_matches("wrote SQL and built an Excel dashboard")
    assert {item.name for item in items} >= {"SQL", "Excel", "Dashboards"}
    assert all(item.level == 0 and item.reason == "" for item in items)


def test_service_uses_the_model_when_it_answers():
    llm = _Canned('{"skills": [{"name": "Figma", "level": 3, "why": "club site"}]}')
    result = SkillIntakeService(llm).suggest("I redesigned the club site in Figma.")
    assert result.source == "ai"
    assert result.note == ""
    assert [(item.name, item.level, item.reason) for item in result.items] == [
        ("Figma", 3, "club site")
    ]
    assert "I redesigned the club site in Figma." in llm.prompt


def test_service_falls_back_when_the_model_is_unconfigured():
    result = SkillIntakeService(_Unconfigured()).suggest("I query SQL every week.")
    assert result.source == "keywords"
    assert "not configured" in result.note
    assert [item.name for item in result.items] == ["SQL"]


def test_service_falls_back_when_the_model_errors():
    result = SkillIntakeService(_Boom()).suggest("I query SQL every week.")
    assert result.source == "keywords"
    assert "did not answer" in result.note
    assert [item.name for item in result.items] == ["SQL"]


def test_service_falls_back_when_the_model_names_nothing_valid():
    # A model answering with skills this catalogue cannot score is not a result,
    # so the extractor gets a second opinion rather than an empty profile.
    result = SkillIntakeService(_Canned('{"skills": [{"name": "Kubernetes"}]}')).suggest(
        "I write SQL every day."
    )
    assert result.source == "keywords"
    assert "keyword search" in result.note
    assert [item.name for item in result.items] == ["SQL"]


def test_service_says_so_plainly_when_nothing_matches():
    result = SkillIntakeService(_Canned('{"skills": []}')).suggest(
        "I like long walks and old films."
    )
    assert result.items == []
    assert result.source == "ai"
    assert "Nothing in that description" in result.note


def test_empty_text_asks_the_model_nothing():
    llm = _Canned('{"skills": [{"name": "Figma"}]}')
    result = SkillIntakeService(llm).suggest("   \n  ")
    assert result.items == []
    assert llm.prompt == ""
