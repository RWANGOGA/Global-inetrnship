"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchAdminStudentDocumentFile,
  fetchAllStudentDocuments,
  isApiEnabled,
  toggleDocumentPublic,
  verifyStudentDocument,
} from "../../../lib/api";
import { StudentDocument } from "../../../types";
import styles from "./AdminDocuments.module.css";

type DocumentFilter = "all" | "pending" | "verified" | "rejected";
type PreviewStatus = "idle" | "loading" | "ready" | "error";

export function AdminDocuments() {
  const { authReady, toast, session } = useApp();
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<DocumentFilter>("pending");
  const [actionId, setActionId] = useState("");
  const [togglingPublic, setTogglingPublic] = useState("");
  const [previewDocument, setPreviewDocument] = useState<StudentDocument | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewError, setPreviewError] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const previewRequest = useRef(0);

  const loadDocuments = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const items = await fetchAllStudentDocuments("all");
      setDocuments(items);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load documents.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!isApiEnabled) {
      setError("Connect the admin dashboard to the API to review uploaded documents.");
      setStatus("error");
      return;
    }
    if (session?.role !== "admin") {
      setError("Administrator access is required to review documents.");
      setStatus("error");
      return;
    }
    void loadDocuments();
  }, [authReady, loadDocuments, session]);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const closePreview = useCallback(() => {
    previewRequest.current += 1;
    setPreviewDocument(null);
    setPreviewStatus("idle");
    setPreviewError("");
    setPreviewUrl("");
    setPreviewText("");
    setPreviewType("");
    setRejecting(false);
    setReason("");
  }, []);

  useEffect(() => {
    if (!previewDocument) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closePreview, previewDocument]);

  async function openPreview(doc: StudentDocument) {
    const requestId = previewRequest.current + 1;
    previewRequest.current = requestId;
    setPreviewDocument(doc);
    setPreviewStatus("loading");
    setPreviewError("");
    setPreviewUrl("");
    setPreviewText("");
    setPreviewType("");
    setRejecting(false);
    setReason("");
    try {
      const result = await fetchAdminStudentDocumentFile(doc.id);
      if (requestId !== previewRequest.current) return;
      const contentType = result.contentType.split(";")[0].trim().toLowerCase();
      setPreviewType(contentType);
      if (contentType.startsWith("text/")) {
        setPreviewText(await result.blob.text());
      } else {
        setPreviewUrl(URL.createObjectURL(result.blob));
      }
      setPreviewStatus("ready");
    } catch (cause) {
      if (requestId !== previewRequest.current) return;
      setPreviewError(
        cause instanceof ApiError ? cause.message : "Unable to open this document."
      );
      setPreviewStatus("error");
    }
  }

  async function downloadOriginal(doc: StudentDocument) {
    setDownloading(true);
    try {
      const result = await fetchAdminStudentDocumentFile(doc.id, true);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      toast(cause instanceof ApiError ? cause.message : "Unable to download the document.");
    } finally {
      setDownloading(false);
    }
  }

  async function decide(
    documentId: string,
    decision: "verified" | "rejected",
    rejectionReason = ""
  ) {
    setActionId(documentId);
    setError("");
    try {
      const updated = await verifyStudentDocument(documentId, decision, rejectionReason);
      setDocuments((items) =>
        items.map((doc) => (doc.id === documentId ? updated : doc))
      );
      setPreviewDocument((current) =>
        current?.id === documentId ? updated : current
      );
      setRejecting(false);
      setReason("");
      toast(decision === "verified" ? "Document verified" : "Document rejected");
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : "Unable to update document.";
      setError(message);
      toast(message);
    } finally {
      setActionId("");
    }
  }

  async function togglePublic(documentId: string, currentPublic: boolean) {
    setTogglingPublic(documentId);
    setError("");
    try {
      const updated = await toggleDocumentPublic(documentId, !currentPublic);
      setDocuments((items) =>
        items.map((doc) => (doc.id === documentId ? updated : doc))
      );
      toast(`Document set to ${!currentPublic ? "public" : "private"}`);
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : "Unable to update document.";
      setError(message);
      toast(message);
    } finally {
      setTogglingPublic("");
    }
  }

  const statusCounts = {
    pending: documents.filter((doc) => doc.status === "pending").length,
    verified: documents.filter((doc) => doc.status === "verified").length,
    rejected: documents.filter((doc) => doc.status === "rejected").length,
  };
  const visibleDocuments =
    filter === "all"
      ? documents
      : documents.filter((doc) => doc.status === filter);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusClass = (value: string) =>
    `tg ${value === "verified" ? "green" : value === "rejected" ? "red" : "gold"}`;

  return (
    <div className={styles.page}>
      <div className={`dpane-h ${styles.header}`}>
        <div>
          <h2>Document verification</h2>
          <p>Open each file to review it before verifying or rejecting · {statusCounts.pending} pending</p>
        </div>
        <div className={styles.filters} aria-label="Filter documents">
          {(["pending", "verified", "rejected", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${filter === value ? "btn-blue" : ""}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
              {value !== "all" && <span className={statusClass(value)}>{statusCounts[value]}</span>}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            disabled={status === "loading"}
            onClick={() => void loadDocuments()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && status !== "error" && (
        <div className={styles.errorNotice} role="alert">{error}</div>
      )}

      <section className="panel">
        <div className={`${styles.tableWrap} pb`} style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>File</th>
                <th className="hide-xs">Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Public</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                <tr><td colSpan={8}>Loading documents…</td></tr>
              ) : status === "error" ? (
                <tr><td colSpan={8} className="error">{error}</td></tr>
              ) : visibleDocuments.length === 0 ? (
                <tr><td colSpan={8}>No documents found for this filter.</td></tr>
              ) : (
                visibleDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td className="who">
                      <b>{doc.user_id.slice(0, 8)}…</b>
                      <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                        {doc.user_id}
                      </span>
                    </td>
                    <td>{doc.filename}</td>
                    <td className="hide-xs">{doc.document_type.replaceAll("_", " ")}</td>
                    <td className="num">{formatBytes(doc.size_bytes)}</td>
                    <td className="num">{doc.uploaded_at.slice(0, 10)}</td>
                    <td><span className={statusClass(doc.status)}>{doc.status}</span></td>
                    <td className="num">{doc.is_public ? "Yes" : "No"}</td>
                    <td className="act">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-blue"
                          onClick={() => void openPreview(doc)}
                        >
                          Review
                        </button>
                        {doc.status === "verified" && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={togglingPublic === doc.id}
                            onClick={() => void togglePublic(doc.id, doc.is_public)}
                          >
                            {doc.is_public ? "Make private" : "Make public"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {previewDocument && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-preview-title"
          >
            <header className={styles.dialogHeader}>
              <div style={{ minWidth: 0 }}>
                <h2 className={styles.documentTitle} id="document-preview-title">
                  {previewDocument.filename}
                </h2>
                <p className={styles.documentMeta}>
                  {previewDocument.document_type.replaceAll("_", " ")} · {previewDocument.user_id} · {formatBytes(previewDocument.size_bytes)}
                </p>
              </div>
              <div className={styles.headerActions}>
                <span className={statusClass(previewDocument.status)}>{previewDocument.status}</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={downloading}
                  onClick={() => void downloadOriginal(previewDocument)}
                >
                  {downloading ? "Preparing…" : "Download original"}
                </button>
                <button type="button" className="btn btn-sm" autoFocus onClick={closePreview}>
                  Close
                </button>
              </div>
            </header>

            <div className={styles.previewBody}>
              {previewStatus === "loading" ? (
                <div className={styles.previewMessage}>Loading secure document preview…</div>
              ) : previewStatus === "error" ? (
                <div className={styles.previewMessage} role="alert">
                  <strong>{previewError}</strong>
                  <span>The original can still be downloaded from this review window.</span>
                </div>
              ) : previewType === "application/pdf" && previewUrl ? (
                <iframe
                  className={styles.previewFrame}
                  title={`Preview of ${previewDocument.filename}`}
                  src={previewUrl}
                  sandbox="allow-same-origin"
                />
              ) : previewType.startsWith("image/") && previewUrl ? (
                <img
                  className={styles.previewImage}
                  src={previewUrl}
                  alt={`Preview of ${previewDocument.filename}`}
                />
              ) : previewType.startsWith("text/") ? (
                <pre className={styles.previewText}>{previewText}</pre>
              ) : (
                <div className={styles.previewMessage}>
                  <strong>This file format cannot be previewed in the browser.</strong>
                  <span>Download the original to review it, then return here to record your decision.</span>
                </div>
              )}
            </div>

            {previewDocument.status === "pending" && (
              rejecting ? (
                <div className={styles.rejectionForm}>
                  <label htmlFor="document-rejection-reason" className="lbl">
                    Rejection reason
                  </label>
                  <textarea
                    id="document-rejection-reason"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain what the student must correct."
                    autoFocus
                  />
                  <div className={styles.rejectionActions}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={actionId === previewDocument.id}
                      onClick={() => {
                        setRejecting(false);
                        setReason("");
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-blue"
                      disabled={!reason.trim() || actionId === previewDocument.id}
                      onClick={() => void decide(previewDocument.id, "rejected", reason)}
                    >
                      {actionId === previewDocument.id ? "Sending…" : "Send rejection"}
                    </button>
                  </div>
                </div>
              ) : (
                <footer className={styles.dialogFooter}>
                  <div className={styles.decisionActions}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={actionId === previewDocument.id}
                      onClick={() => setRejecting(true)}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-blue"
                      disabled={actionId === previewDocument.id}
                      onClick={() => void decide(previewDocument.id, "verified")}
                    >
                      {actionId === previewDocument.id ? "Saving…" : "Verify document"}
                    </button>
                  </div>
                </footer>
              )
            )}
          </section>
        </div>
      )}
    </div>
  );
}
