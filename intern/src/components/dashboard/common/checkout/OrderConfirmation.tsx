"use client";

import React from "react";
import { Icon } from "../../../icons/Icons";
import type { SubscriptionDto } from "../../../../lib/api";

interface OrderConfirmationProps {
  subscription: SubscriptionDto | null;
  invoice: { invoice_number: string } | null;
  transaction: { id: string; amount_cents: number } | null;
  onBackToBilling: () => void;
}

export function OrderConfirmation({
  subscription,
  invoice,
  transaction,
  onBackToBilling,
}: OrderConfirmationProps) {
  return (
    <section className="dpane" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="dpane-h">
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: 400, margin: 0, letterSpacing: "-0.02em", fontFamily: "var(--serif)" }}>
            Order placed
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "3px" }}>
            Your subscription is active and your receipt is ready.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="ph">
          <span className="lbl ink">Order confirmation</span>
          <span style={{ fontSize: "12px", color: "var(--ink-2)" }}>
            {invoice?.invoice_number || "—"}
          </span>
        </div>
        <div className="pb" style={{ display: "grid", gap: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--green)" }}>
            <Icon name="check" size={16} />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>
              Subscription active &mdash; {subscription?.plan || "—"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: "12.5px", color: "var(--ink-2)" }}>
            <div><span className="lbl">Plan</span>{subscription?.plan}</div>
            <div><span className="lbl">Cycle</span>{subscription?.billing_cycle}</div>
            <div><span className="lbl">Amount</span>${((transaction?.amount_cents || 0) / 100).toFixed(2)}</div>
            <div><span className="lbl">Status</span>{subscription?.status}</div>
            <div><span className="lbl">Invoice</span>{invoice?.invoice_number}</div>
            <div><span className="lbl">Transaction</span>{transaction?.id}</div>
            {subscription?.current_period_end && (
              <div><span className="lbl">Renews on</span>{new Date(subscription.current_period_end).toLocaleDateString()}</div>
            )}
          </div>
          <div style={{ borderTop: "1px solid var(--rule)", marginTop: 10, paddingTop: 10, fontSize: "12px", color: "var(--muted)" }}>
            Save this receipt for your records. A copy has been emailed to the billing address on file.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <button
          className="btn btn-blue btn-block"
          onClick={onBackToBilling}
          style={{ height: 46 }}
        >
          <Icon name="chevron-left" size={14} style={{ marginRight: 6 }} /> Go to billing
        </button>
      </div>
    </section>
  );
}
