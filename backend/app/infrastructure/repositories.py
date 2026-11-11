"""Repository adapters — implementations of the application ports.

``SqlAlchemyPlacementRepository`` is the only place that touches the ORM and
maps rows back into domain entities. The rest of the app depends on the
abstract port, so this class could be replaced (e.g. a fake, or a different
store) without touching a single use case.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.application.ports import (
    AdminActionLogRepository,
    ApplicationRepository,
    JobApplicationRepository,
    JobRepository,
    PlacementRepository,
    SavedJobsRepository,
    SavedRepository,
    StudentProfileRepository,
    ResumeRepository,
    StudentDocumentRepository,
    SubscriptionRepository,
    InvoiceRepository,
    TransactionRepository,
    StudentUsageRepository,
    UserRepository,
)
from app.domain.entities import (
    AdminActionLog,
    Application,
    Invoice,
    Job,
    JobApplication,
    Organisation,
    Placement,
    Resume,
    StudentDocument,
    StudentProfile,
    StudentUsage,
    Subscription,
    Transaction,
    User,
)
from app.infrastructure.orm import (
    AdminActionLogORM,
    ApplicationORM,
    InvoiceORM,
    JobApplicationORM,
    JobORM,
    OrganisationORM,
    PlacementORM,
    SavedJobORM,
    SavedORM,
    StudentProfileORM,
    ResumeORM,
    StudentDocumentORM,
    SubscriptionORM,
    TransactionORM,
    UserORM,
)


class SqlAlchemyPlacementRepository(PlacementRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def _to_domain(self, row: PlacementORM, org: Optional[OrganisationORM]) -> Placement:
        organisation = (
            Organisation(
                id=org.id,
                name=org.name,
                type=org.type,
                sector=org.sector or "",
                loc=org.loc or "",
                seal=org.seal or "",
                about=org.about or "",
            )
            if org is not None
            else None
        )
        return Placement(
            id=row.id,
            title=row.title,
            org_id=row.org_id,
            courses=list(row.courses or []),
            grade=row.grade or "",
            loc=row.loc or "",
            mode=row.mode or "",
            duration=row.duration or "",
            stipend=row.stipend or "",
            deadline=row.deadline or "",
            slots=row.slots or 0,
            status=row.status or "Open",
            applicants=row.applicants or 0,
            docs=list(row.docs or []),
            testimonial=bool(row.testimonial),
            about=row.about or "",
            duties=list(row.duties or []),
            review_status=row.review_status or "approved",
            published_at=row.published_at or "",
            closes_at=row.closes_at or "",
            starts_at=row.starts_at or "",
            requirements=list(row.requirements or []),
            review_reason=row.review_reason or "",
            opportunity_type=row.opportunity_type or "internship",
            duration_hours=row.duration_hours,
            budget_range=row.budget_range,
            milestones=list(row.milestones or []) if row.milestones else None,
            remote_ok=row.remote_ok,
            salary_range=row.salary_range,
            probation_period=row.probation_period,
            training_included=row.training_included,
            career_path=row.career_path,
            skills_required=list(row.skills_required or []) if row.skills_required else None,
            org=organisation,
        )

    def _base_query(self):
        return self._session.query(PlacementORM, OrganisationORM).outerjoin(
            OrganisationORM, PlacementORM.org_id == OrganisationORM.id
        )

    def list(
        self,
        *,
        q: Optional[str] = None,
        org_type: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> list[Placement]:
        query = self._base_query().filter(PlacementORM.review_status == "approved")
        if org_type:
            query = query.filter(OrganisationORM.type == org_type)
        if location:
            query = query.filter(OrganisationORM.loc == location)
        if mode:
            query = query.filter(PlacementORM.mode == mode)
        if q:
            like = f"%{q.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(PlacementORM.title).like(like),
                    func.lower(OrganisationORM.name).like(like),
                    func.lower(PlacementORM.loc).like(like),
                )
            )
        return [self._to_domain(p, o) for p, o in query.order_by(PlacementORM.id).all()]

    def get(self, placement_id: str) -> Optional[Placement]:
        row = self._base_query().filter(PlacementORM.id == placement_id).first()
        if row is None:
            return None
        return self._to_domain(row[0], row[1])


class SqlAlchemyJobRepository(JobRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def _to_domain(self, row: JobORM, org: Optional[OrganisationORM]) -> Job:
        organisation = (
            Organisation(
                id=org.id,
                name=org.name,
                type=org.type,
                sector=org.sector or "",
                loc=org.loc or "",
                seal=org.seal or "",
                about=org.about or "",
            )
            if org is not None
            else None
        )
        return Job(
            id=row.id,
            title=row.title,
            org_id=row.org_id,
            loc=row.loc or "",
            mode=row.mode or "",
            employment_type=row.employment_type or "Full time",
            salary=row.salary or "",
            closes_at=row.closes_at or "",
            summary=row.summary or "",
            requirements=list(row.requirements or []),
            status=row.status or "Open",
            review_status=row.review_status or "approved",
            published_at=row.published_at or "",
            review_reason=row.review_reason or "",
            org=organisation,
        )

    def _query(self):
        return self._session.query(JobORM, OrganisationORM).outerjoin(
            OrganisationORM, JobORM.org_id == OrganisationORM.id
        ).filter(JobORM.status == "Open", JobORM.review_status == "approved")

    def list(self, *, q=None, location=None, mode=None) -> list[Job]:
        query = self._query()
        if location:
            query = query.filter(JobORM.loc == location)
        if mode:
            query = query.filter(JobORM.mode == mode)
        if q:
            like = f"%{q.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(JobORM.title).like(like),
                    func.lower(OrganisationORM.name).like(like),
                    func.lower(JobORM.loc).like(like),
                )
            )
        return [self._to_domain(job, org) for job, org in query.order_by(JobORM.id).all()]

    def get(self, job_id: str) -> Optional[Job]:
        row = self._query().filter(JobORM.id == job_id).first()
        return self._to_domain(row[0], row[1]) if row else None


class SqlAlchemySavedRepository(SavedRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list(self, user_id: str) -> list[str]:
        rows = (
            self._session.query(SavedORM.placement_id)
            .filter(SavedORM.user_id == user_id)
            .order_by(SavedORM.placement_id)
            .all()
        )
        return [r[0] for r in rows]

    def is_saved(self, user_id: str, placement_id: str) -> bool:
        return (
            self._session.query(SavedORM)
            .filter_by(user_id=user_id, placement_id=placement_id)
            .first()
            is not None
        )

    def toggle(self, user_id: str, placement_id: str) -> bool:
        existing = (
            self._session.query(SavedORM)
            .filter_by(user_id=user_id, placement_id=placement_id)
            .first()
        )
        if existing is not None:
            self._session.delete(existing)
            self._session.commit()
            return False
        self._session.add(SavedORM(user_id=user_id, placement_id=placement_id))
        self._session.commit()
        return True


class SqlAlchemySavedJobsRepository(SavedJobsRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list(self, user_id: str) -> list[str]:
        rows = (
            self._session.query(SavedJobORM.job_id)
            .filter(SavedJobORM.user_id == user_id)
            .order_by(SavedJobORM.job_id)
            .all()
        )
        return [r[0] for r in rows]

    def is_saved(self, user_id: str, job_id: str) -> bool:
        return (
            self._session.query(SavedJobORM)
            .filter_by(user_id=user_id, job_id=job_id)
            .first()
            is not None
        )

    def toggle(self, user_id: str, job_id: str) -> bool:
        existing = (
            self._session.query(SavedJobORM)
            .filter_by(user_id=user_id, job_id=job_id)
            .first()
        )
        if existing is not None:
            self._session.delete(existing)
            self._session.commit()
            return False
        self._session.add(SavedJobORM(user_id=user_id, job_id=job_id))
        self._session.commit()
        return True


class SqlAlchemyApplicationRepository(ApplicationRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: ApplicationORM) -> Application:
        return Application(
            id=row.id,
            user_id=row.user_id,
            placement_id=row.placement_id,
            status=row.status,
            statement=row.statement or "",
            created_at=row.created_at or "",
            updated_at=row.updated_at or "",
            cv_url=row.cv_url,
            cover_letter=row.cover_letter or "",
            github_url=row.github_url,
            linkedin_url=row.linkedin_url,
            portfolio_url=row.portfolio_url,
            academic_papers=row.academic_papers or [],
            reference_1_name=row.reference_1_name or "",
            reference_1_email=row.reference_1_email or "",
            reference_1_phone=row.reference_1_phone or "",
            reference_1_relationship=row.reference_1_relationship or "",
            reference_2_name=row.reference_2_name or "",
            reference_2_email=row.reference_2_email or "",
            reference_2_phone=row.reference_2_phone or "",
            reference_2_relationship=row.reference_2_relationship or "",
            document_ids=row.document_ids or [],
            shortlisted=row.shortlisted,
        )

    def add(self, application: Application) -> Application:
        self._session.add(
            ApplicationORM(
                id=application.id,
                user_id=application.user_id,
                placement_id=application.placement_id,
                status=application.status,
                statement=application.statement,
                created_at=application.created_at,
                updated_at=application.updated_at,
                cv_url=application.cv_url,
                cover_letter=application.cover_letter,
                github_url=application.github_url,
                linkedin_url=application.linkedin_url,
                portfolio_url=application.portfolio_url,
                academic_papers=application.academic_papers,
                reference_1_name=application.reference_1_name,
                reference_1_email=application.reference_1_email,
                reference_1_phone=application.reference_1_phone,
                reference_1_relationship=application.reference_1_relationship,
                reference_2_name=application.reference_2_name,
                reference_2_email=application.reference_2_email,
                reference_2_phone=application.reference_2_phone,
                reference_2_relationship=application.reference_2_relationship,
                document_ids=application.document_ids,
                shortlisted=application.shortlisted,
            )
        )
        self._session.commit()
        return application

    def find(self, user_id: str, placement_id: str) -> Optional[Application]:
        row = (
            self._session.query(ApplicationORM)
            .filter_by(user_id=user_id, placement_id=placement_id)
            .first()
        )
        return self._to_domain(row) if row is not None else None

    def find_by_id(self, application_id: str) -> Optional[Application]:
        row = self._session.query(ApplicationORM).filter_by(id=application_id).first()
        return self._to_domain(row) if row is not None else None

    def withdraw(self, user_id: str, application_id: str) -> Optional[Application]:
        row = (
            self._session.query(ApplicationORM)
            .filter_by(id=application_id, user_id=user_id)
            .first()
        )
        if row is None:
            return None
        row.status = "Withdrawn"
        self._session.commit()
        return self._to_domain(row)

    def list_for_user(self, user_id: str) -> list[Application]:
        rows = (
            self._session.query(ApplicationORM)
            .filter_by(user_id=user_id)
            .order_by(ApplicationORM.created_at.desc(), ApplicationORM.id)
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def list_for_placement(self, placement_id: str) -> list[Application]:
        rows = (
            self._session.query(ApplicationORM)
            .filter_by(placement_id=placement_id)
            .order_by(ApplicationORM.created_at.desc(), ApplicationORM.id)
            .all()
        )
        return [self._to_domain(r) for r in rows]


class SqlAlchemyJobApplicationRepository(JobApplicationRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: JobApplicationORM) -> JobApplication:
        return JobApplication(
            id=row.id,
            user_id=row.user_id,
            job_id=row.job_id,
            status=row.status,
            statement=row.statement or "",
            created_at=row.created_at or "",
            updated_at=row.updated_at or "",
            cv_url=row.cv_url,
            cover_letter=row.cover_letter or "",
            github_url=row.github_url,
            linkedin_url=row.linkedin_url,
            portfolio_url=row.portfolio_url,
            academic_papers=row.academic_papers or [],
            reference_1_name=row.reference_1_name or "",
            reference_1_email=row.reference_1_email or "",
            reference_1_phone=row.reference_1_phone or "",
            reference_1_relationship=row.reference_1_relationship or "",
            reference_2_name=row.reference_2_name or "",
            reference_2_email=row.reference_2_email or "",
            reference_2_phone=row.reference_2_phone or "",
            reference_2_relationship=row.reference_2_relationship or "",
            document_ids=row.document_ids or [],
            shortlisted=row.shortlisted,
        )

    def add(self, application: JobApplication) -> JobApplication:
        self._session.add(
            JobApplicationORM(
                id=application.id,
                user_id=application.user_id,
                job_id=application.job_id,
                status=application.status,
                statement=application.statement,
                created_at=application.created_at,
                updated_at=application.updated_at,
                cv_url=application.cv_url,
                cover_letter=application.cover_letter,
                github_url=application.github_url,
                linkedin_url=application.linkedin_url,
                portfolio_url=application.portfolio_url,
                academic_papers=application.academic_papers,
                reference_1_name=application.reference_1_name,
                reference_1_email=application.reference_1_email,
                reference_1_phone=application.reference_1_phone,
                reference_1_relationship=application.reference_1_relationship,
                reference_2_name=application.reference_2_name,
                reference_2_email=application.reference_2_email,
                reference_2_phone=application.reference_2_phone,
                reference_2_relationship=application.reference_2_relationship,
                document_ids=application.document_ids,
                shortlisted=application.shortlisted,
            )
        )
        self._session.commit()
        return application

    def find(self, user_id: str, job_id: str) -> Optional[JobApplication]:
        row = (
            self._session.query(JobApplicationORM)
            .filter_by(user_id=user_id, job_id=job_id)
            .first()
        )
        return self._to_domain(row) if row is not None else None

    def find_by_id(self, application_id: str) -> Optional[JobApplication]:
        row = self._session.query(JobApplicationORM).filter_by(id=application_id).first()
        return self._to_domain(row) if row is not None else None

    def list_for_user(self, user_id: str) -> list[JobApplication]:
        rows = (
            self._session.query(JobApplicationORM)
            .filter_by(user_id=user_id)
            .order_by(JobApplicationORM.created_at.desc(), JobApplicationORM.id)
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def list_for_job(self, job_id: str) -> list[JobApplication]:
        rows = (
            self._session.query(JobApplicationORM)
            .filter_by(job_id=job_id)
            .order_by(JobApplicationORM.created_at.desc(), JobApplicationORM.id)
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def update_status(self, application_id: str, status: str) -> Optional[JobApplication]:
        row = self._session.query(JobApplicationORM).filter_by(id=application_id).first()
        if row is None:
            return None
        row.status = status
        row.updated_at = datetime.utcnow().isoformat()
        self._session.commit()
        return self._to_domain(row)


def get_by_id(self, user_id: str) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(id=user_id).first()
        return self._to_domain(row) if row is not None else None


class SqlAlchemyInvoiceRepository(InvoiceRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: "InvoiceORM") -> Invoice:
        return Invoice(
            id=row.id,
            org_id=row.org_id,
            subscription_id=row.subscription_id,
            amount_cents=row.amount_cents,
            currency=row.currency,
            status=row.status,
            invoice_number=row.invoice_number,
            description=row.description,
            line_items=row.line_items or [],
            metadata=row.invoice_metadata or {},
            due_date=row.due_date,
            paid_at=row.paid_at,
            payment_gateway=row.payment_gateway,
            gateway_invoice_id=row.gateway_invoice_id,
            gateway_payment_intent_id=row.gateway_payment_intent_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def get(self, invoice_id: str) -> Optional[Invoice]:
        row = self._session.query(InvoiceORM).filter_by(id=invoice_id).first()
        return self._to_domain(row) if row else None

    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Invoice]:
        query = self._session.query(InvoiceORM).filter_by(org_id=org_id)
        if status:
            query = query.filter_by(status=status)
        rows = query.order_by(InvoiceORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def find_by_gateway_id(self, gateway: str, gateway_invoice_id: str) -> Optional[Invoice]:
        row = self._session.query(InvoiceORM).filter_by(
            payment_gateway=gateway,
            gateway_invoice_id=gateway_invoice_id
        ).first()
        return self._to_domain(row) if row else None

    def find_by_number(self, invoice_number: str) -> Optional[Invoice]:
        row = self._session.query(InvoiceORM).filter_by(invoice_number=invoice_number).first()
        return self._to_domain(row) if row else None

    def save(self, invoice: Invoice) -> Invoice:
        row = self._session.query(InvoiceORM).filter_by(id=invoice.id).first()
        if row is None:
            row = InvoiceORM(id=invoice.id)
            self._session.add(row)
        row.org_id = invoice.org_id
        row.subscription_id = invoice.subscription_id
        row.amount_cents = invoice.amount_cents
        row.currency = invoice.currency
        row.status = invoice.status
        row.invoice_number = invoice.invoice_number
        row.description = invoice.description
        row.line_items = invoice.line_items
        row.invoice_metadata = invoice.invoice_metadata
        row.due_date = invoice.due_date
        row.paid_at = invoice.paid_at
        row.payment_gateway = invoice.payment_gateway
        row.gateway_invoice_id = invoice.gateway_invoice_id
        row.gateway_payment_intent_id = invoice.gateway_payment_intent_id
        row.updated_at = datetime.utcnow()
        self._session.commit()
        return invoice


class SqlAlchemyTransactionRepository(TransactionRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: "TransactionORM") -> Transaction:
        return Transaction(
            id=row.id,
            org_id=row.org_id,
            invoice_id=row.invoice_id,
            subscription_id=row.subscription_id,
            amount_cents=row.amount_cents,
            currency=row.currency,
            type=row.type,
            status=row.status,
            payment_gateway=row.payment_gateway,
            gateway_transaction_id=row.gateway_transaction_id,
            gateway_response=row.gateway_response or {},
            description=row.description,
            metadata=row.transaction_metadata or {},
            idempotency_key=row.idempotency_key,
            created_at=row.created_at,
            processed_at=row.processed_at,
        )

    def get(self, transaction_id: str) -> Optional[Transaction]:
        row = self._session.query(TransactionORM).filter_by(id=transaction_id).first()
        return self._to_domain(row) if row else None

    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Transaction]:
        query = self._session.query(TransactionORM).filter_by(org_id=org_id)
        if status:
            query = query.filter_by(status=status)
        rows = query.order_by(TransactionORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def find_by_idempotency_key(self, key: str) -> Optional[Transaction]:
        row = self._session.query(TransactionORM).filter_by(idempotency_key=key).first()
        return self._to_domain(row) if row else None

    def find_by_invoice_and_type(self, invoice_id: str, type: str) -> Optional[Transaction]:
        row = self._session.query(TransactionORM).filter_by(
            invoice_id=invoice_id, type=type
        ).first()
        return self._to_domain(row) if row else None

    def save(self, transaction: Transaction) -> Transaction:
        row = self._session.query(TransactionORM).filter_by(id=transaction.id).first()
        if row is None:
            row = TransactionORM(id=transaction.id)
            self._session.add(row)
        row.org_id = transaction.org_id
        row.invoice_id = transaction.invoice_id
        row.subscription_id = transaction.subscription_id
        row.amount_cents = transaction.amount_cents
        row.currency = transaction.currency
        row.type = transaction.type
        row.status = transaction.status
        row.payment_gateway = transaction.payment_gateway
        row.gateway_transaction_id = transaction.gateway_transaction_id
        row.gateway_response = transaction.gateway_response
        row.description = transaction.description
        row.transaction_metadata = transaction.transaction_metadata
        row.idempotency_key = transaction.idempotency_key
        row.processed_at = transaction.processed_at
        self._session.commit()
        return transaction


class SqlAlchemyStudentUsageRepository(StudentUsageRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: "StudentUsageORM") -> StudentUsage:
        return StudentUsage(
            id=row.id,
            user_id=row.user_id,
            month=row.month,
            application_count=row.application_count,
            billed_count=row.billed_count,
            last_billed_at=row.last_billed_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def get(self, user_id: str, month: str) -> Optional[StudentUsage]:
        row = self._session.query(StudentUsageORM).filter_by(user_id=user_id, month=month).first()
        return self._to_domain(row) if row else None

    def get_or_create(self, user_id: str, month: str) -> StudentUsage:
        row = self._session.query(StudentUsageORM).filter_by(user_id=user_id, month=month).first()
        if row is None:
            row = StudentUsageORM(
                id=f"su_{uuid4().hex[:12]}",
                user_id=user_id,
                month=month,
                application_count=0,
            )
            self._session.add(row)
            self._session.flush()
        return self._to_domain(row)

    def save(self, usage: StudentUsage) -> StudentUsage:
        row = self._session.query(StudentUsageORM).filter_by(user_id=usage.user_id, month=usage.month).first()
        if row is None:
            row = StudentUsageORM(
                id=usage.id,
                user_id=usage.user_id,
                month=usage.month,
            )
            self._session.add(row)
        row.application_count = usage.application_count
        row.billed_count = usage.billed_count
        row.last_billed_at = usage.last_billed_at
        row.updated_at = datetime.utcnow()
        self._session.commit()
        return usage


class SqlAlchemySubscriptionRepository(SubscriptionRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, org_id: str) -> Subscription:
        row = self._session.query(SubscriptionORM).filter_by(org_id=org_id).first()
        if row is None:
            return Subscription(org_id=org_id)  # Free default
        return Subscription(
            org_id=row.org_id,
            plan=row.plan,
            billing=row.billing or "",
            seats=row.seats or 1,
            since=row.since or "",
        )

    def save(self, subscription: Subscription) -> Subscription:
        row = (
            self._session.query(SubscriptionORM).filter_by(org_id=subscription.org_id).first()
        )
        if row is None:
            row = SubscriptionORM(org_id=subscription.org_id)
            self._session.add(row)
        row.plan = subscription.plan
        row.billing = subscription.billing
        row.seats = subscription.seats
        row.since = subscription.since
        self._session.commit()
        return subscription


class SqlAlchemyStudentProfileRepository(StudentProfileRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: StudentProfileORM) -> StudentProfile:
        return StudentProfile(
            user_id=row.user_id,
            course=row.course or "",
            year=row.year or "",
            cgpa=float(row.cgpa or 0.0),
            university=row.university or "",
            skills=list(row.skills or []),
            talent_search_opt_in=bool(row.talent_search_opt_in),
        )

    def get(self, user_id: str) -> StudentProfile:
        row = self._session.query(StudentProfileORM).filter_by(user_id=user_id).first()
        return self._to_domain(row) if row is not None else StudentProfile(user_id=user_id)

    def save(self, profile: StudentProfile) -> StudentProfile:
        row = (
            self._session.query(StudentProfileORM)
            .filter_by(user_id=profile.user_id)
            .first()
        )
        if row is None:
            row = StudentProfileORM(user_id=profile.user_id)
            self._session.add(row)
        row.course = profile.course
        row.year = profile.year
        row.cgpa = profile.cgpa
        row.university = profile.university
        row.skills = profile.skills
        row.talent_search_opt_in = profile.talent_search_opt_in
        self._session.commit()
        return profile


class SqlAlchemyResumeRepository(ResumeRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: ResumeORM) -> Resume:
        return Resume(
            user_id=row.user_id,
            filename=row.filename,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            content=row.content,
            uploaded_at=row.uploaded_at or "",
        )

    def get(self, user_id: str) -> Optional[Resume]:
        row = self._session.query(ResumeORM).filter_by(user_id=user_id).first()
        return self._to_domain(row) if row is not None else None

    def save(self, resume: Resume) -> Resume:
        row = self._session.query(ResumeORM).filter_by(user_id=resume.user_id).first()
        if row is None:
            row = ResumeORM(user_id=resume.user_id)
            self._session.add(row)
        row.filename = resume.filename
        row.content_type = resume.content_type
        row.size_bytes = resume.size_bytes
        row.content = resume.content
        row.uploaded_at = resume.uploaded_at
        self._session.commit()
        return resume


class SqlAlchemyStudentDocumentRepository(StudentDocumentRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: StudentDocumentORM) -> StudentDocument:
        return StudentDocument(
            id=row.id,
            user_id=row.user_id,
            document_type=row.document_type,
            filename=row.filename,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            content=row.content,
            status=row.status,
            rejection_reason=row.rejection_reason or "",
            uploaded_at=row.uploaded_at or "",
            is_public=row.is_public or False,
            author_role=row.author_role or "student",
            author_id=row.author_id or "",
        )

    def list_for_user(self, user_id: str) -> list[StudentDocument]:
        rows = (
            self._session.query(StudentDocumentORM)
            .filter_by(user_id=user_id)
            .order_by(StudentDocumentORM.document_type)
            .all()
        )
        return [self._to_domain(row) for row in rows]

    def get_by_id(self, document_id: str) -> Optional[StudentDocument]:
        row = self._session.query(StudentDocumentORM).filter_by(id=document_id).first()
        return self._to_domain(row) if row is not None else None

    def list_all(self, status: Optional[str] = None) -> list[StudentDocument]:
        query = self._session.query(StudentDocumentORM)
        if status:
            query = query.filter(StudentDocumentORM.status == status)
        rows = query.order_by(StudentDocumentORM.uploaded_at.desc()).all()
        return [self._to_domain(row) for row in rows]

    def list_public_testimonials(self, limit: int = 10) -> list[StudentDocument]:
        query = self._session.query(StudentDocumentORM).filter(
            StudentDocumentORM.document_type == "testimonial",
            StudentDocumentORM.status == "verified",
            StudentDocumentORM.is_public == True
        ).order_by(StudentDocumentORM.uploaded_at.desc()).limit(limit)
        rows = query.all()
        return [self._to_domain(row) for row in rows]

    def save(self, document: StudentDocument) -> StudentDocument:
        row = self._session.query(StudentDocumentORM).filter_by(id=document.id).first()
        if row is None:
            row = StudentDocumentORM(id=document.id)
            self._session.add(row)
        row.user_id = document.user_id
        row.document_type = document.document_type
        row.filename = document.filename
        row.content_type = document.content_type
        row.size_bytes = document.size_bytes
        row.content = document.content
        row.status = document.status
        row.rejection_reason = document.rejection_reason
        row.uploaded_at = document.uploaded_at
        row.is_public = getattr(document, 'is_public', False)
        row.author_role = getattr(document, 'author_role', 'student')
        row.author_id = getattr(document, 'author_id', '')
        self._session.commit()
        return document


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

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
            )
        )
        self._session.commit()
        return user

    def get_by_email(self, email: str) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(email=email).first()
        return self._to_domain(row) if row is not None else None

    def get_by_id(self, user_id: str) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(id=user_id).first()
        return self._to_domain(row) if row is not None else None


class SqlAlchemyAdminActionLogRepository(AdminActionLogRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

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
        self._session.commit()
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
