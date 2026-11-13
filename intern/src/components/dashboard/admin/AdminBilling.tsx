"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { InvoiceResponse, TransactionResponse } from "../../../lib/api";
import { fetchInvoices, fetchTransactions } from "../../../lib/api";

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
      setInvoices(inv);
      setTransactions(txn);
      // Revenue analytics would need a separate API call
      // setRevenue(await fetchRevenueAnalytics(dateRange.start, dateRange.end));
    } catch (e) {
      toast("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : "—";

  const outstanding = invoices.filter(inv => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date());
  const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amount_cents, 0);

  if (loading) return <div className="dpane-h"><p>Loading billing…</p></div>;

  return (
    <div className="dpane-h" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Revenue Overview */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Revenue Overview</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Total Revenue</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>
              {revenue ? formatCents(revenue.total_revenue_cents) : "—"}
            </div>
          </div>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Outstanding</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--red)" }}>
              {formatCents(totalOutstanding)}
            </div>
          </div>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Open Invoices</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>
              {invoices.filter(i => i.status === "open").length}
            </div>
          </div>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Paid Transactions</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>
              {transactions.filter(t => t.status === "succeeded").length}
            </div>
          </div>
        </div>
        {revenue && (
          <div style={{ marginTop: "20px" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: "14px" }}>By Gateway</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
              {revenue.by_gateway.map((g) => (
                <div key={g.gateway} style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "8px", fontSize: "13px" }}>
                  <div style={{ fontWeight: 600 }}>{g.gateway}</div>
                  <div>{formatCents(g.revenue_cents)} ({g.count} txns)</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Outstanding Invoices */}
      <div className="fold" style={{ padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ margin: 0 }}>Outstanding Invoices</h3>
          <span className="lbl">{outstanding.length} overdue</span>
        </div>
        {outstanding.length === 0 ? (
          <p className="lbl">No overdue invoices. All payments current.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "10px 8px" }}>Invoice</th>
                  <th style={{ padding: "10px 8px" }}>Organization</th>
                  <th style={{ padding: "10px 8px" }}>Due Date</th>
                  <th style={{ padding: "10px 8px" }}>Days Overdue</th>
                  <th style={{ padding: "10px 8px" }}>Amount</th>
                  <th style={{ padding: "10px 8px" }}>Gateway</th>
                  <th style={{ padding: "10px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((inv) => {
                  const daysOverdue = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "10px 8px" }}>{inv.invoice_number}</td>
                      <td style={{ padding: "10px 8px" }}>{inv.org_id}</td>
                      <td style={{ padding: "10px 8px" }}>{formatDate(inv.due_date)}</td>
                      <td style={{ padding: "10px 8px", color: "var(--red)", fontWeight: 600 }}>{daysOverdue}d</td>
                      <td style={{ padding: "10px 8px" }}>{formatCents(inv.amount_cents)}</td>
                      <td style={{ padding: "10px 8px" }}>{inv.payment_gateway || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <button className="btn btn-sm" onClick={() => window.open(`https://mock-billing.example.com/admin/invoices/${inv.id}`, "_blank")}>
                          View
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

      {/* All Invoices */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>All Invoices</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "10px 8px" }}>Number</th>
                <th style={{ padding: "10px 8px" }}>Org</th>
                <th style={{ padding: "10px 8px" }}>Date</th>
                <th style={{ padding: "10px 8px" }}>Due</th>
                <th style={{ padding: "10px 8px" }}>Amount</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Gateway</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 50).map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 8px" }}>{inv.invoice_number}</td>
                  <td style={{ padding: "10px 8px" }}>{inv.org_id}</td>
                  <td style={{ padding: "10px 8px" }}>{formatDate(inv.created_at)}</td>
                  <td style={{ padding: "10px 8px" }}>{formatDate(inv.due_date)}</td>
                  <td style={{ padding: "10px 8px" }}>{formatCents(inv.amount_cents)}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span className={`tg ${inv.status === "paid" ? "gold" : inv.status === "open" ? "" : ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px" }}>{inv.payment_gateway || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoices.length > 50 && <p className="lbl" style={{ marginTop: "10px" }}>Showing 50 of {invoices.length} invoices</p>}
      </div>

      {/* Transaction Log */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Transaction Log</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "10px 8px" }}>Date</th>
                <th style={{ padding: "10px 8px" }}>Org</th>
                <th style={{ padding: "10px 8px" }}>Amount</th>
                <th style={{ padding: "10px 8px" }}>Type</th>
                <th style={{ padding: "10px 8px" }}>Gateway</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 50).map((txn) => (
                <tr key={txn.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 8px" }}>{formatDate(txn.processed_at || txn.created_at)}</td>
                  <td style={{ padding: "10px 8px" }}>{txn.org_id}</td>
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
        {transactions.length > 50 && <p className="lbl" style={{ marginTop: "10px" }}>Showing 50 of {transactions.length} transactions</p>}
      </div>
    </div>
  );
}