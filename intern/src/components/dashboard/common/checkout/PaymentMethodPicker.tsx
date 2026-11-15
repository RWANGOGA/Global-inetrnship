"use client";

import React, { useCallback } from "react";
import { Icon } from "../../../icons/Icons";
import type { PaymentMethodResponse } from "../../../../lib/api";

interface PaymentMethodPickerProps {
  methods: PaymentMethodResponse[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
  adding: boolean;
}

export function PaymentMethodPicker({
  methods,
  selectedId,
  onSelect,
  onAdd,
  adding,
}: PaymentMethodPickerProps) {
  const handleAdd = useCallback(() => {
    onSelect(null);
    onAdd();
  }, [onSelect, onAdd]);

  return (
    <section className="panel" style={{ marginTop: 10 }}>
      <div className="ph">
        <span className="lbl ink">Payment method</span>
        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
          Choose how you&rsquo;d like to pay
        </span>
      </div>
      <div className="pb" style={{ padding: 14, display: "grid", gap: 8 }}>
        {methods.length === 0 ? (
          <div style={{ padding: 10, color: "var(--muted)" }}>
            No saved payment methods. Add one below.
          </div>
        ) : (
          methods.map((m) => {
            const selected = m.id === selectedId;
            const last4 = m.details?.last4 ? `· · · ${m.details.last4}` : "";
            const brand = String(m.details?.brand || m.type).toUpperCase();
            return (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${selected ? "var(--blue)" : "var(--rule-2)"}`,
                  background: selected ? "var(--blue-tint)" : "#fff",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  color: "var(--ink)",
                }}
                onClick={() => onSelect(m.id)}
              >
                <input
                  type="radio"
                  name="payment-method"
                  checked={selected}
                  readOnly
                  style={{ marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: "13px" }}>
                    {brand}{last4}
                    {m.is_default && <span style={{ fontSize: "9.5px", color: "var(--muted)", marginLeft: 6 }}>Default</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--ink-2)" }}>{m.type}</div>
                </div>
                <Icon
                  name={selected ? "check" : "chevron-right"}
                  size={14}
                  style={{ color: selected ? "var(--blue)" : "var(--muted)" }}
                />
              </label>
            );
          })
        )}
        <button
          className="btn btn-ghost"
          onClick={handleAdd}
          disabled={adding}
          style={{
            justifyContent: "flex-start",
            padding: "10px 12px",
            textAlign: "left",
            fontSize: "12.5px",
            color: adding ? "var(--muted)" : "var(--ink)",
          }}
        >
          <Icon name="plus" size={14} style={{ marginRight: 6 }} /> Add a new card
        </button>
      </div>
    </section>
  );
}
