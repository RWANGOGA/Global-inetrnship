"""API versioning: /api/v1 mirrors the legacy /api surface."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.presentation.main import create_app


def _stub_sub() -> FastAPI:
    sub = FastAPI()

    @sub.get("/ping")
    def ping() -> dict:
        return {"pong": True}

    return sub


def _mount_paths(app: FastAPI) -> list[str]:
    return [route.path for route in app.routes if route.__class__.__name__ == "Mount"]


def test_v1_is_mounted_before_legacy_prefix():
    app = create_app(sub_prefix="/api", sub=_stub_sub())
    mounts = _mount_paths(app)
    assert mounts.index("/api/v1") < mounts.index("/api")


def test_versioned_path_serves_the_feature_app():
    app = create_app(sub_prefix="/api", sub=_stub_sub())
    with TestClient(app) as client:
        versioned = client.get("/api/v1/ping")
        legacy = client.get("/api/ping")

    assert versioned.status_code == 200
    assert versioned.json() == {"pong": True}
    assert versioned.headers["x-api-version"] == "v1"
    assert legacy.status_code == 200
    assert "x-api-version" not in legacy.headers


def test_root_prefix_keeps_tests_unversioned():
    app = create_app(sub_prefix="/", sub=_stub_sub())
    mounts = _mount_paths(app)
    assert "" in mounts or "/" in mounts
    assert "//v1" not in mounts
