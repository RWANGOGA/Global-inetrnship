"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ApiError,
  fetchAdminActionLogs,
  isApiEnabled,
  AdminActionLogRead,
  AdminActionLogListResponse,
} from "../../../lib/api";

export function AdminActionLogs() {
  const { toast, session } = useApp();
  const [logs, setLogs] = React.useState<AdminActionLogRead[]>([]);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [filters, setFilters] = React.useState({
    admin_id: "",
    target_user_id: "",
    action: "",
    start_date: "",
    end_date: "",
  });
  const [showFilters, setShowFilters] = React.useState(false);

  React.useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadLogs();
  }, [session, page, filters]);

  async function loadLogs() {
    setStatus("loading");
    try {
      const data = await fetchAdminActionLogs({
        admin_id: filters.admin_id || undefined,
        target_user_id: filters.target_user_id || undefined,
        action: filters.action || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        page,
        page_size: pageSize,
      });
      setLogs(data.items);
      setTotal(data.total);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load action logs");
      setStatus("error");
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ admin_id: "", target_user_id: "", action: "", start_date: "", end_date: "" });
    setPage(1);
  }

  function ActionBadge({ action }: { action: string }) {
    const colors: Record<string, string> = {
      suspend: "red",
      activate: "green",
      change_role: "blue",
      delete: "red",
    };
    const color = colors[action] || "ink";
    return (
      <span
        className="tg"
        style={{
          background: `var(--${color}-tint)`,
          color: `var(--${color})`,
          textTransform: "capitalize",
        }}
      >
        {action.replace("_", " ")}
      </span>
    );
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Action Logs</h2>
          <p>
            {total} action{total === 1 ? "" : "s"} · audit trail
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
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
              <label className="lbl">Admin ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="Filter by admin ID..."
                value={filters.admin_id}
                onChange={(e) => handleFilterChange("admin_id", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="lbl">Target User ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="Filter by target user ID..."
                value={filters.target_user_id}
                onChange={(e) => handleFilterChange("target_user_id", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="lbl">Action</label>
              <select
                className="field-input"
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
              >
                <option value="">All</option>
                <option value="suspend">Suspend</option>
                <option value="activate">Activate</option>
                <option value="change_role">Change Role</option>
                <option value="delete">Delete</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Start Date</label>
              <input
                type="date"
                className="field-input"
                value={filters.start_date}
                onChange={(e) => handleFilterChange("start_date", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="lbl">End Date</label>
              <input
                type="date"
                className="field-input"
                value={filters.end_date}
                onChange={(e) => handleFilterChange("end_date", e.target.value)}
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
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target User</th>
                  <th>Reason</th>
                  <th>Details</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {status === "loading" ? (
                  <tr><td colSpan={6}>Loading action logs...</td></tr>
                ) : status === "error" ? (
                  <tr><td colSpan={6} className="error">{error}</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    <span style={{ opacity: 0.3, marginBottom: "12px", display: "block" }}>
                      <Icon name="file-text" size={48} />
                    </span>
                    <div>No action logs found</div>
                  </td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id}>
                    <td className="who">
                      <b>{log.admin_email}</b>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "9px" }}>{log.admin_id.slice(0, 8)}...</span>
                    </td>
                    <td><ActionBadge action={log.action} /></td>
                    <td>
                      {log.target_user_email ? (
                        <>
                          <b>{log.target_user_email}</b>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "9px", marginTop: "4px", display: "block" }}>{log.target_user_id?.slice(0, 8)}...</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.reason}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>{log.details || "—"}</td>
                    <td className="num">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
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