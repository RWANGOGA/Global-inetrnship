"""Organization internship publishing workflow integration tests."""

STUDENT = "amina@makerere.ac.ug"
EMPLOYER = "hiring@lumenlabs.example"
ADMIN = "office@makerere.ac.ug"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_employer_can_submit_internship_for_review(client):
    employer = _login(client, EMPLOYER)
    payload = {
        "title": "Cybersecurity Internship",
        "courses": ["Computer Science", "Information Technology"],
        "grade": "CGPA 3.2+",
        "loc": "Kampala",
        "mode": "Hybrid",
        "duration": "4 months",
        "stipend": "UGX 900,000 / month",
        "slots": 3,
        "about": "Work with the security operations team.",
        "duties": ["Review alerts", "Support incident drills"],
        "requirements": ["Linux basics", "Networking fundamentals"],
        "docs": ["Transcript", "Student ID"],
        "testimonial": False,
        "published_at": "2026-11-07",
        "closes_at": "2026-11-20",
        "starts_at": "2026-12-01",
    }
    created = client.post("/organization/internships", json=payload, headers=employer)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["title"] == "Cybersecurity Internship"
    assert body["review_status"] == "pending_review"
    assert body["requirements"] == ["Linux basics", "Networking fundamentals"]
    assert body["courses"] == ["Computer Science", "Information Technology"]
    assert body["closes_at"] == "2026-11-20"
    assert body["starts_at"] == "2026-12-01"

    listed = client.get("/organization/internships", headers=employer)
    assert listed.status_code == 200
    assert any(item["id"] == body["id"] for item in listed.json()["items"])


def test_public_catalog_hides_pending_review_internships(client):
    employer = _login(client, EMPLOYER)
    created = client.post(
        "/organization/internships",
        json={
            "title": "Pending Visibility Internship",
            "courses": ["Computer Science"],
            "grade": "CGPA 3.0+",
            "loc": "Kampala",
            "mode": "On-site",
            "duration": "3 months",
            "stipend": "UGX 700,000 / month",
            "slots": 2,
            "about": "Hidden until approved",
            "duties": [],
            "requirements": ["Python"],
            "docs": [],
            "testimonial": False,
            "published_at": "2026-11-07",
            "closes_at": "2026-11-25",
            "starts_at": "2026-12-03",
        },
        headers=employer,
    )
    assert created.status_code == 201
    pending_id = created.json()["id"]
    public_list = client.get("/placements")
    assert public_list.status_code == 200
    assert all(item["id"] != pending_id for item in public_list.json()["items"])


def test_non_employer_cannot_manage_organization_internships(client):
    student = _login(client, STUDENT)
    admin = _login(client, ADMIN)
    payload = {
        "title": "Forbidden Internship",
        "courses": ["Computer Science"],
        "closes_at": "2026-11-20",
        "starts_at": "2026-12-01",
    }
    assert (
        client.post("/organization/internships", json=payload, headers=student).status_code
        == 403
    )
    assert (
        client.get("/organization/internships", headers=student).status_code
        == 403
    )
    assert (
        client.post("/organization/internships", json=payload, headers=admin).status_code
        == 403
    )


def test_internship_date_validation_rejects_invalid_order(client):
    employer = _login(client, EMPLOYER)
    bad = client.post(
        "/organization/internships",
        json={
            "title": "Invalid dates",
            "courses": ["Computer Science"],
            "published_at": "2026-11-20",
            "closes_at": "2026-11-10",
            "starts_at": "2026-11-15",
        },
        headers=employer,
    )
    assert bad.status_code == 422
    assert "Closing date must be after publication date" in bad.json()["detail"]
