"""Admin user-account recovery — delete + restore.

A deleted account cannot log in; the admin recovers it with the ``restore``
action on ``PATCH /users/{id}/action``.
"""

STUDENT = "amina@makerere.ac.ug"
ADMIN = "office@makerere.ac.ug"
PASSWORD = "password123"


def _login(client, email: str) -> dict:
    response = client.post(
        "/auth/login", json={"username": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_admin_can_delete_and_restore_user_account(client):
    admin = _login(client, ADMIN)
    student = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=student).json()["id"]

    deleted = client.patch(
        f"/admin/users/{user_id}/action",
        headers=admin,
        json={"action": "delete", "reason": "test deletion"},
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["user"]["id"] == user_id
    assert deleted.json()["action"] == "delete"

    # A deleted account can no longer log in.
    login_while_deleted = client.post(
        "/auth/login", json={"username": STUDENT, "password": PASSWORD}
    )
    assert login_while_deleted.status_code == 401

    # The admin restores the account.
    restored = client.patch(
        f"/admin/users/{user_id}/action",
        headers=admin,
        json={"action": "restore", "reason": "recovered"},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["action"] == "restore"
    assert restored.json()["user"]["id"] == user_id
    assert restored.json()["user"]["is_active"] is True

    login_after_restore = client.post(
        "/auth/login", json={"username": STUDENT, "password": PASSWORD}
    )
    assert login_after_restore.status_code == 200, login_after_restore.text


def test_admin_cannot_restore_an_unknown_user(client):
    admin = _login(client, ADMIN)
    response = client.patch(
        "/admin/users/does-not-exist/action",
        headers=admin,
        json={"action": "restore", "reason": "nope"},
    )
    assert response.status_code == 404
