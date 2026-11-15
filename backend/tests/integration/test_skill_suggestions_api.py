"""HTTP tests for course-based skill suggestions.

The route lives at /skills/suggestions and takes the course as a query
parameter — these tests used to target /profile/skill-suggestions, which no
longer exists, so they were asserting against a 404.
"""

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


def _suggest(client, headers, course: str | None = None) -> dict:
    params = {"course": course} if course else None
    resp = client.get("/skills/suggestions", headers=headers, params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_suggestions_are_derived_from_course_and_requirements(client):
    headers = _login(client, STUDENT)
    _set_profile(client, headers, skills=["Figma"])

    body = _suggest(client, headers, "Design")

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
        for item in _suggest(client, headers, "Computer Science")["items"]
    }
    # Demand orders the list and the endpoint returns the top ten, so a skill
    # counts on several placements is guaranteed a slot. Python and APIs come
    # from a single placement and surface as the student accepts the rest.
    assert {"SQL", "JavaScript", "Git"} <= names
    # Filtering still holds: no placement open to this course asks for branding.
    assert "Brand Identity" not in names


def test_suggestions_are_empty_without_a_course(client):
    headers = _login(client, STUDENT)
    _set_profile(client, headers, course="", skills=[])

    body = _suggest(client, headers)
    assert body == {"total": 0, "items": []}


def test_suggestions_require_a_student_account(client):
    headers = _login(client, JOBSEEKER)
    resp = client.get(
        "/skills/suggestions", headers=headers, params={"course": "Design"}
    )
    assert resp.status_code == 403
