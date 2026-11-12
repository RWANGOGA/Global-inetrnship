"""HTTP tests for course-based skill suggestions."""

STUDENT = "amina@makerere.ac.ug"
JOBSEEKER = "brian@example.com"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _set_profile(client, headers, **overrides):
    payload = {
        "course": "Design",
        "year": "Year 3",
        "cgpa": 3.7,
        "university": "Makerere University",
        "skills": [],
    }
    payload.update(overrides)
    resp = client.put("/profile", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_suggestions_are_derived_from_course_and_requirements(client):
    headers = _login(client, STUDENT)
    _set_profile(client, headers, skills=["Figma"])

    body = client.get("/profile/skill-suggestions", headers=headers).json()

    names = [item["name"] for item in body["items"]]
    assert body["total"] == len(names)
    assert "Figma" not in names
    assert "UI Design" in names
    # Every suggestion carries its live demand and the placements it unlocks.
    assert all(item["demand"] >= 1 for item in body["items"])
    assert all(item["placement_ids"] for item in body["items"])
    assert body["items"][0]["demand"] >= body["items"][-1]["demand"]


def test_suggestions_change_with_the_students_course(client):
    headers = _login(client, STUDENT)
    _set_profile(client, headers, course="Computer Science", skills=[])

    names = {
        item["name"]
        for item in client.get("/profile/skill-suggestions", headers=headers).json()[
            "items"
        ]
    }
    assert {"Python", "JavaScript", "Git", "SQL", "APIs"} <= names


def test_suggestions_are_empty_without_a_course(client):
    headers = _login(client, STUDENT)
    _set_profile(client, headers, course="", skills=[])

    body = client.get("/profile/skill-suggestions", headers=headers).json()
    assert body == {"total": 0, "items": []}


def test_suggestions_require_a_student_account(client):
    headers = _login(client, JOBSEEKER)
    assert client.get("/profile/skill-suggestions", headers=headers).status_code == 403
