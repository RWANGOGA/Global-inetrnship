"""Payment gateway factory and configuration.

The Flutterwave adapter is used automatically when credentials are present;
otherwise a sandbox adapter keeps local development and tests network-free.
"""
from typing import Optional

from app.application.ports import PaymentGateway
from app.infrastructure.payment_gateways.mock_gateway import (
    create_gateway, GATEWAY_CLASSES, MockGateway,
)
from app.infrastructure.payment_gateways.flutterwave_gateway import FlutterwaveGateway


class PaymentGatewayFactory:
    """Factory for creating and managing payment gateway instances."""

    def __init__(self):
        self._gateways: dict[str, PaymentGateway] = {}
        self._configs: dict[str, dict] = {}

    def register_gateway(self, gateway_id: str, config: dict = None) -> PaymentGateway:
        """Register and create a gateway instance."""
        if gateway_id.lower() == "flutterwave" and config and config.get("secret_key"):
            gateway = FlutterwaveGateway(config)
        else:
            gateway = create_gateway(gateway_id, config or {})
        self._gateways[gateway_id] = gateway
        self._configs[gateway_id] = config or {}
        return gateway

    def get(self, gateway_id: str) -> PaymentGateway:
        """Get a gateway instance, creating it if needed."""
        if gateway_id not in self._gateways:
            self.register_gateway(gateway_id, self._configs.get(gateway_id, {}))
        return self._gateways[gateway_id]

    def get_enabled_gateways(self) -> list[PaymentGateway]:
        """Return all enabled gateway instances."""
        return list(self._gateways.values())

    def is_gateway_enabled(self, gateway_id: str) -> bool:
        """Check if a gateway is registered and enabled."""
        return gateway_id in self._gateways


# Global factory instance
_gateway_factory: Optional[PaymentGatewayFactory] = None


def get_gateway_factory() -> PaymentGatewayFactory:
    """Get the global gateway factory instance."""
    global _gateway_factory
    if _gateway_factory is None:
        _gateway_factory = PaymentGatewayFactory()
        for gw_id in GATEWAY_CLASSES.keys():
            _gateway_factory.register_gateway(gw_id, {"mode": "mock"})
        # Elevate Flutterwave to the real adapter when credentials are supplied.
        from app.core.config import get_settings
        settings = get_settings()
        if settings.is_flutterwave_configured:
            _gateway_factory.register_gateway("flutterwave", {
                "secret_key": settings.flutterwave_secret_key,
                "public_key": settings.flutterwave_public_key,
                "webhook_hash": settings.flutterwave_webhook_hash,
                "mode": settings.flutterwave_mode,
            })
    return _gateway_factory
