"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import { InvoicePayment } from "../common/checkout/InvoicePayment";
import { BillingStatusBanner } from "../common/BillingStatusBanner";
import billingStyles from "../common/Billing.module.css";
import {
  cancelStudentSubscription,
  checkoutStudentPlan,
  fetchStudentInvoices,
  fetchPaymentStatus,
  fetchStudentUsage,
  resumeStudentSubscription,
  startPaymentSession,
  startStudentPlusSession,
  type StudentInvoiceResponse,
  type StudentUsageDto,
} from "../../../lib/api";

// Only used when the API is switched off; the live values come from
// GET /billing/student/usage so the tier can change without a front-end deploy.
const DEMO_FREE_APPS = 30;
const DEMO_OVERAGE_CENTS = 50;

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function UsageRow({ label, value, sub, color, tint }: { label: string; value: number | string; sub: string; color: string; tint: string }) {
  return (
    <div style={{ padding: "14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center", background: tint }}>
      <div style={{ fontSize: "10px", color: color, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800, fontFamily: "var(--mono)" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--serif)" }}>{value}</div>
      <div style={{ fontSize: "10px", color: color, marginTop: "4px", fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

export function StudentBilling() {
  const {
    applications,
    askChat,
    dashGo,
    docs,
    openChat,
    pack,
    recommendations,
    session,
    student,
    isApiEnabled,
    toast,
    getPlacement,
  } = useApp();
  const [usage, setUsage] = useState<StudentUsageDto | null>(null);
  const [invoices, setInvoices] = useState<StudentInvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<StudentInvoiceResponse | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [checkoutKey, setCheckoutKey] = useState("");
  const [billingEmail, setBillingEmail] = useState(session?.email ?? "");
  const [paymentGateway, setPaymentGateway] = useState<"stripe" | "flutterwave">("stripe");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!isApiEnabled) {
      setUsage({
        id: "demo",
        month: new Date().toISOString().slice(0, 7),
        application_count: 0,
        billed_count: 0,
        last_billed_at: null,
        free_limit: DEMO_FREE_APPS,
        application_limit: DEMO_FREE_APPS,
        plan: "Free",
        subscription_status: "free",
        price_cents: 0,
        checkout_enabled: false,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        overage_apps: 0,
        overage_cents: DEMO_OVERAGE_CENTS,
        unpaid_invoice_id: null,
      });
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled, student]);

  useEffect(() => {
    if (session?.email) setBillingEmail(session.email);
  }, [session?.email]);

  const loadData = async () => {
    try {
      const [usageResp, invResp] = await Promise.all([fetchStudentUsage(), fetchStudentInvoices()]);
      setUsage(usageResp);
      setInvoices(Array.isArray(invResp) ? invResp : []);
    } catch (e) {
      toast("Failed to load billing data");
    } finally { setLoading(false); }
  };

  const handlePayInvoice = (invoice: StudentInvoiceResponse) => {
    setSelectedInvoice(invoice);
  };

  const startCheckout = () => {
    setCheckoutStep(0);
    setCheckoutKey(crypto.randomUUID());
    setCheckoutError("");
    setPaymentGateway("stripe");
    setTermsAccepted(false);
    setCheckoutOpen(true);
  };

  const submitCheckout = async () => {
    if (!isApiEnabled) return;
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      if (process.env.NODE_ENV === "production" || usage?.checkout_enabled) {
        const result = await startStudentPlusSession({
          billing_email: billingEmail.trim(),
          idempotency_key: checkoutKey,
          terms_accepted: termsAccepted,
          payment_gateway: paymentGateway,
        });
        if (result.session?.hosted_url) {
          window.location.href = result.session.hosted_url;
          return;
        }
        toast("Student Plus checkout started");
      }
      await checkoutStudentPlan(
        billingEmail.trim(),
        checkoutKey,
        termsAccepted,
        paymentGateway
      );
      setCheckoutOpen(false);
      toast("Student Plus is active");
      await loadData();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Student Plus checkout failed");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const updateSubscription = async (action: "cancel" | "resume") => {
    setPlanBusy(true);
    try {
      if (action === "cancel") await cancelStudentSubscription();
      else await resumeStudentSubscription();
      setConfirmCancel(false);
      toast(action === "cancel" ? "Cancellation scheduled for the end of this billing period" : "Student Plus subscription resumed");
      await loadData();
    } catch (error) {
      // The plan may have lapsed in another tab; resync so the buttons match
      // the account instead of offering an action the server will keep rejecting.
      await loadData();
      toast(error instanceof Error ? error.message : "Could not update your subscription");
    } finally {
      setPlanBusy(false);
    }
  };

  const useCareerSupport = (support: "application" | "fit" | "progress") => {
    let prompt = "";
    if (support === "application") {
      if (!pack.statement.trim()) {
        dashGo("pack");
        toast("Add your application statement to your pack first");
        return;
      }
      const documentStatus = docs.map((document) =>
        `${document.name}: ${document.status}`,
      ).join("; ");
      prompt = `Review my application pack for readiness. Give specific feedback on my statement's clarity, evidence, and relevance, and flag document readiness gaps. Do not invent experience or claim to have read uploaded file contents; the document information below is type and status only.\n\nDocument status: ${documentStatus || "No documents listed"}\n\nApplication statement:\n${pack.statement.slice(0, 5000)}`;
    } else if (support === "fit") {
      const topMatches = recommendations?.items.slice(0, 3) ?? [];
      if (topMatches.length === 0) {
        dashGo("placements");
        toast("Browse placements to get personalized fit explanations");
        return;
      }
      const matchSummary = topMatches.map(({ placement, match }) =>
        `${placement.title}: ${match.score}% fit; matched skills: ${match.matched.join(", ") || "none"}; skills to build: ${match.missing.join(", ") || "none"}`,
      ).join("\n");
      prompt = `Explain why I fit these recommended internships and how I can strengthen my application for each. Be specific and do not overstate my qualifications:\n${matchSummary}`;
    } else {
      const month = new Date().toISOString().slice(0, 7);
      const monthlyApplications = applications.filter((application) =>
        application.created_at?.slice(0, 7) === month,
      );
      const summary = monthlyApplications.map((application) => {
        const placement = getPlacement(application.placement_id);
        return `${placement?.title ?? "Internship"} — ${application.status}`;
      });
      prompt = `Review my application progress for ${month}. I submitted ${summary.length} application(s): ${summary.join("; ") || "none yet"}. Give me a practical next-step review based on these statuses.`;
    }
    openChat();
    askChat(prompt);
  };

  const used = usage?.application_count ?? 0;
  const limit = usage?.application_limit ?? DEMO_FREE_APPS;
  const plan = usage?.plan ?? "Free";
  const overageCents = usage?.overage_cents ?? DEMO_OVERAGE_CENTS;
  const over = usage?.overage_apps ?? Math.max(0, used - limit);
  const isPlus = plan === "Student Plus";
  const checkoutEnabled = isApiEnabled && Boolean(usage?.checkout_enabled);
  const pct = Math.min(100, (used / limit) * 100);
  const overdue = invoices.some((inv) => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date());

  if (loading) {
    return <div className="dpane-h" style={{ padding: "40px", textAlign: "center" }}><p style={{ fontWeight: 600, color: "var(--ink)" }}>Loading billing…</p></div>;
  }

  return (
    <div className={billingStyles.page}>
      <div className={`dpane-h ${billingStyles.header}`}>
      <div>
        <h2 className={billingStyles.title}>Billing</h2>
        <p className={billingStyles.description}>Track your applications and manage overage invoices</p>
      </div>
      <button className="btn btn-sm" onClick={loadData} style={{ padding: "6px 14px", fontSize: "11.5px" }}><Icon name="arrow" size={14} /> Refresh</button>
      </div>

      {/* Billing status banner */}
      <BillingStatusBanner
        plan={plan}
        status={usage?.subscription_status ?? "free"}
        overdue={overdue}
      />

      {checkoutOpen ? (
        <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
          <div className="ph">
            <span className="lbl blue">Student Plus checkout</span>
            <button type="button" className="btn btn-sm" onClick={() => setCheckoutOpen(false)}>Close</button>
          </div>
          <div className="pb" style={{ padding: "18px 20px 20px" }}>
            <div aria-label="Checkout steps" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "20px" }}>
              {["Plan", "Billing details", "Review"].map((label, index) => (
                <button
                  type="button"
                  key={label}
                  aria-current={checkoutStep === index ? "step" : undefined}
                  disabled={index > checkoutStep || checkoutBusy}
                  onClick={() => setCheckoutStep(index)}
                  style={{
                    padding: "9px 10px",
                    border: `1px solid ${checkoutStep === index ? "var(--blue)" : "var(--rule)"}`,
                    borderRadius: "var(--r-md)",
                    color: checkoutStep === index ? "var(--blue)" : "var(--ink-2)",
                    background: checkoutStep === index ? "var(--blue-tint)" : "var(--paper)",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: index > checkoutStep ? "not-allowed" : "pointer",
                  }}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>

            {checkoutStep === 0 && (
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: "17px", color: "var(--ink)" }}>Student Plus — $10/month</h3>
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                  Get 60 applications per calendar month, application statement review, explanations of your internship fit, and a monthly progress review.
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>Renews monthly. You can schedule cancellation from this billing page.</p>
              </div>
            )}

            {checkoutStep === 1 && (
              <label style={{ display: "grid", gap: "6px", maxWidth: "440px", fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
                Billing email
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(event) => setBillingEmail(event.target.value)}
                  autoComplete="email"
                  required
                  style={{ padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--paper)", color: "var(--ink)", font: "inherit" }}
                />
              </label>
            )}

            {checkoutStep === 2 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid var(--rule)", paddingBottom: "12px", marginBottom: "12px", fontSize: "13px" }}>
                  <span>Student Plus · monthly</span><strong>$10.00</strong>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: "11px", color: "var(--muted)", lineHeight: 1.6 }}>
                  Select a payment option. Checkout is in sandbox mode: no real payment details or charges are used.
                </p>
                <fieldset style={{ display: "grid", gap: "8px", margin: "0 0 14px", padding: 0, border: 0 }}>
                  <legend style={{ marginBottom: "8px", color: "var(--ink)", fontSize: "12px", fontWeight: 700 }}>
                    Payment option
                  </legend>
                  {([
                    ["stripe", "Card", "Card checkout via the Stripe test gateway"],
                    ["flutterwave", "Flutterwave", "Flutterwave test checkout"],
                  ] as const).map(([gateway, label, description]) => (
                    <label
                      key={gateway}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "9px",
                        padding: "10px 12px",
                        border: `1px solid ${paymentGateway === gateway ? "var(--blue)" : "var(--rule)"}`,
                        borderRadius: "var(--r-md)",
                        background: paymentGateway === gateway ? "var(--blue-tint)" : "var(--paper)",
                        color: "var(--ink)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="student-payment-gateway"
                        value={gateway}
                        checked={paymentGateway === gateway}
                        onChange={() => setPaymentGateway(gateway)}
                      />
                      <span>
                        <strong style={{ display: "block", fontSize: "12px" }}>{label}</strong>
                        <small style={{ color: "var(--muted)", fontSize: "10px" }}>{description}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", lineHeight: 1.5, color: "var(--ink-2)" }}>
                  <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                  I authorize the $10 monthly Student Plus charge and agree to the subscription terms.
                </label>
              </div>
            )}

            {checkoutError && <p role="alert" style={{ margin: "12px 0 0", color: "var(--red)", fontSize: "12px" }}>{checkoutError}</p>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "20px" }}>
              <button type="button" className="btn btn-sm" disabled={checkoutStep === 0 || checkoutBusy} onClick={() => setCheckoutStep((step) => step - 1)}>Back</button>
              {checkoutStep < 2 ? (
                <button
                  type="button"
                  className="btn btn-sm btn-blue"
                  disabled={checkoutStep === 1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())}
                  onClick={() => setCheckoutStep((step) => step + 1)}
                >
                  Continue
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-blue" disabled={!termsAccepted || checkoutBusy} onClick={submitCheckout}>
                  {checkoutBusy ? "Processing…" : "Authorize $10/month"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
          <div className="ph"><span className="lbl blue">{isPlus ? "Student Plus plan" : "Upgrade your plan"}</span></div>
          <div className="pb" style={{ padding: "16px 20px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <strong style={{ display: "block", fontSize: "14px", color: "var(--ink)" }}>
                {isPlus ? "$10/month · Student Plus" : "Student Plus · $10/month"}
              </strong>
              <span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "var(--ink-2)" }}>
                {isPlus ? `${limit} applications per month${usage?.current_period_end ? ` · renews ${formatDate(usage.current_period_end)}` : ""}` : "60 applications per month plus career-support tools"}
              </span>
              {usage?.cancel_at_period_end && (
                <span style={{ display: "block", marginTop: "5px", fontSize: "11px", color: "var(--red)" }}>Cancellation is scheduled at the end of this billing period.</span>
              )}
            </div>
            {isPlus ? (
              usage?.cancel_at_period_end ? (
                <button type="button" className="btn btn-sm btn-blue" disabled={planBusy} onClick={() => updateSubscription("resume")}>
                  {planBusy ? "Updating…" : "Resume subscription"}
                </button>
              ) : confirmCancel ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--ink-2)" }}>Keep access until period end?</span>
                  <button type="button" className="btn btn-sm" disabled={planBusy} onClick={() => setConfirmCancel(false)}>Keep plan</button>
                  <button type="button" className="btn btn-sm" disabled={planBusy} onClick={() => updateSubscription("cancel")}>Confirm cancellation</button>
                </div>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => setConfirmCancel(true)}>Cancel at period end</button>
              )
            ) : (
              <button type="button" className="btn btn-sm btn-blue" disabled={!checkoutEnabled} onClick={startCheckout}>
                {checkoutEnabled ? "Upgrade to Student Plus" : "Checkout unavailable"}
              </button>
            )}
          </div>
          {!isPlus && isApiEnabled && usage && !usage.checkout_enabled && (
            <p style={{ margin: "0 20px 16px", fontSize: "11px", color: "var(--muted)" }}>
              Student checkout is not enabled for live payments yet. Contact support if you want to join the plan.
            </p>
          )}
        </div>
      )}

      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Career support included with Student Plus</span></div>
        <div className="pb" style={{ padding: "16px 20px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" }}>
            {[
              { id: "application" as const, title: "Application pack review", description: "Review your statement and check pack completeness and document readiness." },
              { id: "fit" as const, title: "Internship fit explanations", description: "Understand matching strengths and skills to improve." },
              { id: "progress" as const, title: "Monthly progress review", description: "Turn your application statuses into practical next steps." },
            ].map((item) => (
              <div key={item.id} style={{ padding: "12px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--paper-2)" }}>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{item.title}</strong>
                <p style={{ minHeight: "34px", margin: "6px 0 10px", fontSize: "11px", lineHeight: 1.5, color: "var(--ink-2)" }}>{item.description}</p>
                <button type="button" className="btn btn-sm" disabled={!isPlus} onClick={() => useCareerSupport(item.id)}>
                  {isPlus ? "Open review" : "Included with Plus"}
                </button>
              </div>
            ))}
          </div>
          {!isPlus && <p style={{ margin: "12px 0 0", fontSize: "11px", color: "var(--muted)" }}>Upgrade to Student Plus to use these guided reviews. Your application pack and existing tools remain available on Free.</p>}
        </div>
      </div>

      {/* Application counter — usage meter */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Applications this month</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "14px" }}>
            <UsageRow label="Used" value={used} sub={`of ${limit} applications`} color={used >= limit ? "var(--red)" : "var(--blue)"} tint={used >= limit ? "var(--red-tint)" : "var(--blue-tint)"} />
            <UsageRow label="Limit" value={limit} sub={isPlus ? "Student Plus · resets monthly" : "Free tier · resets monthly"} color="var(--green)" tint="var(--green-tint)" />
            <UsageRow label="Overage" value={over} sub={`${formatCents(overageCents)} per app`} color={over > 0 ? "var(--red)" : "var(--ink-2)"} tint="var(--paper)" />
          </div>

          <div style={{ height: "6px", background: "var(--rule-2)", borderRadius: "var(--r-pill)", overflow: "hidden", marginBottom: "10px" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: used >= limit ? "var(--red)" : used >= limit * 0.8 ? "var(--blue)" : "var(--green)", transition: "width 0.3s ease", borderRadius: "var(--r-pill)" }} />
          </div>

          <p style={{ margin: "0", fontSize: "12px", color: "var(--muted)", textAlign: "center", fontFamily: "var(--sans)" }}>{used < limit ? `${limit - used} applications remaining this month.` : `Monthly limit reached. Overage: ${over} application${over !== 1 ? "s" : ""} at ${formatCents(overageCents)} each.`}</p>

          {over > 0 && (
            <div style={{ marginTop: "14px", padding: "14px", background: "var(--blue-tint)", border: "1px solid var(--blue)", borderRadius: "var(--r-md)" }}>
              <div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
                <span style={{ color: "var(--blue)", fontSize: "16px" }}>⚠</span>
                <div>
                  <strong style={{ color: "var(--blue)", fontSize: "13px" }}>Monthly application allowance exceeded</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.6 }}>You have {over} overage application{over !== 1 ? "s" : ""}. Pay the invoice below to continue applying.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Billing invoices */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Invoices</span><span className="lbl blue" style={{ fontSize: "10px", fontWeight: 700 }}>{invoices.length} total</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px", opacity: 0.4 }}>📄</div>
              <p style={{ fontSize: "14px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No invoices</p>
              <p style={{ fontSize: "12px", marginTop: "4px", color: "var(--ink-2)", fontWeight: 500 }}>No invoices are due.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
              <table className="dtable">
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Number</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Due</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Amount</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)", fontSize: "12px" }}>{inv.invoice_number}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{formatDate(inv.created_at)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{formatDate(inv.due_date)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)", fontSize: "12px" }}>{formatCents(inv.amount_cents)}</td>
                      <td style={{ padding: "10px 12px" }}><span className={`tg ${inv.status === "paid" ? "green" : inv.status === "open" ? "blue" : "red"}`} style={{ fontWeight: 700, fontSize: "10px" }}>{inv.status}</span></td>
                      <td style={{ padding: "10px 12px" }}>{inv.status === "open" ? (<button className="btn btn-sm btn-blue" onClick={() => handlePayInvoice(inv)} style={{ padding: "5px 12px", fontWeight: 700, fontSize: "11.5px" }}>Pay now</button>) : (<span className="lbl blue" style={{ fontSize: "10px", fontWeight: 700 }}>Paid</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* How billing works */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">How student billing works</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {/* The global reset sets list-style:none, so the bullets have to be
              asked for explicitly. */}
          <ul style={{ margin: 0, paddingLeft: "22px", listStyleType: "disc", fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.8, fontWeight: 500 }}>
            <li>Your current plan includes <b>{limit} applications</b> each month.</li>
            <li>After that, <b>{formatCents(overageCents)} per application</b>.</li>
            <li>Overage invoices are generated automatically when you exceed the limit.</li>
            <li>Pay the invoice to unlock further applications for that month.</li>
            <li>Limit resets on the 1st of each month.</li>
          </ul>
        </div>
      </div>

      {selectedInvoice && (
        <InvoicePayment
          invoice={selectedInvoice}
          audience="student"
          onClose={() => setSelectedInvoice(null)}
          onPaid={() => {
            setSelectedInvoice(null);
            toast("Invoice paid");
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default StudentBilling;
