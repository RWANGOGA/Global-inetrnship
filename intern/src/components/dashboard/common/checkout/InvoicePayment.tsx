"use client";

import React, { useEffect, useState } from "react";
import {
  addPaymentMethodApi,
  fetchPaymentMethods,
  payInvoiceApi,
  payStudentInvoiceApi,
  type InvoiceResponse,
  type PaymentMethodResponse,
  type TransactionResponse,
} from "../../../../lib/api";
import { PaymentMethodPicker } from "./PaymentMethodPicker";

interface InvoicePaymentProps {
  invoice: Pick<InvoiceResponse, "id" | "invoice_number" | "amount_cents" | "currency" | "description" | "status" | "due_date">;
  audience: "employer" | "student";
  onClose: () => void;
  onPaid: (transaction: TransactionResponse) => void;
}

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountCents / 100);
}

export function InvoicePayment({ invoice, audience, onClose, onPaid }: InvoicePaymentProps) {
  const [methods, setMethods] = useState<PaymentMethodResponse[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(audience === "employer");
  const [paying, setPaying] = useState(false);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sandboxMode = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (audience !== "employer") return;
    let active = true;
    fetchPaymentMethods()
      .then((savedMethods) => {
        if (!active) return;
        setMethods(savedMethods);
        const defaultMethod = savedMethods.find((method) => method.is_default) ?? savedMethods[0];
        setSelectedMethod(defaultMethod?.id ?? null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load payment methods.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [audience]);

  const addSandboxMethod = async () => {
    setSavingMethod(true);
    setError(null);
    try {
      const method = await addPaymentMethodApi({ type: "card", details: { sandbox: true } });
      setMethods((current) => [method, ...current]);
      setSelectedMethod(method.id);
      setAddMethodOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add a test payment method.");
    } finally {
      setSavingMethod(false);
    }
  };

  const submitPayment = async () => {
    if (!authorized) {
      setError("Confirm the amount before continuing.");
      return;
    }
    if (audience === "employer" && !selectedMethod) {
      setError("Select a saved payment method.");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const transaction = audience === "student"
        ? await payStudentInvoiceApi(invoice.id, "sandbox-student-card")
        : await payInvoiceApi(invoice.id, selectedMethod!);
      if (transaction.status !== "succeeded") {
        setError("Payment was not completed. The invoice remains unpaid.");
        return;
      }
      onPaid(transaction);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be completed.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-payment-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, .48)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <section className="panel" style={{ width: "min(100%, 620px)", maxHeight: "90vh", overflow: "auto" }}>
        <div className="ph" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 id="invoice-payment-title" style={{ margin: 0, fontSize: 18 }}>Pay invoice</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>{invoice.invoice_number}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="pb" style={{ padding: 18, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "var(--ink-2)" }}>{invoice.description || "Outstanding invoice"}</span>
            <strong>{formatAmount(invoice.amount_cents, invoice.currency)}</strong>
          </div>

          {audience === "employer" && (
            <>
              {loading ? <p>Loading saved payment methods…</p> : (
                <PaymentMethodPicker
                  methods={methods}
                  selectedId={selectedMethod}
                  onSelect={setSelectedMethod}
                  onAdd={() => {
                    if (sandboxMode) setAddMethodOpen(true);
                    else setError("A live payment-provider integration is not configured.");
                  }}
                  adding={addMethodOpen}
                />
              )}
              {addMethodOpen && (
                <div style={{ display: "grid", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                    Test mode only. No real card details or charges are used.
                  </p>
                  <button type="button" className="btn btn-blue" onClick={addSandboxMethod} disabled={!sandboxMode || savingMethod}>
                    {savingMethod ? "Saving…" : "Save test payment method"}
                  </button>
                </div>
              )}
            </>
          )}

          {audience === "student" && (
            <div style={{ padding: 12, borderRadius: "var(--r-sm)", background: "var(--blue-tint)", fontSize: 12 }}>
              Student invoice payments are currently available in sandbox mode only; no real charge will be made.
            </div>
          )}
          {audience === "employer" && sandboxMode && (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Sandbox checkout only. No real card details or charges are used.
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: 10, borderRadius: "var(--r-sm)", color: "var(--red)", background: "var(--red-tint)", fontSize: 12 }}>
              {error}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "start", gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
            <span>I authorize payment of {formatAmount(invoice.amount_cents, invoice.currency)} for this invoice.</span>
          </label>
          <button
            type="button"
            className="btn btn-blue btn-block"
            onClick={submitPayment}
            disabled={!authorized || paying || loading || !sandboxMode || (audience === "employer" && !selectedMethod)}
          >
            {paying ? "Processing…" : `Pay ${formatAmount(invoice.amount_cents, invoice.currency)}`}
          </button>
        </div>
      </section>
    </div>
  );
}
