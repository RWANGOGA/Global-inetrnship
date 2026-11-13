"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { Subscription } from "../../../types";
import type { InvoiceResponse, TransactionResponse, GatewayOption } from "../../../lib/api";
import { fetchInvoices, fetchTransactions, fetchGateways } from "../../../lib/api";

const MOCK_INVOICES: InvoiceResponse[] = [
  { id: "inv_1", org_id: "org_1", subscription_id: "sub_1", amount_cents: 3000, currency: "USD", status: "paid", invoice_number: "INV-2026-001", description: "Pro Plan - Monthly", line_items: [{ description: "Pro Plan - Monthly", quantity: 1, unit_amount_cents: 3000 }], metadata: {}, due_date: "2026-01-15", paid_at: "2026-01-10", payment_gateway: "stripe", gateway_invoice_id: "inv_stripe_1", gateway_payment_intent_id: "pi_1", created_at: "2026-01-01", updated_at: "2026-01-10" },
  { id: "inv_2", org_id: "org_1", subscription_id: "sub_1", amount_cents: 3000, currency: "USD", status: "open", invoice_number: "INV-2026-002", description: "Pro Plan - Monthly", line_items: [{ description: "Pro Plan - Monthly", quantity: 1, unit_amount_cents: 3000 }], metadata: {}, due_date: "2026-02-15", paid_at: null, payment_gateway: "stripe", gateway_invoice_id: "inv_stripe_2", gateway_payment_intent_id: null, created_at: "2026-02-01", updated_at: "2026-02-01" },
];

const MOCK_TRANSACTIONS: TransactionResponse[] = [
  { id: "txn_1", org_id: "org_1", invoice_id: "inv_1", subscription_id: "sub_1", amount_cents: 3000, currency: "USD", type: "payment", status: "succeeded", payment_gateway: "stripe", gateway_transaction_id: "pi_1", gateway_response: {}, description: "Invoice INV-2026-001 - Pro plan", metadata: {}, idempotency_key: "inv_1_pay", created_at: "2026-01-10", processed_at: "2026-01-10" },
  { id: "txn_2", org_id: "org_1", invoice_id: null, subscription_id: null, amount_cents: 1500, currency: "USD", type: "refund", status: "succeeded", payment_gateway: "stripe", gateway_transaction_id: "re_1", gateway_response: {}, description: "Partial refund", metadata: {}, idempotency_key: "ref_1", created_at: "2026-01-20", processed_at: "2026-01-20" },
];

const MOCK_GATEWAYS: GatewayOption[] = [
  { id: "stripe", name: "Stripe (Cards)", currencies: ["USD", "EUR", "GBP"] },
  { id: "paypal", name: "PayPal", currencies: ["USD", "EUR"] },
];

export function EmployerBilling() {
  const { subscription, isApiEnabled, toast, fetchSubscription, createSubscriptionApi, cancelSubscriptionApi, isPremium } = useApp();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiEnabled) {
      // Load mock data for demo mode
      setInvoices(MOCK_INVOICES);
      setTransactions(MOCK_TRANSACTIONS);
      setGateways(MOCK_GATEWAYS);
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled]);

  const loadData = async () => {
    try {
      const [inv, txn, gw] = await Promise.all([
        fetchInvoices(),
        fetchTransactions(),
        fetchGateways(),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setTransactions(Array.isArray(txn) ? txn : []);
      setGateways(Array.isArray(gw) ? gw : []);
    } catch (e) {
      toast("Failed to load billing data");
      setInvoices([]);
      setTransactions([]);
      setGateways([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: "Pro" | "Enterprise", billingCycle: "monthly" | "annual") => {
    if (!gateways.length) return;
    const gateway = gateways[0].id;
    setUpgrading(plan);
    try {
      await createSubscriptionApi(plan, billingCycle, gateway);
      await fetchSubscription();
      toast(`${plan} plan activated (${billingCycle})`);
    } catch (e: any) {
      toast(e?.message || "Upgrade failed");
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel at period end? You'll keep Pro features until then.")) return;
    try {
      await cancelSubscriptionApi();
      await fetchSubscription();
      toast("Cancellation scheduled at period end");
    } catch (e: any) {
      toast(e?.message || "Cancel failed");
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : "—";

  const getLimit = (plan: string) => plan === "Free" ? 3 : -1;

  if (loading) return <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}><p>Loading billing…</p></div>;

  return (
    <div className="dpane-h" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Plan Card */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "24px" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>{subscription.plan}</h2>
              <span className={`tg ${subscription.plan === "Free" ? "" : subscription.plan === "Pro" ? "gold" : ""}`} style={{ fontSize: "13px", padding: "4px 12px", borderRadius: "20px" }}>
                {subscription.status || "active"}
              </span>
            </div>
            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: "15px" }}>
              {subscription.plan === "Free"
                ? "Free tier — 3 placement limit"
                : subscription.plan === "Pro"
                ? `Pro — ${subscription.billing_cycle} billing · $${subscription.billing_cycle === "monthly" ? "30" : "300"}/${subscription.billing_cycle === "monthly" ? "mo" : "yr"}`
                : "Enterprise — custom pricing"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", fontSize: "13px", color: "var(--ink-2)" }}>
              {subscription.current_period_start && (
                <span>Period: {new Date(subscription.current_period_start).toLocaleDateString()} – {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "—"}</span>
              )}
              {subscription.cancel_at_period_end && (
                <span style={{ color: "var(--red)", fontWeight: 600 }}>Cancels at period end</span>
              )}
              {subscription.plan === "Free" && subscription.since && (
                <span>Free since {subscription.since}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "200px", flexShrink: 0 }}>
            {subscription.plan === "Free" ? (
              <>
                <button className="btn" onClick={() => handleUpgrade("Pro", "monthly")} disabled={upgrading === "Pro"} style={{ width: "100%", padding: "14px 24px", fontSize: "14px", fontWeight: 600 }}>
                  {upgrading === "Pro" ? "Activating…" : "Upgrade to Pro — $30/mo"}
                </button>
                <button className="btn btn-secondary" onClick={() => handleUpgrade("Pro", "annual")} disabled={upgrading === "Pro"} style={{ width: "100%", padding: "14px 24px", fontSize: "14px" }}>
                  Upgrade to Pro — $300/yr (save 17%)
                </button>
              </>
            ) : subscription.plan === "Pro" ? (
              <>
                <button className="btn btn-secondary" onClick={handleCancel} disabled={subscription.cancel_at_period_end} style={{ width: "100%", padding: "14px 24px", fontSize: "14px" }}>
                  {subscription.cancel_at_period_end ? "Cancelling…" : "Cancel at period end"}
                </button>
                <button className="btn" onClick={() => handleUpgrade("Enterprise", "monthly")} disabled={upgrading === "Enterprise"} style={{ width: "100%", padding: "14px 24px", fontSize: "14px", fontWeight: 600 }}>
                  {upgrading === "Enterprise" ? "Upgrading…" : "Upgrade to Enterprise"}
                </button>
              </>
            ) : (
              <button className="btn btn-secondary" disabled style={{ width: "100%", padding: "14px 24px", fontSize: "14px" }}>
                Enterprise plan active
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage Meter */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 600 }}>Placement Usage</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "12px", textAlign: "center", background: "var(--blue-tint)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Placements</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "var(--blue)" }}>{subscription.plan === "Free" ? 0 : 0}</div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "12px", textAlign: "center", background: subscription.plan === "Free" ? "var(--amber-tint)" : "var(--green-tint)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Limit</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: subscription.plan === "Free" ? "var(--amber)" : "var(--green)" }}>
              {getLimit(subscription.plan) === -1 ? "Unlimited" : getLimit(subscription.plan)}
            </div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Remaining</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: getLimit(subscription.plan) === -1 ? "var(--green)" : "var(--ink)" }}>
              {getLimit(subscription.plan) === -1 ? "∞" : Math.max(0, getLimit(subscription.plan) - (subscription.plan === "Free" ? 0 : 0))}
            </div>
          </div>
        </div>
        {subscription.plan === "Free" && (
          <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)", textAlign: "center" }}>
            You have used <b>0 of 3</b> free placements. <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Pro", "monthly")} style={{ marginLeft: "8px" }}>Upgrade to Pro</button> for unlimited.
          </p>
        )}
      </div>

      {/* Invoices Table */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Invoices</h3>
          <span className="lbl" style={{ fontSize: "13px" }}>{Array.isArray(invoices) ? invoices.length : 0} total</span>
        </div>
        {Array.isArray(invoices) && invoices.length > 0 ? (
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 16px" }}>Number</th>
                  <th style={{ padding: "14px 16px" }}>Date</th>
                  <th style={{ padding: "14px 16px" }}>Due</th>
                  <th style={{ padding: "14px 16px" }}>Amount</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                  <th style={{ padding: "14px 16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)", transition: "background 0.15s" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 500 }}>{inv.invoice_number}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.created_at)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.due_date)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatCents(inv.amount_cents)}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span className={`tg ${inv.status === "paid" ? "gold" : inv.status === "open" ? "" : ""}`} style={{ fontSize: "12px" }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {inv.status === "open" && (
                        <button className="btn btn-sm" onClick={() => window.open(`https://mock-billing.example.com/invoices/${inv.gateway_invoice_id}`, "_blank")} style={{ padding: "8px 16px" }}>
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📄</div>
            <p style={{ fontSize: "15px", margin: 0 }}>No invoices yet</p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>Invoices will appear here after you upgrade to a paid plan.</p>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 600 }}>Payment History</h3>
        {Array.isArray(transactions) && transactions.length > 0 ? (
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 16px" }}>Date</th>
                  <th style={{ padding: "14px 16px" }}>Amount</th>
                  <th style={{ padding: "14px 16px" }}>Type</th>
                  <th style={{ padding: "14px 16px" }}>Gateway</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(txn.processed_at || txn.created_at)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatCents(txn.amount_cents)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{txn.type}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{txn.payment_gateway}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span className={`tg ${txn.status === "succeeded" ? "gold" : ""}`} style={{ fontSize: "12px" }}>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>💳</div>
            <p style={{ fontSize: "15px", margin: 0 }}>No payments recorded yet</p>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 600 }}>Payment Methods</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <span style={{ color: "var(--ink-2)", fontSize: "14px" }}>Connected gateways:</span>
          {Array.isArray(gateways) && gateways.length > 0 ? (
            gateways.map((g) => (
              <span key={g.id} className="tg" style={{ fontSize: "12px", padding: "6px 12px", background: "var(--blue-tint)", color: "var(--blue)" }}>
                {g.name}
              </span>
            ))
          ) : (
            <span className="lbl" style={{ fontSize: "13px" }}>None connected</span>
          )}
        </div>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "16px" }}>
          Payment methods are managed via the payment gateway's portal. Click "Pay" on an open invoice to add a method.
        </p>
      </div>

      {/* Billing Email */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 600 }}>Billing Email</h3>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
          Invoices and receipts are sent to this email.
        </p>
        <input
          type="email"
          defaultValue={subscription.plan === "Free" ? "" : "billing@yourcompany.com"}
          placeholder="billing@yourcompany.com"
          style={{ padding: "12px 16px", border: "1px solid var(--line)", borderRadius: "10px", width: "100%", maxWidth: "400px", fontSize: "14px", background: "var(--white)" }}
        />
      </div>
    </div>
  );
}