"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchAdminPlacements,
  fetchInternshipReviewQueue,
  isApiEnabled,
  reviewInternship,
  exportPlacementsCsv,
  exportJobsCsv,
  exportPlacementApplicantsCsv,
  exportJobApplicantsCsv,
} from "../../../lib/api";
import { Placement } from "../../../types";

export function AdminPlacements() {
  const { getOrg, toast, session } = useApp();
  const [placements, setPlacements] = React.useState<Placement[]>([]);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = React.useState("");
  const [actionId, setActionId] = React.useState("");
  const [rejecting, setRejecting] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [filters, setFilters] = React.useState({
    reviewStatus: "",
    status: "",
    orgId: "",
    search: "",
  });
  const [showFilters, setShowFilters] = React.useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPlacements = async () => {
    try {
      const blob = await exportPlacementsCsv();
      downloadBlob(blob, "all_placements.csv");
      toast("Placements exported!");
    } catch {
      toast("Failed to export placements");
    }
  };

  const handleExportJobs = async () => {
    try {
      const blob = await exportJobsCsv();
      downloadBlob(blob, "all_jobs.csv");
      toast("Jobs exported!");
    } catch {
      toast("Failed to export jobs");
    }
  };

  React.useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadPlacements();
  }, [session, page, filters]);

  async function loadPlacements() {
    setStatus("loading");
    try {
      const data = await fetchAdminPlacements({
        reviewStatus: filters.reviewStatus || undefined,
        status: filters.status || undefined,
        orgId: filters.orgId || undefined,
        search: filters.search || undefined,
        page,
        pageSize,
      });
      setPlacements(data.items);
      setTotal(data.total);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load placements"
      );
      setStatus("error");
    }
  }

  async function decide(
    internshipId: string,
    decision: "approved" | "rejected",
    rejectionReason = ""
  ) {
    setActionId(internshipId);
    try {
      await reviewInternship(internshipId, decision, rejectionReason);
      setPlacements((items) =>
        items.filter((item) => item.id !== internshipId)
      );
      setTotal((t) => t - 1);
      setRejecting(null);
      setReason("");
      toast(decision === "approved" ? "Placement approved" : "Placement rejected");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update placement"
      );
    } finally {
      setActionId("");
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ reviewStatus: "", status: "", orgId: "", search: "" });
    setPage(1);
  }

  function ReviewStatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
      approved: "green",
      pending_review: "amber",
      rejected: "red",
    };
    return (
      <span
        className="tg"
        style={{
          background: `var(--${colors[status] || "ink"}-1)`,
          color: `var(--${colors[status] || "ink"})`,
        }}
      >
        {status.replace("_", " ")}
      </span>
    );
  }

  function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
      Open: "green",
      Closing: "amber",
      Closed: "red",
    };
    return (
      <span
        className="tg"
        style={{
          background: `var(--${colors[status] || "ink"}-1)`,
          color: `var(--${colors[status] || "ink"})`,
        }}
      >
        {status}
      </span>
    );
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>All Placements</h2>
          <p>
            {total} placement{total === 1 ? "" : "s"} in the system
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportPlacements}
          >
            Export Placements CSV
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportJobs}
          >
            Export Jobs CSV
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showFilters ? "btn-blue" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <div className="pb" style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div>
              <label className="lbl">Review Status</label>
              <select
                className="field"
                value={filters.reviewStatus}
                onChange={(e) => handleFilterChange("reviewStatus", e.target.value)}
              >
                <option value="">All</option>
                <option value="approved">Approved</option>
                <option value="pending_review">Pending Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="lbl">Status</label>
              <select
                className="field"
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Closing">Closing</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="lbl">Search</label>
              <input
                type="text"
                className="field"
                placeholder="Search by title..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={clearFilters}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>Placement</th>
                  <th>Organisation</th>
                  <th>Type</th>
                  <th className="hide-xs">Courses</th>
                  <th>Grade</th>
                  <th className="hide-xs">Docs</th>
                  <th>Review</th>
                  <th>Status</th>
                  <th>Closes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {status === "loading" ? (
                  <tr><td colSpan={10}>Loading placements...</td></tr>
                ) : status === "error" ? (
                  <tr><td colSpan={10} className="error">{error}</td></tr>
                ) : placements.length === 0 ? (
                  <tr><td colSpan={10}>No placements found.</td></tr>
                ) : placements.map((p) => {
                  const o = getOrg(p.orgId);
                  return (
                    <tr key={p.id}>
                      <td className="who">
                        <b>{p.title}</b>
                        <span>
                          {p.slots} slots · {p.duration}
                        </span>
                      </td>
                      <td>{o?.name}</td>
                      <td>
                        <span
                          className={`tg ${
                            o?.type === "Government"
                              ? "blue"
                              : o?.type === "NGO"
                              ? "green"
                              : o?.type === "University"
                              ? "gold"
                              : ""
                          }`}
                        >
                          {o?.type}
                        </span>
                      </td>
                      <td
                        className="hide-xs"
                        style={{ fontSize: "11px", color: "var(--ink-2)" }}
                      >
                        {p.courses.length} courses
                      </td>
                      <td className="num">{p.grade}</td>
                      <td className="hide-xs">
                        <span className="num">{p.docs.length} required</span>
                      </td>
                      <td>
                        <ReviewStatusBadge status={p.reviewStatus} />
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="num">{p.deadline}</td>
                      <td className="act">
                        {p.reviewStatus === "pending_review" && (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-blue"
                              disabled={actionId === p.id}
                              onClick={() => decide(p.id, "approved")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={actionId === p.id}
                              onClick={() => setRejecting(p.id)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div
              className="dpane-h"
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div>
                Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rejecting && (
        <div className="panel" style={{ marginTop: "14px" }}>
          <div className="ph"><span className="lbl">Rejection reason</span></div>
          <div className="pb" style={{ display: "grid", gap: "10px" }}>
            <textarea
              className="field"
              rows={3}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what the organisation must correct."
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
              <button type="button" className="btn btn-sm" onClick={() => setRejecting(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}