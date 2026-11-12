"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

const REQUIRED_DOCUMENTS = [
  { type: "transcript", label: "Transcript", icon: "TR" },
  { type: "student_id", label: "Student ID", icon: "ID" },
  { type: "national_id", label: "National ID", icon: "NI" },
  { type: "recommendation", label: "Recommendation letter", icon: "RL" },
  { type: "portfolio", label: "Portfolio", icon: "PF" },
  { type: "testimonial", label: "Testimonial", icon: "TS" },
];

function statusClass(status: string): string {
  switch (status) {
    case "verified":
      return "tg green";
    case "pending":
      return "tg gold";
    case "rejected":
      return "tg red";
    case "uploaded":
      return "tg blue";
    default:
      return "tg dark";
  }
}

function statusLabel(status: string): string {
  if (!status || status === "missing") return "Not uploaded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "gold" | "red";
}) {
  const color =
    tone === "green"
      ? "var(--green)"
      : tone === "gold"
      ? "var(--gold)"
      : "var(--red)";
  const background =
    tone === "green"
      ? "var(--green-tint)"
      : tone === "gold"
      ? "var(--gold-tint)"
      : "var(--red-tint)";
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        background,
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: "26px",
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-2)" }}>
        {label}
      </div>
    </div>
  );
}

export function VerificationStatus() {
  const { docs, resume, dashGo, dashboardDataStatus } = useApp();

  const rows = [
    {
      key: "resume",
      label: "Resume / CV",
      icon: "CV",
      status: resume ? "uploaded" : "missing",
      file: resume?.filename || "",
      size: resume ? `${Math.ceil(resume.size_bytes / 1024)} KB` : "",
      detail: resume
        ? `Uploaded ${new Date(resume.uploaded_at).toLocaleDateString()}`
        : "Upload a CV before applying",
      reason: "",
    },
    ...REQUIRED_DOCUMENTS.map(({ type, label, icon }) => {
      const doc = docs.find((d) => d.name === type);
      return {
        key: type,
        label,
        icon,
        status: doc?.status || "missing",
        file: doc?.file || "",
        size: doc?.size || "",
        detail: doc
          ? "Reviewed by the placement office"
          : "Required for a complete application",
        reason: "",
      };
    }),
  ];
  const documentRows = rows.filter((r) => r.key !== "resume");

  // Rejected reasons live on the uploaded document in the API; DocItem keeps
  // the display-safe shape, so surface the status here and send the student to
  // Documents for the full reason and replacement flow.
  const verified = documentRows.filter((r) => r.status === "verified").length;
  const pending = documentRows.filter((r) => r.status === "pending").length;
  const attention = documentRows.filter(
    (r) => r.status === "rejected" || r.status === "missing"
  ).length;
  const progress =
    documentRows.length > 0
      ? Math.round((verified / documentRows.length) * 100)
      : 0;

  const loading = dashboardDataStatus === "loading";
  const error = dashboardDataStatus === "error";

  return (
    <>
      <div
        className="dpane-h"
        style={{
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
          marginBottom: "8px",
          paddingBottom: "20px",
          borderBottom: "2px solid var(--rule)",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "32px",
              marginBottom: "8px",
              color: "var(--ink)",
              letterSpacing: "-0.5px",
            }}
          >
            Verification status
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", fontWeight: 500 }}>
            What the placement office has checked and what is still outstanding
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "180px",
              height: "8px",
              background: "var(--rule-2)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--green), var(--blue))",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--ink)",
              whiteSpace: "nowrap",
            }}
          >
            {verified} / {documentRows.length} verified
          </span>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          <div className="pb" style={{ display: "grid", gap: "10px" }}>
            <b style={{ fontSize: "14px" }}>Checking your documents…</b>
            <p style={{ fontSize: "12.5px", color: "var(--muted)" }}>
              Reading verification results from the placement office.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="panel" style={{ borderColor: "var(--red)" }}>
          <div className="pb">
            <b style={{ fontSize: "14px", color: "var(--red)" }}>
              Could not load verification status
            </b>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--ink-2)",
                marginTop: "6px",
                lineHeight: 1.6,
              }}
            >
              The server did not return your documents. Refresh the page to try
              again.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <Stat label="Verified" value={verified} tone="green" />
            <Stat label="Pending review" value={pending} tone="gold" />
            <Stat label="Needs attention" value={attention} tone="red" />
          </div>

          <div
            className="panel"
            style={{
              background: "var(--white)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-xl)",
              overflow: "hidden",
              boxShadow: "0 1px 3px var(--shadow-1)",
              marginBottom: "20px",
            }}
          >
            <div
              className="ph"
              style={{
                background: "var(--paper-2)",
                padding: "20px 28px",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "var(--r-md)",
                      background: "var(--blue-tint)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--blue)",
                    }}
                  >
                    <Icon name="doc" size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: "22px", margin: 0 }}>
                      Checklist
                    </h2>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--ink-2)",
                        marginTop: "2px",
                      }}
                    >
                      Employers only see verified files
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-blue"
                  style={{ height: "40px", padding: "0 16px" }}
                  onClick={() => dashGo("documents")}
                >
                  <Icon name="upload" size={14} /> Manage documents
                </button>
              </div>
            </div>

            <div className="pb" style={{ padding: "28px" }}>
              <div style={{ display: "grid", gap: "12px" }}>
                {rows.map((row) => (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr) auto",
                      gap: "16px",
                      alignItems: "center",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--r-lg)",
                      padding: "16px 18px",
                      background: "var(--white)",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "var(--r-md)",
                        background:
                          row.status === "verified"
                            ? "var(--green-tint)"
                            : row.status === "rejected"
                            ? "var(--red-tint)"
                            : "var(--blue-tint)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color:
                          row.status === "verified"
                            ? "var(--green)"
                            : row.status === "rejected"
                            ? "var(--red)"
                            : "var(--blue)",
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      {row.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                          marginBottom: "4px",
                        }}
                      >
                        <h4
                          style={{
                            fontWeight: 700,
                            fontSize: "15px",
                            color: "var(--ink)",
                            margin: 0,
                          }}
                        >
                          {row.label}
                        </h4>
                        <span className={statusClass(row.status)}>
                          {statusLabel(row.status)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "12.5px",
                          color: "var(--muted)",
                          margin: 0,
                        }}
                      >
                        {row.file
                          ? `${row.file}${row.size ? ` · ${row.size}` : ""}`
                          : row.detail}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color:
                          row.status === "verified"
                            ? "var(--green)"
                            : row.status === "rejected"
                            ? "var(--red)"
                            : "var(--muted)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.status === "verified"
                        ? "Cleared"
                        : row.status === "pending"
                        ? "In review"
                        : row.status === "rejected"
                        ? "Replace file"
                        : row.status === "uploaded"
                        ? "Uploaded"
                        : "Upload"}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "24px",
                  padding: "16px",
                  background: "var(--paper-2)",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--rule)",
                }}
              >
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  <strong style={{ color: "var(--ink)" }}>How it works:</strong>{" "}
                  the placement office checks transcripts and IDs against the
                  university record. Most reviews finish within 48 hours. A
                  rejected file keeps its reason so you can replace it without
                  starting over.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
