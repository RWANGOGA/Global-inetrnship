"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { fetchOrganization, isApiEnabled } from "../../../lib/api";
import { CompanyProfile, Job } from "../../../types";
import { Icon, IconName } from "../../icons/Icons";

interface CompanyDetailViewProps {
  orgId: string;
  onClose: () => void;
}

function DetailSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: IconName }) {
  return (
    <section style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        {icon && (
          <span style={{ color: "var(--blue)" }}>
            <Icon name={icon} size={20} />
          </span>
        )}
        <h3 style={{ fontWeight: 700, fontSize: "16px", margin: 0, color: "var(--ink)" }}>{title}</h3>
      </div>
      <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string | React.ReactNode; icon?: IconName }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
      {icon && (
        <span style={{ color: "var(--muted)", marginTop: "2px", flexShrink: 0 }}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "2px" }}>{label}</span>
        <span style={{ fontSize: "14px", color: "var(--ink)" }}>{value}</span>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Company: "blue",
    Government: "green",
    NGO: "gold",
    University: "amber",
  };
  const color = colors[type] || "ink";
  return (
    <span
      className="tg"
      style={{
        background: `var(--${color}-tint)`,
        color: `var(--${color})`,
        textTransform: "capitalize",
      }}
    >
      {type}
    </span>
  );
}

export function CompanyDetailView({ orgId, onClose }: CompanyDetailViewProps) {
  const { session, toast } = useApp();
  const [org, setOrg] = React.useState<CompanyProfile | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    loadOrganization();
  }, [orgId]);

  async function loadOrganization() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchOrganization(orgId);
      setOrg(data);
      // Also fetch jobs for this organization
      const { fetchOrganizationJobs } = await import("../../../lib/api");
      const jobsData = await fetchOrganizationJobs();
      setJobs(jobsData.filter((j) => j.orgId === orgId));
    } catch (cause) {
      setError("Failed to load organization profile");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--muted)" }}>Loading organization profile...</p>
      </div>
    );
  }

  if (error && !org) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <span style={{ opacity: 0.5, marginBottom: "16px", display: "block" }}>
          <Icon name="bell" size={48} />
        </span>
        <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>Unable to load organization</h3>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>{error}</p>
        <button type="button" className="btn btn-blue" onClick={onClose}>
          <span style={{ marginRight: "8px" }}>
            <Icon name="x" size={14} />
          </span> Close
        </button>
      </div>
    );
  }

  if (!org) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <h1 style={{ fontWeight: 800, fontSize: "28px", margin: 0, color: "var(--ink)" }}>{org.name}</h1>
            <TypeBadge type={org.type} />
          </div>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", margin: 0 }}>
            {org.sector} · {org.loc}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          <span style={{ marginRight: "8px" }}>
            <Icon name="x" size={14} />
          </span> Close
        </button>
      </div>

      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: "24px" }}>
        <InfoRow label="Type" value={<TypeBadge type={org.type} />} />
        <InfoRow label="Sector" value={org.sector} icon="brief" />
        <InfoRow label="Location" value={org.loc} icon="brief" />
      </div>

      <DetailSection title="About" icon="brief">
        <p style={{ whiteSpace: "pre-wrap" }}>{org.about || "No description provided."}</p>
      </DetailSection>

      {jobs.length > 0 && (
        <DetailSection title="Open Opportunities" icon="brief">
          <div style={{ display: "grid", gap: "12px" }}>
            {jobs.filter((j) => j.status === "Open").map((job) => (
              <div
                key={job.id}
                style={{
                  padding: "16px",
                  background: "var(--white)",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-lg)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 2px 8px var(--shadow-1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rule)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <h4 style={{ fontWeight: 700, fontSize: "15px", margin: 0, color: "var(--ink)" }}>{job.title}</h4>
                    <TypeBadge type={job.employmentType} />
                    {job.status && <span className="tg green">{job.status}</span>}
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                    {job.loc} · {job.mode} · Closes {job.closesAt}
                  </p>
                  {job.salary && (
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--blue)", marginTop: "4px" }}>{job.salary}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-blue"
                  onClick={() => { console.log("View job", job.id); }}
                >
                  <Icon name="arrow" size={13} /> View
                </button>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--rule)" }}>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <span style={{ marginRight: "8px" }}>
            <Icon name="x" size={13} />
          </span> Close
        </button>
      </div>
    </>
  );
}