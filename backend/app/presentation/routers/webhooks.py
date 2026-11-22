"""Webhook endpoints for payment gateway callbacks."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.application.services import BillingService
from app.presentation.deps import get_billing_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    service: BillingService = Depends(get_billing_service),
):
    """Handle Stripe webhook events."""
    payload = await request.body()
    
    try:
        event = service.handle_webhook("stripe", payload, stripe_signature or "")
        return {"received": True, "event_type": event.type}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        # Log the error but return 200 to prevent Stripe retries for non-retryable errors
        print(f"Stripe webhook error: {exc}")
        return {"received": True, "error": str(exc)}


@router.post("/paypal")
async def paypal_webhook(
    request: Request,
    paypal_transmission_id: str = Header(None, alias="Paypal-Transmission-Id"),
    paypal_transmission_time: str = Header(None, alias="Paypal-Transmission-Time"),
    paypal_cert_url: str = Header(None, alias="Paypal-Cert-Url"),
    paypal_auth_algo: str = Header(None, alias="Paypal-Auth-Algo"),
    paypal_transmission_sig: str = Header(None, alias="Paypal-Transmission-Sig"),
    service: BillingService = Depends(get_billing_service),
):
    """Handle PayPal webhook events."""
    payload = await request.body()
    
    # Construct signature from headers
    signature = f"{paypal_transmission_id}|{paypal_transmission_time}|{paypal_cert_url}|{paypal_auth_algo}|{paypal_transmission_sig}"
    
    try:
        event = service.handle_webhook("paypal", payload, signature)
        return {"received": True, "event_type": event.type}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"PayPal webhook error: {exc}")
        return {"received": True, "error": str(exc)}


@router.post("/flutterwave")
async def flutterwave_webhook(
    request: Request,
    verif_hash: str = Header(None, alias="verif-hash"),
    service: BillingService = Depends(get_billing_service),
):
    """Handle Flutterwave webhook events.

    The ``verif-hash`` header is verified by the gateway before any state is
    changed. Missing or forged signatures are rejected with HTTP 400.
    """
    payload = await request.body()

    try:
        event = service.handle_webhook("flutterwave", payload, verif_hash or "")
        return {"received": True, "event_type": event.type}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"Flutterwave webhook error: {exc}")
        return {"received": True, "error": str(exc)}


@router.post("/mpesa")
async def mpesa_webhook(
    request: Request,
    service: BillingService = Depends(get_billing_service),
):
    """Handle M-Pesa webhook (STK Push callback)."""
    payload = await request.body()
    
    try:
        event = service.handle_webhook("mpesa", payload, "")
        return {"received": True, "event_type": event.type}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"M-Pesa webhook error: {exc}")
        return {"received": True, "error": str(exc)}


@router.post("/bank_transfer")
async def bank_transfer_webhook(
    request: Request,
    service: BillingService = Depends(get_billing_service),
):
    """Handle Bank Transfer webhook (manual confirmation)."""
    payload = await request.body()
    
    try:
        event = service.handle_webhook("bank_transfer", payload, "")
        return {"received": True, "event_type": event.type}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"Bank Transfer webhook error: {exc}")
        return {"received": True, "error": str(exc)}


@router.post("/crypto")
async def crypto_webhook(
    request: Request,
    service: BillingService = Depends(get_billing_service),
):
    """Handle Crypto payment webhook."""
    payload = await request.body()
    
    try:
        event = service.handle_webhook("crypto", payload, "")
        return {"received": True, "event_type": event.type}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"Crypto webhook error: {exc}")
        return {"received": True, "error": str(exc)}