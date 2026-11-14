"use client";

import React from "react";
import { Icon } from "../../icons/Icons";

type BillingStep =
  | "plan"
  | "payment-method"
  | "review"
  | "confirm"
  | "receipt";

interface BillingStepperProps {
  activeStep: BillingStep;
  size?: "sm" | "md";
}

const STEP_LABELS: Record<BillingStep, string> = {
  plan: "Select plan",
  "payment-method": "Add payment method",
  review: "Review order",
  confirm: "Confirm payment",
  receipt: "Receipt",
};

const STEP_NUMBERS: Record<BillingStep, number> = {
  plan: 1,
  "payment-method": 2,
  review: 3,
  confirm: 4,
  receipt: 5,
};

const STEP_ORDER: BillingStep[] = [
  "plan",
  "payment-method",
  "review",
  "confirm",
  "receipt",
];

export function BillingStepper({
  activeStep,
  size = "md",
}: BillingStepperProps) {
  const isCompact = size === "sm";
  const radius = isCompact ? "var(--r-sm)" : "var(--r-md)";
  const dotSize = isCompact ? 24 : 32;
  const labelSize = isCompact ? "10px" : "11px";
  const numberSize = isCompact ? "10px" : "11px";

  const stepIndex = STEP_ORDER.indexOf(activeStep);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "0 4px",
        overflowX: "auto",
        paddingBottom: "6px",
      }}
    >
      {STEP_ORDER.map((step, idx) => {
        const isActive = idx === stepIndex;
        const isCompleted = idx < stepIndex;
        const isLast = idx === STEP_ORDER.length - 1;
        const num = STEP_NUMBERS[step];
        const label = STEP_LABELS[step];

        return (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            {/* Connector line from previous step */}
            {idx > 0 && (
              <div
                style={{
                  width: "100%",
                  height: "1px",
                  background: isCompleted ? "var(--green)" : "var(--rule-2)",
                  marginLeft: "-4px",
                  marginRight: "-4px",
                }}
              />
            )}

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                border: `1.5px solid ${
                  isCompleted
                    ? "var(--green)"
                    : isActive
                      ? "var(--blue)"
                      : "var(--rule-2)"
                }`,
                background: isCompleted
                  ? "var(--green-tint)"
                  : isActive
                    ? "var(--blue-tint)"
                    : "var(--paper)",
                color: isCompleted
                  ? "var(--green)"
                  : isActive
                    ? "var(--blue)"
                    : "var(--ink-2)",
                fontFamily: "var(--mono)",
                fontSize: numberSize,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                zIndex: 2,
              }}
            >
              {num}
              {isCompleted && (
                <div
                  style={{
                    position: "absolute",
                    color: "var(--green)",
                  }}
                >
                  <Icon name="check" size={isCompact ? 10 : 12} />
                </div>
              )}
            </div>

            {/* Step label */}
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: labelSize,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: isCompleted
                  ? "var(--green)"
                  : isActive
                    ? "var(--blue)"
                    : "var(--muted)",
                whiteSpace: "nowrap",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default BillingStepper;
