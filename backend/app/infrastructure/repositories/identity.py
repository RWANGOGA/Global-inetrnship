"""Identity & Access bounded context: users, admin audit, organisations."""
from app.infrastructure.repositories._base import AutocommitMixin
from typing import Optional
from sqlalchemy.orm import Session
from app.application.ports import (
    AdminActionLogRepository,
    OrganisationRepository,
    UserRepository,
)
from app.domain.entities import (
    AdminActionLog,
    Organisation,
    User,
)
from app.infrastructure.orm import (
    AdminActionLogORM,
    OrganisationORM,
    UserORM,
)

class SqlAlchemyUserRepository(AutocommitMixin, UserRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    @staticmethod
    def _to_domain(row: UserORM) -> User:
        return User(
            id=row.id,
            email=row.email,
            name=row.name,
            role=row.role,
            password_hash=row.password_hash,
            created_at=row.created_at or "",
            org_id=row.org_id or None,
            deleted=bool(row.deleted),
            deleted_at=row.deleted_at or None,
            personal_email=row.personal_email or None,
            graduated=bool(row.graduated),
            graduated_at=row.graduated_at or None,
        )

    def add(self, user: User) -> User:
        self._session.add(
            UserORM(
                id=user.id,
                email=user.email,
                name=user.name,
                role=user.role,
                password_hash=user.password_hash,
                created_at=user.created_at,
                org_id=user.org_id,
                personal_email=user.personal_email,
                graduated=user.graduated,
                graduated_at=user.graduated_at,
            )
        )
        self._persist()
        return user

    def get_by_email(self, email: str) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(email=email).first()
        return self._to_domain(row) if row is not None else None

    def get_by_id(self, user_id: str) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(id=user_id).first()
        return self._to_domain(row) if row is not None else None

    def list_by_role(self, role: str) -> list[User]:
        rows = self._session.query(UserORM).filter_by(role=role).all()
        return [self._to_domain(row) for row in rows]

    def update(self, user_id: str, **fields) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(id=user_id).first()
        if not row:
            return None
        for k, v in fields.items():
            if hasattr(row, k):
                setattr(row, k, v)
        self._persist()
        return self.get_by_id(user_id)

class SqlAlchemyAdminActionLogRepository(AutocommitMixin, AdminActionLogRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    @staticmethod
    def _to_domain(row: AdminActionLogORM) -> AdminActionLog:
        return AdminActionLog(
            id=row.id,
            admin_id=row.admin_id,
            admin_email=row.admin_email,
            target_user_id=row.target_user_id,
            target_user_email=row.target_user_email,
            action=row.action,
            reason=row.reason,
            details=row.details,
            created_at=row.created_at,
        )

    def add(self, log: AdminActionLog) -> AdminActionLog:
        self._session.add(
            AdminActionLogORM(
                id=log.id,
                admin_id=log.admin_id,
                admin_email=log.admin_email,
                target_user_id=log.target_user_id,
                target_user_email=log.target_user_email,
                action=log.action,
                reason=log.reason,
                details=log.details,
                created_at=log.created_at,
            )
        )
        self._persist()
        return log

    def list(
        self,
        *,
        admin_id: Optional[str] = None,
        target_user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list[AdminActionLog]:
        query = self._session.query(AdminActionLogORM)

        if admin_id:
            query = query.filter(AdminActionLogORM.admin_id == admin_id)
        if target_user_id:
            query = query.filter(AdminActionLogORM.target_user_id == target_user_id)
        if action:
            query = query.filter(AdminActionLogORM.action == action)
        if start_date:
            query = query.filter(AdminActionLogORM.created_at >= start_date)
        if end_date:
            query = query.filter(AdminActionLogORM.created_at <= end_date)

        query = query.order_by(AdminActionLogORM.created_at.desc())

        offset = (page - 1) * page_size
        rows = query.offset(offset).limit(page_size).all()
        return [self._to_domain(r) for r in rows]

    def count(
        self,
        *,
        admin_id: Optional[str] = None,
        target_user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> int:
        query = self._session.query(AdminActionLogORM)

        if admin_id:
            query = query.filter(AdminActionLogORM.admin_id == admin_id)
        if target_user_id:
            query = query.filter(AdminActionLogORM.target_user_id == target_user_id)
        if action:
            query = query.filter(AdminActionLogORM.action == action)
        if start_date:
            query = query.filter(AdminActionLogORM.created_at >= start_date)
        if end_date:
            query = query.filter(AdminActionLogORM.created_at <= end_date)

        return query.count()

class SqlAlchemyOrganisationRepository(AutocommitMixin, OrganisationRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    def _to_domain(self, row: "OrganisationORM") -> Organisation:
        return Organisation(
            id=row.id,
            name=row.name,
            type=row.type,
            sector=row.sector,
            loc=row.loc,
            seal=row.seal,
            owner_id=row.owner_id,
            about=row.about,
            created_at=row.created_at,
        )

    def add(self, org: Organisation) -> Organisation:
        row = OrganisationORM(
            id=org.id,
            name=org.name,
            type=org.type,
            sector=org.sector,
            loc=org.loc,
            seal=org.seal,
            about=org.about,
            owner_id=org.owner_id,
            created_at=org.created_at,
        )
        self._session.add(row)
        self._persist()
        return org

    def get(self, org_id: str) -> Optional[Organisation]:
        row = self._session.query(OrganisationORM).filter_by(id=org_id).first()
        if not row:
            return None
        return self._to_domain(row)

    def get_by_owner(self, owner_id: str) -> Optional[Organisation]:
        row = self._session.query(OrganisationORM).filter_by(owner_id=owner_id).first()
        if not row:
            return None
        return self._to_domain(row)
