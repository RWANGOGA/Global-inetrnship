"""Administrator internship approval and rejection integration tests."""

EMPLOYER = "hiring@lumenlabs.example"
ADMIN = "office@makerere.ac.ug"
STUDENT = "amina@makerere.ac.ug"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    response = client.post(
        "/auth/login", json={"username": email, "password": PASSWORD}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _submit(client, headers, title="Review me"):
    return client.post(
        "/organization/internships",
        headers=headers,
        json={
            "title": title,
            "courses": ["Computer Science"],
            "published_at": "2026-11-08",
            "closes_at": "2026-11-20",
            "starts_at": "2026-12-01",
        },
    )


def test_admin_can_approve_pending_internship_and_publish_it(client):
    employer = _login(client, EMPLOYER)
    admin = _login(client, ADMIN)
    created = _submit(client, employer)
    assert created.status_code == 201
    internship_id = created.json()["id"]

    queue = client.get("/admin/internships/review", headers=admin)
    assert queue.status_code == 200
    assert any(item["id"] == internship_id for item in queue.json()["items"])

    approved = client.patch(
        f"/admin/internships/{internship_id}/review",
        headers=admin,
        json={"decision": "approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["review_status"] == "approved"
    assert approved.json()["status"] == "Open"
    assert all(
        item["id"] != internship_id
        for item in client.get("/admin/internships/review", headers=admin).json()["items"]
    )
    assert any(
        item["id"] == internship_id
        for item in client.get("/placements").json()["items"]
    )


def test_admin_rejection_requires_reason_and_hides_internship(client):
    employer = _login(client, EMPLOYER)
    admin = _login(client, ADMIN)
    student = _login(client, STUDENT)
    created = _submit(client, employer, title="Reject me")
    internship_id = created.json()["id"]

    assert client.get(f"/placements/{internship_id}").status_code == 404
    assert (
        client.post(
            "/applications",
            headers=student,
            json={"placement_id": internship_id},
        ).status_code
        == 409
    )

    missing_reason = client.patch(
        f"/admin/internships/{internship_id}/review",
        headers=admin,
        json={"decision": "rejected"},
    )
    assert missing_reason.status_code == 422

    rejected = client.patch(
        f"/admin/internships/{internship_id}/review",
        headers=admin,
        json={"decision": "rejected", "reason": "Add a named supervisor and clearer duties."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["review_status"] == "rejected"
    assert rejected.json()["review_reason"] == "Add a named supervisor and clearer duties."
    assert all(
        item["id"] != internship_id
        for item in client.get("/placements").json()["items"]
    )


def test_only_admin_can_access_review_queue(client):
    employer = _login(client, EMPLOYER)
    student = _login(client, STUDENT)
    assert client.get("/admin/internships/review", headers=employer).status_code == 403
    assert client.get("/admin/internships/review", headers=student).status_code == 403
