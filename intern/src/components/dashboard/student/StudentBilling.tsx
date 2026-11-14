"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import PaymentModal from "../../common/PaymentModal";
import { payInvoiceApi, fetchStudentInvoices, fetchStudentUsage } from "../../../lib/api";

interface InvoiceResponse {
  [key: string]: any;
}

interface StudentUsageDto {
  user_id: string;
  course: string;
  cgpa: number;
  skills: string[];
  talent_search_opt_in: boolean;
  skills_confidence: Record<string, number>;
  skills_source: Record<string, string>;
  application_count: number;
  overage_apps: number;
  overage_cents: number;
  verified?: boolean;
}

const STUDENT_FREE_APPS = 30;
const STUDENT_OVERAGE_CENTS = 50;

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: import("../../icons/Icons").IconName }) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: "24px", boxShadow: "0 1px 3px var(--shadow-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
        {icon && <span style={{ color: "var(--brand)" }}><Icon name={icon} size={20} /></span>}
        <h3 style={{ fontWeight: 600, fontSize: "16px", margin: "0", color: "var(--fg)" }}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function formatCents(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function formatDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString() : "—"; }

export function StudentBilling() {
  const { student, session, isApiEnabled, toast } = useApp();
  const [usage, setUsage] = useState<StudentUsageDto | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; invoice: InvoiceResponse | null }>({ open: false, invoice: null });

  useEffect(() => {
    if (!isApiEnabled) {
      setUsage({
        user_id: session?.id || "current",
        course: student?.course || "Computer Science",
        cgpa: student?.cgpa || 3.5,
        skills: student?.skills || ["React", "JavaScript"],
        talent_search_opt_in: student?.skillsConfidence ? true : false,
        skills_confidence: student?.skillsConfidence || {},
        skills_source: student?.skillsSource || {},
        application_count: Math.floor(Math.random() * 35) + 20,
        overage_apps: Math.max(0, Math.floor(Math.random() * 5)),
        overage_cents: STUDENT_OVERAGE_CENTS,
      });
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled, student]);

  const loadData = async () => {
    try {
      const [usageResp, invResp] = await Promise.all([fetchStudentUsage(), fetchStudentInvoices()]);
      setUsage(usageResp as unknown as StudentUsageDto);
      setInvoices(Array.isArray(invResp) ? (invResp as unknown as InvoiceResponse[]) : []);
    } catch (e) {
      toast("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async (invoice: InvoiceResponse) => {
    setPaymentModal({ open: true, invoice });
  };

  const handlePaymentSuccess = async (txnId: string) => {
    setPaymentModal({ open: false, invoice: null });
    toast("Payment successful!");
    await loadData();
  };

  const used = usage?.application_count ?? 0;
  const limit = usage?.skills ? STUDENT_FREE_APPS : 30;
  const pct = Math.min(100, (used / limit) * 100);
  const over = Math.max(0, used - limit);

  if (loading) return <div className="dpane-h" style={{ padding: "40px", textAlign: "center" }}><p>Loading billing…</p></div>;

  return (
    <div className="dpane-h" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
      <div className="dpane-h">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2>Billing</h2>
            <p style={{ color: "var(--muted)", marginTop: "4px" }}>Track your applications and manage overage invoices</p>
          </div>
          <button className="btn" onClick={loadData} style={{ padding: "8px 16px", fontSize: "13px" }}>
            <Icon name="arrow" size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Application Counter */}
      <SectionCard title="Applications This Month" icon="brief">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", textAlign: "center", background: used >= limit ? "var(--red-tint)" : "var(--blue-tint)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Used</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: used >= limit ? "var(--red)" : "var(--blue)" }}>{used}</div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", textAlign: "center", background: "var(--green-tint)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Free Limit</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "var(--green)" }}>{limit}</div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Overage</div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: over > 0 ? "var(--red)" : "var(--fg)" }}>{over}</div>
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
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>📄</div>
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
                    <td style={{ padding: "14px 16px", fontWeight: 500 }}>{inv.invoice_number || inv.id}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.created_at)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{formatDate(inv.due_date ?? null)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatCents(inv.amount_cents || 0)}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span className={`tg ${inv.status === "paid" ? "green" : inv.status === "pending" ? "" : "red"}`}>{inv.status}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {inv.status === "open" ? (
                        <button className="btn btn-sm" onClick={() => handlePayInvoice(inv)} style={{ padding: "8px 16px" }}>
                          Pay Now
                        </button>
                      ) : (
                        <span className="lbl" style={{ fontSize: "11px", color: "var(--green)" }}>Paid</span>
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

      {/* Payment Modal */}
      {paymentModal.open && paymentModal.invoice && (
        <PaymentModal
          isOpen={paymentModal.open}
          onClose={() => setPaymentModal({ open: false, invoice: null })}
          amount={paymentModal.invoice.amount_cents || 0}
          invoiceId={paymentModal.invoice.id}
          description={paymentModal.invoice.content || "Application overage"}
          currency="USD"
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentCancel={() => setPaymentModal({ open: false, invoice: null })}
        />
      )}
    </div>
  );
}

export default StudentBilling;
