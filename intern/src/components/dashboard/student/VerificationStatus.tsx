"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import styles from "./VerificationStatus.module.css";

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
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending review";
    case "rejected":
      return "Changes needed";
    case "uploaded":
      return "Uploaded";
    default:
      return "Not uploaded";
  }
}

export function VerificationStatus() {
  const {
    docs,
    documentsStatus,
    dashGo,
    refreshStudentDocuments,
    resume,
    toast,
  } = useApp();

  const rows = [
    {
      key: "resume",
      label: "Resume / CV",
      icon: "CV",
      status: resume ? "uploaded" : "missing",
      file: resume?.filename || "",
      detail: resume
        ? `Uploaded ${new Date(resume.uploaded_at).toLocaleDateString()} · ready for applications`
        : "Upload a CV to include it with applications.",
      rejectionReason: "",
    },
    ...REQUIRED_DOCUMENTS.map(({ type, label, icon }) => {
      const doc = docs.find((item) => item.name === type);
      return {
        key: type,
        label,
        icon,
        status: doc?.status || "missing",
        file: doc?.file || "",
        detail: doc
          ? doc.status === "verified"
            ? `Verified${doc.uploadedAt ? ` · uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}` : ""}`
            : doc.status === "pending"
              ? "Waiting for placement office review."
              : "Replace the file to request another review."
          : "Upload this document to complete your application profile.",
        rejectionReason: doc?.rejectionReason || "",
      };
    }),
  ];

  const documentRows = rows.filter((row) => row.key !== "resume");
  const verified = documentRows.filter((row) => row.status === "verified").length;
  const pending = documentRows.filter((row) => row.status === "pending").length;
  const attention = documentRows.filter(
    (row) => row.status === "rejected" || row.status === "missing"
  ).length;
  const progress = Math.round((verified / documentRows.length) * 100);

  const refresh = async () => {
    try {
      await refreshStudentDocuments();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not reload your documents.");
    }
  };

  return (
    <div className={styles.page}>
      <div className={`dpane-h ${styles.header}`}>
        <div>
          <h2>Verification status</h2>
          <p>Track document reviews and see what needs your attention.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.progress}>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Required documents verified"
              aria-valuemin={0}
              aria-valuemax={documentRows.length}
              aria-valuenow={verified}
            >
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.progressLabel}>
              {verified}/{documentRows.length} verified
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            disabled={documentsStatus === "loading"}
            onClick={() => void refresh()}
          >
            <Icon name="arrow" size={13} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={() => dashGo("documents")}
          >
            <Icon name="upload" size={13} /> Manage documents
          </button>
        </div>
      </div>

      {documentsStatus === "loading" || documentsStatus === "idle" ? (
        <div className="panel">
          <div className="pb" style={{ fontSize: "11px", color: "var(--muted)" }}>
            Loading your document statuses…
          </div>
        </div>
      ) : documentsStatus === "error" ? (
        <div className="panel" role="alert">
          <div className="pb" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "var(--red)" }}>
              Could not load verification results. Your documents have not been changed.
            </span>
            <button type="button" className="btn btn-sm" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={`${styles.stat} ${styles.verified}`}>
              <span className={styles.statValue}>{verified}</span>
              <span className={styles.statLabel}>Verified</span>
            </div>
            <div className={`${styles.stat} ${styles.pending}`}>
              <span className={styles.statValue}>{pending}</span>
              <span className={styles.statLabel}>Pending review</span>
            </div>
            <div className={`${styles.stat} ${styles.attention}`}>
              <span className={styles.statValue}>{attention}</span>
              <span className={styles.statLabel}>Needs attention</span>
            </div>
          </div>

          <section className="panel">
            <div className="ph">
              <div>
                <span className="lbl blue">Document checklist</span>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "10.5px" }}>
                  Employers receive only verified supporting documents.
                </p>
              </div>
            </div>
            <div className="pb">
              <div className={styles.list}>
                {rows.map((row) => (
                  <div className={styles.row} key={row.key}>
                    <span className={styles.icon} aria-hidden="true">{row.icon}</span>
                    <div className={styles.rowDetails}>
                      <div className={styles.rowHeading}>
                        <h3>{row.label}</h3>
                        <span className={statusClass(row.status)}>{statusLabel(row.status)}</span>
                      </div>
                      <p className={styles.detail}>{row.file || row.detail}</p>
                      {row.status === "rejected" && row.rejectionReason && (
                        <p className={styles.reason}>Review note: {row.rejectionReason}</p>
                      )}
                    </div>
                    {row.status === "missing" || row.status === "rejected" ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-blue"
                        onClick={() => dashGo("documents")}
                      >
                        {row.status === "rejected" ? "Replace file" : "Upload"}
                      </button>
                    ) : (
                      <span className={styles.progressLabel}>
                        {row.status === "verified" ? "Cleared" : row.status === "pending" ? "In review" : "Ready"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className={styles.note}>
                Rejected documents include the reviewer’s note above. Replace the file from Documents to send it for review again.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
