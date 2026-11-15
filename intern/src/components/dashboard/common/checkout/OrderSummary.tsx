"use client";

import React from "react";
import { Icon } from "../../../icons/Icons";

interface OrderSummaryProps {
  preview: {
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
    line_items: Array<{ description: string; amount_cents: number }>;
  } | null;
  plan: string;
  cycle: string;
  paymentMethod: string | null;
  placing: boolean;
  onPlaceOrder: () => void;
  canPlace: boolean;
}

export function OrderSummary({
  preview,
  plan,
  cycle,
  paymentMethod,
  placing,
  onPlaceOrder,
  canPlace,
}: OrderSummaryProps) {
  const subtotal = preview?.subtotal_cents ?? 0;
  const tax = preview?.tax_cents ?? 0;
  const total = preview?.total_cents ?? 0;

  return (
    <aside
      className="panel"
      style={{
        position: "sticky",
        top: 22,
        alignSelf: "start",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div className="ph">
        <span className="lbl ink">Order summary</span>
      </div>
      <div className="pb" style={{ padding: 14, display: "grid", gap: 6 }}>
        <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>
          <span style={{ fontWeight: 600 }}>{plan}</span> <span style={{ color: "var(--muted)" }}>· {cycle}</span>
        </div>
        {preview?.line_items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "var(--ink-2)",
            }}
          >
            <span>{item.description}</span>
            <span>${(item.amount_cents / 100).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: "12px", color: "var(--ink-2)" }}>
          <div><span className="lbl">Subtotal</span>${(subtotal / 100).toFixed(2)}</div>
          <div><span className="lbl">Tax</span>${(tax / 100).toFixed(2)}</div>
          <div style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: "16px", color: "var(--ink)", borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
            Total &nbsp;<span>${(total / 100).toFixed(2)}</span>
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 4 }}>
          {paymentMethod ? `Charged to ${paymentMethod}` : "No payment method selected"}
        </div>
        <button
          className="btn btn-blue btn-block"
          onClick={onPlaceOrder}
          disabled={!canPlace || placing}
          style={{
            marginTop: 12,
            height: 46,
            opacity: canPlace && !placing ? 1 : 0.5,
          }}
        >
          {placing ? <Icon name="spinner" size={16} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} /> : null}
          Place your order
        </button>
        <div style={{ marginTop: 8, fontSize: "10.5px", color: "var(--muted)", lineHeight: 1.4 }}>
          By placing your order you agree to the subscription terms. You may cancel at any
          time from the billing page; cancellation takes effect at the end of the period.
        </div>
      </div>
    </aside>
  );
}
