"use client";

import React from "react";
import { Icon } from "../../icons/Icons";
import { BillingStepper } from "./BillingStepper";

interface BillingStatusBannerProps {
  plan: string;
  status: string;
  activeStep?: "plan" | "payment-method" | "review" | "confirm" | "receipt";
  overdue?: boolean;
  onUpgrade?: () => void;
}

export function BillingStatusBanner({
  plan,
  status,
  activeStep = "plan",
  overdue = false,
  onUpgrade,
}: BillingStatusBannerProps) {
  const isPaid = status === "paid" || status === "active";
  const needsAction = overdue || status === "open" || status === "past_due";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "16px",
        alignItems: "center",
        padding: "16px 20px",
        border: `1px solid ${needsAction ? "var(--red)" : "var(--rule)"}`,
        borderRadius: "var(--r-lg)",
        background: needsAction ? "var(--red-tint)" : "var(--paper-2)",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: isPaid ? "var(--green-tint)" : "var(--blue-tint)",
            color: isPaid ? "var(--green)" : "var(--blue)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={isPaid ? "check" : "brief"} size={16} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "var(--serif)",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            {plan} plan
            {needsAction && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--red)",
                  color: "#fff",
                  fontFamily: "var(--mono)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {overdue ? "Past due" : "Action needed"}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {status === "active" || status === "paid"
              ? "Subscription active"
              : status === "open"
                ? "Invoice awaiting payment"
                : status === "cancelled"
                  ? "Subscription cancelled"
                  : status}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <BillingStepper activeStep={activeStep} size="sm" />
        {needsAction && onUpgrade && (
          <button
            type="button"
            className="btn btn-blue btn-sm"
            onClick={onUpgrade}
            style={{
              fontSize: "11.5px",
              padding: "6px 14px",
              height: "auto",
              minWidth: 0,
            }}
          >
            Resolve now
          </button>
        )}
      </div>
    </div>
  );
}

export default BillingStatusBanner;
