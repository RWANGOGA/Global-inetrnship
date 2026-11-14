"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
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

export interface PaymentMethodOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "card",
    name: "Credit / Debit Card",
    icon: "brief",
    color: "var(--brand)",
    desc: "Visa, Mastercard, Amex, Discover",
  },
  {
    id: "upi",
    name: "UPI",
    icon: "send",
    color: "#1a73e8",
    desc: "PhonePe, Google Pay, Paytm, BHIM",
  },
  {
    id: "bank",
    name: "Net Banking",
    icon: "inbox",
    color: "#34a853",
    desc: "Direct from your bank account",
  },
  {
    id: "wallet",
    name: "Wallet",
    icon: "user-check",
    color: "#fbbc05",
    desc: "Amazon Pay, Amazon Pay ICICI Card",
  },
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
  const [step, setStep] = useState<"method" | "details" | "confirm" | "success" | "error">("method");
  const [method, setMethod] = useState<string>("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setStep("method");
      setError(null);
      setProcessing(false);
    }
  }, [isOpen]);

  const formatCardNumber = (val: string) => {
    return val.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    return val.replace(/\D/g, "").replace(/(\d{2})(\d{2})?/, "$1/$2").trim();
  };

  const formatCvv = (val: string) => {
    return val.replace(/\D/g, "").slice(0, 3);
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardExpiry(formatExpiry(e.target.value));
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardCvv(formatCvv(e.target.value));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardName(e.target.value);
  };

  const handleUpiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUpiId(e.target.value);
  };

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBank(e.target.value);
  };

  const selectMethod = (id: string) => {
    setMethod(id);
    setError(null);
  };

  const isCardValid = () => {
    const clean = cardNumber.replace(/\s/g, "");
    return clean.length === 16 && cardExpiry.match(/^\d{2}\/\d{2}$/) && cardCvv.length === 3 && cardName.trim().length > 0;
  };

  const isUpiValid = () => upiId.includes("@") && upiId.length > 3;

  const proceedToDetails = () => {
    if (method === "card" && !isCardValid()) {
      setError("Please enter valid card details");
      return;
    }
    if (method === "upi" && !isUpiValid()) {
      setError("Please enter a valid UPI ID");
      return;
    }
    if (method === "bank" && !bank) {
      setError("Please select a bank");
      return;
    }
    setStep("details");
  };

  const goBack = () => {
    setStep("method");
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

  return (
    <div className="pm-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2147483647, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="pm-modal" style={{ width: "min(520px, 92vw)", maxHeight: "90vh", background: "var(--bg)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", background: "var(--brand)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <Icon name="send" size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--fg)" }}>Payment</div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Pay securely with Brightworks</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "6px" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Steps */}
        <div style={{ padding: "0 24px", borderBottom: "1px solid var(--rule)", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {["method", "details", "confirm", "success"].map((stepName, idx) => (
              <div key={stepName} style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, padding: "10px 8px", borderRadius: "var(--r-sm)", background: step === stepName ? "var(--brand-bg)" : "transparent", color: step === stepName ? "var(--brand)" : "var(--muted)", fontSize: "11px", fontWeight: 600 }}>
                <span style={{ fontSize: "10px", opacity: 0.6 }}>{stepName === "method" ? "1" : stepName === "details" ? "2" : stepName === "confirm" ? "3" : "4"}</span>
                <span>{stepName === "method" ? "Method" : stepName === "details" ? "Details" : stepName === "confirm" ? "Confirm" : "Done"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Steps */}
          {step === "method" && (
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "var(--fg)" }}>Choose a payment method</h3>
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
                        border: `2px solid ${isSelected ? "var(--brand)" : "var(--rule)"}`,
                        borderRadius: "var(--r-md)",
                        background: isSelected ? "var(--brand-bg)" : "var(--bg)",
                        color: "var(--fg)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: isSelected ? "var(--brand)" : "var(--bg-elevated)", color: isSelected ? "white" : "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name={pm.icon as any} size={18} />
                        </div>
                        <span style={{ fontSize: "15px", fontWeight: 600 }}>{pm.name}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>{pm.desc}</p>
                    </button>
                  );
                })}
              </div>
              {error && <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--red)" }}>{error}</div>}
            </div>
          )}
          {step === "details" && (
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "var(--fg)" }}>{method === "card" ? "Card Details" : method === "upi" ? "UPI Details" : method === "bank" ? "Bank Details" : "Wallet Details"}</h3>
              <div style={{ maxWidth: "380px" }}>
                {method === "card" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "6px" }}>Card Number</label>
                        <input type="text" value={cardNumber} onChange={handleCardChange} placeholder="1234 5678 9012 3456" maxLength={19} style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none", fontFamily: "monospace" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "6px" }}>Expiry Date</label>
                        <input type="text" value={cardExpiry} onChange={handleExpiryChange} placeholder="MM/YY" maxLength={5} style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none", fontFamily: "monospace" }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "6px" }}>CVV</label>
                      <input type="text" value={cardCvv} onChange={handleCvvChange} placeholder="123" maxLength={3} style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none", fontFamily: "monospace" }} />
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "6px" }}>Cardholder Name</label>
                      <input type="text" value={cardName} onChange={handleNameChange} placeholder="JOHN DOE" style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none" }} />
                    </div>
                  </>
                )}
                {method === "upi" && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "6px" }}>UPI ID</label>
                    <input type="text" value={upiId} onChange={handleUpiChange} placeholder="name@upi" style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none" }} />
                  </div>
                )}
                {method === "bank" && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "6px" }}>Select Bank</label>
                    <select value={bank} onChange={handleBankChange} style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none" }}>
                      <option value="">Select Bank</option>
                      <option value="chase">Chase Bank</option>
                      <option value="bofa">Bank of America</option>
                      <option value="wells">Wells Fargo</option>
                      <option value="citibank">Citibank</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === "confirm" && (
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--blue-tint)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="brief" size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--fg)" }}>{method === "card" ? "Credit/Debit Card" : method === "upi" ? "UPI" : method === "bank" ? "Net Banking" : "Wallet"}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>{method === "card" ? `•••• ${cardNumber.slice(-4)}` : method === "upi" ? upiId : bank || "Bank Account"}</div>
                </div>
              </div>
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--fg)", marginBottom: "8px" }}>
                  <span>Order Total</span>
                  <span>$${(amount / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
                  <span>Currency</span>
                  <span>{currency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 600, color: "var(--fg)" }}>
                  <span>Total</span>
                  <span>$${(amount / 100).toFixed(2)}</span>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
                Your payment will be processed securely via {method === "card" ? "Secure Card Gateway" : method === "upi" ? "UPI Gateway" : method === "bank" ? "Bank Gateway" : "Wallet Gateway"}.
              </div>
              <button type="button" onClick={handlePay} disabled={processing} style={{ width: "100%", padding: "14px 24px", borderRadius: "var(--r-md)", border: "none", background: "var(--brand)", color: "white", fontSize: "15px", fontWeight: 600, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.6 : 1 }}>
                {processing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <span>Processing…</span>
                  </div>
                ) : (
                  <span>Pay ${(amount / 100).toFixed(2)} Now</span>
                )}
              </button>
            </div>
          )}
          {step === "success" && (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", background: "var(--green-tint)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <span style={{ color: "var(--success)", display: "inline-block" }}><Icon name="check" size={28} /></span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--fg)", marginBottom: "8px" }}>Payment Successful</div>
              <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}><span style={{ fontWeight: 600, color: "var(--fg)" }}>${(amount / 100).toFixed(2)}</span> has been charged successfully.</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Receipt ID:</span>
                <span style={{ fontSize: "12px", color: "var(--brand)", fontWeight: 500 }}>{invoiceId}</span>
              </div>
              <button type="button" onClick={onClose} style={{ width: "100%", padding: "12px 24px", borderRadius: "var(--r-md)", border: "none", background: "var(--brand)", color: "white", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Done</button>
            </div>
          )}
          {step === "error" && (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", background: "var(--danger-tint)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <span style={{ color: "var(--danger)", display: "inline-block" }}><Icon name="x" size={24} /></span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--fg)", marginBottom: "8px" }}>Payment Failed</div>
              <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}>{error}</div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={() => setStep("method")} style={{ width: "100%", padding: "12px 24px", borderRadius: "var(--r-md)", border: "1px solid var(--rule)", background: "transparent", color: "var(--fg)", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Try Again</button>
                <button type="button" onClick={onClose} style={{ width: "100%", padding: "12px 24px", borderRadius: "var(--r-md)", border: "none", background: "var(--brand)", color: "white", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
