"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { InvoiceResponse } from "../../../lib/api";
import { fetchInvoices } from "../../../lib/api";
import { Icon } from "../../icons/Icons";

interface StudentUsageResponse {
  id: string;
  user_id: string;
  month: string;
  application_count: number;
  billed_count: number;
  last_billed_at: string | null;
  free_limit: number;
  overage_apps: number;
  overage_cents: number;
}

const MOCK_INVOICES: InvoiceResponse[] = [
  { id: "inv_1", org_id: "current", subscription_id: null, amount_cents: 500, currency: "USD", status: "open", invoice_number: "INV-2026-005", description: "Applications over free tier (30/month)", line_items: [{ description: "Applications over free tier (30/month)", quantity: 2, unit_amount_cents: 50 }], metadata: { type: "student_overage" }, due_date: "2026-02-20", paid_at: null, payment_gateway: "stripe", gateway_invoice_id: "inv_stripe_5", gateway_payment_intent_id: null, created_at: "2026-02-10", updated_at: "2026-02-10" },
  { id: "inv_2", org_id: "current", subscription_id: null, amount_cents: 150, currency: "USD", status: "paid", invoice_number: "INV-2026-006", description: "Applications over free tier (30/month)", line_items: [{ description: "Applications over free tier (30/month)", quantity: 1, unit_amount_cents: 50 }], metadata: { type: "student_overage" }, due_date: "2026-01-15", paid_at: "2026-01-12", payment_gateway: "paypal", gateway_invoice_id: "inv_paypal_2", gateway_payment_intent_id: "pi_3", created_at: "2026-01-05", updated_at: "2026-01-12" },
];

function StudentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "green",
    open: "",
    void: "red",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    "": "tg",
    red: "tg red",
  };
  return <span className={classMap[color] || "tg"}>{status}</span>;
}

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: import("../../icons/Icons").IconName }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: "24px", boxShadow: "0 1px 3px var(--shadow-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
        {icon && <span style={{ color: "var(--blue)" }}><Icon name={icon} size={20} /></span>}
        <h3 style={{ fontWeight: 700, fontSize: "16px", margin: "0", color: "var(--ink)" }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gap: "16px" }}>{children}</div>
    </div>
  );
}

function formatCents(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function formatDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString() : "—"; }

const STUDENT_FREE_APPS = 30;
const STUDENT_OVERAGE_CENTS = 50;

export function StudentBilling() {
  const { isApiEnabled, toast } = useApp();
  const [usage, setUsage] = useState<StudentUsageResponse | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isApiEnabled) {
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
      setInvoices(MOCK_INVOICES);
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled]);

  const loadData = async () => {
    try {
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

  const used = usage?.application_count ?? 0;
  const limit = usage?.free_limit ?? STUDENT_FREE_APPS;
  const pct = Math.min(100, (used / limit) * 100);
  const over = Math.max(0, used - limit);

  if (loading) return <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}><p>Loading billing…</p></div>;

  return (
    <div className="dpane-h" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
      <div className="dpane-h">
        <div>
          <h2>Billing</h2>
          <p style={{ color: "var(--muted)", marginTop: "4px" }}>Track your applications and manage overage invoices</p>
        </div>
      </div>

      {/* Application Counter */}
      <SectionCard title="Applications This Month" icon="brief">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", textAlign: "center", background: used >= limit ? "var(--red-tint)" : "var(--blue-tint)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Used</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: used >= limit ? "var(--red)" : "var(--blue)" }}>
              {used}
            </div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", textAlign: "center", background: "var(--green-tint)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Free Limit</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "var(--green)" }}>{limit}</div>
          </div>
        </div>
        <div style={{ height: "8px", background: "var(--rule-2)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: used >= limit ? "var(--red)" : used >= limit * 0.8 ? "var(--amber)" : "var(--green)",
              transition: "width 0.3s ease",
              borderRadius: "var(--r-pill)",
            }}
          />
        </div>
        <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--muted)", textAlign: "center" }}>
          {used < limit
            ? `${limit - used} free applications remaining this month.`
            : `Free limit exceeded. Overage: ${over} application${over !== 1 ? "s" : ""} at ${formatCents(STUDENT_OVERAGE_CENTS)} each.`}
        </p>
        {over > 0 && (
          <div style={{ marginTop: "16px", padding: "16px", background: "var(--amber-tint)", border: "1px solid var(--amber)", borderRadius: "var(--r-md)" }}>
            <strong style={{ color: "#92400e" }}>⚠ Free limit exceeded</strong>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#92400e" }}>
              You have {over} overage application{over !== 1 ? "s" : ""}. Pay the invoice below to continue applying.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Overage Invoices */}
      <SectionCard title="Overage Invoices" icon="brief">
        {invoices.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📄</div>
            <p style={{ fontSize: "15px", margin: 0 }}>No overage invoices. You're within the free tier.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
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
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 500 }}>{inv.invoice_number}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.created_at)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.due_date)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatCents(inv.amount_cents)}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StudentStatusBadge status={inv.status} />
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
        )}
      </SectionCard>

      {/* Info */}
      <SectionCard title="How Student Billing Works" icon="brief">
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.8 }}>
          <li>First <b>{STUDENT_FREE_APPS} applications</b> each month are free.</li>
          <li>After that, <b>${formatCents(STUDENT_OVERAGE_CENTS)} per application</b>.</li>
          <li>Overage invoices are generated automatically when you exceed the limit.</li>
          <li>Pay the invoice to unlock further applications for that month.</li>
          <li>Limit resets on the 1st of each month.</li>
        </ul>
      </SectionCard>
    </div>
  );
}

export default StudentBilling;