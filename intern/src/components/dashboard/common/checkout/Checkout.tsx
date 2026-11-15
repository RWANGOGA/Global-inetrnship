"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../../../context/AppContext";
import {
  fetchSubscription,
  fetchGateways,
  fetchPaymentMethods,
  addPaymentMethodApi,
  previewCheckoutApi,
  checkoutApi,
  type SubscriptionDto,
  type GatewayOption,
  type CheckoutPreviewResponse,
  type PaymentMethodResponse,
} from "../../../../lib/api";
import { OrderSummary } from "./OrderSummary";
import { PaymentMethodPicker } from "./PaymentMethodPicker";
import { OrderConfirmation } from "./OrderConfirmation";
import { Icon } from "../../../icons/Icons";
import styles from "./Checkout.module.css";

type Section = "plan" | "details" | "payment" | "review";

interface PlanOption {
  value: string;
  label: string;
  desc: string;
}

const PLANS: PlanOption[] = [
  { value: "Pro", label: "Pro", desc: "Unlimited placements + priority review" },
];

const CYCLES: { value: "monthly" | "annual"; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual (save 17%)" },
];

export function Checkout({
  onClose,
  initialPlan = "Pro",
  initialBillingCycle = "monthly",
}: {
  onClose?: () => void;
  initialPlan?: string;
  initialBillingCycle?: "monthly" | "annual";
} = {}) {
  const { toast, role } = useApp();
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [methods, setMethods] = useState<PaymentMethodResponse[]>([]);
  const [preview, setPreview] = useState<CheckoutPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    subscription: SubscriptionDto | null;
    invoice: { invoice_number: string } | null;
    transaction: { id: string; amount_cents: number } | null;
  } | null>(null);

  // Form state
  const [plan, setPlan] = useState(initialPlan);
  const [cycle, setCycle] = useState<"monthly" | "annual">(initialBillingCycle);
  const [gateway, setGateway] = useState("stripe");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [addingMethod, setAddingMethod] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Section state
  const [done, setDone] = useState<Record<Section, boolean>>({
    plan: false,
    details: false,
    payment: false,
    review: false,
  });
  const [expanded, setExpanded] = useState<Section | null>("plan");
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [gw, pm] = await Promise.all([fetchGateways(), fetchPaymentMethods()]);
        if (cancelled) return;
        setGateways(gw);
        setMethods(pm);
        if (pm.length && !selectedPaymentMethod) {
          const def = pm.find((m) => m.is_default) || pm[0];
          setSelectedPaymentMethod(def.id);
        }
        setGateway(gw[0]?.id || "stripe");
      } catch {
        /* gateways optional — checkout still works with defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canPreview = useMemo(() => Boolean(plan && cycle && gateway), [plan, cycle, gateway]);

  const refreshPreview = useCallback(async () => {
    if (!canPreview) return;
    setLoading(true);
    setError(null);
    try {
      const p = await previewCheckoutApi({
        plan,
        billing_cycle: cycle,
        payment_gateway: gateway,
      });
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't preview pricing.");
    } finally {
      setLoading(false);
    }
  }, [plan, cycle, gateway, canPreview]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  const placeOrder = useCallback(async () => {
    if (
      !preview ||
      !selectedPaymentMethod ||
      !done.plan ||
      !done.details ||
      !done.payment ||
      !termsAccepted
    ) {
      setError("Complete each checkout step and accept the subscription terms before ordering.");
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const result = await checkoutApi({
        plan,
        billing_cycle: cycle,
        payment_gateway: gateway,
        payment_method_id: selectedPaymentMethod,
        idempotency_key: idempotencyKeyRef.current,
        billing_details: {
          email: billingEmail,
          tax_id: taxId,
          billing_address: billingAddress,
        },
        terms_accepted: termsAccepted,
      });
      if (result.transaction?.status !== "succeeded") {
        setError("Payment was not completed. Your paid plan has not been activated.");
        return;
      }
      setConfirmed({
        subscription: result.subscription ?? null,
        invoice: result.invoice ? { invoice_number: result.invoice.invoice_number } : null,
        transaction: result.transaction
          ? { id: result.transaction.id, amount_cents: result.transaction.amount_cents }
          : null,
      });
      toast("Order placed · receipt ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed — please try again.");
    } finally {
      setPlacing(false);
    }
  }, [plan, cycle, gateway, selectedPaymentMethod, preview, billingEmail, taxId, billingAddress, done, termsAccepted]);

  const handleSectionToggle = (s: Section) => {
    setExpanded(expanded === s ? null : s);
  };
  const handleChange = (s: Section) => {
    setDone((prev) => {
      if (s === "plan") return { plan: false, details: false, payment: false, review: false };
      if (s === "details") return { ...prev, details: false, payment: false, review: false };
      if (s === "payment") return { ...prev, payment: false, review: false };
      return { ...prev, review: false };
    });
    setTermsAccepted(false);
    setExpanded(s);
  };

  const canPlaceOrder = Boolean(
    preview && selectedPaymentMethod && done.plan && done.details && done.payment && termsAccepted && !placing
  );

  const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const paymentMethodLabel = selectedPaymentMethod
    ? methods.find((m) => m.id === selectedPaymentMethod)?.type ?? null
    : null;

  return (
    <section className={`dpane ${styles.checkout}`} style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {confirmed ? (
        <OrderConfirmation
          subscription={confirmed.subscription}
          invoice={confirmed.invoice}
          transaction={confirmed.transaction}
          onBackToBilling={() => {
            setConfirmed(null);
            setExpanded("plan");
          }}
        />
      ) : (
        <>
          <div className="dpane-h">
            <div>
              <h2 style={{ fontSize: "26px", fontWeight: 400, margin: 0, letterSpacing: "-0.02em", fontFamily: "var(--serif)" }}>
                Subscribe to {plan}
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "3px" }}>
                One page checkout — pick your plan, billing details and payment method, then place your order.
              </p>
            </div>
            {onClose ? (
              <button
                className="btn btn-ghost"
                onClick={onClose}
                style={{ height: 40, padding: "0 14px", fontSize: "12.5px", color: "var(--ink)" }}
              >
                <Icon name="chevron-left" size={14} style={{ marginRight: 6 }} /> Back to billing
              </button>
            ) : (
              role === "employer" && (
                <button
                  className="btn btn-blue"
                  onClick={() => setExpanded("plan")}
                  style={{ height: 40, padding: "0 16px" }}
                >
                  Change plan
                </button>
              )
            )}
          </div>

          {error && (
            <div style={{ padding: "10px 12px", marginBottom: 12, background: "var(--red-tint)", border: "1px solid var(--red-tint)", color: "var(--red)", borderRadius: "var(--r-sm)", fontSize: "12.5px" }}>
              {error}
            </div>
          )}

          <div className={styles.layout}>
            {/* Left: sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {renderSection("plan", "1 · Choose your plan", [
                renderPlanSection(),
              ])}
              {renderSection("details", "2 · Billing details", [
                renderDetailsSection(),
              ])}
              {renderSection("payment", "3 · Payment method", [
                renderPaymentSection(),
              ])}
              {renderSection("review", "4 · Review & place order", [
                renderReviewSection(),
              ])}
            </div>

            {/* Right: sticky order summary */}
            <OrderSummary
              className={styles.summary}
              preview={preview}
              plan={plan}
              cycle={cycle}
              paymentMethod={paymentMethodLabel}
              placing={placing}
              onPlaceOrder={placeOrder}
              canPlace={canPlaceOrder}
            />
          </div>
        </>
      )}
    </section>
  );

  function renderSection(key: Section, title: string, body: React.ReactNode) {
    const isDone = done[key];
    const isExpanded = expanded === key;
    const showBody = isExpanded || (!isDone && expanded == null && key === firstIncomplete());
    return (
      <section
        key={key}
        className="panel"
        style={{ display: "flex", flexDirection: "column", gap: 0 }}
      >
        <div
          className="ph"
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (isDone) {
              handleChange(key);
            } else {
              handleSectionToggle(key);
            }
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>
            {isDone ? <Icon name="check" size={14} style={{ color: "var(--green)" }} /> : <span style={{ fontSize: "10px" }}>{key.charAt(0).toUpperCase()}</span>}
            {title}
            {!isDone && isExpanded && <Icon name="chevron-up" size={12} style={{ marginLeft: "auto", color: "var(--muted)" }} />}
            {!isDone && !isExpanded && <Icon name="chevron-down" size={12} style={{ marginLeft: "auto", color: "var(--muted)" }} />}
          </div>
          {isDone && (
            <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: 4, cursor: "pointer", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={(e) => { e.stopPropagation(); handleChange(key); }}>
              <Icon name="chevron-right" size={11} /> Change
            </div>
          )}
        </div>
        {showBody ? (
          <div className="pb" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {body}
          </div>
        ) : null}
      </section>
    );
  }

  function firstIncomplete(): Section | null {
    for (const s of ["plan", "details", "payment", "review"] as Section[]) {
      if (!done[s]) return s;
    }
    return null;
  }

  function renderPlanSection() {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="lbl ink">Plan</div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {PLANS.map((p) => {
              const sel = plan === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => {
                    setPlan(p.value);
                    setDone((d) => ({ ...d, plan: false, details: false, payment: false, review: false }));
                    setTermsAccepted(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    border: `1px solid ${sel ? "var(--blue)" : "var(--rule-2)"}`,
                    background: sel ? "var(--blue-tint)" : "#fff",
                    color: sel ? "var(--blue)" : "var(--ink-2)",
                    fontWeight: sel ? 700 : 500,
                    fontSize: "12.5px",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)" }}>{p.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 2 }}>{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="lbl ink">Billing cycle</div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {CYCLES.map((c) => {
              const sel = cycle === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => {
                    setCycle(c.value);
                    setDone((d) => ({ ...d, plan: false, details: false, payment: false, review: false }));
                    setTermsAccepted(false);
                  }}
                  style={{
                    padding: "10px 14px",
                    border: `1px solid ${sel ? "var(--blue)" : "var(--rule-2)"}`,
                    background: sel ? "var(--blue-tint)" : "#fff",
                    color: sel ? "var(--blue)" : "var(--ink-2)",
                    fontWeight: sel ? 700 : 500,
                    fontSize: "12.5px",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="lbl ink">Payment gateway</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {gateways.map((g) => {
              const sel = gateway === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setGateway(g.id);
                    setDone((d) => ({ ...d, plan: false, details: false, payment: false, review: false }));
                    setTermsAccepted(false);
                  }}
                  style={{
                    padding: "8px 12px",
                    border: `1px solid ${sel ? "var(--blue)" : "var(--rule-2)"}`,
                    background: sel ? "var(--blue-tint)" : "#fff",
                    color: sel ? "var(--blue)" : "var(--ink-2)",
                    fontWeight: sel ? 700 : 500,
                    fontSize: "11.5px",
                    borderRadius: "var(--r-pill)",
                    cursor: "pointer",
                  }}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
        <button
          className="btn btn-blue"
          onClick={() => {
            setDone((d) => ({ ...d, plan: true }));
            setExpanded("details");
          }}
        >
          Continue to billing details
        </button>
      </div>
    );
  }

  function renderDetailsSection() {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="lbl ink">Billing email</div>
          <div className="fld">
            <input
              type="email"
              placeholder="you@organisation.org"
              value={billingEmail}
              onChange={(e) => {
                setBillingEmail(e.target.value);
                setDone((d) => ({ ...d, details: false, payment: false, review: false }));
              }}
              style={{}}
            />
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="lbl ink">Tax ID (optional)</div>
          <div className="fld">
            <input
              placeholder="VAT / GST registration number"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              style={{}}
            />
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="lbl ink">Billing address</div>
          <div className="fld">
            <input
              placeholder="Street, city, postal code"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              style={{}}
            />
          </div>
        </div>
        <button
          className="btn btn-blue"
          onClick={() => {
            const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim());
            if (!validEmail) {
              toast("Enter a valid billing email.");
              return;
            }
            setDone((d) => ({ ...d, details: true }));
            setExpanded("payment");
          }}
          disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())}
          style={{}}
        >
          Continue to payment
        </button>
      </div>
    );
  }

  function renderPaymentSection() {
    const defaultMethod = methods.find((m) => m.is_default) || methods[0];
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <PaymentMethodPicker
          methods={methods}
          selectedId={selectedPaymentMethod ?? (defaultMethod?.id ?? null)}
          onSelect={(id) => {
            setSelectedPaymentMethod(id);
            setDone((d) => ({ ...d, payment: false, review: false }));
            setTermsAccepted(false);
          }}
          onAdd={() => setAddingMethod(true)}
          adding={addingMethod}
        />
        {addingMethod && (
          <div style={{ display: "grid", gap: 8, paddingTop: 6, borderTop: "1px solid var(--rule)" }}>
            <div className="lbl ink">Add a sandbox payment method</div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
              Test mode only. No real card details or charges are used.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-blue"
                  onClick={async () => {
                    try {
                      const pm = await addPaymentMethodApi({
                        type: "card",
                        details: { sandbox: true },
                      });
                      setMethods((prev) => [pm, ...prev]);
                      setSelectedPaymentMethod(pm.id);
                      setDone((d) => ({ ...d, payment: false }));
                      setAddingMethod(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not save the test payment method.");
                    }
                  }}
                >
                  Save test payment method
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setAddingMethod(false)}
                  style={{}}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {selectedPaymentMethod && (
          <button
            className="btn btn-blue"
            onClick={() => {
              setDone((d) => ({ ...d, payment: true }));
              setExpanded("review");
            }}
          >
            Continue to review
          </button>
        )}
      </div>
    );
  }

  function renderReviewSection() {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="lbl ink">Order review</div>
          <p style={{ fontSize: "12px", color: "var(--ink-2)", margin: 0 }}>
            Confirm your subscription before placing the order. You can cancel at any time;
            cancellation takes effect at the end of the billing period.
          </p>
        </div>
        <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "10.5px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--rule)" }}>Item</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--rule)", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview?.line_items.map((item: { description: string; amount_cents: number }, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{item.description}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{currency(item.amount_cents)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>Subtotal</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{currency(preview?.subtotal_cents || 0)}</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>Tax</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{currency(preview?.tax_cents || 0)}</td>
              </tr>
              <tr style={{ fontWeight: 700, color: "var(--ink)", fontSize: "13px" }}>
                <td style={{ padding: "12px", borderTop: "1px solid var(--rule)" }}>Total</td>
                <td style={{ padding: "12px", textAlign: "right", borderTop: "1px solid var(--rule)" }}>{currency(preview?.total_cents || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
          Your card will be charged {currency(preview?.total_cents || 0)} now. A receipt (invoice
          {preview ? "" : ""}) will be available in your billing history.
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "start", gap: 8, fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span style={{}}>I agree to the subscription terms and authorize
              {currency(preview?.total_cents || 0)} to be charged to my selected payment method.</span>
          </label>
          <button
            className="btn btn-blue btn-block"
            onClick={() => {
              placeOrder();
            }}
            disabled={!canPlaceOrder}
            style={{}}
          >
            Place your order
          </button>
        </div>
      </div>
    );
  }
}
