"""HTTP tests for the learning-resources catalogue."""

ADMIN = "office@makerere.ac.ug"
STUDENT = "amina@makerere.ac.ug"
PASSWORD = "password123"

RESOURCE = {
    "title": "Python for Everybody",
    "url": "https://www.py4e.com/",
    "provider": "University of Michigan",
    "description": "A practical introduction to Python.",
    "skill": "Python",
    "placement_id": "p3",
    "level": "Beginner",
    "resource_type": "Course",
    "duration": "8 weeks",
}


def _login(client, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_catalogue_starts_empty_and_is_public(client):
    body = client.get("/learning-resources").json()
    assert body == {"total": 0, "items": []}


def test_admin_can_create_and_students_can_read(client):
    created = client.post(
        "/learning-resources", json=RESOURCE, headers=_login(client, ADMIN)
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["title"] == RESOURCE["title"]
    assert body["skill"] == "Python"
    assert body["placement_id"] == "p3"
    assert body["id"]
    assert body["created_at"]

    listed = client.get("/learning-resources").json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == body["id"]


def test_list_filters_by_skill_and_placement(client):
    headers = _login(client, ADMIN)
    client.post("/learning-resources", json=RESOURCE, headers=headers)
    client.post(
        "/learning-resources",
        json={**RESOURCE, "title": "SQL Basics", "url": "https://sql.example.com", "skill": "SQL", "placement_id": ""},
        headers=headers,
    )

    by_skill = client.get("/learning-resources", params={"skill": "Python"}).json()
    assert by_skill["total"] == 1
    assert by_skill["items"][0]["skill"] == "Python"

    by_placement = client.get(
        "/learning-resources", params={"placement_id": "p3"}
    ).json()
    assert by_placement["total"] == 1
    assert by_placement["items"][0]["title"] == RESOURCE["title"]


def test_create_validates_url_skill_and_placement(client):
    headers = _login(client, ADMIN)
    for bad in (
        {**RESOURCE, "title": " "},
        {**RESOURCE, "url": "javascript:alert(1)"},
        {**RESOURCE, "skill": "Underwater Basket Weaving"},
        {**RESOURCE, "placement_id": "missing"},
        {**RESOURCE, "level": "Expert"},
    ):
        resp = client.post("/learning-resources", json=bad, headers=headers)
        assert resp.status_code == 400, (bad, resp.text)


def test_only_admin_can_write(client):
    headers = _login(client, STUDENT)
    assert (
        client.post("/learning-resources", json=RESOURCE, headers=headers).status_code
        == 403
    )
    assert client.put(
        "/learning-resources/anything", json=RESOURCE, headers=headers
    ).status_code == 403
    assert client.delete(
        "/learning-resources/anything", headers=headers
    ).status_code == 403


def test_update_and_delete_resource(client):
    headers = _login(client, ADMIN)
    resource_id = client.post(
        "/learning-resources", json=RESOURCE, headers=headers
    ).json()["id"]

    updated = client.put(
        f"/learning-resources/{resource_id}",
        json={**RESOURCE, "title": "Advanced Python", "level": "Advanced"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Advanced Python"
    assert updated.json()["level"] == "Advanced"

    deleted = client.delete(f"/learning-resources/{resource_id}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/learning-resources").json()["total"] == 0
    assert (
        client.delete(f"/learning-resources/{resource_id}", headers=headers).status_code
        == 404
    )
