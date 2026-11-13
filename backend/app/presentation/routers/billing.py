"""Billing API endpoints for company/organisation accounts."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, ConfigDict

from app.application.services import BillingService
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


class SubscriptionUpdate(BaseModel):
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None


class InvoiceCreate(BaseModel):
    line_items: list[dict]
    due_days: int = 7
    description: Optional[str] = None


class PaymentRequest(BaseModel):
    payment_method_id: str


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    subscription_id: Optional[str]
    amount_cents: int
    currency: str
    status: str
    invoice_number: str
    description: Optional[str]
    line_items: list[dict]
    metadata: dict
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
    org_id: str
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
    metadata: dict
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
    overage_apps: int = 0
    overage_cents: int = 50


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
    
    invoice = service.get_invoice(invoice_id)
    if not invoice or invoice.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != "open":
        raise HTTPException(status_code=409, detail="Invoice is not payable")
    
    transaction = service.pay_invoice(invoice_id, payload.payment_method_id)
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
    return {
        "plan": subscription.plan,
        "billing_cycle": subscription.billing,
        "status": subscription.status,
        "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
        "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        "seats": subscription.seats,
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
        ]
    }


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
    overage = max(0, usage.application_count - service.STUDENT_FREE_APPS)
    
    return StudentUsageResponse(
        id=usage.id,
        user_id=usage.user_id,
        month=usage.month,
        application_count=usage.application_count,
        billed_count=usage.billed_count,
        last_billed_at=usage.last_billed_at,
        free_limit=service.STUDENT_FREE_APPS,
        overage_apps=overage,
        overage_cents=service.STUDENT_OVERAGE_CENTS,
    )


@router.get("/student/invoices", response_model=list[InvoiceResponse])
def list_student_invoices(
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    """List student's overage invoices."""
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
    """Pay a student overage invoice."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can pay their invoices")
    
    invoice = service.get_invoice(invoice_id)
    if not invoice or invoice.org_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != "open":
        raise HTTPException(status_code=409, detail="Invoice is not payable")
    
    transaction = service.pay_invoice(invoice_id, payload.payment_method_id)
    return TransactionResponse.model_validate(transaction, from_attributes=True)


# ---- Admin Endpoints ----

@router.get("/admin/revenue", response_model=RevenueAnalyticsResponse)
def get_revenue_analytics(
    start_date: str = Query(...),
    end_date: str = Query(...),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> RevenueAnalyticsResponse:
    """Get revenue analytics for admin dashboard."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
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
        is_premium=sub.plan != "Free",
    )