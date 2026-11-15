"""Billing API endpoints for company/organisation accounts."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, ConfigDict, Field

from app.application.services import BillingService
from app.core.config import get_settings
from app.domain.entities import User, Invoice, Transaction, Subscription, StudentUsage
from app.presentation.deps import get_billing_service, get_current_user
from app.presentation.schemas import SubscriptionRead

router = APIRouter(prefix="/billing", tags=["billing"])


# ---- Request/Response Models ----

class SubscriptionCreate(BaseModel):
    plan: str  # "Pro", "Enterprise"
    billing_cycle: str = "monthly"  # "monthly", "annual"
    payment_gateway: str = "stripe"
    payment_method_id: Optional[str] = None
    terms_accepted: bool = False


class SubscriptionUpdate(BaseModel):
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None


class InvoiceCreate(BaseModel):
    line_items: list[dict]
    due_days: int = 7
    description: Optional[str] = None


class PaymentRequest(BaseModel):
    payment_method_id: str
    terms_accepted: bool = False


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: Optional[str] = None
    user_id: Optional[str] = None
    subscription_id: Optional[str]
    amount_cents: int
    currency: str
    status: str
    invoice_number: str
    description: Optional[str]
    line_items: list[dict]
    metadata: dict = Field(validation_alias="invoice_metadata")
    due_date: Optional[datetime]
    paid_at: Optional[datetime]
    payment_gateway: Optional[str]
    gateway_invoice_id: Optional[str]
    gateway_payment_intent_id: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: Optional[str] = None
    user_id: Optional[str] = None
    invoice_id: Optional[str]
    subscription_id: Optional[str]
    amount_cents: int
    currency: str
    type: str
    status: str
    payment_gateway: str
    gateway_transaction_id: Optional[str]
    gateway_response: dict
    description: Optional[str]
    metadata: dict = Field(validation_alias="transaction_metadata")
    idempotency_key: Optional[str]
    created_at: Optional[datetime]
    processed_at: Optional[datetime]


class StudentUsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    month: str
    application_count: int
    billed_count: int
    last_billed_at: Optional[datetime]
    free_limit: int = 30
    application_limit: int = 30
    plan: str = "Free"
    subscription_status: str = "free"
    price_cents: int = 0
    checkout_enabled: bool = False
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    overage_apps: int = 0
    overage_cents: int = 50
    unpaid_invoice_id: Optional[str] = None


class StudentCheckoutRequest(BaseModel):
    billing_email: Optional[str] = None
    idempotency_key: str = Field(min_length=8, max_length=128)
    terms_accepted: bool = False


class CheckoutPreviewRequest(BaseModel):
    plan: str = "Pro"
    billing_cycle: str = "monthly"
    payment_gateway: str = "stripe"


class CheckoutPreviewResponse(BaseModel):
    plan: str
    billing_cycle: str
    payment_gateway: str
    currency: str
    period: str
    line_items: list[dict]
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    gateway: str
    supported_currencies: list[str]


class CheckoutRequest(BaseModel):
    plan: str = "Pro"
    billing_cycle: str = "monthly"
    payment_gateway: str = "stripe"
    payment_method_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    billing_details: Optional[dict] = None
    terms_accepted: bool = False


class CheckoutResponse(BaseModel):
    subscription: Optional[dict] = None
    invoice: Optional[dict] = None
    transaction: Optional[dict] = None
    replayed: bool = False


class PaymentMethodRequest(BaseModel):
    type: str  # card, paypal, flutterwave, mpesa, bank_transfer, crypto
    details: dict = {}
    gateway_payment_method_id: Optional[str] = None


class PaymentMethodResponse(BaseModel):
    id: str
    org_id: str
    type: str
    details: dict
    is_default: bool
    gateway_payment_method_id: Optional[str] = None
    created_at: str


class RevenueAnalyticsResponse(BaseModel):
    total_revenue_cents: int
    total_revenue_usd: float
    period: dict
    by_gateway: list[dict]
    by_plan: list[dict]


# ---- Company/Org Endpoints ----

@router.post("/subscriptions", response_model=SubscriptionRead)
def create_subscription(
    payload: SubscriptionCreate,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    """Create or upgrade a subscription for the current user's organisation."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage subscriptions")
    if payload.plan != "Free" and not _sandbox_billing_enabled():
        raise HTTPException(status_code=503, detail="A live payment-provider integration is not configured")
    if payload.plan != "Free" and not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Subscription terms must be accepted")
    
    try:
        subscription = service.create_subscription(
            org_id=current_user.org_id,
            plan=payload.plan,
            billing_cycle=payload.billing_cycle,
            payment_gateway=payload.payment_gateway,
            payment_method_id=payload.payment_method_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    
    return _to_subscription_read(subscription)


@router.get("/subscriptions/current", response_model=SubscriptionRead)
def get_current_subscription(
    org_id: str | None = Query(None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    """Get the current organisation's subscription."""
    # Admin can specify org_id, employer uses their own org_id
    if current_user.role == "admin" and org_id:
        subscription = service.get_subscription(org_id)
    elif current_user.role == "employer" and current_user.org_id:
        subscription = service.get_subscription(current_user.org_id)
    else:
        raise HTTPException(status_code=403, detail="Only employers and admins can view subscriptions")
    
    return _to_subscription_read(subscription)


@router.patch("/subscriptions/current", response_model=SubscriptionRead)
def update_subscription(
    payload: SubscriptionUpdate,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    """Upgrade/downgrade subscription."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage subscriptions")
    
    if not payload.plan and not payload.billing_cycle:
        raise HTTPException(status_code=422, detail="Provide at least one of plan or billing_cycle")
    
    if payload.plan:
        try:
            subscription = service.upgrade_subscription(
                org_id=current_user.org_id,
                new_plan=payload.plan,
                new_billing_cycle=payload.billing_cycle,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        return _to_subscription_read(subscription)
    
    # Just return current if no plan change
    subscription = service.get_subscription(current_user.org_id)
    return _to_subscription_read(subscription)


@router.post("/subscriptions/current/cancel", response_model=SubscriptionRead)
def cancel_subscription(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    """Cancel subscription at period end."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage subscriptions")
    
    subscription = service.cancel_subscription(current_user.org_id)
    return _to_subscription_read(subscription)


@router.post("/subscriptions/current/resume", response_model=SubscriptionRead)
def resume_subscription(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    """Resume a cancelled subscription."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage subscriptions")
    
    subscription = service.resume_subscription(current_user.org_id)
    return _to_subscription_read(subscription)


@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    status: Optional[str] = Query(None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    """List invoices for the current organisation."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can view invoices")
    
    invoices = service.list_invoices(current_user.org_id, status)
    return [InvoiceResponse.model_validate(inv, from_attributes=True) for inv in invoices]


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> InvoiceResponse:
    """Get a specific invoice."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can view invoices")
    
    invoice = service.get_invoice(invoice_id)
    if not invoice or invoice.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return InvoiceResponse.model_validate(invoice, from_attributes=True)


@router.post("/invoices/{invoice_id}/pay", response_model=TransactionResponse)
def pay_invoice(
    invoice_id: str,
    payload: PaymentRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
    """Pay an open invoice."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can pay invoices")
    if not _sandbox_billing_enabled():
        raise HTTPException(status_code=503, detail="A live payment-provider integration is not configured")
    if not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Payment authorization is required")
    
    invoice = service.get_invoice(invoice_id)
    if not invoice or invoice.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != "open":
        raise HTTPException(status_code=409, detail="Invoice is not payable")
    
    try:
        transaction = service.pay_invoice(invoice_id, payload.payment_method_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return TransactionResponse.model_validate(transaction, from_attributes=True)


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    status: Optional[str] = Query(None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[TransactionResponse]:
    """List payment transactions for the current organisation."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can view transactions")
    
    transactions = service.list_transactions(current_user.org_id, status)
    return [TransactionResponse.model_validate(tx, from_attributes=True) for tx in transactions]


@router.get("/usage")
def get_usage(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Get current period usage for the organisation."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can view usage")
    
    # Return subscription info with placement counts
    subscription = service.get_subscription(current_user.org_id)
    placement_usage = service.check_placement_limit(current_user.org_id)
    return {
        "plan": subscription.plan,
        "billing_cycle": subscription.billing,
        "status": subscription.status,
        "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
        "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        "seats": subscription.seats,
        "current_placements": placement_usage["current"],
        "placement_limit": placement_usage["limit"],
        "remaining_placements": (
            None if placement_usage["limit"] == -1
            else max(0, placement_usage["limit"] - placement_usage["current"])
        ),
    }


@router.get("/gateways")
def list_gateways(
    current_user: User = Depends(get_current_user),
):
    """List available payment gateways."""
    return {
        "gateways": [
            {"id": "stripe", "name": "Stripe (Cards)", "currencies": ["USD", "EUR", "GBP", "UGX", "KES"]},
            {"id": "paypal", "name": "PayPal", "currencies": ["USD", "EUR", "GBP"]},
            {"id": "flutterwave", "name": "Flutterwave (Africa)", "currencies": ["USD", "UGX", "KES", "NGN", "GHS", "ZAR"]},
            {"id": "mpesa", "name": "M-Pesa (Mobile Money)", "currencies": ["KES", "USD"]},
            {"id": "bank_transfer", "name": "Bank Transfer", "currencies": ["USD", "UGX", "EUR", "KES"]},
            {"id": "crypto", "name": "Crypto (USDC/USDT)", "currencies": ["USDC", "USDT", "USD"]},
        ],
        "sandbox_mode": _sandbox_billing_enabled(),
    }


@router.post("/checkout/preview", response_model=CheckoutPreviewResponse)
def preview_checkout(
    payload: CheckoutPreviewRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> CheckoutPreviewResponse:
    """Preview the cost of a plan before committing (line items, subtotal, tax, total)."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can preview checkout")
    breakdown = service.preview_checkout(
        plan=payload.plan,
        billing_cycle=payload.billing_cycle,
        payment_gateway=payload.payment_gateway,
    )
    return CheckoutPreviewResponse(**breakdown)


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    payload: CheckoutRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> CheckoutResponse:
    """Create a subscription, issue and pay its invoice in one atomic checkout.

    ``idempotency_key`` prevents a double click from charging twice.
    """
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can check out")
    if payload.plan != "Free" and not _sandbox_billing_enabled():
        raise HTTPException(status_code=503, detail="A live payment-provider integration is not configured")
    if payload.plan != "Free" and not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Subscription terms must be accepted")
    try:
        result = service.checkout(
            org_id=current_user.org_id,
            plan=payload.plan,
            billing_cycle=payload.billing_cycle,
            payment_gateway=payload.payment_gateway,
            payment_method_id=payload.payment_method_id,
            idempotency_key=payload.idempotency_key,
            billing_details=payload.billing_details,
            terms_accepted=payload.terms_accepted,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return CheckoutResponse(**result)


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
def list_payment_methods(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[PaymentMethodResponse]:
    """List the organisation's saved payment methods."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage payment methods")
    return [PaymentMethodResponse(**pm) for pm in service.list_payment_methods(current_user.org_id)]


@router.post("/payment-methods", response_model=PaymentMethodResponse)
def add_payment_method(
    payload: PaymentMethodRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> PaymentMethodResponse:
    """Save a payment method for the organisation."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage payment methods")
    if get_settings().environment.lower() not in ("development", "test"):
        raise HTTPException(
            status_code=503,
            detail="Payment methods require a configured payment-provider integration",
        )
    if payload.type != "card":
        raise HTTPException(status_code=422, detail="Sandbox checkout supports card payments only")
    pm = service.add_payment_method(
        org_id=current_user.org_id,
        type="card",
        details={"brand": "Visa", "last4": "4242", "sandbox": True},
    )
    return PaymentMethodResponse(**pm)


@router.delete("/payment-methods/{payment_method_id}")
def delete_payment_method(
    payment_method_id: str,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Remove a saved payment method."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage payment methods")
    ok = service.delete_payment_method(current_user.org_id, payment_method_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "Payment method removed"}


@router.post("/payment-methods/{payment_method_id}/default")
def set_default_payment_method(
    payment_method_id: str,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Mark a payment method as the organisation's default."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can manage payment methods")
    ok = service.set_default_payment_method(current_user.org_id, payment_method_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "Default payment method updated"}


# ---- Student Endpoints ----

@router.get("/student/usage", response_model=StudentUsageResponse)
def get_student_usage(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> StudentUsageResponse:
    """Get current month's application usage for the student."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view their usage")
    
    usage = service.get_student_usage(current_user.id)
    plan = service.get_student_plan(current_user.id)
    overage = max(0, usage.application_count - plan["application_limit"])

    # Find any open overage invoice so the UI can show a pay-to-continue gate.
    unpaid_invoice_id = None
    for inv in service.list_student_invoices(current_user.id):
        if inv.status == "open" and inv.invoice_metadata.get("type") == "student_overage":
            unpaid_invoice_id = inv.id
            break

    return StudentUsageResponse(
        id=usage.id,
        user_id=usage.user_id,
        month=usage.month,
        application_count=usage.application_count,
        billed_count=usage.billed_count,
        last_billed_at=usage.last_billed_at,
        free_limit=service.STUDENT_FREE_APPS,
        application_limit=plan["application_limit"],
        plan=plan["plan"],
        subscription_status=plan["status"],
        price_cents=plan["price_cents"],
        checkout_enabled=get_settings().environment.lower() in ("development", "test"),
        current_period_start=plan["current_period_start"],
        current_period_end=plan["current_period_end"],
        cancel_at_period_end=plan["cancel_at_period_end"],
        overage_apps=overage,
        overage_cents=service.STUDENT_OVERAGE_CENTS,
        unpaid_invoice_id=unpaid_invoice_id,
    )


@router.post("/student/checkout")
def checkout_student_plan(
    payload: StudentCheckoutRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Purchase the monthly Student Plus plan."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can purchase Student Plus")
    if get_settings().environment.lower() not in ("development", "test"):
        raise HTTPException(
            status_code=503,
            detail="Student checkout requires a configured payment-provider integration",
        )
    if not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Payment authorization is required")
    try:
        result = service.checkout_student_plan(
            user_id=current_user.id,
            billing_email=payload.billing_email or current_user.email,
            terms_accepted=payload.terms_accepted,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result["transaction"].status != "succeeded":
        raise HTTPException(status_code=402, detail="Student Plus payment did not complete")
    return {
        "plan": result["plan"],
        "invoice": InvoiceResponse.model_validate(result["invoice"], from_attributes=True),
        "transaction": TransactionResponse.model_validate(
            result["transaction"], from_attributes=True
        ),
    }


@router.post("/student/subscription/cancel")
def cancel_student_subscription(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Schedule Student Plus cancellation for the end of the current billing period."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can manage their subscription")
    try:
        return service.cancel_student_subscription(current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/student/subscription/resume")
def resume_student_subscription(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Resume Student Plus after a scheduled cancellation."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can manage their subscription")
    try:
        return service.resume_student_subscription(current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/student/invoices", response_model=list[InvoiceResponse])
def list_student_invoices(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    """List a student's subscription and overage invoices."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view their invoices")
    
    invoices = service.list_student_invoices(current_user.id)
    return [InvoiceResponse.model_validate(inv, from_attributes=True) for inv in invoices]


@router.post("/student/invoices/{invoice_id}/pay", response_model=TransactionResponse)
def pay_student_invoice(
    invoice_id: str,
    payload: PaymentRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
    """Pay a student's open invoice."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can pay their invoices")
    if get_settings().environment.lower() not in ("development", "test"):
        raise HTTPException(
            status_code=503,
            detail="Student payments require a configured payment-provider integration",
        )
    if not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Payment authorization is required")
    
    invoice = service.get_invoice(invoice_id)
    if not invoice or (
        invoice.user_id != current_user.id and invoice.org_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != "open":
        raise HTTPException(status_code=409, detail="Invoice is not payable")
    
    try:
        transaction = service.pay_student_invoice(invoice_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return TransactionResponse.model_validate(transaction, from_attributes=True)


# ---- Admin Endpoints ----

@router.get("/admin/revenue", response_model=RevenueAnalyticsResponse)
def get_revenue_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> RevenueAnalyticsResponse:
    """Get revenue analytics for admin dashboard."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        end = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
        start = datetime.fromisoformat(start_date) if start_date else end - timedelta(days=30)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Dates must be valid ISO-8601 values") from exc
    if start > end:
        raise HTTPException(status_code=422, detail="start_date must be earlier than end_date")
    
    analytics = service.get_revenue_analytics(start, end)
    return RevenueAnalyticsResponse(**analytics)


@router.get("/admin/outstanding", response_model=list[InvoiceResponse])
def get_outstanding_invoices(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    """Get all overdue invoices."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    invoices = service.get_outstanding_invoices()
    return [InvoiceResponse.model_validate(inv, from_attributes=True) for inv in invoices]


@router.get("/admin/invoices", response_model=list[InvoiceResponse])
def list_admin_invoices(
    status: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    """List all invoices (admin). Optionally filter by status or organisation."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    invoices = service.list_all_invoices(status, org_id)
    return [InvoiceResponse.model_validate(inv, from_attributes=True) for inv in invoices]


@router.get("/admin/transactions", response_model=list[TransactionResponse])
def list_admin_transactions(
    status: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[TransactionResponse]:
    """List all transactions for administrators, with optional filters."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    transactions = service.list_all_transactions(status, org_id)
    return [TransactionResponse.model_validate(tx, from_attributes=True) for tx in transactions]


@router.post("/admin/invoices/{invoice_id}/void")
def void_invoice_admin(
    invoice_id: str,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
):
    """Void an invoice (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    invoice = service.void_invoice(invoice_id)
    return {"message": "Invoice voided", "invoice_id": invoice.id}


# ---- Helper ----

def _to_subscription_read(sub: Subscription) -> SubscriptionRead:
    since_str = ""
    if sub.since:
        if hasattr(sub.since, 'isoformat'):
            since_str = sub.since.isoformat()
        else:
            since_str = str(sub.since)
    return SubscriptionRead(
        plan=sub.plan,
        billing=sub.billing,
        seats=sub.seats,
        since=since_str,
        org_id=sub.org_id if hasattr(sub, 'org_id') else "",
        is_premium=sub.is_premium,
        status=sub.status,
        billing_cycle=sub.billing,
        current_period_start=sub.current_period_start,
        current_period_end=sub.current_period_end,
        cancel_at_period_end=sub.cancel_at_period_end,
        payment_gateway=sub.payment_gateway,
    )


def _sandbox_billing_enabled() -> bool:
    return get_settings().environment.lower() in ("development", "test")