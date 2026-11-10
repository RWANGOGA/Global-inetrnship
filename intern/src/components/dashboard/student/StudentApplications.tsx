"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { ApplicationDto } from "../../../types";
import { Icon } from "../../icons/Icons";

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

function ApplicationDetail({ application }: { application: ApplicationDto }) {
  const { getPlacement, getOrg } = useApp();
  const placement = getPlacement(application.placement_id);
  const org = placement ? getOrg(placement.orgId) : undefined;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div className="dpane-h">
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 700 }}>{placement?.title || "Internship Application"}</h3>
          <p style={{ color: "var(--ink-2)", marginTop: "4px" }}>
            {org?.name || "Organisation"} · Applied {application.created_at.split("T")[0]}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {application.statement && (
          <section style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px" }}>
            <h4 className="lbl" style={{ marginBottom: "8px" }}>Personal Statement</h4>
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{application.statement}</p>
          </section>
        )}

        {application.cover_letter && (
          <section style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px" }}>
            <h4 className="lbl" style={{ marginBottom: "8px" }}>Cover Letter</h4>
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{application.cover_letter}</p>
          </section>
        )}

        {(application.cv_url || application.github_url || application.linkedin_url || application.portfolio_url) && (
          <section style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px" }}>
            <h4 className="lbl" style={{ marginBottom: "8px" }}>Links & CV</h4>
            <div style={{ display: "grid", gap: "8px" }}>
              {application.cv_url && (
                <div className="tg blue"><Icon name="doc" size={10} /> CV: {application.cv_url}</div>
              )}
              {application.github_url && (
                <a href={application.github_url} target="_blank" rel="noopener" className="tg" style={{ textDecoration: "none" }}>
                  <Icon name="arrow" size={10} /> GitHub: {application.github_url}
                </a>
              )}
              {application.linkedin_url && (
                <a href={application.linkedin_url} target="_blank" rel="noopener" className="tg" style={{ textDecoration: "none" }}>
                  <Icon name="arrow" size={10} /> LinkedIn: {application.linkedin_url}
                </a>
              )}
              {application.portfolio_url && (
                <a href={application.portfolio_url} target="_blank" rel="noopener" className="tg" style={{ textDecoration: "none" }}>
                  <Icon name="arrow" size={10} /> Portfolio: {application.portfolio_url}
                </a>
              )}
            </div>
          </section>
        )}

        {application.academic_papers?.length && (
          <section style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px" }}>
            <h4 className="lbl" style={{ marginBottom: "8px" }}>Academic Papers</h4>
            <ul style={{ display: "grid", gap: "6px" }}>
              {application.academic_papers.map((paper, i) => (
                <li key={i} style={{ fontSize: "12px" }}>
                  <a href={paper} target="_blank" rel="noopener" style={{ color: "var(--blue)", textDecoration: "underline" }}>
                    {paper}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(application.reference_1_name || application.reference_2_name) && (
          <section style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px" }}>
            <h4 className="lbl" style={{ marginBottom: "8px" }}>References</h4>
            <div style={{ display: "grid", gap: "16px" }}>
              {application.reference_1_name && (
                <fieldset style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "12px" }}>
                  <legend style={{ fontWeight: 600, fontSize: "11px", padding: "0 8px" }}>Reference 1</legend>
                  <div style={{ display: "grid", gap: "4px", fontSize: "12px" }}>
                    <div><strong>Name:</strong> {application.reference_1_name}</div>
                    <div><strong>Email:</strong> {application.reference_1_email}</div>
                    <div><strong>Phone:</strong> {application.reference_1_phone}</div>
                    <div><strong>Relationship:</strong> {application.reference_1_relationship}</div>
                  </div>
                </fieldset>
              )}
              {application.reference_2_name && (
                <fieldset style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "12px" }}>
                  <legend style={{ fontWeight: 600, fontSize: "11px", padding: "0 8px" }}>Reference 2</legend>
                  <div style={{ display: "grid", gap: "4px", fontSize: "12px" }}>
                    <div><strong>Name:</strong> {application.reference_2_name}</div>
                    <div><strong>Email:</strong> {application.reference_2_email}</div>
                    <div><strong>Phone:</strong> {application.reference_2_phone}</div>
                    <div><strong>Relationship:</strong> {application.reference_2_relationship}</div>
                  </div>
                </fieldset>
              )}
            </div>
          </section>
        )}

        {application.document_ids?.length && (
          <section style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px" }}>
            <h4 className="lbl" style={{ marginBottom: "8px" }}>Additional Documents</h4>
            <ul style={{ display: "grid", gap: "6px" }}>
              {application.document_ids.map((doc, i) => (
                <li key={i} className="tg"><Icon name="doc" size={10} /> {doc}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export function StudentApplications() {
  const { applications, getPlacement, getOrg, withdrawApplication, toast } = useApp();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [withdrawing, setWithdrawing] = React.useState<string | null>(null);

  const canWithdraw = (status: string) => ["Submitted", "In Review"].includes(status);

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>My applications</h2>
          <p>Track every internship application from one live record.</p>
        </div>
      </div>
      <div className="panel">
        <div className="ph">
          <span className="lbl">Application history</span>
          <span className="lbl">{applications.length} submitted</span>
        </div>
        <div className="pb" style={{ display: "grid", gap: "12px" }}>
          {!applications.length && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
              <span style={{ opacity: 0.3, marginBottom: "12px", display: "block" }}>
                <Icon name="file-text" size={48} />
              </span>
              <p>You have not submitted an internship application yet.</p>
            </div>
          )}
          {applications.map((application) => {
            const placement = getPlacement(application.placement_id);
            const org = placement ? getOrg(placement.orgId) : undefined;
            const isExpanded = expandedId === application.id;
            const canWithdrawApp = canWithdraw(application.status);
            return (
              <div key={application.id} style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                <div
                  className="dashboard-recommendation"
                  onClick={() => setExpandedId(isExpanded ? null : application.id)}
                  style={{ cursor: "pointer" }}
                >
                  <span>
                    <b>{placement?.title || "Internship application"}</b>
                    <small>
                      {org?.name || "Organisation"} · submitted {application.created_at.split("T")[0]}
                    </small>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <StatusBadge status={application.status} />
                    <span style={{ color: "var(--muted)" }}>
                      <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={13} />
                    </span>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--rule)", background: "var(--paper-2)" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {application.updated_at && application.updated_at !== application.created_at
                      ? `Updated: ${application.updated_at.split("T")[0]}`
                      : ""}
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {canWithdrawApp && (
                      <button
                        type="button"
                        className={`btn btn-sm ${withdrawing === application.id ? "btn-red" : ""}`}
                        disabled={withdrawing === application.id}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setWithdrawing(application.id);
                          try {
                            await withdrawApplication(application.id);
                            toast("Application withdrawn");
                          } catch {
                            toast("We could not withdraw this application.");
                          } finally {
                            setWithdrawing(null);
                          }
                        }}
                      >
                        {withdrawing === application.id ? (
                          <>
                            <div className="spinner" style={{ width: "13px", height: "13px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "8px" }} />
                            Withdrawing...
                          </>
                        ) : (
                          <>
                            <Icon name="trash" size={13} /> Withdraw
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : application.id);
                      }}
                    >
                      <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={13} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <ApplicationDetail application={application} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .dashboard-recommendation:hover {
          background: var(--paper-2);
        }
      `}</style>
    </>
  );
}