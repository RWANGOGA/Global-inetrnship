"""Jobs Portal catalogue integration tests."""


def test_jobs_catalogue_is_live_and_embeds_organisation(client):
    response = client.get("/jobs")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    job = next(item for item in body["items"] if item["id"] == "j1")
    assert job["title"] == "Junior Product Designer"
    assert job["org"]["name"] == "Lumen Labs"
    assert job["requirements"] == ["Figma", "UI Design", "Portfolio"]


def test_jobs_catalogue_filters_by_search_and_location(client):
    search = client.get("/jobs", params={"q": "data"})
    assert {item["id"] for item in search.json()["items"]} == {"j2"}
    location = client.get("/jobs", params={"location": "Kampala"})
    assert {item["id"] for item in location.json()["items"]} == {"j2", "j4"}


def test_job_detail_returns_404_for_missing_job(client):
    assert client.get("/jobs/j1").status_code == 200
    assert client.get("/jobs/missing").status_code == 404


EMPLOYER = "hiring@lumenlabs.example"
ADMIN = "office@makerere.ac.ug"
STUDENT = "amina@makerere.ac.ug"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    response = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_employer_job_requires_admin_approval_before_public_visibility(client):
    employer = _login(client, EMPLOYER)
    created = client.post(
        "/organization/jobs",
        headers=employer,
        json={
            "title": "QA Engineer",
            "loc": "Kampala",
            "mode": "Hybrid",
            "employment_type": "Full time",
            "closes_at": "2026-12-30",
            "requirements": ["Python", "Testing", "Testing"],
        },
    )
    assert created.status_code == 201, created.text
    job = created.json()
    assert job["review_status"] == "pending_review"
    assert client.get("/jobs", params={"q": "QA Engineer"}).json()["total"] == 0

    admin = _login(client, ADMIN)
    queue = client.get("/admin/jobs/review", headers=admin)
    assert queue.status_code == 200
    assert queue.json()["total"] == 1

    approved = client.patch(
        f"/admin/jobs/{job['id']}/review",
        headers=admin,
        json={"decision": "approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["review_status"] == "approved"
    assert client.get("/jobs", params={"q": "QA Engineer"}).json()["total"] == 1


def test_job_rejection_requires_reason_and_hides_job(client):
    employer = _login(client, EMPLOYER)
    created = client.post(
        "/organization/jobs",
        headers=employer,
        json={"title": "Rejected Role", "closes_at": "2026-12-30"},
    ).json()
    admin = _login(client, ADMIN)
    rejected = client.patch(
        f"/admin/jobs/{created['id']}/review",
        headers=admin,
        json={"decision": "rejected"},
    )
    assert rejected.status_code == 422
    rejected = client.patch(
        f"/admin/jobs/{created['id']}/review",
        headers=admin,
        json={"decision": "rejected", "reason": "Incomplete job description"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "Closed"
    assert client.get("/jobs", params={"q": "Rejected Role"}).json()["total"] == 0


def test_job_posting_is_restricted_to_employers(client):
    student = _login(client, STUDENT)
    response = client.post(
        "/organization/jobs",
        headers=student,
        json={"title": "Forbidden", "closes_at": "2026-12-30"},
    )
    assert response.status_code == 403
