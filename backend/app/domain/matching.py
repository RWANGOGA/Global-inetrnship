"""Matching domain service — the product's core claim, now in pure Python.

Framework-free and I/O-free on purpose: the skill taxonomy, extraction and the
explainable weighted scorer are plain functions over domain values. This lets
us unit-test them to parity with the frontend's ``lib/skills.ts`` and later swap
the keyword extractor for a model (the Groq advisor in B3) without touching a
use case or the shapes it returns.

Weights vary by opportunity_type:
- internship: skills 60% / course 25% / grade 15%
- gig: skills 80% / availability 20% (remote_ok as proxy)
- entry_level: skills 50% / course 30% / grade 20%
Every term the score is built from is returned so callers can explain "why".
"""
from dataclasses import dataclass, field

from app.domain.entities import Placement
from app.domain.values import GRADE_RANK, Grade


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

# Normalized lookup for case-insensitive matching
_SKILL_LOOKUP: dict[str, str] = {s.name.lower(): s.name for s in SKILLS}

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


_WORD_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789")


def required_skills_for(placement: Placement) -> list[str]:
    """Get required skills for a placement.
    
    Uses placement.skills_required if set (new postings), otherwise falls back
    to the hard-coded REQUIRED_SKILLS table for seeded placements.
    Normalizes skill names to match the taxonomy (case-insensitive).
    """
    # Use placement's skills_required if available, else fall back to REQUIRED_SKILLS
    skills = placement.skills_required or REQUIRED_SKILLS.get(placement.id, [])
    # Normalize to taxonomy names (case-insensitive)
    normalized = []
    for skill in skills:
        normalized.append(_SKILL_LOOKUP.get(skill.lower(), skill))
    return normalized


@dataclass(frozen=True)
class SkillSuggestion:
    """A skill the student's course is likely to need, with live demand."""

    name: str
    category: str
    demand: int
    placement_ids: list[str]


def suggest_skills_for_course(
    placements: list[Placement],
    course: str,
    owned: set[str] | None = None,
) -> list[SkillSuggestion]:
    """Suggest missing skills required by placements open to ``course``.

    Suggestions are derived from the live catalogue and the curated
    ``REQUIRED_SKILLS`` table rather than a hardcoded course→skill map. They are
    ordered by how many eligible placements need the skill, then taxonomy order.
    """
    if not course:
        return []
    already = owned or set()
    hits: dict[str, list[str]] = {}
    for placement in placements:
        if course not in placement.courses:
            continue
        for skill in required_skills_for(placement):
            if skill in already:
                continue
            hits.setdefault(skill, []).append(placement.id)

    order = {skill.name: index for index, skill in enumerate(SKILLS)}
    categories = {skill.name: skill.category for skill in SKILLS}
    suggestions = [
        SkillSuggestion(
            name=name,
            category=categories[name],
            demand=len(placement_ids),
            placement_ids=placement_ids,
        )
        for name, placement_ids in hits.items()
        if name in order
    ]
    suggestions.sort(key=lambda s: (-s.demand, order[s.name], s.name))
    return suggestions


def canonical_skill_name(name: str) -> str | None:
    """Resolve a written skill to the taxonomy's own spelling, or ``None``.

    Accepts the taxonomy name in any casing and also the aliases a model or a
    course handout tends to produce ("reactjs", "Power BI", "Next.js"), because
    the names arriving here are often not written the way we spell them. This is
    the single gate that keeps a suggested skill scoreable: if it does not
    resolve, it cannot contribute to a match and must not reach a profile.

    When several skills' keywords fit, the longest one wins. "next.js" is both
    React's alias and a JavaScript file extension, so plain taxonomy order would
    answer JavaScript — the longer, more specific keyword is the right answer.
    """
    cleaned = " ".join((name or "").split())
    if not cleaned:
        return None
    hit = _SKILL_LOOKUP.get(cleaned.lower())
    if hit:
        return hit

    hay = " " + cleaned.lower() + " "
    best_name: str | None = None
    best_length = 0
    for skill in SKILLS:
        for keyword in skill.keywords:
            needle = keyword.lower()
            start = hay.find(needle)
            while start != -1:
                left_ok = hay[start - 1] not in _WORD_CHARS
                after_idx = start + len(needle)
                after = hay[after_idx] if after_idx < len(hay) else None
                right_ok = (
                    after is None or after not in _WORD_CHARS or needle.endswith(" ")
                )
                if left_ok and right_ok:
                    if len(needle) > best_length:
                        best_length = len(needle)
                        best_name = skill.name
                    break
                start = hay.find(needle, start + 1)
    return best_name


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
    availability_fit: bool = False


@dataclass(frozen=True)
class ScoringWeights:
    """How each fit signal contributes to the 0-100 match score."""

    skills: float
    course: float = 0.0
    grade: float = 0.0
    availability: float = 0.0

    def __post_init__(self) -> None:
        values = (self.skills, self.course, self.grade, self.availability)
        if any(v < 0 for v in values):
            raise ValueError("scoring weights cannot be negative")
        if abs(sum(values) - 1.0) > 1e-9:
            raise ValueError(f"scoring weights must sum to 1.0, got {sum(values)}")

    def score(
        self,
        *,
        coverage: float,
        course_fit: bool,
        grade_fit: bool,
        availability_fit: bool,
    ) -> float:
        return (
            coverage * self.skills
            + (self.course if course_fit else 0.0)
            + (self.grade if grade_fit else 0.0)
            + (self.availability if availability_fit else 0.0)
        )


DEFAULT_WEIGHTS: dict[str, ScoringWeights] = {
    # Internship: skills 60% / course 25% / grade 15%
    "internship": ScoringWeights(skills=0.6, course=0.25, grade=0.15),
    # Gig: skills 80% / availability 20% (remote_ok as proxy)
    "gig": ScoringWeights(skills=0.8, availability=0.2),
    # Entry-level: skills 50% / course 30% / grade 20%
    "entry_level": ScoringWeights(skills=0.5, course=0.3, grade=0.2),
}


@dataclass(frozen=True)
class MatchingPolicy:
    """Injected strategy: per-opportunity weights for the matcher.

    Swapping the policy (e.g. a skills-first policy for a hiring sprint) changes
    ranking without editing the scoring function (SOLID: OCP/DIP).
    """

    weights: dict[str, ScoringWeights] = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    default_opportunity_type: str = "internship"

    def weights_for(self, opportunity_type: str) -> ScoringWeights:
        return self.weights.get(
            opportunity_type,
            self.weights[self.default_opportunity_type],
        )


DEFAULT_MATCHING_POLICY = MatchingPolicy()


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
    policy: "MatchingPolicy | None" = None,
) -> MatchResult:
    required = required_skills_for(placement)
    # Normalize student skills to taxonomy names for case-insensitive matching
    have = set(_SKILL_LOOKUP.get(s.lower(), s) for s in student_skills)
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
    threshold = Grade.rank_of(placement.grade)
    grade_fit = student_cgpa >= threshold

    # Weight by opportunity_type using the injected policy.
    policy = policy or DEFAULT_MATCHING_POLICY
    opp_type = placement.opportunity_type or "internship"
    availability_fit = opp_type == "gig" and placement.remote_ok is True
    raw = policy.weights_for(opp_type).score(
        coverage=coverage,
        course_fit=course_fit,
        grade_fit=grade_fit,
        availability_fit=availability_fit,
    )

    return MatchResult(
        score=round(raw * 100),
        matched=matched,
        missing=missing,
        course_fit=course_fit,
        grade_fit=grade_fit,
        availability_fit=opp_type == "gig" and placement.remote_ok is True,
    )


# =============================================================================
# ADVANCED MATCHING ENTITIES (AI-Driven Career Matching)
# =============================================================================

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ProficiencyLevel(Enum):
    BEGINNER = 1
    INTERMEDIATE = 2
    ADVANCED = 3


class CareerStage(Enum):
    STUDENT = "student"
    EARLY_CAREER = "early_career"
    MID_CAREER = "mid_career"
    SENIOR = "senior"
    LEAD_PRINCIPAL = "lead_principal"


@dataclass(frozen=True)
class SkillCompetency:
    """Rich skill representation with proficiency and evidence."""

    skill_id: str
    canonical_name: str
    aliases: list[str] = field(default_factory=list)
    category: str = ""
    proficiency: ProficiencyLevel = ProficiencyLevel.BEGINNER
    confidence_score: float = 0.0
    evidence: list[str] = field(default_factory=list)
    years_experience: float = 0.0
    last_used: Optional[str] = None
    learning_velocity: float = 0.0


@dataclass(frozen=True)
class SoftSkillProfile:
    """AI-extracted soft skills from unstructured text."""

    leadership: float = 0.0
    communication: float = 0.0
    teamwork: float = 0.0
    adaptability: float = 0.0
    problem_solving: float = 0.0
    initiative: float = 0.0
    organization: float = 0.0
    cultural_awareness: float = 0.0


@dataclass(frozen=True)
class CareerTrajectory:
    """Student/employee career path analysis."""

    current_stage: CareerStage = CareerStage.STUDENT
    target_roles: list[str] = field(default_factory=list)
    career_aspirations: list[str] = field(default_factory=list)
    domain_interests: list[str] = field(default_factory=list)
    learning_goals: list[str] = field(default_factory=list)
    work_preferences: str = ""
    values_signals: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CulturalValues:
    """Extracted cultural values and work style preferences."""

    autonomy_preference: float = 0.5
    mission_alignment: float = 0.5
    collaboration_style: str = "hybrid"
    risk_tolerance: float = 0.5
    learning_appetite: float = 0.5
    work_life_integration: float = 0.5
    feedback_receptivity: float = 0.5
    diversity_value: float = 0.5


@dataclass(frozen=True)
class AdvancedStudentProfile:
    """Complete enriched student profile for AI-driven matching."""

    user_id: str
    skills: list[SkillCompetency] = field(default_factory=list)
    career_trajectory: CareerTrajectory = field(default_factory=CareerTrajectory)
    soft_skills: SoftSkillProfile = field(default_factory=SoftSkillProfile)
    cultural_values: CulturalValues = field(default_factory=CulturalValues)
    profile_embedding: list[float] = field(default_factory=list)
    skills_embedding: list[float] = field(default_factory=list)
    bio_embedding: list[float] = field(default_factory=list)
    course: str = ""
    university: str = ""
    cgpa: float = 0.0
    graduation_year: int = 0
    location_preferences: list[str] = field(default_factory=list)
    remote_ok: bool = False
    availability: str = "full-time"


@dataclass(frozen=True)
class AdvancedPlacementProfile:
    """Complete enriched placement/job profile for AI-driven matching."""

    placement_id: str
    required_skills: list[SkillCompetency] = field(default_factory=list)
    preferred_skills: list[SkillCompetency] = field(default_factory=list)
    experience_level: CareerStage = CareerStage.STUDENT
    required_soft_skills: dict[str, float] = field(default_factory=dict)
    cultural_values: CulturalValues = field(default_factory=CulturalValues)
    team_composition: dict[str, int] = field(default_factory=dict)
    description_embedding: list[float] = field(default_factory=list)
    requirements_embedding: list[float] = field(default_factory=list)
    culture_embedding: list[float] = field(default_factory=list)
    org_id: str = ""
    org_type: str = ""
    org_size: str = ""
    location: str = ""
    remote_policy: str = ""
    compensation_band: tuple[float, float] = (0.0, 0.0)
    urgency: str = "this_month"
    hiring_manager_id: Optional[str] = None
