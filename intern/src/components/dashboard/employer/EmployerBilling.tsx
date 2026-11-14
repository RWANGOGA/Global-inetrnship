"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import PaymentModal from "../../common/PaymentModal";
import { BillingStatusBanner } from "../common/BillingStatusBanner";
import {
  payInvoiceApi,
  fetchInvoices,
  fetchTransactions,
  fetchGateways,
  fetchSubscription,
  createSubscriptionApi,
  cancelSubscriptionApi,
  resumeSubscriptionApi,
  type InvoiceResponse,
  type TransactionResponse,
  type GatewayOption,
} from "../../../lib/api";

const MOCK_GATEWAYS: GatewayOption[] = [
  { id: "stripe", name: "Stripe (Cards)", currencies: ["USD", "EUR", "GBP", "UGX", "KES"] },
  { id: "paypal", name: "PayPal", currencies: ["USD", "EUR", "GBP"] },
  { id: "flutterwave", name: "Flutterwave (Africa)", currencies: ["USD", "UGX", "KES", "NGN", "GHS", "ZAR"] },
  { id: "mpesa", name: "M-Pesa (Mobile Money)", currencies: ["KES", "USD"] },
  { id: "bank_transfer", name: "Bank Transfer", currencies: ["USD", "UGX", "EUR", "KES"] },
  { id: "crypto", name: "Crypto (USDC/USDT)", currencies: ["USDC", "USDT", "USD"] },
];

const PLAN_PRICES: Record<string, { monthly: number; annual: number; limit: number }> = {
  Free: { monthly: 0, annual: 0, limit: 3 },
  Pro: { monthly: 3000, annual: 30000, limit: -1 },
  Enterprise: { monthly: 0, annual: 0, limit: -1 },
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}
function getLimit(plan: string) {
  return PLAN_PRICES[plan]?.limit ?? 3;
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
  const [resuming, setResuming] = useState(false);

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
      const [inv, txn, gw, sub] = await Promise.all([fetchInvoices(), fetchTransactions(), fetchGateways(), fetchSubscription()]);
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
      await loadData();
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

  const handleResume = async () => {
    setResuming(true);
    try {
      await resumeSubscriptionApi();
      await loadData();
      toast("Subscription resumed");
    } catch (e: any) { toast(e?.message || "Resume failed"); }
    finally { setResuming(false); }
  };

  const handlePayInvoice = (invoice: InvoiceResponse) => {
    setPaymentModal({ open: true, invoice });
  };

  const handlePaymentSuccess = async () => {
    setPaymentModal({ open: false, invoice: null });
    toast("Payment successful!");
    await loadData();
  };

  const subPlan = subscription?.plan || "Free";
  const subBilling = subscription?.billing_cycle || "monthly";
  const subStatus = subscription?.status || "active";
  const subSince = subscription?.since || new Date().toISOString();
  const planInfo = PLAN_PRICES[subPlan];
  const overdue = invoices.some((inv) => inv.status === "open" && inv.due_date && new Date(inv.due_date) < new Date());

  if (loading) {
    return <div className="dpane-h" style={{ padding: "24px", textAlign: "center" }}><p style={{ fontWeight: 600, color: "var(--ink)" }}>Loading billing…</p></div>;
  }

  return (
    <div className="dpane-h" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
      <div className="dpane-h">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)", margin: 0, textAlign: "left", fontFamily: "var(--sans)" }}>Billing</h2>
            <p style={{ color: "var(--ink-2)", fontSize: "12px", margin: "0", fontWeight: 500 }}>Manage your plan, invoices, and payment methods</p>
          </div>
          <button className="btn btn-sm" onClick={loadData} style={{ fontWeight: 600 }}><Icon name="arrow" size={12} /> Refresh</button>
        </div>
      </div>

      {/* Billing status banner — visible step in every dashboard */}
      <BillingStatusBanner plan={subPlan} status={subStatus} activeStep="plan" overdue={overdue} onUpgrade={() => setPaymentModal({ open: true, invoice: null })} />

      {/* Current plan */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Current plan</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--sans)" }}>{subPlan}</h3>
                <span className={`tg blue`} style={{ fontSize: "10px", padding: "3px 8px", fontWeight: 700 }}>{subStatus}</span>
              </div>
              <p style={{ color: "var(--ink-2)", margin: "0 0 12px", fontSize: "12px", fontWeight: 500 }}>{subPlan === "Free" ? "Free tier — 3 placement limit" : subPlan === "Pro" ? `Pro — ${subBilling} billing · $${subBilling === "monthly" ? "30" : "300"}/${subBilling === "monthly" ? "mo" : "yr"}` : "Enterprise — custom pricing"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "12px", color: "var(--ink-2)", fontWeight: 500 }}>
                {subscription?.current_period_start && <span>Period: {new Date(subscription.current_period_start).toLocaleDateString()} – {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "—"}</span>}
                {subscription?.cancel_at_period_end && <span style={{ color: "var(--red)", fontWeight: 700 }}>Cancels at period end</span>}
                {subPlan === "Free" && subscription?.since && <span>Free since {subscription.since}</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "180px", flexShrink: 0 }}>
              {subPlan === "Free" ? (
                <>
                  <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Pro", "monthly")} disabled={upgrading === "Pro"} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{upgrading === "Pro" ? "Activating…" : "Upgrade to Pro — $30/mo"}</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleUpgrade("Pro", "annual")} disabled={upgrading === "Pro"} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{upgrading === "Pro" ? "Upgrading…" : "Upgrade to Pro — $300/yr (save 17%)"}</button>
                </>
              ) : subPlan === "Pro" ? (
                <>
                  {subscription?.cancel_at_period_end ? (
                    <button className="btn btn-sm btn-blue" onClick={handleResume} disabled={resuming} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{resuming ? "Resuming…" : "Resume subscription"}</button>
                  ) : (
                    <button className="btn btn-sm btn-ghost" onClick={handleCancel} disabled={subStatus === "cancelled" || canceling} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{canceling ? "Cancelling…" : "Cancel at period end"}</button>
                  )}
                  <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Enterprise", "monthly")} disabled={upgrading === "Enterprise"} style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>{upgrading === "Enterprise" ? "Upgrading…" : "Upgrade to Enterprise"}</button>
                </>
              ) : (
                <button className="btn btn-sm btn-ghost" disabled style={{ width: "100%", fontWeight: 700, fontSize: "11.5px" }}>Enterprise plan active</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Placement usage */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Placement usage</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
            <div style={{ padding: "16px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center", background: "var(--blue-tint)" }}>
              <div style={{ fontSize: "10px", color: "var(--blue)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800, fontFamily: "var(--mono)" }}>Active placements</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--blue)" }}>{subPlan === "Free" ? 0 : 0}</div>
            </div>
            <div style={{ padding: "16px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center", background: subPlan === "Free" ? "var(--blue-tint)" : "var(--green-tint)" }}>
              <div style={{ fontSize: "10px", color: subPlan === "Free" ? "var(--blue)" : "var(--green)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800, fontFamily: "var(--mono)" }}>Limit</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: subPlan === "Free" ? "var(--blue)" : "var(--green)" }}>{getLimit(subPlan) === -1 ? "Unlimited" : getLimit(subPlan)}</div>
            </div>
            <div style={{ padding: "16px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--blue)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800, fontFamily: "var(--mono)" }}>Remaining</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: getLimit(subPlan) === -1 ? "var(--green)" : "var(--ink)" }}>{getLimit(subPlan) === -1 ? "∞" : Math.max(0, getLimit(subPlan) - (subPlan === "Free" ? 0 : 0))}</div>
            </div>
          </div>
          {subPlan === "Free" && (
            <div style={{ marginTop: "14px", padding: "14px", background: "var(--blue-tint)", border: "1px solid var(--blue)", borderRadius: "var(--r-md)" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", color: "var(--blue)", fontWeight: 700 }}><strong>Free plan limit: 3 placements</strong></p>
              <button className="btn btn-sm btn-blue" onClick={() => handleUpgrade("Pro", "monthly")} style={{ marginTop: "6px", fontWeight: 700, fontSize: "11.5px" }}>Upgrade to Pro for unlimited placements</button>
            </div>
          )}
        </div>
      </div>

      {/* Payment methods */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Payment methods</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.isArray(gateways) && gateways.length > 0 ? gateways.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
                <div style={{ color: "var(--blue)" }}><Icon name="brief" size={12} /></div>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--sans)" }}>{g.name}</div>
                <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{g.currencies.join(", ")}</span>
              </div>
            )) : (<span className="lbl blue" style={{ fontSize: "11px", fontWeight: 700 }}>None connected</span>)}
            <button type="button" className="btn btn-sm btn-blue" onClick={() => setPaymentModal({ open: true, invoice: null })} style={{ width: "fit-content", fontWeight: 700, fontSize: "11.5px" }}><Icon name="plus" size={12} /> Add payment method</button>
          </div>
          <p style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "14px", fontWeight: 500 }}>Payment methods are managed via the payment gateway's portal. Click "Pay now" on an open invoice to add a method.</p>
        </div>
      </div>

      {/* Invoices */}
      <div className="panel" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Invoices</span><span className="lbl blue" style={{ fontSize: "10px", fontWeight: 700 }}>{Array.isArray(invoices) ? invoices.length : 0} total</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {Array.isArray(invoices) && invoices.length > 0 ? (
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
                      <td style={{ padding: "10px 12px" }}><span className={`tg ${inv.status === "paid" ? "green" : inv.status === "open" ? "blue" : "red"}`} style={{ fontWeight: 700, fontSize: "10px" }}>{inv.status}</span></td>
                      <td style={{ padding: "10px 12px" }}>{inv.status === "open" ? (<button className="btn btn-sm btn-blue" onClick={() => handlePayInvoice(inv)} style={{ padding: "5px 12px", fontWeight: 700, fontSize: "11.5px" }}>Pay now</button>) : (<span className="lbl blue" style={{ fontSize: "10px", fontWeight: 700 }}>Paid</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px", color: "var(--blue)", fontWeight: 700 }}>📄</div>
              <p style={{ fontSize: "14px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No invoices yet</p>
              <p style={{ fontSize: "12px", marginTop: "4px", color: "var(--ink-2)", fontWeight: 500 }}>Invoices will appear here after you upgrade to a paid plan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="ph"><span className="lbl blue">Payment history</span></div>
        <div className="pb" style={{ padding: "16px 20px 20px" }}>
          {Array.isArray(transactions) && transactions.length > 0 ? (
            <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--rule)" }}>
              <table className="dtable">
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Amount</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Type</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Gateway</th>
                    <th style={{ padding: "7px 12px", fontFamily: "var(--mono)", fontSize: "8.5px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{formatDate(txn.created_at)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)", fontSize: "12px" }}>{formatCents(txn.amount_cents)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{txn.type}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-2)", fontWeight: 500, fontSize: "12px" }}>{txn.payment_gateway}</td>
                      <td style={{ padding: "10px 12px" }}><span className={`tg ${txn.status === "succeeded" ? "blue" : ""}`} style={{ fontSize: "10px", fontWeight: 700 }}>{txn.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px", color: "var(--blue)", fontWeight: 700 }}>💳</div>
              <p style={{ fontSize: "14px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>No payments recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {paymentModal.open && paymentModal.invoice && (
        <PaymentModal
          isOpen={paymentModal.open}
          onClose={() => setPaymentModal({ open: false, invoice: null })}
          amount={paymentModal.invoice.amount_cents || 0}
          invoiceId={paymentModal.invoice.id}
          description={paymentModal.invoice.description || "Invoice payment"}
          currency="USD"
          initialStep="method"
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentCancel={() => setPaymentModal({ open: false, invoice: null })}
        />
      )}
    </div>
  );
}

export default EmployerBilling;
