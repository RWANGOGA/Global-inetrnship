"""Pure matcher unit tests — no database, no HTTP. These lock parity with the
frontend's lib/skills.ts: same taxonomy order, same boundary rules, same score.
"""
from app.domain.entities import Placement
from app.domain.matching import (
    extract_skills,
    match_placement,
    required_skills_for,
    _SKILL_LOOKUP,
    suggest_skills_for_course,
)


def _placement(pid, courses, grade, opportunity_type="internship", skills_required=None, remote_ok=None):
    return Placement(
        id=pid,
        title="t",
        org_id="o",
        courses=courses,
        grade=grade,
        opportunity_type=opportunity_type,
        skills_required=skills_required,
        remote_ok=remote_ok,
    )


def test_extract_returns_taxonomy_order():
    got = extract_skills("React TypeScript Node Python Git")
    assert got == ["TypeScript", "React", "Node.js", "Python", "Git"]


def test_extract_isolates_single_skill():
    assert extract_skills("I use Figma daily.") == ["Figma"]


def test_extract_respects_word_boundaries():
    # "json" must not trigger JavaScript ("js"); "personas" must not match "r ".
    assert extract_skills("adjust json personas") == []


def test_extract_requires_exact_keyword():
    # "prototypes" ends the keyword "prototype" with a word char, so it does NOT
    # match — same as the frontend. "prototype" on its own does.
    assert "Prototyping" not in extract_skills("many prototypes here")
    assert "Prototyping" in extract_skills("built a prototype")


def test_match_perfect_is_100():
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    res = match_placement(
        p, ["Figma", "UI Design", "Prototyping", "Design Systems"], "Design", 3.0
    )
    assert res.score == 100
    assert res.matched == ["Figma", "UI Design", "Prototyping", "Design Systems"]
    assert res.missing == []
    assert res.course_fit and res.grade_fit


def test_match_nothing_is_0():
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    res = match_placement(p, [], "Law", 2.0)
    assert res.score == 0
    assert res.matched == []
    assert len(res.missing) == 4
    assert not res.course_fit and not res.grade_fit


def test_match_weighting_is_60_25_15():
    # one of four required skills (25% coverage => 15), course fit (+25),
    # grade fit (+15) => 55.
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    res = match_placement(p, ["Figma"], "Design", 4.0)
    assert res.score == 55
    assert res.matched == ["Figma"]
    assert res.missing == ["UI Design", "Prototyping", "Design Systems"]


def test_confidence_scales_skill_coverage():
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    skills = ["Figma", "UI Design", "Prototyping", "Design Systems"]

    # Unrated skills count in full, preserving the pre-confidence score.
    assert match_placement(p, skills, "Design", 3.0).score == 100
    # Advanced is a full match; Beginner only half a match.
    assert (
        match_placement(p, skills, "Design", 3.0, {s: 3 for s in skills}).score == 100
    )
    beginner = match_placement(
        p, skills, "Design", 3.0, {s: 1 for s in skills}
    )
    assert beginner.score == 70
    assert beginner.matched == skills
    assert beginner.missing == []
    # Intermediate sits between the two extremes.
    assert (
        match_placement(p, skills, "Design", 3.0, {s: 2 for s in skills}).score == 85
    )


def test_confidence_does_not_remove_a_matched_skill():
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    res = match_placement(p, ["Figma"], "Design", 4.0, {"Figma": 1})
    assert res.matched == ["Figma"]
    assert res.missing == ["UI Design", "Prototyping", "Design Systems"]
    # 0.5 of 4 skills = 12.5% coverage -> 7.5 + 25 + 15 = 47.5 -> 48
    assert res.score == 48


def test_suggest_skills_for_course_uses_live_requirements():
    placements = [
        _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+"),
        _placement("p5", ["Design"], "CGPA 3.0+"),
    ]
    suggestions = suggest_skills_for_course(
        placements, "Design", owned={"Figma"}
    )
    names = [s.name for s in suggestions]
    assert "Figma" not in names  # already owned
    assert names[0] == "UI Design"
    assert all(s.demand == 1 for s in suggestions)
    assert all(s.placement_ids for s in suggestions)
    assert suggestions[0].category == "Design"


def test_suggest_skills_for_course_requires_a_course():
    placements = [_placement("p1", ["Design"], "CGPA 3.0+")]
    assert suggest_skills_for_course(placements, "") == []
    assert suggest_skills_for_course(placements, "Law") == []


def test_grade_threshold_from_second_class_upper():
    p = _placement("p2", ["Statistics"], "Second Class Upper")  # threshold 3.3
    assert match_placement(p, [], "Statistics", 3.2).grade_fit is False
    assert match_placement(p, [], "Statistics", 3.3).grade_fit is True


def test_unknown_placement_has_no_required_skills():
    p = _placement("zzz", [], "CGPA 3.0+")
    assert required_skills_for(p) == []
    # no requirements => coverage 0, only course/grade can contribute
    res = match_placement(p, [], "", 0.0)
    assert res.score == 0


def test_required_skills_for_uses_placement_skills_required():
    """New postings use placement.skills_required, not the hardcoded table."""
    p = _placement(
        "new1",
        ["Design"],
        "CGPA 3.0+",
        skills_required=["Figma", "React", "TypeScript"],
    )
    skills = required_skills_for(p)
    assert skills == ["Figma", "React", "TypeScript"]
    # Should not fall back to REQUIRED_SKILLS for p1


def test_required_skills_for_falls_back_to_hardcoded_table():
    """Seeded placements without skills_required fall back to REQUIRED_SKILLS."""
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    skills = required_skills_for(p)
    assert skills == ["Figma", "UI Design", "Prototyping", "Design Systems"]


def test_required_skills_for_normalizes_case():
    """Skill names are normalized to taxonomy casing (case-insensitive)."""
    p = _placement(
        "new2",
        ["Design"],
        "CGPA 3.0+",
        skills_required=["figma", "ui design", "PYTHON"],
    )
    skills = required_skills_for(p)
    assert skills == ["Figma", "UI Design", "Python"]


def test_match_placement_case_insensitive_student_skills():
    """Student skills are matched case-insensitively against taxonomy."""
    p = _placement("p1", ["Design", "Computer Science"], "CGPA 3.0+")
    # Student provides lowercase skills
    res = match_placement(p, ["figma", "ui design"], "Design", 3.5)
    assert "Figma" in res.matched
    assert "UI Design" in res.matched
    assert res.score > 0


def test_gig_weighting_80_skills_20_availability():
    """Gig: 80% skills / 20% availability (remote_ok as proxy)."""
    p = _placement(
        "gig1",
        ["Design"],
        "CGPA 2.5+",
        opportunity_type="gig",
        skills_required=["Figma", "UI Design", "Design Systems"],
        remote_ok=True,
    )
    # Student has 2 of 3 skills = 66.7% coverage
    # 0.667 * 0.8 = 0.533 + 0.2 (availability) = 0.733 -> 73%
    res = match_placement(p, ["Figma", "UI Design"], "Design", 3.0)
    assert res.score == 73
    assert res.availability_fit is True
    assert "Figma" in res.matched
    assert "UI Design" in res.matched
    assert "Design Systems" in res.missing


def test_gig_without_availability():
    """Gig without remote_ok gets no availability bonus."""
    p = _placement(
        "gig2",
        ["Design"],
        "CGPA 2.5+",
        opportunity_type="gig",
        skills_required=["Figma", "UI Design"],
        remote_ok=False,
    )
    # Student has 2 of 2 skills = 100% coverage
    # 1.0 * 0.8 = 0.8 + 0.0 (no availability) = 0.8 -> 80%
    res = match_placement(p, ["Figma", "UI Design"], "Design", 3.0)
    assert res.score == 80
    assert res.availability_fit is False


def test_entry_level_weighting_50_skills_30_course_20_grade():
    """Entry-level: 50% skills / 30% course / 20% grade."""
    p = _placement(
        "el1",
        ["Statistics", "Computer Science"],
        "Second Class Lower",  # threshold 2.7
        opportunity_type="entry_level",
        skills_required=["SQL", "Excel", "Data Cleaning", "Dashboards", "Statistics"],
    )
    # Student has 1 of 5 skills = 20% coverage
    # 0.2 * 0.5 = 0.1 + 0.3 (course fit) + 0.2 (grade fit, 3.5 >= 2.7) = 0.6 -> 60%
    res = match_placement(p, ["SQL"], "Statistics", 3.5)
    assert res.score == 60
    assert res.course_fit is True
    assert res.grade_fit is True


def test_entry_level_missing_course_or_grade():
    """Entry-level without course or grade fit gets lower score."""
    p = _placement(
        "el2",
        ["Statistics"],
        "Second Class Lower",
        opportunity_type="entry_level",
        skills_required=["SQL", "Excel"],
    )
    # Student has 1 of 2 skills = 50% coverage
    # 0.5 * 0.5 = 0.25 + 0.0 (no course fit) + 0.0 (no grade fit, 2.5 < 2.7) = 0.25 -> 25%
    res = match_placement(p, ["SQL"], "Design", 2.5)
    assert res.score == 25
    assert res.course_fit is False
    assert res.grade_fit is False


def test_internship_weighting_unchanged_60_25_15():
    """Internship weighting remains 60% skills / 25% course / 15% grade."""
    p = _placement(
        "p1",
        ["Design", "Computer Science"],
        "CGPA 3.0+",
        opportunity_type="internship",
    )
    # Student has 1 of 4 skills = 25% coverage
    # 0.25 * 0.6 = 0.15 + 0.25 (course fit) + 0.15 (grade fit) = 0.55 -> 55%
    res = match_placement(p, ["Figma"], "Design", 4.0)
    assert res.score == 55


def test_skill_lookup_normalization():
    """_SKILL_LOOKUP maps lowercase to canonical taxonomy names."""
    assert _SKILL_LOOKUP["figma"] == "Figma"
    assert _SKILL_LOOKUP["ui design"] == "UI Design"
    assert _SKILL_LOOKUP["python"] == "Python"
    assert _SKILL_LOOKUP["javascript"] == "JavaScript"
