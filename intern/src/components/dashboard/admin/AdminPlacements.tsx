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
import { Icon } from "../../icons/Icons";
import { DataState } from "../../../components/common/DataState";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Open: "green",
    Closing: "amber",
    Closed: "red",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    amber: "tg gold",
    red: "tg red",
  };
  return <span className={classMap[color] || "tg"}>{status}</span>;
}

function ReviewStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: "green",
    pending_review: "amber",
    rejected: "red",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    amber: "tg gold",
    red: "tg red",
  };
  return <span className={classMap[color] || "tg"}>{status.replace("_", " ")}</span>;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminPlacements() {
  const { getOrg, toast, session } = useApp();
  const [placements, setPlacements] = React.useState<Placement[]>([]);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
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

  const handleExportPlacementApplicants = async (id: string) => {
    try {
      const blob = await exportPlacementApplicantsCsv(id);
      downloadBlob(blob, `placement_${id}_applicants.csv`);
      toast("Applicants exported!");
    } catch {
      toast("Failed to export applicants");
    }
  };

  const handleExportJobApplicants = async (id: string) => {
    try {
      const blob = await exportJobApplicantsCsv(id);
      downloadBlob(blob, `job_${id}_applicants.csv`);
      toast("Applicants exported!");
    } catch {
      toast("Failed to export applicants");
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
        cause instanceof ApiError ? cause.message : "Unable to load placements"
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
      setPlacements((items) => items.filter((item) => item.id !== internshipId));
      setTotal((t) => t - 1);
      setRejecting(null);
      setReason("");
      toast(decision === "approved" ? "Placement approved" : "Placement rejected");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to update placement");
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

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>All Placements</h2>
          <p>
            {total} placement{total === 1 ? "" : "s"} in the system
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-sm" onClick={handleExportPlacements}>
            <Icon name="download" size={13} /> Export Placements
          </button>
          <button type="button" className="btn btn-sm" onClick={handleExportJobs}>
            <Icon name="download" size={13} /> Export Jobs
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showFilters ? "btn-blue" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icon name="filter" size={13} /> Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <div className="pb" style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", padding: "16px" }}>
            <div className="field">
              <label className="lbl">Review Status</label>
              <select
                className="field-input"
                value={filters.reviewStatus}
                onChange={(e) => handleFilterChange("reviewStatus", e.target.value)}
              >
                <option value="">All</option>
                <option value="approved">Approved</option>
                <option value="pending_review">Pending Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Status</label>
              <select
                className="field-input"
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Closing">Closing</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Search</label>
              <input
                type="text"
                className="field-input"
                placeholder="Search by title..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}>
                <Icon name="x" size={13} /> Clear
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
                <DataState
                  state={status}
                  error={error}
                  items={placements}
                  colSpan={10}
                  emptyMessage="No placements found"
                  emptyIcon="brief"
                  loadingMessage="Loading placements..."
                  errorMessage="Unable to load placements"
                  children={(p: Placement) => {
                    const o = getOrg(p.orgId);
                    return (
                      <tr key={p.id}>
                        <td className="who">
                          <b>{p.title}</b>
                          <span>{p.slots} slots · {p.duration}</span>
                        </td>
                        <td>{o?.name}</td>
                        <td>
                          <span
                            className={`tg ${
                              o?.type === "Government" ? "blue"
                              : o?.type === "NGO" ? "green"
                              : o?.type === "University" ? "gold"
                              : ""
                            }`}
                          >
                            {o?.type}
                          </span>
                        </td>
                        <td className="hide-xs" style={{ fontSize: "11px", color: "var(--ink-2)" }}>
                          {p.courses.length} courses
                        </td>
                        <td className="num">{p.grade}</td>
                        <td className="hide-xs">
                          <span className="num">{p.docs.length} required</span>
                        </td>
                        <td><ReviewStatusBadge status={p.reviewStatus} /></td>
                        <td><StatusBadge status={p.status} /></td>
                        <td className="num">{p.deadline}</td>
                        <td className="act">
                          {p.reviewStatus === "pending_review" && (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-blue"
                                disabled={actionId === p.id}
                                onClick={() => decide(p.id, "approved")}
                              >
                                <Icon name="check" size={12} /> Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-red"
                                disabled={actionId === p.id}
                                onClick={() => setRejecting(p.id)}
                              >
                                <Icon name="x" size={12} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }}
                />
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div
              className="dpane-h"
              style={{
                padding: "16px",
                borderTop: "1px solid var(--rule)",
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
                  <Icon name="chevron-left" size={13} /> Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <Icon name="chevron-right" size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rejecting && (
        <div className="panel" style={{ marginTop: "14px" }}>
          <div className="ph"><span className="lbl">Rejection reason</span></div>
          <div className="pb" style={{ display: "grid", gap: "10px", padding: "16px" }}>
            <div className="field">
              <label className="lbl">Reason <span style={{ color: "var(--red)" }}>*</span></label>
              <textarea
                className="field-input"
                rows={3}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain what the organisation must correct."
                style={{ minHeight: "80px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-sm btn-blue"
                disabled={!reason.trim() || actionId === rejecting}
                onClick={() => decide(rejecting, "rejected", reason)}
              >
                <Icon name="send" size={13} /> Send rejection
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setRejecting(null)}>
                <Icon name="x" size={13} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}