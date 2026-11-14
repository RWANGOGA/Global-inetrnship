"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import PaymentModal from "../../common/PaymentModal";
import { BillingStatusBanner } from "../common/BillingStatusBanner";
import {
  payInvoiceApi,
  fetchStudentInvoices,
  fetchStudentUsage,
  type StudentInvoiceResponse,
} from "../../../lib/api";

const STUDENT_FREE_APPS = 30;
const STUDENT_OVERAGE_CENTS = 50;

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
  const { student, session, isApiEnabled, toast } = useApp();
  const [usage, setUsage] = useState<{ application_count: number; overage_apps: number; overage_cents: number; free_limit: number } | null>(null);
  const [invoices, setInvoices] = useState<StudentInvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; invoice: StudentInvoiceResponse | null }>({ open: false, invoice: null });

  useEffect(() => {
    if (!isApiEnabled) {
      setUsage({ application_count: 0, overage_apps: 0, overage_cents: STUDENT_OVERAGE_CENTS, free_limit: STUDENT_FREE_APPS });
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled, student]);

  const loadData = async () => {
    try {
      const [usageResp, invResp] = await Promise.all([fetchStudentUsage(), fetchStudentInvoices()]);
      setUsage({ application_count: usageResp.current, overage_apps: Math.max(0, usageResp.current - usageResp.limit), overage_cents: usageResp.overage_cents, free_limit: usageResp.limit });
      setInvoices(Array.isArray(invResp) ? invResp : []);
    } catch (e) {
      toast("Failed to load billing data");
    } finally { setLoading(false); }
  };

  const handlePayInvoice = (invoice: StudentInvoiceResponse) => {
    setPaymentModal({ open: true, invoice });
  };

  const handlePaymentSuccess = async () => {
    setPaymentModal({ open: false, invoice: null });
    toast("Payment successful!");
    await loadData();
  };

  const used = usage?.application_count ?? 0;
  const limit = usage?.free_limit ?? STUDENT_FREE_APPS;
  const over = Math.max(0, used - limit);
  const pct = Math.min(100, (used / limit) * 100);
  const overdue = invoices.some((inv) => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date());

  if (loading) {
    return <div className="dpane-h" style={{ padding: "40px", textAlign: "center" }}><p style={{ fontWeight: 600, color: "var(--ink)" }}>Loading billing…</p></div>;
  }

  return (
    <div className="dpane-h" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
      <div className="dpane-h">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)", margin: 0, textAlign: "left", fontFamily: "var(--sans)" }}>Billing</h2>
            <p style={{ color: "var(--muted)", marginTop: "4px", fontSize: "12px" }}>Track your applications and manage overage invoices</p>
          </div>
          <button className="btn btn-sm" onClick={loadData} style={{ padding: "6px 14px", fontSize: "11.5px" }}><Icon name="arrow" size={14} /> Refresh</button>
        </div>
      </div>

      {/* Billing status banner — visible step in every dashboard */}
      <BillingStatusBanner plan="Free" status={over > 0 ? "open" : "active"} activeStep="plan" overdue={overdue} />

      {/* Application counter — usage meter */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Applications this month</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "14px" }}>
            <UsageRow label="Used" value={used} sub={`of ${limit} free applications`} color={used >= limit ? "var(--red)" : "var(--blue)"} tint={used >= limit ? "var(--red-tint)" : "var(--blue-tint)"} />
            <UsageRow label="Limit" value={limit} sub="Free tier resets monthly" color="var(--green)" tint="var(--green-tint)" />
            <UsageRow label="Overage" value={over} sub={`${formatCents(STUDENT_OVERAGE_CENTS)} per app`} color={over > 0 ? "var(--red)" : "var(--fg)"} tint="var(--paper)" />
          </div>

          <div style={{ height: "6px", background: "var(--rule-2)", borderRadius: "var(--r-pill)", overflow: "hidden", marginBottom: "10px" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: used >= limit ? "var(--red)" : used >= limit * 0.8 ? "var(--blue)" : "var(--green)", transition: "width 0.3s ease", borderRadius: "var(--r-pill)" }} />
          </div>

          <p style={{ margin: "0", fontSize: "12px", color: "var(--muted)", textAlign: "center", fontFamily: "var(--sans)" }}>{used < limit ? `${limit - used} free applications remaining this month.` : `Free limit exceeded. Overage: ${over} application${over !== 1 ? "s" : ""} at ${formatCents(STUDENT_OVERAGE_CENTS)} each.`}</p>

          {over > 0 && (
            <div style={{ marginTop: "14px", padding: "14px", background: "var(--amber-tint)", border: "1px solid var(--amber)", borderRadius: "var(--r-md)" }}>
              <div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
                <span style={{ color: "#92400e", fontSize: "16px" }}>⚠</span>
                <div>
                  <strong style={{ color: "#92400e", fontSize: "13px" }}>Free limit exceeded</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#92400e", lineHeight: 1.6 }}>You have {over} overage application${over !== 1 ? "s" : ""}. Pay the invoice below to continue applying.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overage invoices */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Overage invoices</span><span className="lbl blue" style={{ fontSize: "10px", fontWeight: 700 }}>{invoices.length} total</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px", opacity: 0.4 }}>📄</div>
              <p style={{ fontSize: "14px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No overage invoices</p>
              <p style={{ fontSize: "12px", marginTop: "4px", color: "var(--ink-2)", fontWeight: 500 }}>You're within the free tier.</p>
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
                      <td style={{ padding: "10px 12px" }}><span className={`tg ${inv.status === "paid" ? "green" : inv.status === "pending" ? "blue" : "red"}`} style={{ fontWeight: 700, fontSize: "10px" }}>{inv.status}</span></td>
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
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.8, fontWeight: 500 }}>
            <li>First <b>{STUDENT_FREE_APPS} applications</b> each month are free.</li>
            <li>After that, <b>{formatCents(STUDENT_OVERAGE_CENTS)} per application</b>.</li>
            <li>Overage invoices are generated automatically when you exceed the limit.</li>
            <li>Pay the invoice to unlock further applications for that month.</li>
            <li>Limit resets on the 1st of each month.</li>
          </ul>
        </div>
      </div>

      {/* Payment modal */}
      {paymentModal.open && (
        <PaymentModal
          isOpen={paymentModal.open}
          onClose={() => setPaymentModal({ open: false, invoice: null })}
          amount={(paymentModal.invoice?.amount_cents ?? 0)}
          invoiceId={paymentModal.invoice?.id ?? ""}
          description={paymentModal.invoice?.description ?? "Application overage"}
          currency="USD"
          initialStep="method"
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentCancel={() => setPaymentModal({ open: false, invoice: null })}
        />
      )}
    </div>
  );
}

export default StudentBilling;
