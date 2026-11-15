"""Turn a student's own words into the platform's own skill names.

Why this exists: a skill on a profile only means something if the matcher can
score it, and the matcher scores ``app.domain.matching.SKILLS``. Keyword
extraction alone cannot bridge the gap — "I helped patients check in at the
clinic" contains none of the taxonomy's keywords, so a student writes a good
paragraph and is told we recognised nothing. A model reads the sentence and
names *Patient Records*.

The model is not trusted to invent skills, though. Every name it returns is
resolved through ``canonical_skill_name`` and anything outside the taxonomy is
dropped, so a hallucinated "Kubernetes" can never reach a profile the matcher
will later fail to score.

The deterministic extractor stays as the fallback: same endpoint, same response
shape, whether or not a model is configured. ``source`` tells the client which
one answered so the UI can say so instead of guessing.
"""
from dataclasses import dataclass, field
import json
import re
from typing import Iterable, Optional

from app.application.ports import LLMClient
from app.core.errors import LLMNotConfigured
from app.domain.matching import SKILLS, canonical_skill_name, extract_skills

# The model is given at most this much text; a longer paste adds cost without
# adding evidence, and the profile it feeds is a short paragraph by design.
MAX_TEXT_LENGTH = 4000
# Enough to cover a strong young profile, few enough to stay inside the
# adapter's answer budget (GroqClient asks for 512 tokens) so the JSON is never
# truncated mid-object.
MAX_MATCHES = 8

LEVEL_LABELS = {1: "Beginner", 2: "Intermediate", 3: "Advanced"}


@dataclass(frozen=True)
class SkillMatch:
    """One taxonomy skill the text supports."""

    name: str
    category: str
    level: int  # 0 = no opinion, 1..3 = Beginner..Advanced
    reason: str
    owned: bool = False


@dataclass(frozen=True)
class SkillMatchResult:
    items: list[SkillMatch] = field(default_factory=list)
    source: str = "keywords"  # "ai" | "keywords"
    note: str = ""


_CATEGORY_BY_NAME = {skill.name: skill.category for skill in SKILLS}

_SYSTEM = (
    "You map a student's own words onto a fixed skills list. You never invent a "
    "skill outside that list and you never credit something the student only "
    "says they want to learn."
)


def _taxonomy_block() -> str:
    return "\n".join(
        f"- {skill.name} · {skill.category} · cues: {', '.join(skill.keywords)}"
        for skill in SKILLS
    )


def build_prompt(text: str, owned: Iterable[str] = ()) -> str:
    """The extraction prompt. Public so tests and the advisor can reuse it."""
    owned_list = sorted({name for name in owned if name})
    already = (
        f"\nAlready on their profile — never repeat these: {', '.join(owned_list)}\n"
        if owned_list
        else "\n"
    )
    return (
        f"{_SYSTEM}\n\n"
        f"SKILLS (choose names exactly as written)\n{_taxonomy_block()}\n"
        f"{already}"
        "Read the text for evidence of real work: personal projects, coursework, "
        "employment, volunteering. Credit a skill when the work implies it, even "
        "if the skill is never named — a dashboard built in Excel is Excel and "
        "Dashboards.\n\n"
        "Reply with JSON only, no prose and no code fence:\n"
        '{"skills": [{"name": "<from the list>", "level": 2, "why": "<short reason>"}]}\n'
        "level: 1 beginner, 2 intermediate, 3 advanced, judged by how much "
        "evidence the text gives. At most "
        f"{MAX_MATCHES} entries, strongest first. If the text supports nothing, "
        'reply {"skills": []}.\n\n'
        f'STUDENT TEXT\n"""\n{text}\n"""'
    )


def _as_level(value: object) -> int:
    """Model-supplied proficiency, clamped to the three levels the UI offers."""
    try:
        level = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
    return level if level in LEVEL_LABELS else 0


def parse_matches(
    answer: str, owned: Iterable[str] = ()
) -> list[SkillMatch]:
    """Validate a model answer against the taxonomy.

    Deliberately forgiving about the JSON (models wrap answers in code fences or
    drop the closing brace when they run long) and strict about the skills: an
    entry that does not resolve to a taxonomy name is discarded, not repaired.
    """
    owned_set = set(owned)

    payload: object = []
    stripped = (answer or "").strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", stripped).strip()
    try:
        payload = json.loads(stripped)
    except ValueError:
        # Recover the individual objects of a truncated answer instead of
        # losing every match because the last brace never arrived.
        recovered: list[object] = []
        for chunk in re.findall(r"\{[^{}]*\}", stripped):
            try:
                recovered.append(json.loads(chunk))
            except ValueError:
                continue
        payload = recovered

    if isinstance(payload, dict):
        entries = payload.get("skills") or payload.get("matches") or []
    elif isinstance(payload, list):
        entries = payload
    else:
        entries = []

    found: list[SkillMatch] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name = canonical_skill_name(str(entry.get("name", "")))
        if not name or name in seen or name in owned_set:
            continue
        seen.add(name)
        found.append(
            SkillMatch(
                name=name,
                category=_CATEGORY_BY_NAME.get(name, ""),
                level=_as_level(entry.get("level")),
                reason=" ".join(str(entry.get("why") or "").split())[:120],
                owned=name in owned_set,
            )
        )
        if len(found) >= MAX_MATCHES:
            break
    return found


def keyword_matches(text: str, owned: Iterable[str] = ()) -> list[SkillMatch]:
    """The no-model answer: exactly what the extractor has always returned."""
    owned_set = set(owned)
    return [
        SkillMatch(
            name=name,
            category=_CATEGORY_BY_NAME.get(name, ""),
            level=0,
            reason="",
            owned=name in owned_set,
        )
        for name in extract_skills(text)
        if name not in owned_set
    ][:MAX_MATCHES]


class SkillIntakeService:
    """Suggestion engine behind POST /skills/match."""

    def __init__(self, llm: Optional[LLMClient] = None) -> None:
        self._llm = llm

    def suggest(
        self, text: str, owned: Iterable[str] = ()
    ) -> SkillMatchResult:
        cleaned = " ".join((text or "").split())
        if not cleaned:
            return SkillMatchResult()
        text = cleaned[:MAX_TEXT_LENGTH]
        owned_set = {name for name in owned if name}

        if self._llm is None:
            return SkillMatchResult(
                items=keyword_matches(text, owned_set),
                source="keywords",
                note="AI is not configured on this server, so these came from "
                "keyword search of the skill list.",
            )

        try:
            answer = self._llm.complete(build_prompt(text, owned_set))
        except LLMNotConfigured:
            return SkillMatchResult(
                items=keyword_matches(text, owned_set),
                source="keywords",
                note="AI is not configured on this server, so these came from "
                "keyword search of the skill list.",
            )
        except Exception:
            return SkillMatchResult(
                items=keyword_matches(text, owned_set),
                source="keywords",
                note="The AI service did not answer, so these came from keyword "
                "search of the skill list.",
            )

        matches = parse_matches(answer, owned_set)
        if matches:
            return SkillMatchResult(items=matches, source="ai")

        # The model answered but recognised nothing the taxonomy can score.
        # Fall back rather than report success with an empty list, and say so.
        fallback = keyword_matches(text, owned_set)
        if fallback:
            return SkillMatchResult(
                items=fallback,
                source="keywords",
                note="The AI found no skills it could match, so these came from "
                "keyword search of the skill list.",
            )
        return SkillMatchResult(
            items=[],
            source="ai",
            note="Nothing in that description maps to a skill on this platform yet. "
            "Add a project, a tool or a course and try again.",
        )
