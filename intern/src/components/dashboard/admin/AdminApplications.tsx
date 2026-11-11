"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchAdminApplications,
  isApiEnabled,
  exportAdminApplicationsCsv,
} from "../../../lib/api";
import { ApplicationDto } from "../../../types";
import { Icon } from "../../icons/Icons";
import { DataState } from "../../../components/common/DataState";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Submitted: "blue",
    "In Review": "amber",
    Accepted: "green",
    Rejected: "red",
    Withdrawn: "ink",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    blue: "tg blue",
    amber: "tg gold",
    green: "tg green",
    red: "tg red",
    ink: "tg dark",
  };
  return <span className={classMap[color] || "tg"}>{status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="tg" style={{ background: type === "job" ? "var(--blue-tint)" : "var(--green-tint)", color: type === "job" ? "var(--blue)" : "var(--green)" }}>
      {type === "job" ? "Job" : "Internship"}
    </span>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminApplications() {
  const { toast, session } = useApp();
  const [applications, setApplications] = React.useState<ApplicationDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [filters, setFilters] = React.useState({
    type: "",
    status: "",
    search: "",
  });
  const [showFilters, setShowFilters] = React.useState(false);

  const handleExportCsv = async () => {
    try {
      const blob = await exportAdminApplicationsCsv();
      downloadBlob(blob, "all_applications.csv");
      toast("Applications exported!");
    } catch {
      toast("Failed to export applications");
    }
  };

  React.useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadApplications();
  }, [session, page, filters]);

  async function loadApplications() {
    setStatus("loading");
    try {
      const data = await fetchAdminApplications({
        type: (filters.type as "internship" | "job") || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page,
        page_size: pageSize,
      });
      setApplications(data.items);
      setTotal(data.total);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load applications");
      setStatus("error");
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ type: "", status: "", search: "" });
    setPage(1);
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>All Applications</h2>
          <p>
            {total} application{total === 1 ? "" : "s"} across internships and jobs
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-sm" onClick={handleExportCsv}>
            <Icon name="download" size={13} /> Export CSV
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
              <label className="lbl">Type</label>
              <select
                className="field-input"
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
              >
                <option value="">All</option>
                <option value="internship">Internship</option>
                <option value="job">Job</option>
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
                <option value="Submitted">Submitted</option>
                <option value="In Review">In Review</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Withdrawn">Withdrawn</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Search</label>
              <input
                type="text"
                className="field-input"
                placeholder="Search by name or email..."
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
                  <th>Applicant</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <DataState
                  state={status}
                  error={error}
                  items={applications}
                  colSpan={7}
                  emptyMessage="No applications found"
                  emptyIcon="file-text"
                  loadingMessage="Loading applications..."
                  errorMessage="Unable to load applications"
                  children={(app: ApplicationDto) => (
                    <tr key={app.id}>
                      <td className="who">
                        <b>{app.user_name || app.user_id.slice(0, 8) + "…"}</b>
                        <span>{app.user_email}</span>
                      </td>
                      <td><TypeBadge type={app.type || "internship"} /></td>
                      <td>{app.type === "internship" ? app.placement_title : app.job_title}</td>
                      <td>{app.type === "internship" ? "Placement" : "Job"}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td className="num">{app.created_at.split("T")[0]}</td>
                      <td className="act">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => console.log("View details", app.id)}
                        >
                          <Icon name="eye" size={13} /> View
                        </button>
                      </td>
                    </tr>
                  )}
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
    </>
  );
}