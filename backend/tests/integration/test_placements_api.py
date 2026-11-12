"""End-to-end through the router: HTTP -> service -> repository -> SQLite."""


def test_list_returns_seeded_catalogue(client):
    resp = client.get("/placements")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 12
    assert len(body["items"]) == 12
    # employer is embedded for inline rendering
    p1 = next(i for i in body["items"] if i["id"] == "p1")
    assert p1["org"]["name"] == "Lumen Labs"
    assert p1["org"]["seal"] == "LL"
    # Verify new fields are present
    assert "opportunity_type" in p1
    assert "skills_required" in p1


def test_filter_by_org_type(client):
    body = client.get("/placements", params={"org_type": "Government"}).json()
    assert body["total"] == 4
    assert {i["id"] for i in body["items"]} == {"p2", "p6", "p12", "p14"}
    assert all(i["org"]["type"] == "Government" for i in body["items"])


def test_filter_by_location(client):
    body = client.get("/placements", params={"location": "Kampala"}).json()
    assert body["total"] == 7


def test_filter_by_mode(client):
    body = client.get("/placements", params={"mode": "Remote"}).json()
    assert {i["id"] for i in body["items"]} == {"p1", "p11", "p13"}


def test_keyword_search(client):
    body = client.get("/placements", params={"q": "design"}).json()
    assert {i["id"] for i in body["items"]} == {"p1", "p11", "p13"}


def test_combined_filters(client):
    body = client.get(
        "/placements", params={"org_type": "Company", "mode": "Remote"}
    ).json()
    assert {i["id"] for i in body["items"]} == {"p1", "p11", "p13"}


def test_get_single(client):
    body = client.get("/placements/p3").json()
    assert body["title"] == "Software Engineering Intern"
    assert body["org"]["name"] == "Northwind"


def test_get_missing_is_404(client):
    assert client.get("/placements/nope").status_code == 404


def test_catalog_meta(client):
    resp = client.get("/placements/meta")
    assert resp.status_code == 200
    body = resp.json()
    # Filter values are derived from the placements actually in the database.
    assert "Design" in body["courses"]
    assert body["courses"] == sorted(body["courses"])
    assert set(body["org_types"]) == {"Company", "Government", "NGO", "University"}
    assert "Kampala" in body["locations"]
    # Matching tables come from the domain — the frontend keeps no copies.
    assert body["grade_rules"]["CGPA 3.6+"] == 3.6
    assert body["grade_rules"]["Second Class Upper"] == 3.3
    assert body["required_skills"]["p1"] == [
        "Figma",
        "UI Design",
        "Prototyping",
        "Design Systems",
    ]
    assert any(s["name"] == "React" for s in body["skills"])


def test_meta_route_wins_over_id_capture(client):
    # /placements/meta must not be treated as placement id "meta".
    assert client.get("/placements/meta").status_code == 200
