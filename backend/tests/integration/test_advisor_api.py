"""Advisor HTTP tests — override the LLM port so nothing hits Groq."""
from fastapi.testclient import TestClient

from app.presentation.deps import get_llm_client
from tests.fakes import FakeLLM

STUDENT = "amina@makerere.ac.ug"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": "password123"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_advisor_returns_llm_reply_grounded_by_matcher(app):
    fake = FakeLLM(canned="Focus on Figma and target Lumen Labs.")
    app.state.sub_app.dependency_overrides[get_llm_client] = lambda: fake
    with TestClient(app) as c:
        h = _login(c, STUDENT)
        resp = c.post(
            "/advisor",
            json={"message": "what next?", "skills": ["Figma"], "course": "Design", "cgpa": 3.5},
            headers=h,
        )
        assert resp.status_code == 200
        assert resp.json()["reply"] == fake.canned
        assert fake.calls == 1
        assert "Top matches" in fake.last_prompt
        assert "Product Design Intern" in fake.last_prompt


def test_advisor_503_when_groq_not_configured(client):
    h = _login(client, STUDENT)
    resp = client.post("/advisor", json={"message": "hi"}, headers=h)
    assert resp.status_code == 503
    assert "GROQ" in resp.json()["detail"].upper()
