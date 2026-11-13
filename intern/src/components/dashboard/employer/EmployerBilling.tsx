"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { Subscription, InvoiceResponse, TransactionResponse, GatewayOption } from "../../../lib/api";
import { fetchInvoices, fetchTransactions, fetchGateways } from "../../../lib/api";

export function EmployerBilling() {
  const { subscription, isApiEnabled, toast, fetchSubscription, createSubscriptionApi, cancelSubscriptionApi, isPremium } = useApp();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiEnabled) {
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
      setInvoices(inv);
      setTransactions(txn);
      setGateways(gw);
    } catch (e) {
      toast("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: "Pro" | "Enterprise", billingCycle: "monthly" | "annual") => {
    if (!gateways.length) return;
    const gateway = gateways[0].id; // default to first available
    setUpgrading(plan);
    try {
      await createSubscriptionApi(plan, billingCycle, gateway);
      await fetchSubscription(); // refresh local subscription
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

  const planPrices: Record<string, Record<string, number>> = {
    Pro: { monthly: 3000, annual: 30000 },
    Enterprise: { monthly: 0, annual: 0 },
  };

  const getLimit = (plan: string) => plan === "Free" ? 3 : -1;
  const currentPlacements = subscription.plan === "Free" ? 0 : 0; // would need actual count from API

  if (loading) return <div className="dpane-h"><p>Loading billing…</p></div>;

  return (
    <div className="dpane-h" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Plan Card */}
      <div className="fold" style={{ padding: "22px", display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <h2 style={{ margin: 0 }}>{subscription.plan}</h2>
            <span className={`tg ${subscription.plan === "Free" ? "" : subscription.plan === "Pro" ? "gold" : ""}`}>
              {subscription.status || "active"}
            </span>
          </div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            {subscription.plan === "Free"
              ? "Free tier — 3 placement limit"
              : subscription.plan === "Pro"
              ? `Pro — ${subscription.billing_cycle} billing`
              : "Enterprise — custom pricing"}
          </p>
          <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--ink-2)" }}>
            {subscription.current_period_start && (
              <span>Period: {formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}</span>
            )}
            {subscription.cancel_at_period_end && (
              <span style={{ color: "var(--red)" }}>Cancels at period end</span>
            )}
            {subscription.plan === "Free" && subscription.since && (
              <span>Free since {subscription.since}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "180px" }}>
          {subscription.plan === "Free" ? (
            <>
              <button className="btn" onClick={() => handleUpgrade("Pro", "monthly")} disabled={upgrading === "Pro"}>
                {upgrading === "Pro" ? "Activating…" : "Upgrade to Pro — $30/mo"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleUpgrade("Pro", "annual")} disabled={upgrading === "Pro"}>
                Upgrade to Pro — $300/yr (save 17%)
              </button>
            </>
          ) : subscription.plan === "Pro" ? (
            <>
              <button className="btn btn-secondary" onClick={handleCancel} disabled={subscription.cancel_at_period_end}>
                {subscription.cancel_at_period_end ? "Cancelling…" : "Cancel at period end"}
              </button>
              <button className="btn" onClick={() => handleUpgrade("Enterprise", "monthly")} disabled={upgrading === "Enterprise"}>
                {upgrading === "Enterprise" ? "Upgrading…" : "Upgrade to Enterprise"}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" disabled>Enterprise plan active</button>
          )}
        </div>
      </div>

      {/* Usage Meter */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Placement Usage</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Active Placements</div>
            <div style={{ fontSize: "28px", fontWeight: 600 }}>{currentPlacements}</div>
          </div>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Limit</div>
            <div style={{ fontSize: "28px", fontWeight: 600 }}>
              {getLimit(subscription.plan) === -1 ? "Unlimited" : getLimit(subscription.plan)}
            </div>
          </div>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Remaining</div>
            <div style={{ fontSize: "28px", fontWeight: 600, color: getLimit(subscription.plan) === -1 ? "var(--green)" : "var(--ink)" }}>
              {getLimit(subscription.plan) === -1 ? "∞" : Math.max(0, getLimit(subscription.plan) - currentPlacements)}
            </div>
          </div>
        </div>
        {subscription.plan === "Free" && (
          <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--muted)" }}>
            You have used <b>0 of 3</b> free placements. Upgrade to Pro for unlimited placements.
          </p>
        )}
      </div>

      {/* Invoices Table */}
      <div className="fold" style={{ padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ margin: 0 }}>Invoices</h3>
          {invoices.length === 0 && <span className="lbl">No invoices yet</span>}
        </div>
        {invoices.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "10px 8px" }}>Number</th>
                  <th style={{ padding: "10px 8px" }}>Date</th>
                  <th style={{ padding: "10px 8px" }}>Due</th>
                  <th style={{ padding: "10px 8px" }}>Amount</th>
                  <th style={{ padding: "10px 8px" }}>Status</th>
                  <th style={{ padding: "10px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 8px" }}>{inv.invoice_number}</td>
                    <td style={{ padding: "10px 8px" }}>{formatDate(inv.created_at)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatDate(inv.due_date)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatCents(inv.amount_cents)}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span className={`tg ${inv.status === "paid" ? "gold" : inv.status === "open" ? "" : ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {inv.status === "open" && (
                        <button className="btn btn-sm" onClick={() => window.open(`https://mock-billing.example.com/invoices/${inv.gateway_invoice_id}`, "_blank")}>
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Payment History</h3>
        {transactions.length === 0 ? (
          <p className="lbl">No payments recorded</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "10px 8px" }}>Date</th>
                  <th style={{ padding: "10px 8px" }}>Amount</th>
                  <th style={{ padding: "10px 8px" }}>Type</th>
                  <th style={{ padding: "10px 8px" }}>Gateway</th>
                  <th style={{ padding: "10px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 8px" }}>{formatDate(txn.processed_at || txn.created_at)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatCents(txn.amount_cents)}</td>
                    <td style={{ padding: "10px 8px" }}>{txn.type}</td>
                    <td style={{ padding: "10px 8px" }}>{txn.payment_gateway}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span className={`tg ${txn.status === "succeeded" ? "gold" : ""}`}>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Payment Methods</h3>
        <p className="lbl">Connected gateways: {gateways.map(g => g.name).join(", ") || "None"}</p>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "8px" }}>
          Payment methods are managed via the payment gateway's portal. Click "Pay" on an open invoice to add a method.
        </p>
      </div>

      {/* Billing Email */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Billing Email</h3>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "10px" }}>
          Invoices and receipts are sent to this email.
        </p>
        <input
          type="email"
          defaultValue={subscription.plan === "Free" ? "" : "billing@example.com"}
          placeholder="billing@yourcompany.com"
          style={{ padding: "10px", border: "1px solid var(--line)", borderRadius: "8px", width: "100%", maxWidth: "360px", fontSize: "14px" }}
        />
      </div>
    </div>
  );
}