"""End-to-end tests for POST /match and POST /skills/extract."""


def test_match_ranks_best_fit_first(client):
    body = client.post(
        "/match",
        json={
            "skills": ["Python", "JavaScript", "Git", "SQL", "APIs"],
            "course": "Computer Science",
            "cgpa": 3.5,
        },
    ).json()
    assert body["total"] == 12
    top = body["items"][0]
    assert top["placement"]["id"] == "p3"  # required skills exactly these
    assert top["match"]["score"] == 100
    assert top["match"]["missing"] == []


def test_match_applies_skill_confidence(client):
    body = client.post(
        "/match",
        json={
            "skills": ["Python", "JavaScript", "Git", "SQL", "APIs"],
            "skills_confidence": {
                "Python": 1,
                "JavaScript": 1,
                "Git": 1,
                "SQL": 1,
                "APIs": 1,
            },
            "course": "Computer Science",
            "cgpa": 3.5,
        },
    ).json()
    top = body["items"][0]
    assert top["placement"]["id"] == "p3"
    # 50% weighted skill coverage (0.5 * 60) + course 25 + grade 15 = 70.
    assert top["match"]["score"] == 70
    assert top["match"]["matched"] == ["Python", "JavaScript", "Git", "SQL", "APIs"]


def test_match_score_never_exceeds_100_and_is_sorted(client):
    items = client.post(
        "/match", json={"skills": ["SQL", "Python"], "course": "Statistics", "cgpa": 3.7}
    ).json()["items"]
    scores = [i["match"]["score"] for i in items]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 100 for s in scores)


def test_match_respects_limit(client):
    body = client.post("/match", json={"skills": [], "course": "", "cgpa": 0, "limit": 3}).json()
    assert body["total"] == 3
    assert len(body["items"]) == 3


def test_match_applies_filters(client):
    items = client.post(
        "/match", json={"skills": [], "course": "", "cgpa": 0, "mode": "Remote"}
    ).json()["items"]
    assert {i["placement"]["id"] for i in items} == {"p1", "p11"}
    assert all(i["placement"]["mode"] == "Remote" for i in items)


def test_match_embeds_employer(client):
    top = client.post(
        "/match", json={"skills": ["Figma", "UI Design", "Prototyping", "Design Systems"],
                        "course": "Design", "cgpa": 3.0}
    ).json()["items"][0]
    assert top["placement"]["id"] == "p1"
    assert top["match"]["score"] == 100
    assert top["placement"]["org"]["name"] == "Lumen Labs"


def test_extract_endpoint(client):
    body = client.post("/skills/extract", json={"text": "React and TypeScript with Git"}).json()
    assert "React" in body["skills"]
    assert "TypeScript" in body["skills"]
    assert "Git" in body["skills"]
