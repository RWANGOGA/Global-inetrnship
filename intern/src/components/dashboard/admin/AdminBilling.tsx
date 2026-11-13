"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { InvoiceResponse, TransactionResponse } from "../../../lib/api";
import { fetchInvoices, fetchTransactions } from "../../../lib/api";

const MOCK_INVOICES: InvoiceResponse[] = [
  { id: "inv_1", org_id: "org_1", subscription_id: "sub_1", amount_cents: 3000, currency: "USD", status: "paid", invoice_number: "INV-2026-001", description: "Pro Plan - Monthly", line_items: [{ description: "Pro Plan - Monthly", quantity: 1, unit_amount_cents: 3000 }], metadata: {}, due_date: "2026-01-15", paid_at: "2026-01-10", payment_gateway: "stripe", gateway_invoice_id: "inv_stripe_1", gateway_payment_intent_id: "pi_1", created_at: "2026-01-01", updated_at: "2026-01-10" },
  { id: "inv_2", org_id: "org_2", subscription_id: "sub_2", amount_cents: 30000, currency: "USD", status: "paid", invoice_number: "INV-2026-002", description: "Pro Plan - Annual", line_items: [{ description: "Pro Plan - Annual", quantity: 1, unit_amount_cents: 30000 }], metadata: {}, due_date: "2026-02-01", paid_at: "2026-01-28", payment_gateway: "paypal", gateway_invoice_id: "inv_paypal_1", gateway_payment_intent_id: "pi_2", created_at: "2026-01-15", updated_at: "2026-01-28" },
  { id: "inv_3", org_id: "org_3", subscription_id: "sub_3", amount_cents: 3000, currency: "USD", status: "open", invoice_number: "INV-2026-003", description: "Pro Plan - Monthly", line_items: [{ description: "Pro Plan - Monthly", quantity: 1, unit_amount_cents: 3000 }], metadata: {}, due_date: "2026-02-15", paid_at: null, payment_gateway: "stripe", gateway_invoice_id: "inv_stripe_3", gateway_payment_intent_id: null, created_at: "2026-02-01", updated_at: "2026-02-01" },
  { id: "inv_4", org_id: "org_4", subscription_id: "sub_4", amount_cents: 3000, currency: "USD", status: "open", invoice_number: "INV-2026-004", description: "Pro Plan - Monthly", line_items: [{ description: "Pro Plan - Monthly", quantity: 1, unit_amount_cents: 3000 }], metadata: {}, due_date: "2026-01-20", paid_at: null, payment_gateway: "flutterwave", gateway_invoice_id: "inv_fw_1", gateway_payment_intent_id: null, created_at: "2026-01-10", updated_at: "2026-01-10" },
];

const MOCK_TRANSACTIONS: TransactionResponse[] = [
  { id: "txn_1", org_id: "org_1", invoice_id: "inv_1", subscription_id: "sub_1", amount_cents: 3000, currency: "USD", type: "payment", status: "succeeded", payment_gateway: "stripe", gateway_transaction_id: "pi_1", gateway_response: {}, description: "Invoice INV-2026-001 - Pro plan", metadata: {}, idempotency_key: "inv_1_pay", created_at: "2026-01-10", processed_at: "2026-01-10" },
  { id: "txn_2", org_id: "org_2", invoice_id: "inv_2", subscription_id: "sub_2", amount_cents: 30000, currency: "USD", type: "payment", status: "succeeded", payment_gateway: "paypal", gateway_transaction_id: "pi_2", gateway_response: {}, description: "Invoice INV-2026-002 - Pro Annual", metadata: {}, idempotency_key: "inv_2_pay", created_at: "2026-01-28", processed_at: "2026-01-28" },
  { id: "txn_3", org_id: "org_3", invoice_id: null, subscription_id: null, amount_cents: 1500, currency: "USD", type: "refund", status: "succeeded", payment_gateway: "stripe", gateway_transaction_id: "re_1", gateway_response: {}, description: "Partial refund", metadata: {}, idempotency_key: "ref_1", created_at: "2026-01-20", processed_at: "2026-01-20" },
  { id: "txn_4", org_id: "org_4", invoice_id: null, subscription_id: null, amount_cents: 500, currency: "USD", type: "fee", status: "succeeded", payment_gateway: "flutterwave", gateway_transaction_id: "fee_1", gateway_response: {}, description: "Gateway fee", metadata: {}, idempotency_key: "fee_1", created_at: "2026-02-01", processed_at: "2026-02-01" },
];

const MOCK_REVENUE = {
  total_revenue_cents: 34500,
  total_revenue_usd: 345.00,
  by_gateway: [
    { gateway: "stripe", count: 2, revenue_cents: 4500, revenue_usd: 45.00 },
    { gateway: "paypal", count: 1, revenue_cents: 30000, revenue_usd: 300.00 },
    { gateway: "flutterwave", count: 1, revenue_cents: 500, revenue_usd: 5.00 },
  ],
  by_plan: [
    { plan: "Pro", subscriptions: 4 },
    { plan: "Enterprise", subscriptions: 1 },
  ],
};

export function AdminBilling() {
  const { isApiEnabled, toast } = useApp();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [revenue, setRevenue] = useState<{
    total_revenue_cents: number;
    total_revenue_usd: number;
    by_gateway: Array<{gateway: string; count: number; revenue_cents: number; revenue_usd: number}>;
    by_plan: Array<{plan: string; subscriptions: number}>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  useEffect(() => {
    if (!isApiEnabled) {
      // Load mock data for demo mode
      setInvoices(MOCK_INVOICES);
      setTransactions(MOCK_TRANSACTIONS);
      setRevenue(MOCK_REVENUE);
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled]);

  const loadData = async () => {
    try {
      const [inv, txn] = await Promise.all([
        fetchInvoices(),
        fetchTransactions(),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setTransactions(Array.isArray(txn) ? txn : []);
    } catch (e) {
      toast("Failed to load billing data");
      setInvoices([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : "—";

  const outstanding = Array.isArray(invoices)
    ? invoices.filter(inv => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date())
    : [];
  const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amount_cents, 0);

  if (loading) return <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}><p>Loading billing…</p></div>;

  return (
    <div className="dpane-h" style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Revenue Overview */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <h3 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 600 }}>Revenue Overview</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <MetricCard label="Total Revenue" value={revenue ? formatCents(revenue.total_revenue_cents) : "—"} icon="💰" color="var(--green)" />
          <MetricCard label="Outstanding" value={formatCents(totalOutstanding)} icon="⚠️" color="var(--red)" />
          <MetricCard label="Open Invoices" value={Array.isArray(invoices) ? invoices.filter(i => i.status === "open").length : 0} icon="📄" color="var(--blue)" />
          <MetricCard label="Paid Transactions" value={Array.isArray(transactions) ? transactions.filter(t => t.status === "succeeded").length : 0} icon="✅" color="var(--green)" />
        </div>
        {revenue && revenue.by_gateway && revenue.by_gateway.length > 0 && (
          <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600 }}>Revenue by Gateway</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
              {revenue.by_gateway.map((g) => (
                <div key={g.gateway} style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--bg-2)" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{g.gateway}</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)" }}>{formatCents(g.revenue_cents)}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{g.count} transactions</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {revenue && revenue.by_plan && revenue.by_plan.length > 0 && (
          <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600 }}>Subscriptions by Plan</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
              {revenue.by_plan.map((p) => (
                <div key={p.plan} style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--bg-2)" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{p.plan}</div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)" }}>{p.subscriptions}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>active subscriptions</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Outstanding Invoices */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Outstanding Invoices</h3>
          <span className="lbl" style={{ fontSize: "13px", padding: "6px 12px", background: "var(--red-tint)", color: "var(--red)", borderRadius: "20px" }}>
            {outstanding.length} overdue
          </span>
        </div>
        {outstanding.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✅</div>
            <p style={{ fontSize: "15px", margin: 0 }}>No overdue invoices. All payments current.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 16px" }}>Invoice</th>
                  <th style={{ padding: "14px 16px" }}>Organization</th>
                  <th style={{ padding: "14px 16px" }}>Due Date</th>
                  <th style={{ padding: "14px 16px" }}>Days Overdue</th>
                  <th style={{ padding: "14px 16px" }}>Amount</th>
                  <th style={{ padding: "14px 16px" }}>Gateway</th>
                  <th style={{ padding: "14px 16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((inv) => {
                  const daysOverdue = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 500 }}>{inv.invoice_number}</td>
                      <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{inv.org_id}</td>
                      <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.due_date)}</td>
                      <td style={{ padding: "14px 16px", color: "var(--red)", fontWeight: 600 }}>{daysOverdue}d</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatCents(inv.amount_cents)}</td>
                      <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{inv.payment_gateway || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <button className="btn btn-sm" onClick={() => window.open(`https://mock-billing.example.com/admin/invoices/${inv.id}`, "_blank")} style={{ padding: "8px 16px" }}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All Invoices Table */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>All Invoices</h3>
          <span className="lbl" style={{ fontSize: "13px" }}>{Array.isArray(invoices) ? invoices.length : 0} total</span>
        </div>
        {Array.isArray(invoices) && invoices.length > 0 ? (
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 16px" }}>Number</th>
                  <th style={{ padding: "14px 16px" }}>Org</th>
                  <th style={{ padding: "14px 16px" }}>Date</th>
                  <th style={{ padding: "14px 16px" }}>Due</th>
                  <th style={{ padding: "14px 16px" }}>Amount</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                  <th style={{ padding: "14px 16px" }}>Gateway</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 100).map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 500 }}>{inv.invoice_number}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{inv.org_id}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.created_at)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.due_date)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatCents(inv.amount_cents)}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span className={`tg ${inv.status === "paid" ? "gold" : inv.status === "open" ? "" : ""}`} style={{ fontSize: "12px" }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{inv.payment_gateway || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📄</div>
            <p style={{ fontSize: "15px", margin: 0 }}>No invoices found</p>
          </div>
        )}
        {Array.isArray(invoices) && invoices.length > 100 && (
          <p className="lbl" style={{ marginTop: "16px", textAlign: "center" }}>Showing 100 of {invoices.length} invoices</p>
        )}
      </div>

      {/* Transaction Log */}
      <div className="fold" style={{ padding: "28px", borderRadius: "16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px var(--shadow-1)" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 600 }}>Transaction Log</h3>
        {Array.isArray(transactions) && transactions.length > 0 ? (
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 16px" }}>Date</th>
                  <th style={{ padding: "14px 16px" }}>Org</th>
                  <th style={{ padding: "14px 16px" }}>Amount</th>
                  <th style={{ padding: "14px 16px" }}>Type</th>
                  <th style={{ padding: "14px 16px" }}>Gateway</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 100).map((txn) => (
                  <tr key={txn.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(txn.processed_at || txn.created_at)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{txn.org_id}</td>
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
            <p style={{ fontSize: "15px", margin: 0 }}>No transactions recorded yet</p>
          </div>
        )}
        {Array.isArray(transactions) && transactions.length > 100 && (
          <p className="lbl" style={{ marginTop: "16px", textAlign: "center" }}>Showing 100 of {transactions.length} transactions</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ padding: "24px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--white)", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 2px 8px var(--shadow-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "24px" }}>{icon}</span>
        <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{label}</div>
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}