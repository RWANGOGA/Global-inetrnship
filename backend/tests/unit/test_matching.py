"""Pure matcher unit tests — no database, no HTTP. These lock parity with the
frontend's lib/skills.ts: same taxonomy order, same boundary rules, same score.
"""
from app.domain.entities import Placement
from app.domain.matching import (
    extract_skills,
    match_placement,
    required_skills_for,
)


def _placement(pid, courses, grade):
    return Placement(id=pid, title="t", org_id="o", courses=courses, grade=grade)


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
