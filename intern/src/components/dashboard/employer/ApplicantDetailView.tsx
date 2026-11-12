"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchApplicantDetail, ApplicantDetail } from "../../../lib/api";
import { Icon, IconName } from "../../icons/Icons";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { label: string; className: string }> = {
    Submitted: { label: "Submitted", className: "tg blue" },
    "In Review": { label: "In Review", className: "tg gold" },
    Accepted: { label: "Accepted", className: "tg green" },
    Rejected: { label: "Rejected", className: "tg red" },
    Withdrawn: { label: "Withdrawn", className: "tg dark" },
  };
  const config = colors[status] || { label: status, className: "tg" };
  return <span className={config.className}>{config.label}</span>;
}

function SkillChip({ skill, verified }: { skill: string; verified: boolean }) {
  return (
    <span className={`skill-pill ${verified ? "verified" : "missing"}`}>
      {verified && <Icon name="check" size={10} />}
      {!verified && <Icon name="x" size={10} />}
      {skill}
    </span>
  );
}

function DocumentRow({ doc }: { doc: any }) {
  const statusColors: Record<string, string> = {
    verified: "green",
    pending: "gold",
    rejected: "red",
    missing: "ink",
  };
  const color = statusColors[doc.status] || "ink";
  return (
    <>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
          <Icon name="doc" size={14} className="ic" />
          {doc.document_type}
        </span>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule-2)" }}>{doc.filename}</td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule-2)" }}>
        <span className={`tg ${color}`}>{doc.status}</span>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule-2)", color: "var(--muted)", fontSize: "12px" }}>
        {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "—"}
      </td>
    </>
  );
}

function SectionHeader({ title, icon, subtitle }: { title: string; icon?: IconName; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
      {icon && <span style={{ color: "var(--blue)", marginTop: "2px" }}><Icon name={icon} size={20} /></span>}
      <div>
        <h3 style={{ fontWeight: 700, fontSize: "17px", margin: "0 0 4px", color: "var(--ink)" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

export function ApplicantDetailView({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const { toast } = useApp();
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "match" | "references">("overview");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchApplicantDetail(applicationId);
        setDetail(data);
      } catch (err: any) {
        setError(err.message || "Failed to load applicant detail");
        toast("Failed to load applicant detail");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [applicationId, toast]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
        <div className="spinner" style={{ width: 32, height: 32, border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ marginTop: "12px" }}>Loading applicant detail...</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
        <div style={{ opacity: 0.3, marginBottom: "16px" }}>
          <Icon name="alert-triangle" size={48} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>Unable to load</h3>
        <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto 20px" }}>{error || "Applicant not found"}</p>
        <button type="button" className="btn btn-blue" onClick={onClose}><Icon name="x" size={14} /> Close</button>
      </div>
    );
  }

  const d = detail;
  const isInternship = d.application_type === "internship";
  const oppTitle = isInternship ? d.placement_title : d.job_title;
  const oppType = isInternship ? (d.placement_opportunity_type || "internship") : "job";

  return (
    <div className="applicant-detail-modal">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", paddingBottom: "16px", borderBottom: "2px solid var(--rule)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: "8px" }}>
            <Icon name="chevron-left" size={20} />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h2 style={{ fontWeight: 800, fontSize: "22px", margin: 0, color: "var(--ink)" }}>
                {d.student_name || `Candidate ${d.student_id.slice(0, 8)}…`}
              </h2>
              <StatusBadge status={d.status} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--ink-2)", fontSize: "14px" }}>
              <span>{d.student_email}</span>
              <span>·</span>
              <span>{d.student_course}</span>
              <span>·</span>
              <span>Year {d.student_year}</span>
              <span>·</span>
              <span>{d.student_university}</span>
              <span>·</span>
              <span>CGPA: {d.student_cgpa.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="btn btn-blue" onClick={() => console.log("Message candidate")}>
            <Icon name="send" size={14} /> Message
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <Icon name="x" size={14} /> Close
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "4px", background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "4px", border: "1px solid var(--rule)", marginBottom: "24px" }}>
        <button type="button" className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
          <Icon name="user" size={14} /> Overview
        </button>
        <button type="button" className={`tab-btn ${activeTab === "documents" ? "active" : ""}`} onClick={() => setActiveTab("documents")}>
          <Icon name="doc" size={14} /> Documents ({d.documents.length})
        </button>
        <button type="button" className={`tab-btn ${activeTab === "match" ? "active" : ""}`} onClick={() => setActiveTab("match")}>
          <Icon name="check" size={14} /> Skills Match
        </button>
        <button type="button" className={`tab-btn ${activeTab === "references" ? "active" : ""}`} onClick={() => setActiveTab("references")}>
          <Icon name="user" size={14} /> References
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "28px" }}>
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: "24px" }}>
            {/* Opportunity Info */}
            <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "20px" }}>
              <SectionHeader title="Applied Opportunity" icon="brief" subtitle={`${oppType.charAt(0).toUpperCase() + oppType.slice(1)} • ${oppTitle}`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div><span className="lbl">Application ID</span><br /><b>{d.application_id}</b></div>
                <div><span className="lbl">Applied</span><br /><b>{new Date(d.created_at).toLocaleDateString()}</b></div>
                <div><span className="lbl">Last Updated</span><br /><b>{d.updated_at ? new Date(d.updated_at).toLocaleDateString() : "—"}</b></div>
                <div><span className="lbl">Shortlisted</span><br /><b>{d.shortlisted ? "Yes" : "No"}</b></div>
              </div>
            </div>

            {/* Student Profile */}
            <div>
              <SectionHeader title="Student Profile" icon="user" subtitle={`${d.student_university} • ${d.student_course} • Year ${d.student_year}`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
                <div style={{ background: "var(--green-tint)", borderRadius: "var(--r-lg)", padding: "20px", textAlign: "center" }}>
                  <div className="lbl" style={{ color: "var(--green)" }}>CGPA</div>
                  <div style={{ fontWeight: 800, fontSize: "28px", color: "var(--green)" }}>{d.student_cgpa.toFixed(2)}</div>
                </div>
                <div style={{ background: "var(--blue-tint)", borderRadius: "var(--r-lg)", padding: "20px", textAlign: "center" }}>
                  <div className="lbl" style={{ color: "var(--blue)" }}>Course</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)" }}>{d.student_course}</div>
                </div>
                <div style={{ background: "var(--gold-tint)", borderRadius: "var(--r-lg)", padding: "20px", textAlign: "center" }}>
                  <div className="lbl" style={{ color: "var(--gold)" }}>University</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)" }}>{d.student_university}</div>
                </div>
                <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "20px", textAlign: "center" }}>
                  <div className="lbl" style={{ color: "var(--muted)" }}>Talent Search</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)" }}>{d.talent_search_opt_in ? "Opted In" : "Not Opted In"}</div>
                </div>
              </div>
            </div>

            {/* Statement & Cover Letter */}
            {d.statement && (
              <div>
                <SectionHeader title="Personal Statement" icon="doc" />
                <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "20px", whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--ink-2)" }}>
                  {d.statement}
                </div>
              </div>
            )}
            {d.cover_letter && (
              <div>
                <SectionHeader title="Cover Letter" icon="doc" />
                <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "20px", whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--ink-2)" }}>
                  {d.cover_letter}
                </div>
              </div>
            )}

            {/* Links */}
            {(d.cv_url || d.github_url || d.linkedin_url || d.portfolio_url) && (
              <div>
                <SectionHeader title="Links & Portfolio" icon="arrow" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  {d.cv_url && <a href={d.cv_url} target="_blank" rel="noopener" className="btn btn-ghost"><Icon name="doc" size={14} /> CV</a>}
                  {d.github_url && <a href={d.github_url} target="_blank" rel="noopener" className="btn btn-ghost"><Icon name="arrow" size={14} /> GitHub</a>}
                  {d.linkedin_url && <a href={d.linkedin_url} target="_blank" rel="noopener" className="btn btn-ghost"><Icon name="user" size={14} /> LinkedIn</a>}
                  {d.portfolio_url && <a href={d.portfolio_url} target="_blank" rel="noopener" className="btn btn-ghost"><Icon name="brief" size={14} /> Portfolio</a>}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div>
            <SectionHeader title="Documents" icon="doc" subtitle={`${d.documents.length} document${d.documents.length !== 1 ? "s" : ""} uploaded`} />
            {d.documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
                <div style={{ opacity: 0.25, marginBottom: "16px" }}>
                  <Icon name="doc" size={48} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>No documents uploaded</h3>
                <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto" }}>This candidate has not uploaded any documents yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
                  <thead>
                    <tr style={{ background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                      <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Type</th>
                      <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Filename</th>
                      <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Status</th>
                      <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.documents.map((doc: any) => (
                      <tr key={doc.id}>
                        <DocumentRow doc={doc} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "match" && (
          <div>
            {d.match_score ? (
              <div style={{ display: "grid", gap: "24px" }}>
                {/* Match Score Header */}
                <div style={{ background: "var(--blue-tint)", borderRadius: "var(--r-xl)", padding: "28px", textAlign: "center" }}>
                  <div className="lbl" style={{ color: "var(--blue)", fontSize: "13px", marginBottom: "8px" }}>Overall Match Score</div>
                  <div style={{ fontWeight: 800, fontSize: "56px", color: "var(--blue)", lineHeight: 1 }}>{d.match_score.score}%</div>
                  <div style={{ marginTop: "12px", color: "var(--ink-2)", fontSize: "14px" }}>
                    {d.match_score.matched_skills.length} of {d.match_score.matched_skills.length + d.match_score.missing_skills.length} required skills matched
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "20px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "var(--white)", borderRadius: "var(--r-md)" }}>
                      <span style={{ color: d.match_score.course_fit ? "var(--green)" : "var(--red)" }}>
                        <Icon name={d.match_score.course_fit ? "check" : "x"} size={14} />
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>Course Fit: {d.match_score.course_fit ? "Yes" : "No"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "var(--white)", borderRadius: "var(--r-md)" }}>
                      <span style={{ color: d.match_score.grade_fit ? "var(--green)" : "var(--red)" }}>
                        <Icon name={d.match_score.grade_fit ? "check" : "x"} size={14} />
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>Grade Fit: {d.match_score.grade_fit ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>

                {/* Matched Skills */}
                <div>
                  <SectionHeader title="Matched Skills" icon="check" subtitle={`${d.match_score.matched_skills.length} skills found`} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {d.match_score.matched_skills.length === 0 ? (
                      <span style={{ color: "var(--muted)", fontSize: "13px" }}>No matched skills</span>
                    ) : (
                      d.match_score.matched_skills.map((skill: string) => (
                        <SkillChip key={skill} skill={skill} verified={true} />
                      ))
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div>
                  <SectionHeader title="Missing Skills" icon="x" subtitle={`${d.match_score.missing_skills.length} skills needed`} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {d.match_score.missing_skills.length === 0 ? (
                      <span style={{ color: "var(--green)", fontWeight: 600 }}>All required skills matched! 🎉</span>
                    ) : (
                      d.match_score.missing_skills.map((skill: string) => (
                        <SkillChip key={skill} skill={skill} verified={false} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
                <div style={{ opacity: 0.25, marginBottom: "16px" }}><Icon name="alert-triangle" size={48} /></div>
                <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>No match score available</h3>
                <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto" }}>
                  Match scoring is only available for internship applications with defined skill requirements.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "references" && (
          <div style={{ display: "grid", gap: "20px" }}>
            {d.reference_1_name && (
              <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "24px" }}>
                <h4 style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", color: "var(--ink)" }}>Reference 1</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                  <div><span className="lbl">Name</span><br />{d.reference_1_name}</div>
                  <div><span className="lbl">Email</span><br />{d.reference_1_email}</div>
                  <div><span className="lbl">Phone</span><br />{d.reference_1_phone}</div>
                  <div><span className="lbl">Relationship</span><br />{d.reference_1_relationship}</div>
                </div>
              </div>
            )}
            {d.reference_2_name && (
              <div style={{ background: "var(--paper-2)", borderRadius: "var(--r-lg)", padding: "24px" }}>
                <h4 style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", color: "var(--ink)" }}>Reference 2</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                  <div><span className="lbl">Name</span><br />{d.reference_2_name}</div>
                  <div><span className="lbl">Email</span><br />{d.reference_2_email}</div>
                  <div><span className="lbl">Phone</span><br />{d.reference_2_phone}</div>
                  <div><span className="lbl">Relationship</span><br />{d.reference_2_relationship}</div>
                </div>
              </div>
            )}
            {!d.reference_1_name && !d.reference_2_name && (
              <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
                <div style={{ opacity: 0.25, marginBottom: "16px" }}><Icon name="user" size={48} /></div>
                <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>No references provided</h3>
                <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto" }}>This candidate has not listed any references.</p>
              </div>
            )}
          </div>
        )}

      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .applicant-detail-modal {
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-btn {
          display: inline-flex;
          alignItems: center;
          gap: 8px;
          padding: 10px 18px;
          borderRadius: var(--r-md);
          fontSize: 13px;
          fontWeight: 600;
          color: var(--ink-2);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tab-btn:hover {
          color: var(--ink);
          background: var(--white);
        }
        .tab-btn.active {
          color: var(--blue);
          background: var(--white);
          boxShadow: 0 1px 3px var(--shadow-1);
        }
        .skill-pill {
          display: inline-flex;
          alignItems: center;
          gap: 5px;
          padding: 6px 11px;
          borderRadius: var(--r-pill);
          fontSize: 12px;
          fontWeight: 500;
          border: 1px solid var(--rule-2);
        }
        .skill-pill.verified {
          background: var(--green-tint);
          border-color: transparent;
          color: var(--green);
        }
        .skill-pill.missing {
          background: var(--red-tint);
          border-color: transparent;
          color: var(--red);
        }
        .lbl {
          display: block;
          fontSize: 11.5px;
          fontWeight: 600;
          color: var(--muted);
          textTransform: uppercase;
          letterSpacing: 0.05em;
          marginBottom: 4px;
        }
      `}</style>
    </div>
  );
}