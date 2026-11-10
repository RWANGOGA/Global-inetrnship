"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ApiError,
  fetchUserList,
  fetchUserDetail,
  userAction,
  isApiEnabled,
  UserRead,
  UserDetailResponse,
  UserListResponse,
} from "../../../lib/api";

type Tab = "list" | "detail" | "action";

interface OrgStats {
  active_placements: number;
  total_hired: number;
  total_revenue_cents: number;
  compliance_score: number;
  active_postings: number;
  subscription: {
    plan: string;
    billing: string;
    seats: number;
    status: string;
  };
  billing_email?: string;
  tax_id?: string;
}

interface UserManagementProps {}

export function UserManagement() {
  const { dashGo, toast, session } = useApp();
  const [users, setUsers] = useState<UserRead[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRead | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "detail" | "action">("list");
  const [actionType, setActionType] = useState<"suspend" | "activate" | "change_role">("suspend");
  const [actionReason, setActionReason] = useState("");
  const [newRole, setNewRole] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);


  useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadUsers();
  }, [session, page, roleFilter, statusFilter, search]);

  async function loadUsers() {
    setStatus("loading");
    try {
      const res = await fetchUserList({
        role: roleFilter || undefined,
        status: statusFilter,
        search: search || undefined,
        page,
        pageSize,
      });
      setUsers(res.items);
      setTotal(res.total);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load users"
      );
      setStatus("error");
    }
  }

  async function handleView(user: UserRead) {
    setSelectedUser(user);
    setView("detail");
    try {
      const detail = await fetchUserDetail(user.id);
      setUserDetail(detail);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load user"
      );
    }
  }

  async function handleAction() {
    if (!selectedUser || !actionReason.trim()) return;
    setActionLoading(true);
    try {
      await userAction(selectedUser.id, {
        action: actionType,
        reason: actionReason,
        new_role: newRole || undefined,
      });
      toast(`User ${actionType}d successfully`);
      setView("list");
      setSelectedUser(null);
      setActionReason("");
      setNewRole("");
      loadUsers();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to update user"
      );
    } finally {
      setActionLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    active: "green",
    inactive: "red",
    pending: "gold",
    suspended: "red",
    sanctioned: "red",
  };

  const roleColors: Record<string, string> = {
    student: "blue",
    employer: "green",
    jobseeker: "gold",
    admin: "red",
    employee: "purple",
  };

  const roleBadge = (role: string) => (
    <span
      className="tg"
      style={{ background: `var(--${roleColors[role] || "muted"})` }}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );


  if (view === "detail" && selectedUser && userDetail) {
    return renderDetailView();
  }

  if (view === "action" && selectedUser) {
    return renderActionView();
  }

  return renderListView();

  function renderListView() {
    return (
      <>
        <div className="dpane-h">
          <div>
            <h2>Users</h2>
            <p>
              {users.length} of {total} users ·{" "}
              {users.filter((u) => u.is_active).length} active
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => toast("Create user not yet implemented")}
            >
              <Icon name="plus" size={12} /> Add user
            </button>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: "14px" }}>
          <div className="pb" style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <span className="lbl">Search:</span>
              <input
                type="text"
                className="field"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{ minWidth: "250px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <span className="lbl">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="field"
                style={{ minWidth: "160px" }}
              >
                <option value="">All roles</option>
                <option value="student">Student</option>
                <option value="employer">Employer</option>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
                <option value="jobseeker">Job Seeker</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <span className="lbl">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive");
                  setPage(1);
                }}
                className="field"
                style={{ minWidth: "140px" }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="pb" style={{ padding: 0 }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th className="num">Applications</th>
                  <th className="num">Documents</th>
                  <th className="num">Testimonials</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {status === "loading" ? (
                  <tr>
                    <td colSpan={8}>Loading users...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No users found.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="who">
                        <b>{user.name}</b>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "9px" }}>
                          {user.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td>
                        <span
                          className={`tg ${
                            roleColors[user.role] || ""
                          }`}
                        >
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td>{user.email}</td>
                      <td>{statusBadge(user.is_active ? "active" : "inactive")}</td>
                      <td className="num">—</td>
                      <td className="num">—</td>
                      <td className="num">—</td>
                      <td className="act">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleView(user)}
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
    const u = selectedUser!;
    const d = userDetail;
    if (!d || !selectedUser) return null;

    return (
      <>
        <div className="dpane-h">
          <div>
            <h2>{u.name}</h2>
            <p>
              {u.email} ·{" "}
              <span className={`tg ${roleColors[u.role]}`}>{u.role}</span>
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn btn-sm" onClick={() => setView("list")}>
              Back to list
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setView("action")}>
              Manage
            </button>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <b>{d.applications_count ?? 0}</b>
            <span className="lbl">applications</span>
          </div>
          <div className="kpi">
            <b>{d.documents_count ?? 0}</b>
            <span className="lbl">documents</span>
          </div>
          <div className="kpi">
            <b>{d.testimonials_count ?? 0}</b>
            <span className="lbl">testimonials</span>
          </div>
          <div className="kpi">
            <span className={`tg ${u.is_active ? "green" : "red"}`}>
              {u.is_active ? "Active" : "Inactive"}
            </span>
            <span className="lbl">status</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Subscription</span>
              <span className="tg blue">{d.subscription?.plan || "Free"}</span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Plan</span>
                <b>{d.subscription?.plan || "Free"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Billing</span>
                <b>{d.subscription?.billing || "—"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Seats</span>
                <b>{d.subscription?.seats ?? 1}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                <span>Status</span>
                <span className={`tg ${d.subscription?.status === "active" ? "green" : "red"}`}>
                  {d.subscription?.status || "active"}
                </span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">User Details</span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "8px", fontSize: "11.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ID</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "9px" }}>
                  {u.id}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Role</span>
                <span>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Email</span>
                <span>{u.email}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status</span>
                <span className={`tg ${u.is_active ? "green" : "red"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Joined</span>
                <span>{new Date(u.created_at).toLocaleDateString()}</span>
              </div>
              {u.org_id && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Organization</span>
                  <span>{u.org_id}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Applications ({d.applications_count ?? 0})</span>
            </div>
            <div className="pb" style={{ padding: 0 }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Placement</th>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.applications || []).map((app) => (
                    <tr key={app.id}>
                      <td>{app.placement_title}</td>
                      <td>{app.organization}</td>
                      <td>
                        <span className={`tg ${app.status === "Accepted" ? "green" : app.status === "Rejected" ? "red" : "gold"}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="num">{new Date(app.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!d.applications || d.applications.length === 0) && (
                    <tr>
                      <td colSpan={4} className="muted">No applications yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Documents ({d.documents_count ?? 0})</span>
            </div>
            <div className="pb" style={{ padding: 0 }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>File</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.documents || []).map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.document_type}</td>
                      <td>{doc.filename}</td>
                      <td>{statusBadge(doc.status)}</td>
                      <td className="num">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!d.documents || d.documents.length === 0) && (
                    <tr>
                      <td colSpan={4} className="muted">No documents uploaded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Testimonials ({d.testimonials_count ?? 0})</span>
            </div>
            <div className="pb" style={{ padding: 0 }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.testimonials || []).map((t) => (
                    <tr key={t.id}>
                      <td>{t.filename}</td>
                      <td>{statusBadge(t.status)}</td>
                      <td className="num">{new Date(t.uploaded_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!d.testimonials || d.testimonials.length === 0) && (
                    <tr>
                      <td colSpan={3} className="muted">No testimonials.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderActionView() {
    const u = selectedUser!;

    return (
      <>
        <div className="dpane-h">
          <div>
            <h2>User Action</h2>
            <p>{u.name} ({u.email})</p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setView("detail");
              setActionReason("");
              setNewRole("");
            }}
          >
            Back
          </button>
        </div>

        <div className="panel">
          <div className="ph">
            <span className="lbl">Action</span>
          </div>
          <div className="pb">
            <div className="row2" style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              {(["suspend", "activate", "change_role"] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  className={`btn btn-sm ${actionType === action ? "btn-blue" : ""}`}
                  onClick={() => setActionType(action)}
                  style={{ flex: 1 }}
                >
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
            {actionType === "change_role" && (
              <div className="field" style={{ marginBottom: "16px" }}>
                <label>New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="field"
                >
                  <option value="">Select role</option>
                  <option value="student">Student</option>
                  <option value="employer">Employer</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="jobseeker">Job Seeker</option>
                </select>
              </div>
            )}
            <div className="field">
              <label>Reason (required)</label>
              <textarea
                className="field"
                rows={4}
                required
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Explain the reason for this action..."
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-sm btn-blue"
                disabled={actionLoading || !actionReason.trim() || (actionType === "change_role" && !newRole)}
                onClick={handleAction}
              >
                {actionLoading ? "Processing…" : `Apply ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setView("detail");
                  setActionReason("");
                  setNewRole("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  function statusBadge(status: string) {
    const statusColors: Record<string, string> = {
      active: "green",
      inactive: "red",
      pending: "gold",
      suspended: "red",
      sanctioned: "red",
    };
    return (
      <span
        className="tg"
        style={{ background: `var(--${statusColors[status] || "muted"})` }}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function formatCurrencyDisplay(cents: number) {
    return "$" + (cents / 100).toLocaleString();
  }
}