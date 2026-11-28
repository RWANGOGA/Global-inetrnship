"""Placements bounded context: placements, jobs, applications, profiles, resources."""
from app.infrastructure.repositories._base import AutocommitMixin
from datetime import datetime
from typing import Optional
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.application.ports import (
    ApplicationRepository,
    JobApplicationRepository,
    JobRepository,
    LearningResourceRepository,
    PlacementRepository,
    SavedJobsRepository,
    SavedRepository,
    StudentProfileRepository,
    ResumeRepository,
    StudentDocumentRepository,
)
from app.domain.entities import (
    Application,
    Job,
    JobApplication,
    LearningResource,
    Organisation,
    Placement,
    Resume,
    StudentDocument,
    StudentProfile,
    User,
)
from app.infrastructure.orm import (
    ApplicationORM,
    JobApplicationORM,
    JobORM,
    LearningResourceORM,
    OrganisationORM,
    PlacementORM,
    SavedJobORM,
    SavedORM,
    StudentProfileORM,
    ResumeORM,
    StudentDocumentORM,
    UserORM,
)

class SqlAlchemyPlacementRepository(AutocommitMixin, PlacementRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
        opportunity_type: Optional[str] = None,
    ) -> list[Placement]:
        query = self._base_query().filter(
            PlacementORM.review_status == "approved",
            PlacementORM.status == "Open"
        )
        if org_type:
            query = query.filter(OrganisationORM.type == org_type)
        if location:
            query = query.filter(OrganisationORM.loc == location)
        if mode:
            query = query.filter(PlacementORM.mode == mode)
        if opportunity_type:
            query = query.filter(PlacementORM.opportunity_type == opportunity_type)
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

    def update(self, placement_id: str, **fields) -> Optional[Placement]:
        row = (
            self._session.query(PlacementORM)
            .filter(PlacementORM.id == placement_id)
            .first()
        )
        if row is None:
            return None
        allowed = {
            "title", "courses", "grade", "loc", "mode", "duration", "stipend",
            "deadline", "slots", "status", "docs", "testimonial", "about",
            "duties", "requirements", "opportunity_type", "duration_hours",
            "budget_range", "milestones", "remote_ok", "salary_range",
            "probation_period", "training_included", "career_path",
            "skills_required", "review_status",
        }
        for key, value in fields.items():
            if key in allowed and value is not None:
                setattr(row, key, value)
        self._persist()
        self._session.refresh(row)
        org = (
            self._session.query(OrganisationORM)
            .filter(OrganisationORM.id == row.org_id)
            .first()
        )
        return self._to_domain(row, org)

class SqlAlchemyJobRepository(AutocommitMixin, JobRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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

    def update(self, job_id: str, **fields) -> Optional[Job]:
        row = self._session.query(JobORM).filter_by(id=job_id).first()
        if row is None:
            return None
        for k, v in fields.items():
            if hasattr(row, k):
                setattr(row, k, v)
        self._persist()
        org = self._session.query(OrganisationORM).filter_by(id=row.org_id).first()
        return self._to_domain(row, org)

class SqlAlchemySavedRepository(AutocommitMixin, SavedRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
            self._persist()
            return False
        self._session.add(SavedORM(user_id=user_id, placement_id=placement_id))
        self._persist()
        return True

class SqlAlchemySavedJobsRepository(AutocommitMixin, SavedJobsRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
            self._persist()
            return False
        self._session.add(SavedJobORM(user_id=user_id, job_id=job_id))
        self._persist()
        return True

class SqlAlchemyApplicationRepository(AutocommitMixin, ApplicationRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
        self._persist()
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
        self._persist()
        return self._to_domain(row)

    def reactivate(self, user_id: str, application_id: str) -> Optional[Application]:
        row = (
            self._session.query(ApplicationORM)
            .filter_by(id=application_id, user_id=user_id)
            .first()
        )
        if row is None:
            return None
        row.status = "Submitted"
        row.updated_at = datetime.utcnow().isoformat()
        self._persist()
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

class SqlAlchemyJobApplicationRepository(AutocommitMixin, JobApplicationRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
        self._persist()
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
        self._persist()
        return self._to_domain(row)


def get_by_id(self, user_id: str) -> Optional[User]:
        row = self._session.query(UserORM).filter_by(id=user_id).first()
        return self._to_domain(row) if row is not None else None

class SqlAlchemyStudentProfileRepository(AutocommitMixin, StudentProfileRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
            skills_confidence=dict(row.skills_confidence or {}),
            skills_source=dict(row.skills_source or {}),
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
        row.skills_confidence = profile.skills_confidence
        row.skills_source = profile.skills_source
        self._persist()
        return profile

class SqlAlchemyResumeRepository(AutocommitMixin, ResumeRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
        self._persist()
        return resume

class SqlAlchemyStudentDocumentRepository(AutocommitMixin, StudentDocumentRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

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
        self._persist()
        return document

class SqlAlchemyLearningResourceRepository(AutocommitMixin, LearningResourceRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    @staticmethod
    def _to_domain(row: LearningResourceORM) -> LearningResource:
        return LearningResource(
            id=row.id,
            title=row.title or "",
            url=row.url or "",
            provider=row.provider or "",
            description=row.description or "",
            skill=row.skill or "",
            placement_id=row.placement_id or "",
            level=row.level or "",
            resource_type=row.resource_type or "Course",
            duration=row.duration or "",
            created_at=row.created_at or "",
        )

    def list(
        self,
        *,
        skill: Optional[str] = None,
        placement_id: Optional[str] = None,
    ) -> list[LearningResource]:
        query = self._session.query(LearningResourceORM)
        if skill:
            query = query.filter(LearningResourceORM.skill == skill)
        if placement_id:
            query = query.filter(LearningResourceORM.placement_id == placement_id)
        rows = query.order_by(
            LearningResourceORM.created_at.desc(), LearningResourceORM.title
        ).all()
        return [self._to_domain(row) for row in rows]

    def get(self, resource_id: str) -> Optional[LearningResource]:
        row = (
            self._session.query(LearningResourceORM)
            .filter_by(id=resource_id)
            .first()
        )
        return self._to_domain(row) if row is not None else None

    def add(self, resource: LearningResource) -> LearningResource:
        row = LearningResourceORM(
            id=resource.id,
            title=resource.title,
            url=resource.url,
            provider=resource.provider,
            description=resource.description,
            skill=resource.skill,
            placement_id=resource.placement_id,
            level=resource.level,
            resource_type=resource.resource_type,
            duration=resource.duration,
            created_at=resource.created_at,
        )
        self._session.add(row)
        self._persist()
        return resource

    def update(self, resource: LearningResource) -> LearningResource:
        row = (
            self._session.query(LearningResourceORM)
            .filter_by(id=resource.id)
            .first()
        )
        if row is None:
            return resource
        row.title = resource.title
        row.url = resource.url
        row.provider = resource.provider
        row.description = resource.description
        row.skill = resource.skill
        row.placement_id = resource.placement_id
        row.level = resource.level
        row.resource_type = resource.resource_type
        row.duration = resource.duration
        self._persist()
        return resource

    def delete(self, resource_id: str) -> bool:
        row = (
            self._session.query(LearningResourceORM)
            .filter_by(id=resource_id)
            .first()
        )
        if row is None:
            return False
        self._session.delete(row)
        self._persist()
        return True


# =============================================================================
# CHAT / MESSAGING REPOSITORIES
# =============================================================================
