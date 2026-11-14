"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import PaymentModal from "../../common/PaymentModal";
import { payInvoiceApi, fetchInvoices, fetchTransactions, fetchGateways, fetchSubscription, createSubscriptionApi, cancelSubscriptionApi } from "../../../lib/api";
import type { InvoiceResponse, TransactionResponse, GatewayOption } from "../../../lib/api";

interface EmployerBillingProps {
  student?: any;
}

const MOCK_GATEWAYS: GatewayOption[] = [
  { id: "stripe", name: "Stripe (Cards)", currencies: ["USD", "EUR", "GBP", "UGX", "KES"] },
  { id: "paypal", name: "PayPal", currencies: ["USD", "EUR", "GBP"] },
  { id: "flutterwave", name: "Flutterwave (Africa)", currencies: ["USD", "UGX", "KES", "NGN", "GHS", "ZAR"] },
  { id: "mpesa", name: "M-Pesa (Mobile Money)", currencies: ["KES", "USD"] },
  { id: "bank_transfer", name: "Bank Transfer", currencies: ["USD", "UGX", "EUR", "KES"] },
  { id: "crypto", name: "Crypto (USDC/USDT)", currencies: ["USDC", "USDT", "USD"] },
];

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: import("../../icons/Icons").IconName }) {
  return (
    <div className="panel">
      <div className="ph">
        {icon && <span className="section-icon"><Icon name={icon} size={13} /></span>}
        <span className="lbl blue">{title}</span>
      </div>
      <div className="pb">{children}</div>
    </div>
  );
}

function formatCents(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function formatDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString() : "—"; }
function getLimit(plan: string) { return plan === "Free" ? 3 : plan === "Pro" ? 50 : -1; }
function GatewayBadge({ name }: { name: string }) {
  return <span className="tg blue">{name}</span>;
}

export function EmployerBilling() {
  const { student, isApiEnabled, toast } = useApp();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; invoice: InvoiceResponse | null }>({ open: false, invoice: null });
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!isApiEnabled) {
      setInvoices([]);
      setTransactions([]);
      setGateways(MOCK_GATEWAYS);
      setSubscription({ plan: "Free", billing_cycle: "monthly", status: "active", since: new Date().toISOString() });
      setLoading(false);
      return;
    }
    loadData();
  }, [isApiEnabled, student]);

  const loadData = async () => {
    try {
      const [inv, txn, gw, sub] = await Promise.all([
        fetchInvoices(),
        fetchTransactions(),
        fetchGateways(),
        fetchSubscription(),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setTransactions(Array.isArray(txn) ? txn : []);
      setGateways(Array.isArray(gw) ? gw : []);
      setSubscription(sub);
    } catch (e) {
      toast("Failed to load billing data");
      setInvoices([]); setTransactions([]); setGateways([]); setSubscription(null);
    } finally { setLoading(false); }
  };

  const handleUpgrade = async (plan: "Pro" | "Enterprise", billingCycle: "monthly" | "annual") => {
    if (!gateways.length) return;
    const gateway = gateways[0].id;
    setUpgrading(plan);
    try {
      const created = await createSubscriptionApi(plan, billingCycle, gateway);
      setSubscription(created);
      toast(`${plan} plan activated (${billingCycle})`);
    } catch (e: any) { toast(e?.message || "Upgrade failed"); }
    finally { setUpgrading(null); }
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

  const handlePayInvoice = async (invoice: InvoiceResponse) => {
    setPaymentModal({ open: true, invoice });
  };

  const handlePaymentSuccess = async (txnId: string) => {
    setPaymentModal({ open: false, invoice: null });
    toast("Payment successful!");
    await loadData();
  };

  if (loading) return <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}><p style={{ fontWeight: 600, color: "var(--ink)" }}>Loading billing…</p></div>;

  const subPlan = subscription?.plan || "Free";
  const subBilling = subscription?.billing_cycle || "monthly";
  const subStatus = subscription?.status || "active";
  const subSince = subscription?.since || new Date().toISOString();

  return (
    <div className="dpane-h" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
      <div className="dpane-h">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontWeight: 800, color: "var(--ink)", fontSize: "22px", marginBottom: "4px" }}>Billing</h2>
            <p style={{ color: "var(--ink-2)", fontSize: "14px", margin: "0", fontWeight: 500 }}>Manage your plan, invoices, and payment methods</p>
          </div>
          <button className="btn btn-sm" onClick={loadData} style={{ fontWeight: 700 }}>
            <Icon name="arrow" size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Current Plan */}
      <SectionCard title="Current Plan" icon="brief">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
              <h3 style={{ margin: "0", fontSize: "28px", fontWeight: 800, color: "var(--ink)" }}>{subPlan}</h3>
              <span className={`tg blue`} style={{ fontSize: "12px", padding: "4px 10px", fontWeight: 700 }}>{subStatus}</span>
            </div>
            <p style={{ color: "var(--ink-2)", margin: "0 0 16px", fontSize: "14px", fontWeight: 500 }}>
              {subPlan === "Free" ? "Free tier — 3 placement limit" : subPlan === "Pro" ? `Pro — ${subBilling} billing · $${subBilling === "monthly" ? "30" : "300"}/${subBilling === "monthly" ? "mo" : "yr"}` : "Enterprise — custom pricing"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "var(--ink-2)", fontWeight: 500 }}>
              {subscription?.current_period_start && <span>Period: {new Date(subscription.current_period_start).toLocaleDateString()} – {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "—"}</span>}
              {subscription?.cancel_at_period_end && <span style={{ color: "var(--red)", fontWeight: 700 }}>Cancels at period end</span>}
              {subPlan === "Free" && subscription?.since && <span>Free since {subscription.since}</span>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "200px", flexShrink: 0 }}>
            {subPlan === "Free" ? (
              <>
                <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Pro", "monthly")} disabled={upgrading === "Pro"} style={{ width: "100%", fontWeight: 700 }}>{upgrading === "Pro" ? "Activating…" : "Upgrade to Pro — $30/mo"}</button>
                <button className="btn btn-sm btn-ghost" onClick={() => handleUpgrade("Pro", "annual")} disabled={upgrading === "Pro"} style={{ width: "100%", fontWeight: 700 }}>{upgrading === "Pro" ? "Upgrading…" : "Upgrade to Pro — $300/yr (save 17%)"}</button>
              </>
            ) : subPlan === "Pro" ? (
              <>
                <button className="btn btn-sm btn-ghost" onClick={handleCancel} disabled={subStatus === "cancelled" || canceling} style={{ width: "100%", fontWeight: 700 }}>{canceling ? "Cancelling…" : "Cancel at period end"}</button>
                <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Enterprise", "monthly")} disabled={upgrading === "Enterprise"} style={{ width: "100%", fontWeight: 700 }}>{upgrading === "Enterprise" ? "Upgrading…" : "Upgrade to Enterprise"}</button>
              </>
            ) : (
              <button className="btn btn-sm btn-ghost" disabled style={{ width: "100%", fontWeight: 700 }}>Enterprise plan active</button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Placement Usage */}
      <SectionCard title="Placement Usage" icon="brief">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center", background: "var(--blue-tint)" }}>
            <div style={{ fontSize: "11px", color: "var(--blue)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800 }}>Active Placements</div>
            <div style={{ fontSize: "34px", fontWeight: 800, color: "var(--blue)" }}>{subPlan === "Free" ? 0 : 0}</div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center", background: subPlan === "Free" ? "var(--blue-tint)" : "var(--green-tint)" }}>
            <div style={{ fontSize: "11px", color: subPlan === "Free" ? "var(--blue)" : "var(--green)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800 }}>Limit</div>
            <div style={{ fontSize: "34px", fontWeight: 800, color: subPlan === "Free" ? "var(--blue)" : "var(--green)" }}>{getLimit(subPlan) === -1 ? "Unlimited" : getLimit(subPlan)}</div>
          </div>
          <div style={{ padding: "20px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--blue)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800 }}>Remaining</div>
            <div style={{ fontSize: "34px", fontWeight: 800, color: getLimit(subPlan) === -1 ? "var(--green)" : "var(--ink)" }}>{getLimit(subPlan) === -1 ? "∞" : Math.max(0, getLimit(subPlan) - (subPlan === "Free" ? 0 : 0))}</div>
          </div>
        </div>
        {subPlan === "Free" && (
          <div style={{ marginTop: "16px", padding: "16px", background: "var(--blue-tint)", border: "1px solid var(--blue)", borderRadius: "var(--r-md)" }}>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--blue)", fontWeight: 700 }}><strong>Free plan limit: 3 placements</strong></p>
            <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Pro", "monthly")} style={{ marginTop: "8px", fontWeight: 700 }}>
              Upgrade to Pro for unlimited placements
            </button>
          </div>
        )}
      </SectionCard>

      {/* Invoices */}
      <SectionCard title="Invoices" icon="brief">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: "0", fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>Invoices</h3>
          <span className="lbl blue" style={{ fontSize: "12px", fontWeight: 700 }}>{Array.isArray(invoices) ? invoices.length : 0} total</span>
        </div>
        {Array.isArray(invoices) && invoices.length > 0 ? (
          <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Number</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Date</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Due</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--ink)" }}>{inv.invoice_number}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)", fontWeight: 500 }}>{formatDate(inv.created_at)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)", fontWeight: 500 }}>{formatDate(inv.due_date)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--ink)" }}>{formatCents(inv.amount_cents)}</td>
                    <td style={{ padding: "14px 16px" }}><EmployerStatusBadge status={inv.status} /></td>
                    <td style={{ padding: "14px 16px" }}>
                      {inv.status === "open" ? (
                        <button className="btn btn-sm btn-blue" onClick={() => handlePayInvoice(inv)} style={{ padding: "8px 16px", fontWeight: 700 }}>
                          Pay Now
                        </button>
                      ) : (
                        <span className="lbl blue" style={{ fontSize: "11px", fontWeight: 700 }}>Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "34px", marginBottom: "12px", color: "var(--blue)", fontWeight: 700 }}>📄</div>
            <p style={{ fontSize: "15px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No invoices yet</p>
            <p style={{ fontSize: "13px", marginTop: "4px", color: "var(--ink-2)", fontWeight: 500 }}>Invoices will appear here after you upgrade to a paid plan.</p>
          </div>
        )}
      </SectionCard>

      {/* Payment History */}
      <SectionCard title="Payment History" icon="brief">
        {Array.isArray(transactions) && transactions.length > 0 ? (
          <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Date</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Type</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Gateway</th>
                  <th style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)", fontWeight: 500 }}>{formatDate(txn.created_at)}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--ink)" }}>{formatCents(txn.amount_cents)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)", fontWeight: 500 }}>{txn.type}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-2)", fontWeight: 500 }}>{txn.payment_gateway}</td>
                    <td style={{ padding: "14px 16px" }}><span className={`tg ${txn.status === "succeeded" ? "blue" : ""}`} style={{ fontSize: "11px", fontWeight: 700 }}>{txn.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "34px", marginBottom: "12px", color: "var(--blue)", fontWeight: 700 }}>💳</div>
            <p style={{ fontSize: "15px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No payments recorded yet</p>
          </div>
        )}
      </SectionCard>

      {/* Payment Methods */}
      <SectionCard title="Payment Methods" icon="brief">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <span style={{ color: "var(--ink-2)", fontSize: "13px", fontWeight: 500 }}>Connected gateways:</span>
          {Array.isArray(gateways) && gateways.length > 0 ? gateways.map((g) => <GatewayBadge key={g.id} name={g.name} />) : <span className="lbl blue" style={{ fontSize: "12px", fontWeight: 700 }}>None connected</span>}
        </div>
        <p style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "16px", fontWeight: 500 }}>Payment methods are managed via the payment gateway's portal. Click "Pay" on an open invoice to add a method.</p>
      </SectionCard>

      {/* Billing Email */}
      <SectionCard title="Billing Email" icon="brief">
        <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "8px", fontWeight: 500 }}>Invoices and receipts are sent to this email.</p>
        <input type="email" defaultValue={subscription?.plan === "Free" ? "" : "billing@yourcompany.com"} placeholder="billing@yourcompany.com" style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--white)", color: "var(--ink)", height: "44px", padding: "0 14px", fontSize: "13.5px", outline: 0, width: "100%", maxWidth: "400px", fontWeight: 500, transition: "border-color 0.15s, box-shadow 0.15s" }} onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule)"; e.currentTarget.style.boxShadow = "none"; }} />
      </SectionCard>

      {paymentModal.open && paymentModal.invoice && (
        <PaymentModal
          isOpen={paymentModal.open}
          onClose={() => setPaymentModal({ open: false, invoice: null })}
          amount={paymentModal.invoice.amount_cents || 0}
          invoiceId={paymentModal.invoice.id}
          description={paymentModal.invoice.description || "Invoice payment"}
          currency="USD"
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentCancel={() => setPaymentModal({ open: false, invoice: null })}
        />
      )}
    </div>
  );
}

function EmployerStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "green", open: "blue", void: "red" };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = { green: "tg green", blue: "tg blue", red: "tg red" };
  return <span className={classMap[color] || "tg"} style={{ fontWeight: 700 }}>{status}</span>;
}

export default EmployerBilling;
