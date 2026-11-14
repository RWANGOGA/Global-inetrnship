"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { InvoiceResponse, TransactionResponse } from "../../../lib/api";
import { fetchInvoices, fetchTransactions } from "../../../lib/api";
import { Icon } from "../../icons/Icons";
import { BillingStatusBanner } from "../common/BillingStatusBanner";

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
  pending_cents: 6000,
  collected_cents: 34500,
  by_gateway: [
    { gateway: "stripe", count: 2, revenue_cents: 6000, revenue_usd: 60.00 },
    { gateway: "paypal", count: 1, revenue_cents: 30000, revenue_usd: 300.00 },
    { gateway: "flutterwave", count: 1, revenue_cents: 500, revenue_usd: 5.00 },
  ],
  by_plan: [
    { plan: "Pro", subscriptions: 4 },
    { plan: "Enterprise", subscriptions: 1 },
  ],
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ padding: "16px 18px", borderRight: "1px solid var(--rule)", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "22px" }}>{icon}</span>
        <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, fontFamily: "var(--mono)" }}>{label}</div>
      </div>
      <div style={{ fontSize: "30px", fontWeight: 700, color, fontFamily: "var(--serif)" }}>{value}</div>
    </div>
  );
}

export function AdminBilling() {
  const { isApiEnabled, toast } = useApp();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [revenue, setRevenue] = useState<{
    total_revenue_cents: number;
    total_revenue_usd: number;
    pending_cents: number;
    collected_cents: number;
    by_gateway: Array<{ gateway: string; count: number; revenue_cents: number; revenue_usd: number }>;
    by_plan: Array<{ plan: string; subscriptions: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isApiEnabled) {
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

  const outstanding = Array.isArray(invoices)
    ? invoices.filter(inv => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date())
    : [];
  const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amount_cents, 0);
  const paidInvoices = Array.isArray(invoices) ? invoices.filter(i => i.status === "paid").length : 0;
  const paidTxns = Array.isArray(transactions) ? transactions.filter(t => t.status === "succeeded").length : 0;

  const overdue = outstanding.length > 0;

  if (loading) {
    return (
      <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}>
        <p style={{ fontWeight: 600, color: "var(--ink)" }}>Loading billing…</p>
      </div>
    );
  }

  return (
    <div className="dpane-h" style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px" }}>
      <div className="dpane-h">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2>Billing</h2>
            <p style={{ color: "var(--muted)", marginTop: "4px" }}>Revenue overview, invoices, and transaction log</p>
          </div>
        </div>
      </div>

      {/* Billing status banner — visible step in every dashboard */}
      <BillingStatusBanner
        plan="All plans"
        status={overdue ? "open" : "active"}
        activeStep="receipt"
        overdue={overdue}
      />

      {/* Revenue overview KPI strip */}
      <div className="kpis" style={{ marginBottom: "22px" }}>
        <MetricCard label="Total revenue" value={revenue ? formatCents(revenue.total_revenue_cents) : "—"} icon="💰" color="var(--green)" />
        <MetricCard label="Outstanding" value={formatCents(totalOutstanding)} icon="⚠️" color={overdue ? "var(--red)" : "var(--green)"} />
        <MetricCard label="Open invoices" value={Array.isArray(invoices) ? invoices.filter(i => i.status === "open").length : 0} icon="📄" color="var(--blue)" />
        <MetricCard label="Paid transactions" value={paidTxns} icon="✅" color="var(--green)" />
      </div>

      {/* Revenue by gateway */}
      {revenue && revenue.by_gateway && revenue.by_gateway.length > 0 && (
        <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
          <div className="ph">
            <span className="lbl blue">Revenue by gateway</span>
          </div>
          <div className="pb" style={{ padding: "20px 24px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {revenue.by_gateway.map((g) => (
              <div key={g.gateway} style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", background: "var(--paper-2)" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "8px", color: "var(--ink)" }}>{g.gateway}</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)" }}>{formatCents(g.revenue_cents)}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", fontFamily: "var(--mono)" }}>{g.count} transactions</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by plan */}
      {revenue && revenue.by_plan && revenue.by_plan.length > 0 && (
        <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
          <div className="ph">
            <span className="lbl blue">Subscriptions by plan</span>
          </div>
          <div className="pb" style={{ padding: "20px 24px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {revenue.by_plan.map((p) => (
              <div key={p.plan} style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", background: "var(--paper-2)" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "8px", color: "var(--ink)" }}>{p.plan}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)" }}>{p.subscriptions}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", fontFamily: "var(--mono)" }}>active subscriptions</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outstanding invoices */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph">
          <span className="lbl blue">Outstanding invoices</span>
          <span className={`tg ${overdue ? "red" : "green"}`} style={{ fontSize: "11px", fontWeight: 700 }}>{outstanding.length} overdue</span>
        </div>
        <div className="pb" style={{ padding: "20px 24px 24px" }}>
          {outstanding.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>✅</div>
              <p style={{ fontSize: "15px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No overdue invoices</p>
              <p style={{ fontSize: "13px", marginTop: "4px", color: "var(--ink-2)", fontWeight: 500 }}>All payments current.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
              <table className="dtable">
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Invoice</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Organization</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Due date</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Days overdue</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Amount</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Gateway</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((inv) => {
                    const daysOverdue = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    return (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                        <td style={{ padding: "11px 12px", fontWeight: 500, color: "var(--ink)" }}>{inv.invoice_number}</td>
                        <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{inv.org_id}</td>
                        <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{formatDate(inv.due_date)}</td>
                        <td style={{ padding: "11px 12px", color: "var(--red)", fontWeight: 600, fontFamily: "var(--mono)" }}>{daysOverdue}d</td>
                        <td style={{ padding: "11px 12px", fontWeight: 600, color: "var(--ink)" }}>{formatCents(inv.amount_cents)}</td>
                        <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{inv.payment_gateway || "—"}</td>
                        <td style={{ padding: "11px 12px" }}>
                          <button className="btn btn-sm" onClick={() => toast("Opening invoice details…")} style={{ padding: "6px 14px", fontWeight: 700 }}>
                            View details
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
      </div>

      {/* All invoices table */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph">
          <span className="lbl blue">All invoices</span>
          <span className="lbl" style={{ fontSize: "12px" }}>{Array.isArray(invoices) ? invoices.length : 0} total</span>
        </div>
        <div className="pb" style={{ padding: "20px 24px 24px" }}>
          {Array.isArray(invoices) && invoices.length > 0 ? (
            <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
              <table className="dtable">
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Number</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Org</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Due</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Amount</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Gateway</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 100).map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <td style={{ padding: "11px 12px", fontWeight: 500, color: "var(--ink)" }}>{inv.invoice_number}</td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{inv.org_id}</td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{formatDate(inv.created_at)}</td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{formatDate(inv.due_date)}</td>
                      <td style={{ padding: "11px 12px", fontWeight: 600, color: "var(--ink)" }}>{formatCents(inv.amount_cents)}</td>
                      <td style={{ padding: "11px 12px" }}>
                        <span className={`tg ${inv.status === "paid" ? "green" : inv.status === "open" ? "blue" : "red"}`}>{inv.status}</span>
                      </td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{inv.payment_gateway || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>📄</div>
              <p style={{ fontSize: "15px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No invoices found</p>
            </div>
          )}
          {Array.isArray(invoices) && invoices.length > 100 && (
            <p className="lbl" style={{ marginTop: "16px", textAlign: "center" }}>Showing 100 of {invoices.length} invoices</p>
          )}
        </div>
      </div>

      {/* Transaction log */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="ph">
          <span className="lbl blue">Transaction log</span>
        </div>
        <div className="pb" style={{ padding: "20px 24px 24px" }}>
          {Array.isArray(transactions) && transactions.length > 0 ? (
            <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
              <table className="dtable">
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Org</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Amount</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Type</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Gateway</th>
                    <th style={{ padding: "8px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 100).map((txn) => (
                    <tr key={txn.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{formatDate(txn.processed_at || txn.created_at)}</td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{txn.org_id}</td>
                      <td style={{ padding: "11px 12px", fontWeight: 600, color: "var(--ink)" }}>{formatCents(txn.amount_cents)}</td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)", fontWeight: 500 }}>{txn.type}</td>
                      <td style={{ padding: "11px 12px", color: "var(--ink-2)" }}>{txn.payment_gateway}</td>
                      <td style={{ padding: "11px 12px" }}>
                        <span className={`tg ${txn.status === "succeeded" ? "blue" : ""}`} style={{ fontSize: "11px" }}>{txn.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>💳</div>
              <p style={{ fontSize: "15px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No transactions recorded yet</p>
            </div>
          )}
          {Array.isArray(transactions) && transactions.length > 100 && (
            <p className="lbl" style={{ marginTop: "16px", textAlign: "center" }}>Showing 100 of {transactions.length} transactions</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminBilling;
