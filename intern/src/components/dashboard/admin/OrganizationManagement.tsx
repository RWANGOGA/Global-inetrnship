"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ApiError,
  fetchOrganizationList,
  fetchOrganizationDetail,
  sanctionOrganization,
  OrganizationRead,
  OrganizationDetailResponse,
  OrganizationListResponse,
  OrganizationSanctionRequest,
} from "../../../lib/api";

type View = "list" | "detail";

export function OrganizationManagement() {
  const { toast, session } = useApp();
  const [organizations, setOrganizations] = useState<OrganizationRead[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRead | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrganizationDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgTypeFilter, setOrgTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [actionType, setActionType] = useState<"suspend" | "unsuspend" | "sanction">("suspend");
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!session?.role || session.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadOrganizations();
  }, [session, page, statusFilter, orgTypeFilter, search]);

  async function loadOrganizations() {
    setStatus("loading");
    try {
      const res = await fetchOrganizationList({
        status: statusFilter,
        orgType: orgTypeFilter || undefined,
        page,
        pageSize,
      });
      setOrganizations(res.items);
      setTotal(res.total);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load organizations"
      );
      setStatus("error");
    }
  }

  async function handleView(org: OrganizationRead) {
    setSelectedOrg(org);
    setView("detail");
    try {
      const detail = await fetchOrganizationDetail(org.id);
      setOrgDetail(detail);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load organization"
      );
    }
  }

  async function handleSanction() {
    if (!selectedOrg || !actionReason.trim()) return;
    setActionLoading(true);
    try {
      await sanctionOrganization(selectedOrg.id, {
        action: actionType,
        reason: actionReason,
      });
      toast(`Organization ${actionType}d successfully`);
      setView("list");
      setSelectedOrg(null);
      setActionReason("");
      loadOrganizations();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to update organization"
      );
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = (active: boolean) => (
    <span
      className="tg"
      style={{ background: `var(--${active ? "green" : "red"}-tint)`, color: `var(--${active ? "green" : "red"})` }}
    >
      {active ? "Active" : "Suspended"}
    </span>
  );

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      Company: "blue",
      Government: "green",
      NGO: "red",
      University: "gold",
    };
    return (
      <span
        className="tg"
        style={{ background: `var(--${colors[type] || "muted"}-tint)`, color: `var(--${colors[type] || "muted"})` }}
      >
        {type}
      </span>
    );
  };

  const formatCurrency = (cents: number) => {
    return "$" + (cents / 100).toLocaleString();
  };

  if (view === "detail" && selectedOrg && orgDetail) {
    return renderDetailView();
  }

  return renderListView();

  function renderListView() {
    return (
      <>
        <div className="dpane-h">
          <div>
            <h2>Organizations</h2>
            <p>
              {organizations.length} of {total} organizations ·{" "}
              {organizations.filter((o) => o.is_active).length} active
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
          <div className="panel" style={{ marginBottom: "14px" }}>
            <div className="pb" style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "12px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="lbl">Search:</span>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  style={{ minWidth: "250px" }}
                />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="lbl">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "all" | "active" | "inactive");
                    setPage(1);
                  }}
                  className="field-input"
                  style={{ minWidth: "140px" }}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="lbl">Type:</span>
                <select
                  value={orgTypeFilter}
                  onChange={(e) => {
                    setOrgTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="field-input"
                  style={{ minWidth: "160px" }}
                >
                  <option value="">All types</option>
                  <option value="Company">Company</option>
                  <option value="Government">Government</option>
                  <option value="NGO">NGO</option>
                  <option value="University">University</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="pb" style={{ padding: 0 }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Sector</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th className="num">Active Placements</th>
                  <th className="num">Total Hired</th>
                  <th className="num">Revenue</th>
                  <th className="num">Compliance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {status === "loading" ? (
                  <tr>
                    <td colSpan={10}>Loading organizations...</td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td colSpan={10}>No organizations found.</td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id}>
                      <td className="who">
                        <b>{org.name}</b>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "9px" }}>
                          {org.id}
                        </span>
                      </td>
                      <td>{typeBadge(org.type)}</td>
                      <td>{org.sector}</td>
                      <td>{org.loc}</td>
                      <td>{statusBadge(org.is_active)}</td>
                      <td className="num">{orgDetail?.active_placements ?? 0}</td>
                      <td className="num">{orgDetail?.total_hired ?? 0}</td>
                      <td className="num">{formatCurrency(orgDetail?.total_revenue_cents ?? 0)}</td>
                      <td className="num">
                        <span className={`tg ${(orgDetail?.compliance_score ?? 100) >= 80 ? "green" : (orgDetail?.compliance_score ?? 100) >= 60 ? "gold" : "red"}`}>
                          {orgDetail?.compliance_score ?? 100}%
                        </span>
                      </td>
                      <td className="act">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleView(org)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                className="btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  function renderDetailView() {
    const o = selectedOrg!;
    const d = orgDetail;
    if (!d || !selectedOrg) return null;

    const subscription = d.subscription || { plan: "Free", billing: "", seats: 1, status: "active" };

    return (
      <>
        <div className="dpane-h">
          <div>
            <h2>{o.name}</h2>
            <p>
              {o.sector} · {o.loc} · {typeBadge(o.type)}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn btn-sm" onClick={() => setView("list")}>
              Back to list
            </button>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <b>{d.active_placements ?? 0}</b>
            <span className="lbl">active placements</span>
          </div>
          <div className="kpi">
            <b>{d.total_hired ?? 0}</b>
            <span className="lbl">total hired</span>
          </div>
          <div className="kpi">
            <b>{formatCurrency(d.total_revenue_cents ?? 0)}</b>
            <span className="lbl">revenue</span>
          </div>
          <div className="kpi">
            <span className={`tg ${(d.compliance_score ?? 100) >= 80 ? "green" : (d.compliance_score ?? 100) >= 60 ? "gold" : "red"}`}>
              {d.compliance_score ?? 100}%
            </span>
            <span className="lbl">compliance score</span>
          </div>
          <div className="kpi">
            <b>{d.active_postings ?? 0}</b>
            <span className="lbl">active postings</span>
          </div>
          <div className="kpi">
            <span className={`tg ${subscription.status === "active" ? "green" : "red"}`}>
              {subscription.plan}
            </span>
            <span className="lbl">subscription</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Subscription</span>
              <span className={`tg ${subscription.status === "active" ? "green" : "red"}`}>
                {subscription.plan}
              </span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Plan</span>
                <b>{subscription.plan}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Billing</span>
                <b>{subscription.billing || "—"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Seats</span>
                <b>{subscription.seats ?? 1}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Status</span>
                <span className={`tg ${subscription.status === "active" ? "green" : "red"}`}>
                  {subscription.status}
                </span>
              </div>
              {o.billing_email && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                  <span>Billing Email</span>
                  <b>{o.billing_email}</b>
                </div>
              )}
              {o.tax_id && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                  <span>Tax ID</span>
                  <b>{o.tax_id}</b>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Organization Details</span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "8px", fontSize: "11.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ID</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "9px" }}>
                  {o.id}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Type</span>
                <span>{o.type}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Sector</span>
                <span>{o.sector}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Location</span>
                <span>{o.loc}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status</span>
                <span>{statusBadge(o.is_active)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Created</span>
                <span>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Enforcement Action</span>
            </div>
            <div className="pb">
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                {(["suspend", "unsuspend", "sanction"] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={`btn btn-sm ${actionType === action ? "btn-blue" : action === "sanction" ? "btn-red" : ""}`}
                    onClick={() => setActionType(action)}
                    style={{ flex: 1 }}
                    disabled={action === "unsuspend" && o.is_active}
                    title={action === "unsuspend" && o.is_active ? "Organization is already active" : ""}
                  >
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </button>
                ))}
              </div>
              <div className="field" style={{ marginBottom: "16px" }}>
                <label>Reason (required)</label>
                <textarea
                  className="field-input"
                  rows={4}
                  required
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={actionType === "sanction" ? "Explain the policy violation..." : actionType === "suspend" ? "Explain why this organization should be suspended..." : "Reason for unsuspending..."}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${actionType === "sanction" ? "btn-red" : "btn-blue"}`}
                  disabled={actionLoading || !actionReason.trim()}
                  onClick={handleSanction}
                >
                  {actionLoading ? "Processing…" : `Apply ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setView("list");
                    setActionReason("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}