"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { ApiError, fetchAllStudentDocuments, verifyStudentDocument, isApiEnabled, toggleDocumentPublic } from "../../../lib/api";
import { StudentDocument } from "../../../types";

export function AdminDocuments() {
  const { toast, session } = useApp();
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("pending");
  const [actionId, setActionId] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [togglingPublic, setTogglingPublic] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadDocuments();
  }, [session, filter]);

  async function loadDocuments() {
    setStatus("loading");
    try {
      const items = await fetchAllStudentDocuments(filter === "all" ? undefined : filter);
      setDocuments(items);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load documents"
      );
      setStatus("error");
    }
  }

  async function decide(
    documentId: string,
    decision: "verified" | "rejected",
    rejectionReason = ""
  ) {
    setActionId(documentId);
    try {
      await verifyStudentDocument(documentId, decision, rejectionReason);
      setDocuments((items) =>
        items.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: decision, rejection_reason: rejectionReason }
            : doc
        )
      );
      setRejecting(null);
      setReason("");
      toast(decision === "verified" ? "Document verified" : "Document rejected");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update document"
      );
    } finally {
      setActionId("");
    }
  }

  async function togglePublic(documentId: string, currentPublic: boolean) {
    setTogglingPublic(documentId);
    try {
      await toggleDocumentPublic(documentId, !currentPublic);
      setDocuments((items) =>
        items.map((doc) =>
          doc.id === documentId ? { ...doc, is_public: !currentPublic } : doc
        )
      );
      toast(`Document set to ${!currentPublic ? "public" : "private"}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update document"
      );
    } finally {
      setTogglingPublic("");
    }
  }

  const statusCounts = {
    pending: documents.filter((d) => d.status === "pending").length,
    verified: documents.filter((d) => d.status === "verified").length,
    rejected: documents.filter((d) => d.status === "rejected").length,
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Document verification</h2>
          <p>
            Review and verify student documents — {statusCounts.pending} pending
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["pending", "verified", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn btn-sm ${filter === f ? "btn-blue" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && <span className="tg gold">{statusCounts[f as keyof typeof statusCounts]}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Student</th>
                <th>Document</th>
                <th className="hide-xs">Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Public</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                <tr>
                  <td colSpan={7}>Loading documents...</td>
                </tr>
              ) : status === "error" ? (
                <tr>
                  <td colSpan={7} className="error">
                    {error}
                  </td>
                </tr>
              ) : !documents || documents.length === 0 ? (
                <tr>
                  <td colSpan={8}>No documents found for this filter.</td>
                </tr>
              ) : (
                (documents || []).map((doc) => (
                  <tr key={doc.id}>
                    <td className="who">
                      <b>{doc.user_id.slice(0, 8)}…</b>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {doc.document_type}
                      </span>
                    </td>
                    <td>{doc.filename}</td>
                    <td className="hide-xs">
                      <span className="tg gold">{doc.document_type}</span>
                    </td>
                    <td className="num">{formatBytes(doc.size_bytes)}</td>
                    <td className="num">{doc.uploaded_at.slice(0, 10)}</td>
                    <td>
                      <span
                        className={`tg ${
                          doc.status === "verified"
                            ? "green"
                            : doc.status === "rejected"
                            ? "red"
                            : "gold"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="num">
                      <span
                        className={`tg ${
                          doc.is_public ? "green" : "muted"
                        }`}
                      >
                        {doc.is_public ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="act">
                      {doc.status === "pending" && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-blue"
                            disabled={actionId === doc.id}
                            onClick={() => decide(doc.id, "verified")}
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={actionId === doc.id}
                            onClick={() => setRejecting(doc.id)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {doc.status === "verified" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={togglingPublic === doc.id}
                          onClick={() => togglePublic(doc.id, doc.is_public)}
                        >
                          {doc.is_public ? "Make Private" : "Make Public"}
                        </button>
                      )}
                      {doc.status !== "pending" && (
                        <span className="muted" style={{ fontSize: "11px" }}>
                          {doc.status === "rejected" && doc.rejection_reason && (
                          <span title={doc.rejection_reason}>
                            Rejected: {doc.rejection_reason.slice(0, 30)}…
                          </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {rejecting && (
        <div className="panel" style={{ marginTop: "14px" }}>
          <div className="ph">
            <span className="lbl">Rejection reason</span>
          </div>
          <div className="pb" style={{ display: "grid", gap: "10px" }}>
            <textarea
              className="field"
              rows={3}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what the student must correct."
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-sm btn-blue"
                disabled={!reason.trim() || actionId === rejecting}
                onClick={() => decide(rejecting, "rejected", reason)}
              >
                Send rejection
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setRejecting(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}