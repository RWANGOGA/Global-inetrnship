"""Integration tests exercise the real adapters (SQLAlchemy + SQLite) through
the same repository port the API uses — no mocks, but still fully offline."""
from app.infrastructure.repositories import SqlAlchemyPlacementRepository


def test_repository_returns_full_seed(session):
    repo = SqlAlchemyPlacementRepository(session)
    assert len(repo.list()) == 14


def test_repository_nests_organisation(session):
    repo = SqlAlchemyPlacementRepository(session)
    p = repo.get("p1")
    assert p is not None
    assert p.org is not None
    assert p.org.name == "Lumen Labs"
    assert p.org.type == "Company"


def test_repository_filters_by_mode(session):
    repo = SqlAlchemyPlacementRepository(session)
    remote = repo.list(mode="Remote")
    assert {p.id for p in remote} == {"p1", "p11", "p13"}


def test_repository_keyword_matches_title_and_org(session):
    repo = SqlAlchemyPlacementRepository(session)
    hits = repo.list(q="Makerere")
    assert [p.id for p in hits] == ["p10"]


def test_repository_get_missing_returns_none(session):
    repo = SqlAlchemyPlacementRepository(session)
    assert repo.get("does-not-exist") is None
