"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import { Checkout } from "../common/checkout/Checkout";
import { InvoicePayment } from "../common/checkout/InvoicePayment";
import { BillingStatusBanner } from "../common/BillingStatusBanner";
import billingStyles from "../common/Billing.module.css";
import {
  fetchInvoices,
  fetchTransactions,
  fetchGateways,
  fetchSubscription,
  fetchEmployerBillingUsage,
  cancelSubscriptionApi,
  resumeSubscriptionApi,
  type InvoiceResponse,
  type TransactionResponse,
  type GatewayOption,
  type EmployerBillingUsage,
} from "../../../lib/api";

const PLAN_PRICES: Record<string, { monthly: number; annual: number; limit: number }> = {
  Free: { monthly: 0, annual: 0, limit: 3 },
  Pro: { monthly: 3000, annual: 30000, limit: -1 },
  Enterprise: { monthly: 0, annual: 0, limit: -1 },
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}
function getLimit(plan: string) {
  return PLAN_PRICES[plan]?.limit ?? 3;
}

export function EmployerBilling() {
  const { student, isApiEnabled, toast } = useApp();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [placementUsage, setPlacementUsage] = useState<EmployerBillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutCycle, setCheckoutCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponse | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (!isApiEnabled) {
      setInvoices([]);
      setTransactions([]);
      setGateways([]);
      setSubscription({ plan: "Free", billing_cycle: "monthly", status: "active", since: new Date().toISOString() });
      setPlacementUsage({
        plan: "Free",
        billing_cycle: "monthly",
        status: "active",
        current_period_start: null,
        current_period_end: null,
        seats: 1,
        current_placements: 0,
        placement_limit: 3,
        remaining_placements: 3,
      });
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled, student]);

  const loadData = async () => {
    try {
      const [inv, txn, gw, sub, usage] = await Promise.all([
        fetchInvoices(),
        fetchTransactions(),
        fetchGateways(),
        fetchSubscription(),
        fetchEmployerBillingUsage(),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setTransactions(Array.isArray(txn) ? txn : []);
      setGateways(Array.isArray(gw) ? gw : []);
      setSubscription(sub);
      setPlacementUsage(usage);
    } catch (e) {
      toast("Failed to load billing data");
      setInvoices([]); setTransactions([]); setGateways([]); setSubscription(null);
    } finally { setLoading(false); }
  };

  const handleUpgrade = (billingCycle: "monthly" | "annual") => {
    setCheckoutCycle(billingCycle);
    setCheckoutOpen(true);
  };

  const handleCancel = async () => {
    if (!confirm("Cancel at period end? You'll keep Pro features until then.")) return;
    setCanceling(true);
    try {
      await cancelSubscriptionApi();
      await loadData();
      toast("Cancellation scheduled at period end");
    } catch (e: any) { toast(e?.message || "Cancel failed"); }
    finally { setCanceling(false); }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await resumeSubscriptionApi();
      await loadData();
      toast("Subscription resumed");
    } catch (e: any) { toast(e?.message || "Resume failed"); }
    finally { setResuming(false); }
  };

  const handlePayInvoice = (invoice: InvoiceResponse) => {
    setSelectedInvoice(invoice);
  };

  const subPlan = subscription?.plan || "Free";
  const subBilling = subscription?.billing_cycle || "monthly";
  const subStatus = subscription?.status || "active";
  const currentPlacements = placementUsage?.current_placements ?? 0;
  const placementLimit = placementUsage?.placement_limit ?? getLimit(subPlan);
  const remainingPlacements = placementUsage?.remaining_placements
    ?? (placementLimit === -1 ? null : Math.max(0, placementLimit - currentPlacements));
  const overdue = invoices.some((inv) => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date());

  if (loading) {
    return <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}><p style={{ fontWeight: 600, color: "var(--ink)" }}>Loading billing…</p></div>;
  }

  if (checkoutOpen) {
    return (
      <Checkout
        initialPlan="Pro"
        initialBillingCycle={checkoutCycle}
        onClose={() => {
          setCheckoutOpen(false);
          void loadData();
        }}
      />
    );
  }

  return (
    <div className={`${billingStyles.page} ${billingStyles.employer}`}>
      <div className={`dpane-h ${billingStyles.header}`}>
      <div>
        <h2 className={billingStyles.title}>Billing</h2>
        <p className={billingStyles.description}>Manage your plan, invoices, and payment methods</p>
      </div>
      <button className="btn btn-sm" onClick={loadData} style={{ fontWeight: 600 }}><Icon name="arrow" size={12} /> Refresh</button>
      </div>

      {/* Billing status banner */}
      <BillingStatusBanner
        plan={subPlan}
        status={subStatus}
        overdue={overdue}
        onUpgrade={() => {
          const openInvoice = invoices.find((invoice) => invoice.status === "open");
          if (openInvoice) {
            handlePayInvoice(openInvoice);
          } else {
            handleUpgrade("monthly");
          }
        }}
      />

      {/* Current plan */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Current plan</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div className={billingStyles.employerPlanGrid} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <h3 className={billingStyles.employerPlanTitle}>{subPlan}</h3>
                <span className={`tg blue`} style={{ fontSize: "10px", padding: "3px 8px", fontWeight: 700 }}>{subStatus}</span>
              </div>
              <p style={{ color: "var(--ink-2)", margin: "0 0 12px", fontSize: "12px", fontWeight: 500 }}>{subPlan === "Free" ? "Free tier — 3 placement limit" : subPlan === "Pro" ? `Pro — ${subBilling} billing · $${subBilling === "monthly" ? "30" : "300"}/${subBilling === "monthly" ? "mo" : "yr"}` : "Enterprise — custom pricing"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "12px", color: "var(--ink-2)", fontWeight: 500 }}>
                {subscription?.current_period_start && <span>Period: {new Date(subscription.current_period_start).toLocaleDateString()} – {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "—"}</span>}
                {subscription?.cancel_at_period_end && <span style={{ color: "var(--red)", fontWeight: 700 }}>Cancels at period end</span>}
                {subPlan === "Free" && subscription?.since && <span>Free since {subscription.since}</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
              {subPlan === "Free" ? (
                <>
                  <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("monthly")} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>Upgrade to Pro — $30/mo</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleUpgrade("annual")} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>Upgrade to Pro — $300/yr (save 17%)</button>
                </>
              ) : subPlan === "Pro" ? (
                <>
                  {subscription?.cancel_at_period_end ? (
                    <button className="btn btn-sm btn-blue" onClick={handleResume} disabled={resuming} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{resuming ? "Resuming…" : "Resume subscription"}</button>
                  ) : (
                    <button className="btn btn-sm btn-ghost" onClick={handleCancel} disabled={subStatus === "cancelled" || canceling} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{canceling ? "Cancelling…" : "Cancel at period end"}</button>
                  )}
                  <p className={billingStyles.employerNote}>Enterprise plans require a custom quote and aren’t available in self-serve checkout.</p>
                </>
              ) : (
                <button className="btn btn-sm btn-ghost" disabled style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>Enterprise plan active</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Placement usage */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Placement usage</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div className={billingStyles.employerMetricGrid}>
            <div className={billingStyles.employerMetric} style={{ background: "var(--blue-tint)" }}>
              <div className={billingStyles.employerMetricLabel}>Active placements</div>
              <div className={billingStyles.employerMetricValue} style={{ color: "var(--blue)" }}>{currentPlacements}</div>
            </div>
            <div className={billingStyles.employerMetric} style={{ background: subPlan === "Free" ? "var(--blue-tint)" : "var(--green-tint)" }}>
              <div className={billingStyles.employerMetricLabel} style={{ color: subPlan === "Free" ? "var(--blue)" : "var(--green)" }}>Limit</div>
              <div className={billingStyles.employerMetricValue} style={{ color: subPlan === "Free" ? "var(--blue)" : "var(--green)" }}>{placementLimit === -1 ? "Unlimited" : placementLimit}</div>
            </div>
            <div className={billingStyles.employerMetric}>
              <div className={billingStyles.employerMetricLabel}>Remaining</div>
              <div className={billingStyles.employerMetricValue} style={{ color: placementLimit === -1 ? "var(--green)" : "var(--ink)" }}>{remainingPlacements === null ? "∞" : remainingPlacements}</div>
            </div>
          </div>
          {subPlan === "Free" && (
            <div className={billingStyles.employerUpsell}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", color: "var(--blue)", fontWeight: 700 }}><strong>Free plan limit: 3 placements</strong></p>
              <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("monthly")} style={{ fontWeight: 700, fontSize: "11.5px" }}>Upgrade to Pro for unlimited placements</button>
            </div>
          )}
        </div>
      </div>

      {/* Payment methods */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Available payment gateways</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.isArray(gateways) && gateways.length > 0 ? gateways.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
                <div style={{ color: "var(--blue)" }}><Icon name="brief" size={12} /></div>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--sans)" }}>{g.name}</div>
                <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{g.currencies.join(", ")}</span>
              </div>
            )) : (<span className="lbl blue" style={{ fontSize: "11px", fontWeight: 700 }}>No payment gateways available</span>)}
          </div>
          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "10px" }}>Choose a gateway during checkout. Saved payment methods are managed in the payment step.</p>
        </div>
      </div>

      {/* Invoices */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Invoices</span><span className="lbl blue" style={{ fontSize: "10px", fontWeight: 700 }}>{Array.isArray(invoices) ? invoices.length : 0} total</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {Array.isArray(invoices) && invoices.length > 0 ? (
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
          ) : (
            <div className={billingStyles.employerEmpty}>
              <div className={billingStyles.employerEmptyIcon}>📄</div>
              <p className={billingStyles.employerEmptyTitle}>No invoices yet</p>
              <p className={billingStyles.employerEmptyDescription}>Invoices will appear here after you upgrade to a paid plan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Payment history</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {Array.isArray(transactions) && transactions.length > 0 ? (
            <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
              <table className="dtable">
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Amount</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Type</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Gateway</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{formatDate(txn.created_at)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)", fontSize: "12px" }}>{formatCents(txn.amount_cents)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{txn.type}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{txn.payment_gateway}</td>
                      <td style={{ padding: "10px 12px" }}><span className={`tg ${txn.status === "succeeded" ? "blue" : ""}`} style={{ fontSize: "10px", fontWeight: 700 }}>{txn.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={billingStyles.employerEmpty}>
              <div className={billingStyles.employerEmptyIcon}>💳</div>
              <p className={billingStyles.employerEmptyTitle}>No payments recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {selectedInvoice && (
        <InvoicePayment
          invoice={selectedInvoice}
          audience="employer"
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

export default EmployerBilling;
