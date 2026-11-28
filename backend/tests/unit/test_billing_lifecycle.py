"""Billing lifecycle edge cases: past-due recovery, failed payment, voiding."""
import pytest

from app.application.services import BillingService
from app.domain.entities import Invoice, Subscription
from tests.fakes import (
    FakeGatewayFactory,
    InMemoryInvoiceRepository,
    InMemoryPaymentMethodRepository,
    InMemoryStudentUsageRepository,
    InMemorySubscriptionRepository,
    InMemoryTransactionRepository,
)


def _service():
    subscriptions = InMemorySubscriptionRepository()
    invoices = InMemoryInvoiceRepository()
    payment_methods = InMemoryPaymentMethodRepository()
    service = BillingService(
        session=None,
        subscription_repo=subscriptions,
        invoice_repo=invoices,
        transaction_repo=InMemoryTransactionRepository(),
        gateway_factory=FakeGatewayFactory(),
        student_usage_repo=InMemoryStudentUsageRepository(),
        payment_method_repo=payment_methods,
    )
    return service, subscriptions, invoices, payment_methods


def _past_due_setup(service, subscriptions, invoices, payment_methods):
    gateway = service._gateways.get("stripe")
    customer = gateway.get_or_create_customer("o1")
    gateway_invoice = gateway.create_invoice(customer.id, [], {})

    subscriptions.save(
        Subscription(
            org_id="o1",
            plan="Pro",
            billing="monthly",
            status="past_due",
            payment_gateway="stripe",
            gateway_customer_id=customer.id,
        )
    )
    invoices.save(
        Invoice(
            id="inv_past_due",
            org_id="o1",
            amount_cents=3000,
            currency="USD",
            status="open",
            invoice_number="INV-PD-1",
            payment_gateway="stripe",
            gateway_invoice_id=gateway_invoice.id,
        )
    )
    method = payment_methods.add("o1", "card", {}, gateway_payment_method_id="pm_ok")
    return gateway, method


def test_successful_payment_reactivates_a_past_due_subscription():
    service, subscriptions, invoices, payment_methods = _service()
    _gateway, method = _past_due_setup(service, subscriptions, invoices, payment_methods)

    transaction = service.pay_invoice("inv_past_due", method["payment_method_id"])

    assert transaction.status == "succeeded"
    assert invoices.get("inv_past_due").status == "paid"
    assert subscriptions.get("o1").status == "active"


def test_paying_twice_is_idempotent():
    service, subscriptions, invoices, payment_methods = _service()
    _gateway, method = _past_due_setup(service, subscriptions, invoices, payment_methods)

    first = service.pay_invoice("inv_past_due", method["payment_method_id"])
    second = service.pay_invoice("inv_past_due", method["payment_method_id"])

    assert first.id == second.id
    assert second.status == "succeeded"
    assert len(service.list_transactions("o1")) == 1


def test_failed_payment_keeps_subscription_past_due_and_invoice_open():
    service, subscriptions, invoices, payment_methods = _service()
    gateway, method = _past_due_setup(service, subscriptions, invoices, payment_methods)
    gateway.config["force_payment_fail"] = True

    transaction = service.pay_invoice("inv_past_due", method["payment_method_id"])

    assert transaction.status == "failed"
    assert invoices.get("inv_past_due").status == "open"
    assert subscriptions.get("o1").status == "past_due"


def test_paid_invoice_cannot_be_voided():
    service, _subscriptions, invoices, _methods = _service()
    invoices.save(
        Invoice(id="inv_paid", org_id="o1", amount_cents=1000, status="paid")
    )

    with pytest.raises(ValueError):
        service.void_invoice("inv_paid")


def test_cancelling_a_free_plan_is_a_no_op():
    service, subscriptions, _invoices, _methods = _service()

    result = service.cancel_subscription("free-org")

    assert result.plan == "Free"
    assert subscriptions.get("free-org").cancel_at_period_end is False
