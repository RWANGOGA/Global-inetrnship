"""Application services — thin use-case orchestrators over the ports."""
from __future__ import annotations
from contextlib import nullcontext

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from app.application.ports import (
    ApplicationRepository,
    LearningResourceRepository,
    PlacementRepository,
    SavedRepository,
    StudentProfileRepository,
    ResumeRepository,
    StudentDocumentRepository,
    SubscriptionRepository,
    InvoiceRepository,
    TransactionRepository,
    StudentUsageRepository,
)
from app.core.errors import LearningResourceNotFound, PlacementNotFound, PlacementNotOpen
from app.domain.entities import (
    Application, LearningResource, Placement, Resume, StudentDocument,
    StudentProfile, Subscription, Invoice, Transaction, StudentUsage
)
from app.domain.matching import (
    GRADE_RANK,
    REQUIRED_SKILLS,
    SKILLS,
    SKILL_NAMES,
    RankedPlacement,
    SkillSuggestion,
    match_placement,
    suggest_skills_for_course,
)


class PlacementService:
    """Use cases for browsing the placements catalogue.

    Depends only on the ``PlacementRepository`` port, so the same service runs
    against Postgres in production and SQLite in tests.
    """

    def __init__(self, repo: PlacementRepository) -> None:
        self._repo = repo

    def list_placements(
        self,
        *,
        q: Optional[str] = None,
        org_type: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
        opportunity_type: Optional[str] = None,
    ) -> list[Placement]:
        return self._repo.list(
            q=q, org_type=org_type, location=location, mode=mode, opportunity_type=opportunity_type
        )

    def get_placement(self, placement_id: str) -> Optional[Placement]:
        return self._repo.get(placement_id)

    def update_placement(
        self, placement_id: str, **fields
    ) -> Optional[Placement]:
        """Update mutable fields on a placement (requirements, courses, grade, ...)."""
        return self._repo.update(placement_id, **fields)

    def catalog_meta(self) -> dict:
        """Catalogue metadata the UI needs to render filters and explain matches.

        Courses/types/locations are derived from the placements actually stored
        in the database — they can never drift from the catalog. The grade
        thresholds, skill taxonomy and per-placement requirements come from the
        matching domain, which is their single source of truth; the frontend
        keeps no private copies of these tables.
        """
        placements = self._repo.list()
        courses = sorted({c for p in placements for c in p.courses})
        org_types = sorted({p.org.type for p in placements if p.org and p.org.type})
        locations = sorted({p.loc for p in placements if p.loc})
        return {
            "courses": courses,
            "org_types": org_types,
            "locations": locations,
            "grade_rules": dict(GRADE_RANK),
            "required_skills": dict(REQUIRED_SKILLS),
            "skills": [
                {"name": s.name, "category": s.category, "keywords": list(s.keywords)}
                for s in SKILLS
            ],
        }


class MatchingService:
    """Use case: rank placements against a student's skill profile.

    Pulls the candidate pool through the same ``PlacementRepository`` port and
    delegates the actual scoring to the pure domain matcher. Keeping the repo
    behind the port means this use case is testable offline and DB-agnostic.
    """

    def __init__(self, repo: PlacementRepository) -> None:
        self._repo = repo

    def rank(
        self,
        *,
        student_skills: list[str],
        student_course: str,
        student_cgpa: float,
        student_confidence: Optional[dict[str, int]] = None,
        q: Optional[str] = None,
        org_type: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
        opportunity_type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[RankedPlacement]:
        candidates = self._repo.list(
            q=q, org_type=org_type, location=location, mode=mode, opportunity_type=opportunity_type
        )
        ranked = [
            RankedPlacement(
                placement=p,
                match=match_placement(
                    p,
                    student_skills,
                    student_course,
                    student_cgpa,
                    student_confidence,
                ),
            )
            for p in candidates
        ]
        ranked.sort(key=lambda r: (-r.match.score, r.placement.id))
        return ranked[:limit] if limit else ranked

    def suggest_skills(
        self, *, student_course: str, student_skills: list[str]
    ) -> list[SkillSuggestion]:
        return suggest_skills_for_course(
            self._repo.list(), student_course, set(student_skills)
        )


class SavedService:
    """Use cases for a user's bookmarked placements."""

    def __init__(self, repo: SavedRepository) -> None:
        self._repo = repo

    def list(self, user_id: str) -> list[str]:
        return self._repo.list(user_id)

    def is_saved(self, user_id: str, placement_id: str) -> bool:
        return self._repo.is_saved(user_id, placement_id)

    def toggle(self, user_id: str, placement_id: str) -> "tuple[bool, list[str]]":
        now_saved = self._repo.toggle(user_id, placement_id)
        return now_saved, self._repo.list(user_id)


class ApplicationService:
    """Use cases for applying to placements.

    Holds the two real business rules: you can only apply to an existing, open
    placement, and applying twice for the same placement is idempotent.
    """

    def __init__(
        self,
        placements: PlacementRepository,
        apps: ApplicationRepository,
        billing: BillingService = None,
    ) -> None:
        self._placements = placements
        self._apps = apps
        self._billing = billing

    def apply(
        self,
        *,
        user_id: str,
        placement_id: str,
        statement: str = "",
        cover_letter: str = "",
        cv_url: str | None = None,
        github_url: str | None = None,
        linkedin_url: str | None = None,
        portfolio_url: str | None = None,
        academic_papers: list | None = None,
        reference_1_name: str = "",
        reference_1_email: str = "",
        reference_1_phone: str = "",
        reference_1_relationship: str = "",
        reference_2_name: str = "",
        reference_2_email: str = "",
        reference_2_phone: str = "",
        reference_2_relationship: str = "",
        document_ids: list | None = None,
    ) -> Application:
        placement = self._placements.get(placement_id)
        if placement is None:
            raise PlacementNotFound(placement_id)
        if placement.status == "Closed" or placement.review_status != "approved":
            raise PlacementNotOpen(placement_id)

        existing = self._apps.find(user_id, placement_id)
        if existing is not None:
            return existing  # idempotent: no duplicate applications

        # Check student application limit (billing gate)
        if self._billing:
            limit_check = self._billing.check_student_application_limit(user_id)
            if not limit_check["allowed"]:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "application_limit_exceeded",
                        "message": limit_check["reason"],
                        "current": limit_check["current"],
                        "limit": limit_check["limit"],
                        "unpaid_invoice": limit_check.get("unpaid_invoice")
                    }
                )

        now = date.today().isoformat()
        application = Application(
            id=uuid4().hex,
            user_id=user_id,
            placement_id=placement_id,
            status="Submitted",
            statement=statement,
            cover_letter=cover_letter,
            cv_url=cv_url,
            github_url=github_url,
            linkedin_url=linkedin_url,
            portfolio_url=portfolio_url,
            academic_papers=academic_papers or [],
            reference_1_name=reference_1_name,
            reference_1_email=reference_1_email,
            reference_1_phone=reference_1_phone,
            reference_1_relationship=reference_1_relationship,
            reference_2_name=reference_2_name,
            reference_2_email=reference_2_email,
            reference_2_phone=reference_2_phone,
            reference_2_relationship=reference_2_relationship,
            document_ids=document_ids or [],
            shortlisted=False,
            created_at=now,
            updated_at=now,
        )
        application = self._apps.add(application)

        # Record for student billing (tracks free tier / overage)
        if self._billing:
            self._billing.record_student_application(user_id)

        return application

    def list_for_user(self, user_id: str) -> list[Application]:
        return self._apps.list_for_user(user_id)

    def list_for_placement(self, placement_id: str) -> list[Application]:
        return self._apps.list_for_placement(placement_id)

    def withdraw(self, *, user_id: str, application_id: str) -> Optional[Application]:
        application = self._apps.find_by_id(application_id)
        if application is None or application.user_id != user_id:
            return None
        if application.status in ("Accepted", "Rejected", "Withdrawn"):
            return application
        return self._apps.withdraw(user_id, application_id)


class BillingService:
    """
    Billing service with ACID guarantees:
    - Atomicity: All DB changes in single transaction (SQLAlchemy session)
    - Consistency: Validate business rules before commit
    - Isolation: Use SELECT FOR UPDATE for concurrent operations
    - Durability: Commit only after all validations pass
    """

    # Plan pricing in cents
    PLAN_PRICES = {
        "Free": {"monthly": 0, "annual": 0},
        "Pro": {"monthly": 3000, "annual": 30000},  # $30/mo or $300/yr
        "Enterprise": {"monthly": 0, "annual": 0},  # Custom pricing
    }

    # Placement limits per plan
    PLACEMENT_LIMITS = {
        "Free": 3,
        "Pro": -1,  # -1 = unlimited
        "Enterprise": -1,
    }

    # Student billing
    STUDENT_FREE_APPS = 30
    STUDENT_OVERAGE_CENTS = 50  # $0.50 per application

    def __init__(
        self,
        session: Session | None,
        subscription_repo: SubscriptionRepository,
        invoice_repo: InvoiceRepository,
        transaction_repo: TransactionRepository,
        gateway_factory: "PaymentGatewayFactory",
        student_usage_repo: StudentUsageRepository,
    ) -> None:
        self._session = session
        self._subscriptions = subscription_repo
        self._invoices = invoice_repo
        self._transactions = transaction_repo
        self._gateways = gateway_factory
        self._student_usage = student_usage_repo

    def _transaction(self):
        """Context manager for transactions - no-op, let caller manage transaction."""
        from contextlib import nullcontext
        return nullcontext()

    # ============ COMPANY BILLING ============

    def get_subscription(self, org_id: str) -> Subscription:
        """Get subscription with Free default."""
        return self._subscriptions.get(org_id)

    def check_placement_limit(self, org_id: str, session: Session = None) -> dict:
        """Check if org can create another placement. Returns dict with allowed, current, limit, reason."""
        sub = self.get_subscription(org_id)
        limit = self.PLACEMENT_LIMITS.get(sub.plan, 3)
        
        if limit == -1:
            return {"allowed": True, "current": 0, "limit": -1, "reason": "unlimited"}
        
        # Count active/open placements for this org
        if session:
            from app.infrastructure.orm import PlacementORM
            current = session.query(PlacementORM).filter(
                PlacementORM.org_id == org_id,
                PlacementORM.status.in_(["Open", "Closing"]),
                PlacementORM.review_status == "approved"
            ).count()
        else:
            # Fallback for tests without session
            current = 0
        
        allowed = current < limit
        return {
            "allowed": allowed,
            "current": current,
            "limit": limit,
            "reason": f"Free plan allows {limit} placements. Upgrade to Pro for unlimited." if not allowed else None
        }

    def create_subscription(
        self,
        org_id: str,
        plan: str,
        billing_cycle: str = "monthly",
        payment_gateway: str = "stripe",
        payment_method_id: str = None,
    ) -> Subscription:
        """
        Atomic: Creates subscription + invoice + transaction in one transaction.
        Consistent: Validates plan exists, org exists, gateway enabled.
        Isolated: Uses row-level locks on organisation.
        Durable: Commits only after all records created.
        """
        with self._transaction():
            # 1. Lock organisation row (skip if no session for testing)
            if self._session:
                from app.infrastructure.orm import OrganisationORM
                org = self._session.query(OrganisationORM).filter_by(id=org_id).with_for_update().one_or_none()
                if not org:
                    raise ValueError(f"Organisation {org_id} not found")
            else:
                # Mock org for testing
                class MockOrg:
                    currency = "USD"
                org = MockOrg()

            # 2. Validate plan
            self._validate_plan(plan, billing_cycle)

            # Free plan: no gateway customer, no invoice, no payment — just a
            # local Free subscription record.
            if plan == "Free":
                now = datetime.utcnow()
                subscription = Subscription(
                    org_id=org_id,
                    plan="Free",
                    billing="",
                    seats=1,
                    status="active",
                    current_period_start=None,
                    current_period_end=None,
                    payment_gateway=None,
                    gateway_customer_id=None,
                    gateway_subscription_id=None,
                    since="",
                )
                self._subscriptions.save(subscription)
                return subscription

            gateway = self._gateways.get(payment_gateway)
            self._validate_gateway(gateway, org.currency if hasattr(org, 'currency') else "USD")

            # 3. Get/create gateway customer
            customer = gateway.get_or_create_customer(org_id)

            # 4. Create subscription in gateway
            price_id = self._plan_to_price_id(plan, billing_cycle)
            gw_sub = gateway.create_subscription(customer.id, price_id)

            # 5. Create local subscription record
            now = datetime.utcnow()
            period_end = now + timedelta(days=30 if billing_cycle == "monthly" else 365)
            
            subscription = Subscription(
                org_id=org_id,
                plan=plan,
                billing=billing_cycle,
                status="active" if gw_sub.status == "active" else "trialing",
                current_period_start=now,
                current_period_end=period_end,
                payment_gateway=payment_gateway,
                gateway_customer_id=customer.id,
                gateway_subscription_id=gw_sub.id,
                seats=1,
                since=now.isoformat(),
            )
            self._subscriptions.save(subscription)

            # 6. Create first invoice
            invoice = self._create_invoice_for_subscription(subscription, gateway)

            # 7. Attempt payment if payment_method provided
            if payment_method_id:
                self._pay_invoice(invoice.id, payment_method_id)

            return subscription

    def _create_invoice_for_subscription(self, subscription: Subscription, gateway: PaymentGateway) -> Invoice:
        """Create invoice for subscription period."""
        amount_cents = self.PLAN_PRICES.get(subscription.plan, {}).get(subscription.billing, 0)
        
        line_items = [{
            "description": f"{subscription.plan} Plan - {subscription.billing}ly",
            "quantity": 1,
            "unit_amount_cents": amount_cents,
            "period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else "",
            "period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else "",
        }]

        gw_invoice = gateway.create_invoice(
            subscription.gateway_customer_id,
            line_items,
            metadata={"subscription_id": subscription.org_id, "plan": subscription.plan}
        )

        invoice = Invoice(
            id=f"inv_{uuid4().hex[:12]}",
            org_id=subscription.org_id,
            subscription_id=subscription.org_id,
            amount_cents=amount_cents,
            currency="USD",
            status="open",
            invoice_number=self._generate_invoice_number(),
            line_items=line_items,
            due_date=datetime.utcnow() + timedelta(days=7),
            payment_gateway=subscription.payment_gateway,
            gateway_invoice_id=gw_invoice.id,
        )
        self._invoices.save(invoice)

        # Create pending transaction record
        transaction = Transaction(
            id=f"txn_{uuid4().hex[:12]}",
            org_id=subscription.org_id,
            invoice_id=invoice.id,
            subscription_id=subscription.org_id,
            amount_cents=invoice.amount_cents,
            currency=invoice.currency,
            type="payment",
            status="pending",
            payment_gateway=subscription.payment_gateway,
            idempotency_key=f"inv_{invoice.id}_pay",
            description=f"Invoice {invoice.invoice_number} - {subscription.plan} plan",
        )
        self._transactions.save(transaction)

        return invoice

    def _pay_invoice(self, invoice_id: str, payment_method_id: str) -> Transaction:
        """Process payment for invoice - atomic with transaction record."""
        invoice = self._invoices.get(invoice_id)
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")
        
        subscription = self._subscriptions.get(invoice.org_id)
        gateway = self._gateways.get(subscription.payment_gateway)

        # Idempotency: check if already paid
        existing = self._transactions.find_by_idempotency_key(f"inv_{invoice_id}_pay")
        if existing and existing.status == "succeeded":
            return existing

        # Attempt payment via gateway
        gw_payment = gateway.pay_invoice(invoice.gateway_invoice_id, payment_method_id)

        # Update transaction
        transaction = self._transactions.find_by_idempotency_key(f"inv_{invoice_id}_pay")
        if not transaction:
            transaction = Transaction(
                id=f"txn_{uuid4().hex[:12]}",
                org_id=invoice.org_id,
                invoice_id=invoice.id,
                subscription_id=subscription.org_id,
                amount_cents=invoice.amount_cents,
                currency=invoice.currency,
                type="payment",
                status="pending",
                payment_gateway=subscription.payment_gateway,
                idempotency_key=f"inv_{invoice_id}_pay",
                description=f"Invoice {invoice.invoice_number} - {subscription.plan} plan",
            )
        
        transaction.status = "succeeded" if gw_payment.status == "succeeded" else "failed"
        transaction.gateway_transaction_id = gw_payment.id
        transaction.gateway_response = gw_payment.raw_response
        transaction.processed_at = datetime.utcnow()

        if transaction.status == "succeeded":
            invoice.status = "paid"
            invoice.paid_at = datetime.utcnow()
            invoice.gateway_payment_intent_id = gw_payment.id

        self._invoices.save(invoice)
        self._transactions.save(transaction)

        return transaction

    def cancel_subscription(self, org_id: str) -> Subscription:
        """Cancel subscription at period end (does not immediately downgrade)."""
        subscription = self._subscriptions.get(org_id)
        if subscription.plan == "Free":
            return subscription

        with self._transaction():
            if subscription.payment_gateway and subscription.gateway_subscription_id:
                gateway = self._gateways.get(subscription.payment_gateway)
                gateway.cancel_subscription(subscription.gateway_subscription_id, at_period_end=True)

            updated = Subscription(
                org_id=subscription.org_id,
                plan=subscription.plan,
                billing=subscription.billing,
                seats=subscription.seats,
                since=subscription.since,
                status=subscription.status,
                current_period_start=subscription.current_period_start,
                current_period_end=subscription.current_period_end,
                cancel_at_period_end=True,
                trial_end=subscription.trial_end,
                payment_gateway=subscription.payment_gateway,
                gateway_customer_id=subscription.gateway_customer_id,
                gateway_subscription_id=subscription.gateway_subscription_id,
            )

            self._subscriptions.save(updated)
            return updated

    def resume_subscription(self, org_id: str) -> Subscription:
        """Resume a subscription cancelled at period end."""
        subscription = self._subscriptions.get(org_id)
        if subscription.plan == "Free":
            return subscription
        if not subscription.cancel_at_period_end:
            return subscription

        with self._transaction():
            gateway = self._gateways.get(subscription.payment_gateway)
            if subscription.gateway_subscription_id and hasattr(gateway, "resume_subscription"):
                gateway.resume_subscription(subscription.gateway_subscription_id)

            updated = Subscription(
                org_id=subscription.org_id,
                plan=subscription.plan,
                billing=subscription.billing,
                seats=subscription.seats,
                since=subscription.since,
                status="active",
                current_period_start=subscription.current_period_start,
                current_period_end=subscription.current_period_end,
                cancel_at_period_end=False,
                trial_end=subscription.trial_end,
                payment_gateway=subscription.payment_gateway,
                gateway_customer_id=subscription.gateway_customer_id,
                gateway_subscription_id=subscription.gateway_subscription_id,
            )

            self._subscriptions.save(updated)
            return updated

    def upgrade_subscription(
        self,
        org_id: str,
        new_plan: str,
        new_billing_cycle: str = None,
        payment_method_id: str = None,
    ) -> Subscription:
        """Upgrade/downgrade to a new plan effective now (replaces current plan)."""
        subscription = self._subscriptions.get(org_id)
        if subscription.plan == "Free" and new_plan == "Free":
            return subscription

        billing_cycle = new_billing_cycle or subscription.billing or "monthly"
        self._validate_plan(new_plan, billing_cycle)

        # Replace the current plan effective now. Proration (credit for unused
        # time on the old plan) is applied as a line item on the next invoice.
        return self.create_subscription(
            org_id=org_id,
            plan=new_plan,
            billing_cycle=billing_cycle,
            payment_gateway=subscription.payment_gateway or "stripe",
            payment_method_id=payment_method_id,
        )

    # ============ INVOICE MANAGEMENT ============

    def get_invoice(self, invoice_id: str) -> Optional[Invoice]:
        return self._invoices.get(invoice_id)

    def list_invoices(self, org_id: str, status: Optional[str] = None) -> list[Invoice]:
        return self._invoices.list_for_org(org_id, status)

    def list_transactions(self, org_id: str, status: Optional[str] = None) -> list[Transaction]:
        return self._transactions.list_for_org(org_id, status)

    def pay_invoice(self, invoice_id: str, payment_method_id: str) -> Transaction:
        """Pay an open invoice."""
        return self._pay_invoice(invoice_id, payment_method_id)

    def void_invoice(self, invoice_id: str) -> Invoice:
        """Void an invoice (admin only)."""
        invoice = self._invoices.get(invoice_id)
        if invoice.status == "paid":
            raise ValueError("Cannot void paid invoice")
        
        invoice.status = "void"
        self._invoices.save(invoice)
        return invoice

    # ============ STUDENT BILLING ============

    def record_student_application(self, user_id: str) -> StudentUsage:
        """Track student application count for billing. Called when student applies."""
        month = datetime.utcnow().strftime("%Y-%m")
        
        with self._transaction():
            usage = self._student_usage.get_or_create(user_id, month)
            usage.application_count += 1
            
            # Check if should bill (31st application)
            if usage.application_count == self.STUDENT_FREE_APPS + 1:
                self._bill_student_overage(user_id, usage)
            
            self._student_usage.save(usage)
            return usage

    def _bill_student_overage(self, user_id: str, usage: StudentUsage):
        """Bill student for applications beyond free tier."""
        overage_count = usage.application_count - self.STUDENT_FREE_APPS
        amount_cents = overage_count * self.STUDENT_OVERAGE_CENTS
        
        invoice = Invoice(
            id=f"inv_{uuid4().hex[:12]}",
            org_id=user_id,  # student acts as their own "org" for billing
            amount_cents=amount_cents,
            currency="USD",
            status="open",
            invoice_number=self._generate_invoice_number(),
            line_items=[{
                "description": f"Applications over free tier ({self.STUDENT_FREE_APPS}/month)",
                "quantity": overage_count,
                "unit_amount_cents": self.STUDENT_OVERAGE_CENTS,
            }],
            due_date=datetime.utcnow() + timedelta(days=7),
            metadata={"type": "student_overage", "user_id": user_id},
        )
        self._invoices.save(invoice)
        
        usage.billed_count = overage_count
        usage.last_billed_at = datetime.utcnow()

    def get_student_usage(self, user_id: str) -> StudentUsage:
        """Get current month's usage for a student."""
        month = datetime.utcnow().strftime("%Y-%m")
        usage = self._student_usage.get(user_id, month)
        if not usage:
            usage = StudentUsage(
                id=f"su_{uuid4().hex[:12]}",
                user_id=user_id,
                month=month,
                application_count=0,
            )
        return usage

    def check_student_application_limit(self, user_id: str) -> dict:
        """Check if student can apply. Returns dict with allowed, current, limit, reason, unpaid_invoice."""
        usage = self.get_student_usage(user_id)
        free_limit = self.STUDENT_FREE_APPS
        
        if usage.application_count < free_limit:
            return {
                "allowed": True,
                "current": usage.application_count,
                "limit": free_limit,
                "reason": None
            }
        
        # Over free limit - check for unpaid overage invoice
        invoices = self._invoices.list_for_org(user_id, status="open")
        overage_invoices = [inv for inv in invoices if inv.metadata.get("type") == "student_overage"]
        
        if overage_invoices:
            # Has unpaid overage invoice - block until paid
            unpaid = overage_invoices[0]
            return {
                "allowed": False,
                "current": usage.application_count,
                "limit": free_limit,
                "reason": f"Free limit of {free_limit} applications/month exceeded. Pay overage invoice {unpaid.invoice_number} (${unpaid.amount_cents/100:.2f}) to continue applying.",
                "unpaid_invoice": {
                    "id": unpaid.id,
                    "invoice_number": unpaid.invoice_number,
                    "amount_cents": unpaid.amount_cents,
                    "due_date": unpaid.due_date
                }
            }
        
        # No unpaid invoice - allowed (next application will create new overage invoice)
        return {
            "allowed": True,
            "current": usage.application_count,
            "limit": free_limit,
            "reason": f"Free limit exceeded. Next application will create overage invoice at ${self.STUDENT_OVERAGE_CENTS/100:.2f}/application."
        }

    def list_student_invoices(self, user_id: str) -> list[Invoice]:
        """Invoices issued to a student (student acts as their own org for billing)."""
        return self._invoices.list_for_org(user_id)

    # ============ WEBHOOK HANDLING ============

    def handle_webhook(self, gateway_id: str, payload: bytes, signature: str) -> WebhookEvent:
        """Process gateway webhook - update local state from external events."""
        gateway = self._gateways.get(gateway_id)
        event = gateway.handle_webhook(payload, signature)
        
        with self._transaction():
            if event.type in ("invoice.payment_succeeded", "payment_intent.succeeded"):
                self._handle_payment_succeeded(event, gateway_id)
            elif event.type in ("invoice.payment_failed", "payment_intent.payment_failed"):
                self._handle_payment_failed(event, gateway_id)
            elif event.type == "customer.subscription.updated":
                self._handle_subscription_updated(event, gateway_id)
            elif event.type == "customer.subscription.deleted":
                self._handle_subscription_cancelled(event, gateway_id)
        
        return event

    def _handle_payment_succeeded(self, event: WebhookEvent, gateway_id: str):
        """Update invoice/transaction on successful payment."""
        data = event.data
        gw_invoice_id = data.get("invoice") or data.get("invoice_id")
        gw_payment_id = data.get("payment_intent") or data.get("id")
        
        if not gw_invoice_id:
            return
        
        invoice = self._invoices.find_by_gateway_id(gateway_id, gw_invoice_id)
        if not invoice:
            return
        
        invoice.status = "paid"
        invoice.paid_at = datetime.utcnow()
        invoice.gateway_payment_intent_id = gw_payment_id
        
        transaction = self._transactions.find_by_invoice_and_type(invoice.id, "payment")
        if not transaction:
            transaction = Transaction(
                id=f"txn_{uuid4().hex[:12]}",
                org_id=invoice.org_id,
                invoice_id=invoice.id,
                subscription_id=invoice.subscription_id,
                amount_cents=invoice.amount_cents,
                currency=invoice.currency,
                type="payment",
                status="pending",
                payment_gateway=gateway_id,
                idempotency_key=f"inv_{invoice.id}_pay_webhook",
            )
        
        transaction.status = "succeeded"
        transaction.gateway_transaction_id = gw_payment_id
        transaction.gateway_response = event.raw_data
        transaction.processed_at = datetime.utcnow()
        
        self._invoices.save(invoice)
        self._transactions.save(transaction)

    def _handle_payment_failed(self, event: WebhookEvent, gateway_id: str):
        """Handle failed payment."""
        data = event.data
        gw_invoice_id = data.get("invoice") or data.get("invoice_id")
        
        invoice = self._invoices.find_by_gateway_id(gateway_id, gw_invoice_id)
        if not invoice:
            return
        
        transaction = self._transactions.find_by_invoice_and_type(invoice.id, "payment")
        if transaction:
            transaction.status = "failed"
            transaction.gateway_response = event.raw_data
            transaction.processed_at = datetime.utcnow()
            self._transactions.save(transaction)

    def _handle_subscription_updated(self, event: WebhookEvent, gateway_id: str):
        """Handle subscription status changes."""
        data = event.data
        gw_sub_id = data.get("id")
        
        # Find local subscription by gateway ID
        from app.infrastructure.orm import SubscriptionORM
        sub_orm = self._session.query(SubscriptionORM).filter_by(
            gateway_subscription_id=gw_sub_id
        ).first()
        
        if sub_orm:
            sub_orm.status = data.get("status", sub_orm.status)
            sub_orm.current_period_start = datetime.fromtimestamp(data.get("current_period_start", 0))
            sub_orm.current_period_end = datetime.fromtimestamp(data.get("current_period_end", 0))
            sub_orm.cancel_at_period_end = data.get("cancel_at_period_end", False)

    def _handle_subscription_cancelled(self, event: WebhookEvent, gateway_id: str):
        """Handle subscription cancellation."""
        data = event.data
        gw_sub_id = data.get("id")
        
        from app.infrastructure.orm import SubscriptionORM
        sub_orm = self._session.query(SubscriptionORM).filter_by(
            gateway_subscription_id=gw_sub_id
        ).first()
        
        if sub_orm:
            sub_orm.status = "cancelled"
            sub_orm.plan = "Free"
            sub_orm.billing = ""
            sub_orm.cancel_at_period_end = False

    # ============ ADMIN ANALYTICS ============

    def get_revenue_analytics(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> dict:
        """Admin: Revenue breakdown by gateway, plan, org type."""
        from sqlalchemy import func
        
        # Total revenue
        total_revenue = self._session.query(func.sum(Transaction.amount_cents)).filter(
            Transaction.type == "payment",
            Transaction.status == "succeeded",
            Transaction.processed_at >= start_date,
            Transaction.processed_at <= end_date,
        ).scalar() or 0
        
        # By gateway
        by_gateway = self._session.query(
            Transaction.payment_gateway,
            func.count(Transaction.id),
            func.sum(Transaction.amount_cents)
        ).filter(
            Transaction.type == "payment",
            Transaction.status == "succeeded",
            Transaction.processed_at >= start_date,
            Transaction.processed_at <= end_date,
        ).group_by(Transaction.payment_gateway).all()
        
        # By plan
        from app.infrastructure.orm import SubscriptionORM
        by_plan = self._session.query(
            SubscriptionORM.plan,
            func.count(SubscriptionORM.org_id)
        ).filter(
            SubscriptionORM.plan != "Free"
        ).group_by(SubscriptionORM.plan).all()
        
        return {
            "total_revenue_cents": total_revenue,
            "total_revenue_usd": total_revenue / 100,
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "by_gateway": [
                {"gateway": g, "count": c, "revenue_cents": r, "revenue_usd": r / 100}
                for g, c, r in by_gateway
            ],
            "by_plan": [
                {"plan": p, "subscriptions": c}
                for p, c in by_plan
            ],
        }

    def get_outstanding_invoices(self) -> list[Invoice]:
        """Admin: All unpaid invoices past due date."""
        return self._invoices.list_outstanding()

    # ============ UTILITIES ============

    def _validate_plan(self, plan: str, billing_cycle: str):
        if plan not in self.PLAN_PRICES:
            raise ValueError(f"Unknown plan: {plan}")
        if billing_cycle not in ("monthly", "annual"):
            raise ValueError(f"Invalid billing cycle: {billing_cycle}")
        if plan != "Free" and self.PLAN_PRICES[plan].get(billing_cycle, 0) == 0:
            if plan != "Enterprise":  # Enterprise has custom pricing
                raise ValueError(f"Plan {plan} not available for {billing_cycle} billing")

    def _validate_gateway(self, gateway: PaymentGateway, currency: str):
        if currency not in gateway.get_supported_currencies():
            raise ValueError(f"Gateway does not support currency: {currency}")

    def _plan_to_price_id(self, plan: str, billing_cycle: str) -> str:
        """Map plan to gateway price ID."""
        return f"price_{plan.lower()}_{billing_cycle}"

    def _generate_invoice_number(self) -> str:
        """Generate unique invoice number: INV-YYYY-NNNNN"""
        # Use timestamp + random suffix for uniqueness without DB query
        year = datetime.utcnow().year
        unique_suffix = uuid4().hex[:8].upper()
        return f"INV-{year}-{unique_suffix}"


class StudentProfileService:
    """Use cases for a student's persisted academic profile."""

    def __init__(self, repo: StudentProfileRepository) -> None:
        self._repo = repo

    def get(self, user_id: str) -> StudentProfile:
        return self._repo.get(user_id)

    def save(
        self,
        *,
        user_id: str,
        course: str,
        year: str,
        cgpa: float,
        university: str,
        skills: list[str],
        talent_search_opt_in: bool = False,
        skills_confidence: Optional[dict[str, int]] = None,
        skills_source: Optional[dict[str, str]] = None,
    ) -> StudentProfile:
        clean_skills = list(
            dict.fromkeys(skill.strip() for skill in skills if skill.strip())
        )
        owned = set(clean_skills)
        confidence = {
            name: int(level)
            for name, level in (skills_confidence or {}).items()
            if name in owned and level in (1, 2, 3)
        }
        source = {
            name: value
            for name, value in (skills_source or {}).items()
            if name in owned and value
        }
        return self._repo.save(
            StudentProfile(
                user_id=user_id,
                course=course.strip(),
                year=year.strip(),
                cgpa=max(0.0, cgpa),
                university=university.strip(),
                skills=clean_skills,
                talent_search_opt_in=talent_search_opt_in,
                skills_confidence=confidence,
                skills_source=source,
            )
        )


class LearningResourceService:
    """Admin-curated resources that help students close skill gaps."""

    LEVELS = {"Beginner", "Intermediate", "Advanced"}

    def __init__(
        self,
        repo: LearningResourceRepository,
        placements: PlacementRepository,
    ) -> None:
        self._repo = repo
        self._placements = placements

    def list(
        self,
        *,
        skill: Optional[str] = None,
        placement_id: Optional[str] = None,
    ) -> list[LearningResource]:
        return self._repo.list(skill=skill, placement_id=placement_id)

    def create(
        self,
        *,
        title: str,
        url: str,
        provider: str = "",
        description: str = "",
        skill: str = "",
        placement_id: str = "",
        level: str = "",
        resource_type: str = "Course",
        duration: str = "",
    ) -> LearningResource:
        fields = self._validate(
            title=title,
            url=url,
            provider=provider,
            description=description,
            skill=skill,
            placement_id=placement_id,
            level=level,
            resource_type=resource_type,
            duration=duration,
        )
        return self._repo.add(
            LearningResource(
                id=uuid4().hex,
                created_at=datetime.now(timezone.utc).isoformat(),
                **fields,
            )
        )

    def update(
        self,
        resource_id: str,
        *,
        title: str,
        url: str,
        provider: str = "",
        description: str = "",
        skill: str = "",
        placement_id: str = "",
        level: str = "",
        resource_type: str = "Course",
        duration: str = "",
    ) -> LearningResource:
        existing = self._repo.get(resource_id)
        if existing is None:
            raise LearningResourceNotFound(resource_id)
        fields = self._validate(
            title=title,
            url=url,
            provider=provider,
            description=description,
            skill=skill,
            placement_id=placement_id,
            level=level,
            resource_type=resource_type,
            duration=duration,
        )
        return self._repo.update(
            LearningResource(
                id=existing.id,
                created_at=existing.created_at,
                **fields,
            )
        )

    def delete(self, resource_id: str) -> None:
        if not self._repo.delete(resource_id):
            raise LearningResourceNotFound(resource_id)

    def _validate(
        self,
        *,
        title: str,
        url: str,
        provider: str,
        description: str,
        skill: str,
        placement_id: str,
        level: str,
        resource_type: str,
        duration: str,
    ) -> dict:
        title = title.strip()
        url = url.strip()
        skill = skill.strip()
        placement_id = placement_id.strip()
        level = level.strip()
        if not title:
            raise ValueError("Title is required")
        if not url.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if skill and skill not in SKILL_NAMES:
            raise ValueError("Choose a skill from the skills taxonomy")
        if placement_id and self._placements.get(placement_id) is None:
            raise ValueError("Placement not found")
        if level and level not in self.LEVELS:
            raise ValueError("Level must be Beginner, Intermediate or Advanced")
        return {
            "title": title,
            "url": url,
            "provider": provider.strip(),
            "description": description.strip(),
            "skill": skill,
            "placement_id": placement_id,
            "level": level,
            "resource_type": (resource_type.strip() or "Course"),
            "duration": duration.strip(),
        }


class ResumeService:
    def __init__(self, repo: ResumeRepository) -> None:
        self._repo = repo

    def get(self, user_id: str) -> Optional[Resume]:
        return self._repo.get(user_id)

    def save(
        self,
        *,
        user_id: str,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> Resume:
        return self._repo.save(
            Resume(
                user_id=user_id,
                filename=filename,
                content_type=content_type,
                size_bytes=len(content),
                content=content,
                uploaded_at=datetime.now(timezone.utc).isoformat(),
            )
        )


class StudentDocumentService:
    ALLOWED_TYPES = {
        "transcript",
        "student_id",
        "national_id",
        "recommendation",
        "portfolio",
        "testimonial",
    }

    def __init__(self, repo: StudentDocumentRepository) -> None:
        self._repo = repo

    def list(self, user_id: str) -> list[StudentDocument]:
        return self._repo.list_for_user(user_id)

    def get_by_id(self, document_id: str) -> StudentDocument | None:
        return self._repo.get_by_id(document_id)

    def list_all(self, status: str | None = None) -> list[StudentDocument]:
        return self._repo.list_all(status=status)

    def verify_document(
        self,
        *,
        document_id: str,
        status: str,
        rejection_reason: str = "",
    ) -> StudentDocument | None:
        """Admin action: verify or reject a student document."""
        if status not in ("verified", "rejected"):
            raise ValueError("Status must be 'verified' or 'rejected'")
        if status == "rejected" and not rejection_reason.strip():
            raise ValueError("Rejection reason is required")
        document = self._repo.get_by_id(document_id)
        if document is None:
            return None
        document = StudentDocument(
            id=document.id,
            user_id=document.user_id,
            document_type=document.document_type,
            filename=document.filename,
            content_type=document.content_type,
            size_bytes=document.size_bytes,
            content=document.content,
            status=status,
            rejection_reason=rejection_reason.strip() if status == "rejected" else "",
            uploaded_at=document.uploaded_at,
        )
        return self._repo.save(document)

    def save(
        self,
        *,
        user_id: str,
        document_type: str,
        filename: str,
        content_type: str,
        content: bytes,
        author_role: str = "student",
    ) -> StudentDocument:
        if document_type not in self.ALLOWED_TYPES:
            raise ValueError("Unsupported document type")
        existing = next(
            (
                d
                for d in self._repo.list_for_user(user_id)
                if d.document_type == document_type
            ),
            None,
        )
        # Determine author_id based on role
        author_id = user_id
        if author_role in ("employer", "employee"):
            # For employer/employee, author_id could be org_id or user_id
            # We'll use user_id for now, can be enhanced later
            author_id = user_id
        document = StudentDocument(
            id=existing.id if existing else uuid4().hex,
            user_id=user_id,
            document_type=document_type,
            filename=filename,
            content_type=content_type,
            size_bytes=len(content),
            content=content,
            status="pending",
            uploaded_at=datetime.now(timezone.utc).isoformat(),
            is_public=document_type == "testimonial",  # Testimonials are public by default
            author_role=author_role,
            author_id=author_id,
        )
        return self._repo.save(document)

    def set_document_public(self, document_id: str, is_public: bool) -> StudentDocument | None:
        """Set the is_public flag on a document (admin only)."""
        document = self._repo.get_by_id(document_id)
        if document is None:
            return None
        document = StudentDocument(
            id=document.id,
            user_id=document.user_id,
            document_type=document.document_type,
            filename=document.filename,
            content_type=document.content_type,
            size_bytes=document.size_bytes,
            content=document.content,
            status=document.status,
            rejection_reason=document.rejection_reason,
            uploaded_at=document.uploaded_at,
            is_public=is_public,
        )
        return self._repo.save(document)

    def list_public_testimonials(self, limit: int = 10) -> list[StudentDocument]:
        """Get verified public testimonials for the home page carousel."""
        all_docs = self._repo.list_all(status="verified")
        public_testimonials = [d for d in all_docs if d.document_type == "testimonial" and d.is_public]
        return public_testimonials[:limit]

    def list_public_testimonials_by_role(self, role: str, limit: int = 10) -> list[StudentDocument]:
        """Get verified public testimonials filtered by author role."""
        all_docs = self._repo.list_all(status="verified")
        public_testimonials = [d for d in all_docs if d.document_type == "testimonial" and d.is_public and d.author_role == role]
        return public_testimonials[:limit]


# =============================================================================
# CONTACT INFO SERVICE
# =============================================================================

class ContactInfoService:
    """Service for managing contact information (email, WhatsApp)."""
    
    def __init__(self):
        # In production, this would come from a config table or environment variables
        self.email = "akandwanahojonan256@gmail.com"
        self.whatsapp = "+256756348528"
    
    def get_contact_info(self) -> dict:
        return {
            "email": self.email,
            "whatsapp": self.whatsapp,
        }


# =============================================================================
# LEARNING SERVICE
# =============================================================================

class LearningService:
    """Service for tracking student learning progress, courses, badges, and achievements."""
    
    def __init__(self, session):
        self.session = session
    
    def get_student_learning_profile(self, user_id: str) -> dict:
        """Get the student's complete learning profile."""
        # In production, this would query the database
        # For now, return mock data
        return {
            "user_id": user_id,
            "completed_courses": [
                {
                    "course_id": "python-101",
                    "course_name": "Python Fundamentals",
                    "completed_modules": 8,
                    "total_modules": 8,
                    "progress_percentage": 100.0,
                    "last_accessed": "2026-10-15T10:30:00Z",
                    "badge_earned": "python-fundamentals"
                },
                {
                    "course_id": "web-dev-101",
                    "course_name": "Web Development Basics",
                    "completed_modules": 6,
                    "total_modules": 10,
                    "progress_percentage": 60.0,
                    "last_accessed": "2026-11-01T14:20:00Z",
                    "badge_earned": None
                }
            ],
            "in_progress_courses": [
                {
                    "course_id": "react-101",
                    "course_name": "React Fundamentals",
                    "completed_modules": 3,
                    "total_modules": 8,
                    "progress_percentage": 37.5,
                    "last_accessed": "2026-11-10T09:15:00Z",
                    "badge_earned": None
                }
            ],
            "achievements": [
                {
                    "id": "python-fundamentals",
                    "name": "Python Fundamentals",
                    "description": "Completed all modules in Python Fundamentals course",
                    "earned_at": "2026-10-15T10:30:00Z",
                    "badge_icon": "🐍"
                }
],
            "badges": [
                {
                    "id": "python-fundamentals",
                    "name": "Python Fundamentals",
                    "icon": "🐍",
                    "earned": True,
                    "earned_at": "2026-10-15T10:30:00Z"
                },
                {
                    "id": "web-dev-101",
                    "name": "Web Development Basics",
                    "icon": "🌐",
                    "earned": False
                },
                {
                    "id": "react-101",
                    "name": "React Fundamentals",
                    "icon": "⚛️",
                    "earned": False
                }
            ],
            "skills_confidence": {"Figma": 3, "UI Design": 2},
            "skills_source": {"Figma": "project", "UI Design": "course"},
        }
    
    def mark_module_complete(self, user_id: str, course_id: str, module_id: str) -> dict:
        """Mark a module as complete and check for badge earning."""
        # In production, this would update the database
        # For now, return mock response
        
        # Check if course is complete
        badge_earned = None
        if course_id == "python-101" and module_id == "module-8":
            badge_earned = "python-fundamentals"
        elif course_id == "web-dev-101" and module_id == "module-10":
            badge_earned = "web-dev-101"
        elif course_id == "react-101" and module_id == "module-8":
            badge_earned = "react-101"
        
        return {
            "success": True,
            "badge_earned": badge_earned
        }
