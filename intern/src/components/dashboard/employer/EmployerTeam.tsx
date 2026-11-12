"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchOrganizationMembers, inviteOrganizationMember, updateOrganizationMemberRole, removeOrganizationMember, OrganizationMember, InviteMemberRequest, UpdateMemberRoleRequest } from "../../../lib/api";
import { Icon, IconName } from "../../icons/Icons";

export function EmployerTeam() {
  const { session, toast } = useApp();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await fetchOrganizationMembers();
      setMembers(data.items);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.role === "employer") {
      loadMembers();
    }
  }, [session]);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", paddingBottom: "16px", borderBottom: "2px solid var(--rule)" }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: "24px", margin: "0 0 4px", color: "var(--ink)" }}>Team Members</h2>
          <p style={{ color: "var(--ink-2)", margin: 0 }}>Manage organization members and their roles</p>
        </div>
        <button type="button" className="btn btn-blue" onClick={() => toast("Invite modal coming soon")}>
          <Icon name="plus" size={14} /> Invite Member
        </button>
      </div>

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
                      <span className="tg blue">{member.role}</span>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span className="tg green">{member.status}</span>
                    </td>
                    <td style={{ padding: "16px", color: "var(--ink-2)", fontSize: "13px" }}>
                      {member.invited_at ? new Date(member.invited_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <span className="tg">Active</span>
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
