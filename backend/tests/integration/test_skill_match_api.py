"""POST /skills/match — the model reads the bio, the taxonomy has the last word.

The LLM port is overridden so nothing here reaches Groq. The unconfigured case
is exercised for real: conftest blanks GROQ_MODEL, so the production adapter
raises LLMNotConfigured and the endpoint must fall back rather than 503.
"""
from fastapi.testclient import TestClient

from app.presentation.deps import get_llm_client
from tests.fakes import FakeLLM

STUDENT = "amina@makerere.ac.ug"
PASSWORD = "password123"

BIO = (
    "I am a third-year student. I redesigned our club website in Figma and "
    "helped the campus clinic move patient records onto a laptop."
)


def _login(client, email: str = STUDENT) -> dict:
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


def test_match_returns_only_skills_the_platform_can_score(app):
    # "Kubernetes" is a real skill but not one this catalogue scores; it must be
    # dropped, or the student ends up with a skill that changes no match score.
    fake = FakeLLM(
        canned=(
            '{"skills": [{"name": "Figma", "level": 3, "why": "redesigned club site"},'
            ' {"name": "Patient Records", "level": 2, "why": "clinic filing"},'
            ' {"name": "Kubernetes", "level": 3, "why": "invented"}]}'
        )
    )
    app.state.sub_app.dependency_overrides[get_llm_client] = lambda: fake
    with TestClient(app) as c:
        headers = _login(c)
        _set_profile(c, headers)
        body = c.post("/skills/match", json={"text": BIO}, headers=headers).json()

    assert body["source"] == "ai"
    assert [item["name"] for item in body["items"]] == ["Figma", "Patient Records"]
    assert body["total"] == 2
    assert body["items"][0]["category"] == "Design"
    assert body["items"][0]["level"] == 3
    assert body["items"][1]["reason"] == "clinic filing"
    # The prompt has to carry the taxonomy and the student's words, otherwise the
    # model is guessing.
    assert "Patient Records" in fake.last_prompt
    assert "campus clinic" in fake.last_prompt


def test_match_falls_back_to_keywords_when_the_model_is_unconfigured(client):
    headers = _login(client)
    _set_profile(client, headers, skills=[])

    body = client.post(
        "/skills/match",
        json={"text": "Built a dashboard in Excel and wrote SQL queries."},
        headers=headers,
    ).json()

    assert body["source"] == "keywords"
    assert "AI is not configured" in body["note"]
    names = [item["name"] for item in body["items"]]
    assert {"Excel", "SQL", "Dashboards"} <= set(names)
    # No model means no proficiency opinion; the UI must not invent one.
    assert all(item["level"] == 0 for item in body["items"])


def test_match_never_offers_a_skill_the_student_already_has(app):
    fake = FakeLLM(
        canned=(
            '{"skills": [{"name": "Figma", "level": 3},'
            ' {"name": "Prototyping", "level": 2}]}'
        )
    )
    app.state.sub_app.dependency_overrides[get_llm_client] = lambda: fake
    with TestClient(app) as c:
        headers = _login(c)
        _set_profile(c, headers, skills=["Figma"])

        body = c.post("/skills/match", json={"text": BIO}, headers=headers).json()
        # The client's in-session skills count too, because the saved profile
        # lags behind an optimistic add in the dashboard.
        body2 = c.post(
            "/skills/match",
            json={"text": BIO, "skills": ["Prototyping"]},
            headers=headers,
        ).json()

    assert [item["name"] for item in body["items"]] == ["Prototyping"]
    assert body2["items"] == []
    # Both owned skills are named to the model so it does not spend its answer
    # budget re-suggesting them.
    instructions = fake.last_prompt.split("STUDENT TEXT")[0]
    assert "Already on their profile" in instructions
    assert "Figma" in instructions and "Prototyping" in instructions


def test_match_requires_authentication(client):
    resp = client.post("/skills/match", json={"text": BIO})
    assert resp.status_code == 401


def test_match_rejects_empty_text(client):
    headers = _login(client)
    assert client.post("/skills/match", json={"text": ""}, headers=headers).status_code == 422
