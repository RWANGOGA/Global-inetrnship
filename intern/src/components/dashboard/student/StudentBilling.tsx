"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { InvoiceResponse, StudentUsageResponse } from "../../../lib/api";
import { fetchInvoices } from "../../../lib/api";

const STUDENT_FREE_APPS = 30;
const STUDENT_OVERAGE_CENTS = 50;

export function StudentBilling() {
  const { isApiEnabled, toast } = useApp();
  const [usage, setUsage] = useState<StudentUsageResponse | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isApiEnabled) {
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled]);

  const loadData = async () => {
    try {
      // Note: would need fetchStudentUsage and fetchStudentInvoices in api.ts
      // For now using mock data
      const month = new Date().toISOString().slice(0, 7);
      setUsage({
        id: "su_1",
        user_id: "current",
        month,
        application_count: 12,
        billed_count: 0,
        last_billed_at: null,
        free_limit: STUDENT_FREE_APPS,
        overage_apps: 0,
        overage_cents: STUDENT_OVERAGE_CENTS,
      });
      setInvoices([]);
    } catch (e) {
      toast("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : "—";

  if (loading) return <div className="dpane-h"><p>Loading billing…</p></div>;

  const used = usage?.application_count ?? 0;
  const limit = usage?.free_limit ?? STUDENT_FREE_APPS;
  const pct = Math.min(100, (used / limit) * 100);
  const over = Math.max(0, used - limit);

  return (
    <div className="dpane-h" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Application Counter */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Applications This Month</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Used</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: used >= limit ? "var(--red)" : "var(--ink)" }}>
              {used}
            </div>
          </div>
          <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Free Limit</div>
            <div style={{ fontSize: "32px", fontWeight: 700 }}>{limit}</div>
          </div>
        </div>
        <div style={{ height: "8px", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: used >= limit ? "var(--red)" : used >= limit * 0.8 ? "var(--amber)" : "var(--green)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--muted)" }}>
          {used < limit
            ? `${limit - used} free applications remaining this month.`
            : `Free limit exceeded. Overage: ${over} application${over !== 1 ? "s" : ""} at ${formatCents(STUDENT_OVERAGE_CENTS)} each.`}
        </p>
        {over > 0 && (
          <div style={{ marginTop: "12px", padding: "12px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px" }}>
            <strong style={{ color: "#92400e" }}>⚠ Free limit exceeded</strong>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#92400e" }}>
              You have {over} overage application{over !== 1 ? "s" : ""}. Pay the invoice below to continue applying.
            </p>
          </div>
        )}
      </div>

      {/* Overage Invoices */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 14px" }}>Overage Invoices</h3>
        {invoices.length === 0 ? (
          <p className="lbl">No overage invoices. You're within the free tier.</p>
        ) : (
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
                      <span className={`tg ${inv.status === "paid" ? "gold" : ""}`}>
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

      {/* Info */}
      <div className="fold" style={{ padding: "22px" }}>
        <h3 style={{ margin: "0 0 10px" }}>How Student Billing Works</h3>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.7 }}>
          <li>First <b>{STUDENT_FREE_APPS} applications</b> each month are free.</li>
          <li>After that, <b>${formatCents(STUDENT_OVERAGE_CENTS)} per application</b>.</li>
          <li>Overage invoices are generated automatically when you exceed the limit.</li>
          <li>Pay the invoice to unlock further applications for that month.</li>
          <li>Limit resets on the 1st of each month.</li>
        </ul>
      </div>
    </div>
  );
}