"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  describeApiError,
  fetchOrganizationMembers,
  inviteOrganizationMember,
  updateOrganizationMemberRole,
  removeOrganizationMember,
  OrganizationMember,
  InviteMemberRequest,
} from "../../../lib/api";
import { Icon } from "../../icons/Icons";

const ROLES: Array<InviteMemberRequest["role"]> = ["owner", "admin", "recruiter", "member"];

/** Status colours for a membership record; anything unrecognised falls back to red. */
function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value === "active") return "green";
  if (value === "invited" || value === "pending") return "gold";
  return "red";
}

export function EmployerTeam() {
  const { session, toast, openModal } = useApp();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteMemberRequest["role"]>("recruiter");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await fetchOrganizationMembers();
      setMembers(data.items);
      setError("");
    } catch (cause) {
      setError(describeApiError(cause, "Failed to load team members").message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.role === "employer") {
      loadMembers();
    }
  }, [session]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) {
      setInviteError("Enter the email address to invite.");
      return;
    }
    setInviting(true);
    setInviteError("");
    try {
      const result = await inviteOrganizationMember({ email, role: inviteRole });
      toast(result.message || `Invitation sent to ${email}`);
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("recruiter");
      await loadMembers();
    } catch (cause) {
      // Keep the form open so the address does not have to be retyped.
      setInviteError(describeApiError(cause, "Could not send the invitation.").message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: OrganizationMember, role: string) {
    if (role === member.role) return;
    setBusyMemberId(member.id);
    try {
      const result = await updateOrganizationMemberRole(member.id, {
        role: role as InviteMemberRequest["role"],
      });
      setMembers((current) => current.map((item) => (item.id === member.id ? result.member : item)));
      toast(result.message || "Role updated");
    } catch (cause) {
      toast(describeApiError(cause, "Could not change the role.").message);
    } finally {
      setBusyMemberId(null);
    }
  }

  function confirmRemove(member: OrganizationMember) {
    const label = member.user_name || member.user_email;
    openModal(
      "Remove team member",
      <p style={{ fontSize: "13px" }}>
        {label} will lose access to this organization's postings and applicants. They can be
        invited again later.
      </p>,
      "Remove",
      () => {
        void handleRemove(member);
      }
    );
  }

  async function handleRemove(member: OrganizationMember) {
    const label = member.user_name || member.user_email;
    setBusyMemberId(member.id);
    try {
      const result = await removeOrganizationMember(member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      toast(result.message || `${label} removed from the organization`);
    } catch (cause) {
      toast(describeApiError(cause, "Could not remove this member.").message);
    } finally {
      setBusyMemberId(null);
    }
  }

  if (!session || session.role !== "employer") {
    return (
      <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
        <Icon name="shield-check" size={48} />
        <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>Employer Access Required</h3>
        <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto" }}>Sign in as an employer to manage your team.</p>
      </div>
    );
  }

  return (
    <div className="employer-team">
      <div className="dpane-h">
        <div>
          <h2>Team members</h2>
          <p>
            {members.length} member{members.length === 1 ? "" : "s"} · roles and invitations
          </p>
        </div>
        <button
          type="button"
          className={`btn btn-sm ${showInvite ? "" : "btn-blue"}`}
          onClick={() => {
            setShowInvite((current) => !current);
            setInviteError("");
          }}
        >
          <Icon name={showInvite ? "x" : "plus"} size={13} />
          {showInvite ? "Cancel" : "Invite member"}
        </button>
      </div>

      {/* Invite used to only raise "Invite modal coming soon". An inline panel
          keeps the typed address on failure, which a modal confirm cannot. */}
      {showInvite && (
        <div className="panel" style={{ marginBottom: "18px" }}>
          <form className="pb" onSubmit={handleInvite} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end", padding: "16px" }}>
            <div className="field" style={{ flex: "1 1 260px" }}>
              <label htmlFor="inviteEmail">Work email</label>
              <input
                id="inviteEmail"
                type="email"
                required
                value={inviteEmail}
                placeholder="name@organisation.com"
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="field" style={{ flex: "0 0 170px" }}>
              <label htmlFor="inviteRole">Role</label>
              <select
                id="inviteRole"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as InviteMemberRequest["role"])}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-sm btn-blue" disabled={inviting}>
              {inviting ? "Sending…" : "Send invite"}
            </button>
            {inviteError && (
              <p style={{ flexBasis: "100%", color: "var(--red)", fontSize: "12px" }} role="alert">
                {inviteError}
              </p>
            )}
          </form>
        </div>
      )}

      <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
            Loading team members...
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
            <Icon name="alert-triangle" size={48} />
            <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>Unable to load</h3>
            <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto 20px" }}>{error}</p>
            <button type="button" className="btn btn-blue" onClick={loadMembers}><Icon name="arrow" size={14} /> Retry</button>
          </div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
            <Icon name="user" size={48} />
            <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>No team members yet</h3>
            <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto 20px" }}>You're the only member.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
              <thead>
                <tr style={{ background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Member</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Role</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Status</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Invited</th>
                  <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", width: "200px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} style={{ borderBottom: "1px solid var(--rule-2)" }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="candidate-avatar" style={{ width: 36, height: 36, fontSize: "11px" }}>
                          {member.user_name?.charAt(0).toUpperCase() || member.user_email?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                            {member.user_name || "Unnamed"}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>{member.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <select
                        value={member.role}
                        disabled={busyMemberId === member.id}
                        aria-label={`Role for ${member.user_name || member.user_email}`}
                        onChange={(event) => handleRoleChange(member, event.target.value)}
                        style={{ height: "30px", fontSize: "12px", padding: "0 6px", border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", background: "var(--white)" }}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span className={`tg ${statusTone(member.status)}`}>{member.status}</span>
                    </td>
                    <td style={{ padding: "16px", color: "var(--ink-2)", fontSize: "13px" }}>
                      {member.invited_at ? new Date(member.invited_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      {/* Used to render a hardcoded "Active" badge here, which repeated
                          the status column and offered no action at all. */}
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busyMemberId === member.id}
                        onClick={() => confirmRemove(member)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
