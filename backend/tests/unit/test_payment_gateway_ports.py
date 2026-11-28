"""ISP: the gateway port is composed of narrow, purpose-specific roles."""
from app.application.ports import (
    CustomerGateway,
    GatewayCapabilities,
    InvoiceGateway,
    PaymentGateway,
    PaymentMethodGateway,
    SubscriptionGateway,
    WebhookHandler,
)
from app.infrastructure.payment_gateways.mock_gateway import create_gateway


ROLE_PORTS = (
    CustomerGateway,
    SubscriptionGateway,
    InvoiceGateway,
    PaymentMethodGateway,
    WebhookHandler,
    GatewayCapabilities,
)


def test_composite_gateway_extends_every_role():
    for role in ROLE_PORTS:
        assert issubclass(PaymentGateway, role)


def test_concrete_gateway_is_substitutable_for_each_role():
    gateway = create_gateway("flutterwave", {"mode": "mock"})
    for role in ROLE_PORTS:
        assert isinstance(gateway, role)


def test_role_ports_are_independent_interfaces():
    # No role should declare another role's methods (keeps them segregated).
    invoice_methods = {
        name for name in dir(InvoiceGateway) if not name.startswith("_")
    }
    webhook_methods = {
        name for name in dir(WebhookHandler) if not name.startswith("_")
    }
    assert "handle_webhook" not in invoice_methods
    assert "create_invoice" not in webhook_methods
