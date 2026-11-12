"""Matching domain service — the product's core claim, now in pure Python.

Framework-free and I/O-free on purpose: the skill taxonomy, extraction and the
explainable weighted scorer are plain functions over domain values. This lets
us unit-test them to parity with the frontend's ``lib/skills.ts`` and later swap
the keyword extractor for a model (the Groq advisor in B3) without touching a
use case or the shapes it returns.

Weights are identical to the frontend: skills 60% / course 25% / grade 15%.
Every term the score is built from is returned so callers can explain "why".
"""
from dataclasses import dataclass, field

from app.domain.entities import Placement


@dataclass(frozen=True)
class Skill:
    name: str
    category: str
    keywords: tuple[str, ...]


SKILLS: list[Skill] = [
    # Design & UX
    Skill("Figma", "Design", ("figma",)),
    Skill("UI Design", "Design", ("ui design", "ui/ux", "interface design", "mockup")),
    Skill("UX Research", "Design", ("ux research", "usability test", "user interview", "user research")),
    Skill("Prototyping", "Design", ("prototype", "prototyping", "wireframe")),
    Skill("Design Systems", "Design", ("design system", "component library", "style guide")),
    Skill("Brand Identity", "Design", ("brand", "branding", "logo", "visual identity")),
    Skill("Typography", "Design", ("typography", "type setting", "font")),
    Skill("Illustrator", "Design", ("illustrator", "photoshop", "adobe", "affinity")),
    # Engineering
    Skill("JavaScript", "Engineering", ("javascript", "js", "es6")),
    Skill("TypeScript", "Engineering", ("typescript", "ts")),
    Skill("React", "Engineering", ("react", "reactjs", "next.js", "nextjs")),
    Skill("Node.js", "Engineering", ("node", "nodejs", "express")),
    Skill("Python", "Engineering", ("python", "django", "flask", "fastapi")),
    Skill("Git", "Engineering", ("git", "github", "version control")),
    Skill("APIs", "Engineering", ("api", "rest", "graphql", "endpoint")),
    Skill("Testing", "Engineering", ("test", "testing", "jest", "unit test", "qa")),
    # Data
    Skill("SQL", "Data", ("sql", "postgres", "mysql", "query", "database")),
    Skill("Excel", "Data", ("excel", "spreadsheet", "google sheets")),
    Skill("Data Cleaning", "Data", ("data cleaning", "data wrangling", "etl", "preprocess")),
    Skill("Dashboards", "Data", ("dashboard", "tableau", "power bi", "looker", "data studio")),
    Skill("Statistics", "Data", ("statistic", "regression", "hypothesis", "r ", "spss", "sampling")),
    Skill("Data Analysis", "Data", ("data analysis", "analytics", "pandas", "numpy", "insight")),
    # Policy, research & programmes
    Skill("Policy Analysis", "Research", ("policy", "legislation", "regulation", "bill")),
    Skill("Research", "Research", ("research", "literature review", "survey", "study")),
    Skill("Report Writing", "Research", ("report writing", "brief", "memo", "documentation", "write-up")),
    Skill("Stakeholder Engagement", "Research", ("stakeholder", "community", "consultation", "coordination")),
    Skill("Monitoring & Evaluation", "Research", ("monitoring", "evaluation", "m&e", "indicator", "logframe", "theory of change")),
    # Health
    Skill("Health Informatics", "Health", ("health informatics", "electronic health", "ehr", "patient data")),
    Skill("Patient Records", "Health", ("patient record", "clinical record", "medical record", "triage")),
    # Communication & brand
    Skill("Copywriting", "Communication", ("copywriting", "content writing", "copy", "blog")),
    Skill("Communication", "Communication", ("communication", "presentation", "public speaking", "storytelling")),
    # Professional
    Skill("Problem Solving", "Professional", ("problem solving", "problem-solving", "analytical thinking")),
    Skill("Teamwork", "Professional", ("teamwork", "collaboration", "team lead", "agile", "scrum")),
]

SKILL_NAMES: list[str] = [s.name for s in SKILLS]

# Curated requirements per placement, keyed by id (same table the frontend uses).
REQUIRED_SKILLS: dict[str, list[str]] = {
    "p1": ["Figma", "UI Design", "Prototyping", "Design Systems"],
    "p2": ["SQL", "Excel", "Data Cleaning", "Dashboards", "Statistics"],
    "p3": ["Python", "JavaScript", "Git", "SQL", "APIs"],
    "p4": ["Health Informatics", "Patient Records", "Data Cleaning"],
    "p5": ["JavaScript", "React", "TypeScript", "Git"],
    "p6": ["Policy Analysis", "Research", "Report Writing"],
    "p7": ["SQL", "Dashboards", "Data Analysis", "Python"],
    "p8": ["Data Analysis", "Report Writing", "Research", "Excel"],
    "p9": ["Stakeholder Engagement", "Report Writing", "Monitoring & Evaluation"],
    "p10": ["UX Research", "Research", "Prototyping", "Statistics"],
    "p11": ["Brand Identity", "Typography", "Illustrator", "Copywriting"],
    "p12": ["Monitoring & Evaluation", "Data Analysis", "Report Writing", "Statistics"],
}

# Proficiency rating -> share of the skill requirement it satisfies.
# Unrated skills count as fully met so profiles saved before confidence levels
# existed keep their previous scores.
CONFIDENCE_WEIGHTS: dict[int, float] = {
    1: 0.5,   # Beginner
    2: 0.75,  # Intermediate
    3: 1.0,   # Advanced
}
DEFAULT_CONFIDENCE_WEIGHT = 1.0

# Grade label -> minimum CGPA it implies (mirrors data/GRADE_RANK).
GRADE_RANK: dict[str, float] = {
    "CGPA 3.6+": 3.6,
    "CGPA 3.4+": 3.4,
    "CGPA 3.0+": 3.0,
    "Second Class Upper": 3.3,
    "Second Class Lower": 2.7,
}

_WORD_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789")


def required_skills_for(placement: Placement) -> list[str]:
    return REQUIRED_SKILLS.get(placement.id, [])


def extract_skills(text: str) -> list[str]:
    """Deterministic, whole-word-ish keyword match over the taxonomy.

    Returns skills in taxonomy order. The leading/trailing padding and the
    non-alphanumeric boundary checks mirror the frontend exactly (so "js" does
    not fire inside a longer word).
    """
    hay = " " + text.lower() + " "
    found: list[str] = []
    for skill in SKILLS:
        for kw in skill.keywords:
            needle = kw.lower()
            idx = hay.find(needle)
            if idx == -1:
                continue
            before = hay[idx - 1] if idx - 1 >= 0 else None
            after_idx = idx + len(needle)
            after = hay[after_idx] if after_idx < len(hay) else None
            left_ok = before is None or before not in _WORD_CHARS
            right_ok = after is None or after not in _WORD_CHARS or needle.endswith(" ")
            if left_ok and right_ok:
                found.append(skill.name)
                break
    return found


@dataclass(frozen=True)
class MatchResult:
    score: int  # 0-100
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    course_fit: bool = False
    grade_fit: bool = False


@dataclass(frozen=True)
class RankedPlacement:
    """A placement paired with how well a given student matches it."""

    placement: Placement
    match: MatchResult


def match_placement(
    placement: Placement,
    student_skills: list[str],
    student_course: str,
    student_cgpa: float,
    student_confidence: dict[str, int] | None = None,
) -> MatchResult:
    required = required_skills_for(placement)
    have = set(student_skills)
    matched = [s for s in required if s in have]
    missing = [s for s in required if s not in have]
    confidence = student_confidence or {}

    if required:
        # A skill's proficiency scales its contribution: Advanced counts in
        # full, Intermediate 75%, Beginner 50%. An unrated skill counts in full
        # so existing profiles keep their original score.
        weighted = sum(
            CONFIDENCE_WEIGHTS.get(confidence.get(skill, 0), DEFAULT_CONFIDENCE_WEIGHT)
            for skill in matched
        )
        coverage = min(1.0, weighted / len(required))
    else:
        coverage = 0.0

    course_fit = student_course in placement.courses
    threshold = GRADE_RANK.get(placement.grade, 0.0)
    grade_fit = student_cgpa >= threshold

    raw = coverage * 0.6 + (0.25 if course_fit else 0.0) + (0.15 if grade_fit else 0.0)
    return MatchResult(
        score=round(raw * 100),
        matched=matched,
        missing=missing,
        course_fit=course_fit,
        grade_fit=grade_fit,
    )
