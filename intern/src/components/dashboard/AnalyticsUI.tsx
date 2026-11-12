"use client";

import React from "react";
import { Icon, IconName } from "../icons/Icons";

export interface FunnelStageMetrics {
  stage: string;
  count: number;
  conversion_rate: number;
  avg_days_in_stage: number | null;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: IconName;
  trend?: string;
}

export const MetricCard = ({ title, value, subtitle, icon, trend }: MetricCardProps) => 
  React.createElement("div", { 
    style: { background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "20px" } 
  },
    React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" } },
      React.createElement("div", null,
        React.createElement("p", { style: { fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" } }, title),
        React.createElement("p", { style: { fontSize: "28px", fontWeight: 800, color: "var(--ink)", margin: 0 } }, value),
        subtitle && React.createElement("p", { style: { fontSize: "12px", color: "var(--muted)", marginTop: "4px" } }, subtitle)
      ),
      React.createElement("div", { 
        style: { background: "var(--blue-tint)", color: "var(--blue)", width: "48px", height: "48px", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center" } 
      },
        React.createElement(Icon, { name: icon, size: 22 })
      )
    ),
    trend && React.createElement("p", { style: { fontSize: "12px", color: "var(--green)", marginTop: "12px", fontWeight: 600 } }, trend)
  );

interface FunnelChartProps {
  stages: Array<{ stage: string; count: number; conversion_rate: number; avg_days_in_stage: number | null }>;
}

export const FunnelChart = ({ stages }: FunnelChartProps) => {
  if (!stages.length) return React.createElement("p", { style: { color: "var(--muted)", textAlign: "center", padding: "40px" } }, "No funnel data available");
  
  const maxCount = Math.max(...stages.map(s => s.count));
  
  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" } },
    stages.map((stage, i) => {
      const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
      const prevStage = i > 0 ? stages[i - 1] : null;
      return React.createElement("div", { 
        key: stage.stage, 
        style: { width: "100%", maxWidth: "400px" } 
      },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "6px" } },
          React.createElement("span", { style: { fontWeight: 600, fontSize: "14px", color: "var(--ink)" } }, stage.stage),
          React.createElement("span", { style: { fontSize: "13px", color: "var(--ink-2)" } }, `${stage.count} applications`)
        ),
        React.createElement("div", { style: { height: "28px", background: "var(--rule-2)", borderRadius: "var(--r-pill)", overflow: "hidden", position: "relative" } },
          React.createElement("div", { 
            style: { 
              width: `${(stage.count / maxCount) * 100}%`, 
              height: "100%", 
              background: "linear-gradient(90deg, var(--blue), var(--blue-light))",
              borderRadius: "var(--r-pill)",
              display: "flex",
              alignItems: "center",
              paddingLeft: "12px",
              color: "white",
              fontSize: "11px",
              fontWeight: 600,
              minWidth: stage.count > 0 ? "40px" : 0,
              transition: "width 0.5s ease"
            } },
            stage.count > 0 && stage.count
          ),
          prevStage && React.createElement("div", { 
            style: { 
              position: "absolute", 
              right: `${100 - (stage.count / maxCount) * 100}%`, 
              top: "50%", 
              transform: "translateY(-50%)",
              background: "var(--gold)",
              color: "var(--ink)",
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: "var(--r-sm)",
              whiteSpace: "nowrap"
            } },
            `${stage.conversion_rate}% from ${prevStage.stage}`
          )
        )
      );
    })
  );
};

interface DataTableProps {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  emptyMessage: string;
}

export const DataTable = ({ title, columns, rows, emptyMessage }: DataTableProps) =>
  React.createElement("div", { style: { background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", overflow: "hidden" } },
    React.createElement("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--rule)", fontWeight: 700, fontSize: "15px", color: "var(--ink)" } }, title),
    rows.length === 0 
      ? React.createElement("div", { style: { padding: "40px", textAlign: "center", color: "var(--muted)" } }, emptyMessage)
      : React.createElement("div", { style: { overflowX: "auto" } },
        React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "13px" } },
          React.createElement("thead", null,
            React.createElement("tr", { style: { background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" } },
              columns.map((col, i) => React.createElement("th", { 
                key: i, 
                style: { padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" } 
              }, col))
            )
          ),
          React.createElement("tbody", null,
            rows.map((row, rowIdx) => React.createElement("tr", { 
              key: rowIdx, 
              style: { borderBottom: "1px solid var(--rule-2)" } 
            },
              row.map((cell, cellIdx) => React.createElement("td", { 
                key: cellIdx, 
                style: { padding: "12px 16px", color: "var(--ink)" } 
              }, cell))
            ))
          )
        )
      )
  );