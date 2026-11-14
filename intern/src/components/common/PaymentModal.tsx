"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { BillingStepper } from "../dashboard/common/BillingStepper";
import { payInvoiceApi } from "../../lib/api";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  invoiceId: string;
  description: string;
  currency?: string;
  onPaymentSuccess?: (txnId: string) => void;
  onPaymentCancel?: () => void;
}

type PayStep = "method" | "details" | "confirm" | "success" | "error";

const PAYMENT_METHODS: Array<{ id: string; name: string; icon: string; desc: string }> = [
  { id: "card", name: "Credit / Debit Card", icon: "brief", desc: "Visa, Mastercard, Amex, Discover" },
  { id: "paypal", name: "PayPal", icon: "send", desc: "Pay with your PayPal account" },
  { id: "flutterwave", name: "Flutterwave", icon: "send", desc: "Cards, bank, mobile money (Africa)" },
  { id: "mpesa", name: "M-Pesa", icon: "send", desc: "Mobile money (East Africa)" },
  { id: "bank_transfer", name: "Bank Transfer", icon: "inbox", desc: "Direct from your bank account" },
  { id: "crypto", name: "Crypto (USDC/USDT)", icon: "brief", desc: "USDC / USDT stablecoins" },
];

export function PaymentModal({
  isOpen,
  onClose,
  amount,
  invoiceId,
  description,
  currency = "USD",
  onPaymentSuccess,
  onPaymentCancel,
}: PaymentModalProps) {
  const [step, setStep] = useState<PayStep>("method");
  const [method, setMethod] = useState<string>("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("method");
      setError(null);
      setProcessing(false);
    }
  }, [isOpen]);

  const formatCardNumber = (val: string) => val.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  const formatExpiry = (val: string) => val.replace(/\D/g, "").replace(/(\d{2})(\d{2})?/, "$1/$2").trim();
  const formatCvv = (val: string) => val.replace(/\D/g, "").slice(0, 3);

  const isCardValid = () => {
    const clean = cardNumber.replace(/\s/g, "");
    return clean.length === 16 && cardExpiry.match(/^\d{2}\/\d{2}$/) && cardCvv.length === 3 && cardName.trim().length > 0;
  };

  const selectMethod = (id: string) => {
    setMethod(id);
    setError(null);
  };

  const proceedToDetails = () => {
    if (method === "card" && !isCardValid()) {
      setError("Please enter valid card details");
      return;
    }
    setStep("details");
  };

  const goBack = () => {
    setStep("details");
    setError(null);
  };

  const handlePay = async () => {
    setProcessing(true);
    setError(null);
    try {
      const response = await payInvoiceApi(invoiceId, `${method}_${Date.now()}`);
      if (response.status === "succeeded" || response.status === "completed") {
        setStep("success");
        onPaymentSuccess?.(response.id);
      } else {
        setStep("error");
        setError("Payment failed. Please try again.");
      }
    } catch (e: any) {
      setStep("error");
      setError(e?.message || "Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const stepMap: Record<PayStep, { label: string; number: number }> = {
    method: { label: "Method", number: 1 },
    details: { label: "Details", number: 2 },
    confirm: { label: "Confirm", number: 3 },
    success: { label: "Done", number: 4 },
    error: { label: "Done", number: 4 },
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(14,17,20,.32)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "18px" }}>
      <div style={{ width: "min(520px, 92vw)", maxHeight: "90vh", background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 10px 26px -16px rgba(24,24,27,.18)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--paper-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", background: "var(--blue)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Icon name="send" size={16} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: "18px", fontWeight: 400, color: "var(--ink)" }}>Payment</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Pay securely</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "6px" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Steps */}
        <div style={{ padding: "0 20px", borderBottom: "1px solid var(--rule)", background: "var(--paper-2)" }}>
          <BillingStepper activeStep={
            step === "method" ? "plan" :
            step === "details" ? "payment-method" :
            step === "confirm" ? "review" :
            step === "success" ? "confirm" : "receipt"
          } size="sm" />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {step === "method" && (
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: "18px", fontWeight: 400, color: "var(--ink)", marginBottom: "16px" }}>Choose a payment method</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                {PAYMENT_METHODS.map((pm) => {
                  const isSelected = method === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => selectMethod(pm.id)}
                      style={{
                        width: "100%",
                        padding: "18px 16px",
                        border: `2px solid ${isSelected ? "var(--blue)" : "var(--rule-2)"}`,
                        borderRadius: "var(--r-md)",
                        background: isSelected ? "var(--blue-tint)" : "var(--paper)",
                        color: "var(--ink)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        transition: "all 0.2s",
                        fontFamily: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: isSelected ? "var(--blue)" : "var(--paper-2)", color: isSelected ? "#fff" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name={pm.icon as any} size={16} />
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--sans)" }}>{pm.name}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, fontFamily: "var(--sans)", fontWeight: 500 }}>{pm.desc}</p>
                    </button>
                  );
                })}
              </div>
              {error && <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--red)", fontFamily: "var(--sans)", fontWeight: 500 }}>{error}</div>}
              <div style={{ marginTop: "20px", display: "flex", gap: "8px" }}>
                <button type="button" onClick={onClose} className="btn btn-sm btn-ghost" style={{ fontWeight: 700 }}>Cancel</button>
                <button type="button" onClick={proceedToDetails} disabled={method === "card" && !isCardValid()} className="btn btn-sm btn-blue" style={{ fontWeight: 700 }}>Continue</button>
              </div>
            </div>
          )}
          {step === "details" && (
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: "18px", fontWeight: 400, color: "var(--ink)", marginBottom: "16px" }}>{method === "card" ? "Card details" : method.toUpperCase()} details</div>
              <div style={{ maxWidth: "380px" }}>
                {method === "card" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Card number</label>
                        <input type="text" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--rule-2)", borderRadius: "var(--r-sm)", background: "var(--paper)", color: "var(--ink)", fontSize: "13px", fontFamily: "var(--mono)", outline: 0 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Expiry date</label>
                        <input type="text" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--rule-2)", borderRadius: "var(--r-sm)", background: "var(--paper)", color: "var(--ink)", fontSize: "13px", fontFamily: "var(--mono)", outline: 0 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>CVV</label>
                      <input type="text" value={cardCvv} onChange={(e) => setCardCvv(formatCvv(e.target.value))} placeholder="123" maxLength={3} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--rule-2)", borderRadius: "var(--r-sm)", background: "var(--paper)", color: "var(--ink)", fontSize: "13px", fontFamily: "var(--mono)", outline: 0 }} />
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Cardholder name</label>
                      <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="JOHN DOE" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--rule-2)", borderRadius: "var(--r-sm)", background: "var(--paper)", color: "var(--ink)", fontSize: "13px", outline: 0 }} />
                    </div>
                  </>
                )}
                {method !== "card" && (
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Account identifier</label>
                    <input type="text" placeholder="Enter account details" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--rule-2)", borderRadius: "var(--r-sm)", background: "var(--paper)", color: "var(--ink)", fontSize: "13px", outline: 0 }} />
                  </div>
                )}
              </div>
              <div style={{ marginTop: "24px", display: "flex", gap: "8px" }}>
                <button type="button" onClick={goBack} className="btn btn-sm btn-ghost" style={{ fontWeight: 700 }}>Back</button>
                <button type="button" onClick={() => setStep("confirm")} className="btn btn-sm btn-blue" style={{ fontWeight: 700 }}>Continue</button>
              </div>
            </div>
          )}
          {step === "confirm" && (
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "var(--blue-tint)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="brief" size={16} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--sans)" }}>{method === "card" ? "Credit/Debit Card" : method.toUpperCase()}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--mono)" }}>{method === "card" ? `•••• ${cardNumber.slice(-4)}` : "Account on file"}</div>
                </div>
              </div>
              <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-md)", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--ink)", marginBottom: "8px", fontWeight: 500 }}>
                  <span>Order total</span>
                  <span>$${(amount / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "12px", fontFamily: "var(--mono)" }}>
                  <span>Currency</span>
                  <span>{currency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "17px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--serif)" }}>
                  <span>Total</span>
                  <span>$${(amount / 100).toFixed(2)}</span>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px", fontFamily: "var(--sans)", fontWeight: 500 }}>
                Your payment will be processed securely via {method === "card" ? "Secure card gateway" : "Selected gateway"}.
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={goBack} className="btn btn-sm btn-ghost" style={{ fontWeight: 700 }}>Back</button>
                <button type="button" onClick={handlePay} disabled={processing} className="btn btn-sm btn-blue" style={{ fontWeight: 700 }}>
                  {processing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "14px", height: "14px", border: "2px solid rgba(24,24,27,.3)", borderTopColor: "var(--ink)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <span>Processing…</span>
                    </div>
                  ) : (
                    <span>Pay $${(amount / 100).toFixed(2)} now</span>
                  )}
                </button>
              </div>
            </div>
          )}
          {step === "success" && (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", background: "var(--green-tint)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <span style={{ color: "var(--green)", display: "inline-block" }}><Icon name="check" size={28} /></span>
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: "22px", fontWeight: 400, color: "var(--ink)", marginBottom: "8px" }}>Payment successful</div>
              <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px", fontFamily: "var(--sans)", fontWeight: 500 }}><span style={{ fontWeight: 600, color: "var(--ink)" }}>${(amount / 100).toFixed(2)}</span> has been charged successfully.</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "24px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Receipt id:</span>
                <span style={{ fontSize: "11px", color: "var(--blue)", fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{invoiceId}</span>
              </div>
              <button type="button" onClick={onClose} className="btn btn-sm btn-blue" style={{ fontWeight: 700 }}>Done</button>
            </div>
          )}
          {step === "error" && (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", background: "var(--red-tint)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <span style={{ color: "var(--red)", display: "inline-block" }}><Icon name="x" size={24} /></span>
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: "22px", fontWeight: 400, color: "var(--ink)", marginBottom: "8px" }}>Payment failed</div>
              <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px", fontFamily: "var(--sans)", fontWeight: 500 }}>{error}</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button type="button" onClick={() => setStep("method")} className="btn btn-sm btn-ghost" style={{ fontWeight: 700 }}>Try again</button>
                <button type="button" onClick={onClose} className="btn btn-sm btn-blue" style={{ fontWeight: 700 }}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
