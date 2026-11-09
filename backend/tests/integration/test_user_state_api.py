"""B4 HTTP tests — saved, applications and subscription against the isolated
seeded SQLite database via the mounted sub-app.

R1d: these endpoints now derive the actor from the Bearer token, so every test
logs in as a real demo account and asserts that identity comes from the token
(not from a user_id/org_id the client sends).
"""

STUDENT = "amina@makerere.ac.ug"
EMPLOYER = "hiring@lumenlabs.example"  # linked to org o4
ADMIN = "office@makerere.ac.ug"
JOBSEEKER = "brian@example.com"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _user_id(client, email: str) -> str:
    return client.get("/auth/me", headers=_login(client, email)).json()["id"]


# ---- Auth enforcement ------------------------------------------------------


def test_user_state_requires_a_token(client):
    assert client.get("/saved").status_code == 401
    assert client.post("/saved/toggle", json={"placement_id": "p1"}).status_code == 401
    assert client.post("/applications", json={"placement_id": "p1"}).status_code == 401
    assert client.get("/applications").status_code == 401
    assert client.get("/billing/subscriptions/current").status_code == 401


# ---- Saved -----------------------------------------------------------------


def test_toggle_saved_then_list(client):
    h = _login(client, STUDENT)
    resp = client.post("/saved/toggle", json={"placement_id": "p1"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["saved_ids"] == ["p1"]

    assert client.get("/saved", headers=h).json()["saved_ids"] == ["p1"]

    # toggling again removes it
    resp = client.post("/saved/toggle", json={"placement_id": "p1"}, headers=h)
    assert resp.json()["saved"] is False
    assert resp.json()["saved_ids"] == []


def test_saved_is_per_account(client):
    a = _login(client, STUDENT)
    b = _login(client, JOBSEEKER)
    client.post("/saved/toggle", json={"placement_id": "p1"}, headers=a)
    # a bookmark by one account is invisible to another — identity is the token
    assert client.get("/saved", headers=b).json()["saved_ids"] == []


# ---- Applications ----------------------------------------------------------


def test_apply_persists_and_is_idempotent(client):
    h = _login(client, STUDENT)
    uid = _user_id(client, STUDENT)
    resp = client.post(
        "/applications", json={"placement_id": "p1", "statement": "keen"}, headers=h
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["status"] == "Submitted"
    assert created["placement_id"] == "p1"
    # the applicant id is the token's user, whatever the client tried to send
    assert created["user_id"] == uid

    # applying again returns the same row (idempotent)
    resp2 = client.post("/applications", json={"placement_id": "p1"}, headers=h)
    assert resp2.status_code == 201
    assert resp2.json()["id"] == created["id"]

    assert client.get("/applications", headers=h).json()["total"] == 1


def test_ignored_body_user_id_cannot_spoof_another_account(client):
    h = _login(client, STUDENT)
    uid = _user_id(client, STUDENT)
    resp = client.post(
        "/applications", json={"placement_id": "p2", "user_id": "someone-else"}, headers=h
    )
    assert resp.status_code == 201
    assert resp.json()["user_id"] == uid


def test_applicants_requires_hiring_role(client):
    student = _login(client, STUDENT)
    employer = _login(client, EMPLOYER)
    # student can't see who applied
    assert client.get("/placements/p1/applicants", headers=student).status_code == 403
    # employer (hiring side) can
    assert client.get("/placements/p1/applicants", headers=employer).status_code == 200


def test_apply_unknown_placement_is_404(client):
    h = _login(client, STUDENT)
    resp = client.post("/applications", json={"placement_id": "does-not-exist"}, headers=h)
    assert resp.status_code == 404


def test_student_can_track_and_withdraw_own_application(client):
    h = _login(client, STUDENT)
    created = client.post(
        "/applications", json={"placement_id": "p2"}, headers=h
    ).json()
    tracked = client.get("/applications", headers=h).json()
    assert tracked["total"] == 1
    assert tracked["items"][0]["id"] == created["id"]

    withdrawn = client.post(
        f"/applications/{created['id']}/withdraw", headers=h
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "Withdrawn"


def test_student_cannot_withdraw_another_account_application(client):
    owner = _login(client, STUDENT)
    created = client.post(
        "/applications", json={"placement_id": "p3"}, headers=owner
    ).json()
    other = _login(client, JOBSEEKER)
    response = client.post(
        f"/applications/{created['id']}/withdraw", headers=other
    )
    assert response.status_code == 403


# ---- Student profile -------------------------------------------------------


def test_student_profile_is_empty_until_saved_then_persists(client):
    h = _login(client, STUDENT)
    empty = client.get("/profile", headers=h)
    assert empty.status_code == 200
    assert empty.json()["course"] == ""
    assert empty.json()["skills"] == []

    updated = client.put(
        "/profile",
        json={
            "course": " Design ",
            "year": "Year 3",
            "cgpa": 3.7,
            "university": "Makerere University",
            "skills": ["Figma", "Figma", " UI Design "],
        },
        headers=h,
    )
    assert updated.status_code == 200
    assert updated.json()["course"] == "Design"
    assert updated.json()["skills"] == ["Figma", "UI Design"]
    assert client.get("/profile", headers=h).json()["university"] == "Makerere University"


def test_non_student_cannot_access_student_profile(client):
    h = _login(client, JOBSEEKER)
    assert client.get("/profile", headers=h).status_code == 403
    assert client.put("/profile", json={}, headers=h).status_code == 403


# ---- Application pack ------------------------------------------------------


def test_student_application_pack_is_live_and_persists(client):
    h = _login(client, STUDENT)
    initial = client.get("/application-pack", headers=h)
    assert initial.status_code == 200
    assert initial.json()["statement"] == ""

    updated = client.put(
        "/application-pack",
        json={
            "statement": "  I build accessible digital products.  ",
            "targets": [" Product design ", "Product design", "Research"],
        },
        headers=h,
    )
    assert updated.status_code == 200
    assert updated.json()["statement"] == "I build accessible digital products."
    assert updated.json()["targets"] == ["Product design", "Research"]

    persisted = client.get("/application-pack", headers=h)
    assert persisted.json()["statement"] == "I build accessible digital products."
    assert persisted.json()["targets"] == ["Product design", "Research"]


def test_non_student_cannot_access_application_pack(client):
    h = _login(client, JOBSEEKER)
    assert client.get("/application-pack", headers=h).status_code == 403
    assert client.put("/application-pack", json={}, headers=h).status_code == 403


# ---- Resume -----------------------------------------------------------------


def test_student_can_upload_replace_and_download_resume(client):
    h = _login(client, STUDENT)
    first = client.put(
        "/resume",
        files={"file": ("resume.pdf", b"first resume", "application/pdf")},
        headers=h,
    )
    assert first.status_code == 200
    assert first.json()["filename"] == "resume.pdf"
    assert first.json()["size_bytes"] == len(b"first resume")

    replacement = client.put(
        "/resume",
        files={
            "file": (
                "resume.docx",
                b"replacement resume",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=h,
    )
    assert replacement.status_code == 200
    assert replacement.json()["filename"] == "resume.docx"
    downloaded = client.get("/resume/download", headers=h)
    assert downloaded.status_code == 200
    assert downloaded.content == b"replacement resume"
    assert client.get("/resume", headers=h).json()["filename"] == "resume.docx"


def test_resume_rejects_unsupported_files_and_non_students(client):
    student = _login(client, STUDENT)
    bad = client.put(
        "/resume",
        files={"file": ("resume.txt", b"not a resume", "text/plain")},
        headers=student,
    )
    assert bad.status_code == 415
    jobseeker = _login(client, JOBSEEKER)
    assert client.get("/resume", headers=jobseeker).status_code == 403


# ---- Student documents -----------------------------------------------------


def test_student_can_upload_replace_and_list_documents(client):
    h = _login(client, STUDENT)
    empty = client.get("/documents", headers=h)
    assert empty.status_code == 200
    assert empty.json()["items"] == []

    uploaded = client.put(
        "/documents/transcript",
        files={"file": ("transcript.pdf", b"transcript", "application/pdf")},
        headers=h,
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["document_type"] == "transcript"
    assert uploaded.json()["status"] == "pending"

    replacement = client.put(
        "/documents/transcript",
        files={"file": ("new-transcript.pdf", b"new", "application/pdf")},
        headers=h,
    )
    assert replacement.status_code == 200
    assert replacement.json()["id"] == uploaded.json()["id"]
    assert replacement.json()["filename"] == "new-transcript.pdf"
    assert client.get("/documents", headers=h).json()["items"][0]["size_bytes"] == 3


def test_documents_enforce_type_and_student_authorization(client):
    student = _login(client, STUDENT)
    unsupported = client.put(
        "/documents/passport",
        files={"file": ("passport.pdf", b"passport", "application/pdf")},
        headers=student,
    )
    assert unsupported.status_code == 400
    bad_file = client.put(
        "/documents/portfolio",
        files={"file": ("portfolio.txt", b"portfolio", "text/plain")},
        headers=student,
    )
    assert bad_file.status_code == 415
    assert client.get("/documents", headers=_login(client, JOBSEEKER)).status_code == 403


# ---- Subscription ----------------------------------------------------------


def test_subscription_derives_org_from_the_employer_token(client):
    h = _login(client, EMPLOYER)  # org o4
    default = client.get("/billing/subscriptions/current", headers=h).json()
    assert default["org_id"] == "o4"
    assert default["plan"] == "Free"
    assert default["is_premium"] is False

    activated = client.post(
        "/billing/subscriptions",
        json={"plan": "Pro", "billing_cycle": "monthly", "payment_gateway": "stripe"},
        headers=h,
    ).json()
    assert activated["plan"] == "Pro"
    assert activated["is_premium"] is True
    assert activated["seats"] == 1
    assert activated["since"]

    # persists across reads (keyed by the token's org, no org_id sent)
    assert client.get("/billing/subscriptions/current", headers=h).json()["plan"] == "Pro"

    cancelled = client.post("/billing/subscriptions/current/cancel", json={}, headers=h).json()
    assert cancelled["plan"] == "Free"
    assert cancelled["is_premium"] is False


def test_student_cannot_access_subscription(client):
    h = _login(client, STUDENT)
    assert client.get("/billing/subscriptions/current", headers=h).status_code == 403


def test_admin_may_target_an_org_explicitly(client):
    h = _login(client, ADMIN)
    resp = client.get("/billing/subscriptions/current?org_id=o5", headers=h)
    assert resp.status_code == 200
    assert resp.json()["org_id"] == "o5"
