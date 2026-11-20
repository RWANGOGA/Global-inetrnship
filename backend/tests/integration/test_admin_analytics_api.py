"""Admin hiring-funnel analytics.

Every assertion below is derived from rows inserted into the test database, so
the endpoint cannot drift back to placeholder figures. Applications are scoped
with ``org_type=AnalyticsTestCo`` (a synthetic type) to isolate them from the
seeded catalogue.
"""

from datetime import date, datetime, time, timedelta

from app.infrastructure.orm import (
    ApplicationORM,
    JobApplicationORM,
    JobORM,
    OrganisationORM,
    PlacementORM,
)

ADMIN = "office@makerere.ac.ug"
STUDENT = "amina@makerere.ac.ug"
PASSWORD = "password123"
ORG_TYPE = "AnalyticsTestCo"


def _login(client, email: str) -> dict:
    response = client.post(
        "/auth/login", json={"username": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _iso(days_ago: int, hour: int = 9) -> str:
    day = date.today() - timedelta(days=days_ago)
    return datetime.combine(day, time(hour, 0)).isoformat()


def _seed_analytics_rows(session_factory) -> dict:
    """One org, two placements (internship + gig), one job and seven apps."""
    session = session_factory()
    try:
        session.add(
            OrganisationORM(
                id="oa",
                name="Analytics Co",
                type=ORG_TYPE,
                sector="Tech",
                loc="Kampala",
            )
        )
        session.add_all(
            [
                PlacementORM(
                    id="pa",
                    title="Backend Intern",
                    org_id="oa",
                    opportunity_type="internship",
                    review_status="approved",
                    published_at=_iso(20),
                    skills_required=["Python", "SQL"],
                ),
                PlacementORM(
                    id="pb",
                    title="Website Gig",
                    org_id="oa",
                    opportunity_type="gig",
                    review_status="approved",
                    published_at=_iso(20),
                    skills_required=["Figma"],
                ),
                # Legacy row: no published_at, still a live catalogue entry.
                PlacementORM(
                    id="pc-legacy",
                    title="Legacy Intern",
                    org_id="oa",
                    opportunity_type="internship",
                    review_status="approved",
                    published_at="",
                ),
                JobORM(
                    id="ja",
                    title="Data Engineer",
                    org_id="oa",
                    review_status="approved",
                    published_at=_iso(20),
                    requirements=["Python"],
                ),
            ]
        )
        session.add_all(
            [
                # Created today, after 00:00 — proves the end date is inclusive.
                ApplicationORM(
                    id="a1",
                    user_id="u1",
                    placement_id="pa",
                    status="Submitted",
                    created_at=_iso(0),
                    updated_at=_iso(0),
                ),
                ApplicationORM(
                    id="a2",
                    user_id="u2",
                    placement_id="pa",
                    status="In Review",
                    created_at=_iso(1),
                    updated_at=_iso(1),
                ),
                ApplicationORM(
                    id="a3",
                    user_id="u3",
                    placement_id="pa",
                    status="Accepted",
                    created_at=_iso(10),
                    updated_at=_iso(4),  # 6 days to hire
                ),
                ApplicationORM(
                    id="a4",
                    user_id="u4",
                    placement_id="pb",
                    status="Rejected",
                    created_at=_iso(5),
                    updated_at=_iso(4),
                ),
                ApplicationORM(
                    id="a5",
                    user_id="u5",
                    placement_id="pb",
                    status="Accepted",
                    created_at=_iso(3),
                    updated_at=_iso(1),  # 2 days to hire
                ),
                # Shortlisted but still Submitted: counts as reviewed.
                ApplicationORM(
                    id="a6",
                    user_id="u6",
                    placement_id="pa",
                    status="Submitted",
                    created_at=_iso(2),
                    updated_at=_iso(2),
                    shortlisted=True,
                ),
                JobApplicationORM(
                    id="ja1",
                    user_id="u7",
                    job_id="ja",
                    status="Submitted",
                    created_at=_iso(2),
                    updated_at=_iso(2),
                ),
            ]
        )
        session.commit()
    finally:
        session.close()
    return {"today": date.today().isoformat(), "start": _iso(30)[:10]}


def _fetch(client, headers, **overrides):
    params = {
        "period_start": _iso(30)[:10],
        "period_end": date.today().isoformat(),
        "org_type": ORG_TYPE,
    }
    params.update(overrides)
    return client.get("/admin/analytics/hiring-funnel", params=params, headers=headers)


# ---- Shape of the real numbers ------------------------------------------------


def test_analytics_counts_match_the_database(client, session_factory):
    _seed_analytics_rows(session_factory)
    response = _fetch(client, _login(client, ADMIN))

    assert response.status_code == 200, response.text
    body = response.json()

    # 2 placements + 1 legacy placement + 1 job; one organisation.
    assert body["total_postings"] == 4
    assert body["total_organizations"] == 1
    # 6 internship applications + 1 job application.
    assert body["total_applications"] == 7

    assert body["applications_by_type"] == {"internship": 4, "gig": 2, "job": 1}
    assert body["applications_by_status"] == {
        "Submitted": 3,
        "Accepted": 2,
        "In Review": 1,
        "Rejected": 1,
    }


def test_funnel_is_cumulative_and_never_exceeds_the_stage_before(client, session_factory):
    _seed_analytics_rows(session_factory)
    body = _fetch(client, _login(client, ADMIN)).json()

    stages = {stage["stage"]: stage for stage in body["overall_stages"]}
    assert stages["Applications"]["count"] == 7
    # In Review + Accepted + Rejected + one shortlisted Submitted.
    assert stages["Reviewed"]["count"] == 5
    assert stages["Accepted"]["count"] == 2

    assert stages["Applications"]["conversion_rate"] == 100.0
    assert stages["Reviewed"]["conversion_rate"] == 71.43
    assert stages["Accepted"]["conversion_rate"] == 40.0
    # Monotonic funnel: each stage <= the previous one.
    counts = [stages[name]["count"] for name in ("Applications", "Reviewed", "Accepted")]
    assert counts == sorted(counts, reverse=True)


def test_time_to_hire_uses_real_application_timestamps(client, session_factory):
    _seed_analytics_rows(session_factory)
    body = _fetch(client, _login(client, ADMIN)).json()

    # Accepted apps took 6 and 2 days.
    assert body["avg_time_to_hire_days"] == 4.0


def test_top_organisations_and_skills_come_from_postings(client, session_factory):
    _seed_analytics_rows(session_factory)
    body = _fetch(client, _login(client, ADMIN)).json()

    assert body["top_organizations_by_hires"] == [
        {"organization_id": "oa", "organization_name": "Analytics Co", "hires": 2}
    ]
    skills = {row["skill"]: row["count"] for row in body["top_skills_platform"]}
    # Python is required by one placement and one job; SQL/Figma by one posting.
    assert skills["Python"] == 2
    assert skills["SQL"] == 1
    assert skills["Figma"] == 1

    assert body["conversion_by_org_type"] == {ORG_TYPE: 28.57}
    assert body["conversion_by_opportunity_type"] == {
        "gig": 50.0,
        "internship": 25.0,
        "job": 0.0,
    }


def test_end_date_includes_the_whole_day(client, session_factory):
    _seed_analytics_rows(session_factory)
    today = date.today().isoformat()
    body = _fetch(
        client,
        _login(client, ADMIN),
        period_start=today,
        period_end=today,
    ).json()

    # a1 was created today at 09:00, so a same-day window must include it.
    assert body["total_applications"] == 1
    assert body["applications_by_status"] == {"Submitted": 1}


def test_gig_filter_only_counts_gig_postings_and_applications(client, session_factory):
    _seed_analytics_rows(session_factory)
    body = _fetch(
        client, _login(client, ADMIN), opportunity_type="gig"
    ).json()

    assert body["total_postings"] == 1
    assert body["total_applications"] == 2
    assert body["applications_by_type"] == {"gig": 2}
    assert body["conversion_by_opportunity_type"] == {"gig": 50.0}


def test_unknown_org_type_returns_empty_not_everything(client, session_factory):
    _seed_analytics_rows(session_factory)
    body = _fetch(client, _login(client, ADMIN), org_type="NoSuchType").json()

    assert body["total_postings"] == 0
    assert body["total_organizations"] == 0
    assert body["total_applications"] == 0
    assert body["applications_by_type"] == {}
    assert body["overall_stages"][0]["count"] == 0


def test_application_to_a_deleted_posting_is_still_counted(client, session_factory):
    _seed_analytics_rows(session_factory)
    session = session_factory()
    try:
        session.add(
            ApplicationORM(
                id="a-orphan",
                user_id="u8",
                placement_id="posting-that-was-deleted",
                status="In Review",
                created_at=_iso(1),
                updated_at=_iso(1),
            )
        )
        session.commit()
    finally:
        session.close()

    # No org/type filter: the application must not disappear just because its
    # posting is gone, or the platform totals would understate real activity.
    body = _fetch(client, _login(client, ADMIN), org_type="").json()

    assert body["total_applications"] == 8
    assert body["applications_by_type"]["unknown"] == 1
    stages = {stage["stage"]: stage["count"] for stage in body["overall_stages"]}
    assert stages["Applications"] == 8
    assert stages["Reviewed"] == 6


# ---- Validation and access control -------------------------------------------


def test_invalid_dates_return_422(client):
    headers = _login(client, ADMIN)
    bad_date = client.get(
        "/admin/analytics/hiring-funnel",
        params={"period_start": "2026-13-40", "period_end": "2026-11-20"},
        headers=headers,
    )
    assert bad_date.status_code == 422

    reversed_range = client.get(
        "/admin/analytics/hiring-funnel",
        params={"period_start": "2026-11-20", "period_end": "2026-11-01"},
        headers=headers,
    )
    assert reversed_range.status_code == 422


def test_analytics_requires_an_admin(client):
    student = _login(client, STUDENT)
    assert _fetch(client, student).status_code == 403
    assert client.get(
        "/admin/analytics/hiring-funnel",
        params={"period_start": "2026-01-01", "period_end": "2026-01-31"},
    ).status_code == 401
