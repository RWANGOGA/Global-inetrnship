"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchOrganizationInternships,
  fetchOrganizationApplicants,
  fetchOrganizationJobs,
  fetchJobApplicants,
  updateJobApplicationStatus,
  isApiEnabled,
  exportOrgPlacementApplicantsCsv,
  exportOrgJobApplicantsCsv,
  toggleJobApplicationShortlist,
  toggleInternshipApplicationShortlist,
  fetchOrganizationShortlistedInternships,
  fetchOrganizationShortlistedJobs,
} from "../../../lib/api";
import { Placement, ApplicationDto, Job, JobApplicationDto } from "../../../types";
import { Icon, IconName } from "../../icons/Icons";
import { ApplicantDetailView } from "./ApplicantDetailView";

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

function TypeBadge({ isInternship }: { isInternship: boolean }) {
  return (
    <span className={`tg ${isInternship ? "blue" : "green"}`}>
      <Icon name="brief" size={10} /> {isInternship ? "Internship" : "Job"}
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

function LoadingSpinner({ size = 32, text }: { size?: number; text?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
      <div className="spinner" style={{ width: size, height: size, border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      {text && <span style={{ marginTop: "12px", fontSize: "14px", color: "var(--ink-2)" }}>{text}</span>}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
      <div style={{ opacity: 0.25, marginBottom: "20px" }}>
        <Icon name={icon} size={56} />
      </div>
      <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>{title}</h3>
      <p style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" }}>{description}</p>
      {action && <div style={{ marginTop: "20px" }}>{action}</div>}
    </div>
  );
}

function ShortlistedCard({ student, isInternship, onRemove, onView, onInvite }: {
  student: ApplicationDto | JobApplicationDto;
  isInternship: boolean;
  onRemove: () => void;
  onView: () => void;
  onInvite: () => void;
}) {
  return (
    <div className="shortlisted-card">
      <div className="card-main">
        <div className="candidate-info">
          <div className="candidate-avatar">
            <Icon name="user" size={20} />
          </div>
          <div className="candidate-details">
            <div className="candidate-name">Candidate {student.user_id.slice(0, 8)}…</div>
            <div className="candidate-meta">
              <span>{student.created_at.split("T")[0]}</span>
              <TypeBadge isInternship={isInternship} />
            </div>
          </div>
        </div>
        <div className="candidate-status">
          <StatusBadge status={student.status} />
        </div>
      </div>
      <div className="card-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onView}>
          <Icon name="eye" size={13} /> View
        </button>
        <button type="button" className="btn btn-sm btn-blue" onClick={onInvite}>
          <Icon name="send" size={13} /> Invite
        </button>
        <button type="button" className="btn btn-sm btn-ghost remove-btn" onClick={onRemove} title="Remove from shortlist">
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}

export function EmployerApplicants() {
  const { session, dashGo, toast } = useApp();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [internshipApplicants, setInternshipApplicants] = useState<Record<string, ApplicationDto[]>>({});
  const [jobApplicants, setJobApplicants] = useState<Record<string, JobApplicationDto[]>>({});
  const [shortlistedInternships, setShortlistedInternships] = useState<ApplicationDto[]>([]);
  const [shortlistedJobs, setShortlistedJobs] = useState<JobApplicationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"internships" | "jobs" | "shortlisted">("internships");
  const [selectedId, setSelectedId] = useState<string>("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [loadingShortlisted, setLoadingShortlisted] = useState(false);
  // Applicant detail view
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  // View mode: table or kanban
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  const handleExportPlacementApplicants = async (id: string) => {
    try {
      const blob = await exportOrgPlacementApplicantsCsv(id);
      downloadBlob(blob, `placement_${id}_applicants.csv`);
      toast("Applicants exported!");
    } catch {
      toast("Failed to export applicants");
    }
  };

  const handleExportJobApplicants = async (id: string) => {
    try {
      const blob = await exportOrgJobApplicantsCsv(id);
      downloadBlob(blob, `job_${id}_applicants.csv`);
      toast("Applicants exported!");
    } catch {
      toast("Failed to export applicants");
    }
  };

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "employer") {
      setLoading(false);
      return;
    }
    loadData();
  }, [session]);

  async function loadData() {
    setLoading(true);
    try {
      const [placementsData, jobsData] = await Promise.all([
        fetchOrganizationInternships(),
        fetchOrganizationJobs(),
      ]);
      setPlacements(placementsData);
      setJobs(jobsData);

      if (placementsData.length > 0) {
        setSelectedId(placementsData[0].id);
        loadInternshipApplicants(placementsData[0].id);
      }
      if (jobsData.length > 0 && activeTab === "jobs") {
        setSelectedId(jobsData[0].id);
        loadJobApplicants(jobsData[0].id);
      }
      
      if (activeTab === "shortlisted") {
        await loadShortlistedApplications();
      }
      
      setLoading(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load data");
      setLoading(false);
    }
  }

  async function loadInternshipApplicants(placementId: string) {
    try {
      const apps = await fetchOrganizationApplicants(placementId);
      setInternshipApplicants((prev) => ({ ...prev, [placementId]: apps }));
    } catch (cause) {
      console.error("Failed to load internship applicants:", cause);
    }
  }

  async function loadJobApplicants(jobId: string) {
    try {
      const data = await fetchJobApplicants(jobId);
      setJobApplicants((prev) => ({ ...prev, [jobId]: data.items }));
    } catch (cause) {
      console.error("Failed to load job applicants:", cause);
    }
  }

  async function loadShortlistedApplications() {
    setLoadingShortlisted(true);
    try {
      const [internshipApps, jobApps] = await Promise.all([
        fetchOrganizationShortlistedInternships(),
        fetchOrganizationShortlistedJobs(),
      ]);
      setShortlistedInternships(internshipApps);
      setShortlistedJobs(jobApps);
    } catch (cause) {
      console.error("Failed to load shortlisted applications:", cause);
    } finally {
      setLoadingShortlisted(false);
    }
  }

  async function handleShortlistInternship(applicationId: string, shortlist: boolean) {
    try {
      await toggleInternshipApplicationShortlist(applicationId);
      if (selectedId) loadInternshipApplicants(selectedId);
      if (activeTab === "shortlisted") await loadShortlistedApplications();
      toast(shortlist ? "Applicant shortlisted" : "Applicant removed from shortlist");
    } catch {
      toast("Failed to update shortlist");
    }
  }

  async function handleShortlistJob(applicationId: string, shortlist: boolean) {
    try {
      await toggleJobApplicationShortlist(applicationId);
      if (selectedId) loadJobApplicants(selectedId);
      if (activeTab === "shortlisted") await loadShortlistedApplications();
      toast(shortlist ? "Applicant shortlisted" : "Applicant removed from shortlist");
    } catch {
      toast("Failed to update shortlist");
    }
  }

  function handleSelectionChange(id: string) {
    setSelectedId(id);
    if (activeTab === "internships") {
      if (id && !internshipApplicants[id]) loadInternshipApplicants(id);
    } else {
      if (id && !jobApplicants[id]) loadJobApplicants(id);
    }
  }

  async function handleStatusUpdate(applicationId: string, status: string) {
    setUpdating(applicationId);
    try {
      await updateJobApplicationStatus(applicationId, status);
      if (activeTab === "jobs") {
        loadJobApplicants(selectedId);
      }
    } catch (cause) {
      console.error("Failed to update status:", cause);
    } finally {
      setUpdating(null);
    }
  }

  const currentItems = activeTab === "internships" ? placements : activeTab === "jobs" ? jobs : [];
  const currentApplicants = activeTab === "internships"
    ? internshipApplicants[selectedId] || []
    : activeTab === "jobs"
    ? jobApplicants[selectedId] || []
    : [...shortlistedInternships, ...shortlistedJobs];

type KanbanColumnConfig = {
  id: string;
  label: string;
  color: "blue" | "gold" | "green" | "red" | "dark";
  icon: IconName;
};

// Kanban columns configuration
const STATUS_COLUMNS: KanbanColumnConfig[] = [
  { id: "Submitted", label: "Submitted", color: "blue", icon: "send" },
  { id: "In Review", label: "In Review", color: "gold", icon: "eye" },
  { id: "Accepted", label: "Accepted", color: "green", icon: "check" },
  { id: "Rejected", label: "Rejected", color: "red", icon: "x" },
  { id: "Withdrawn", label: "Withdrawn", color: "dark", icon: "file-text" },
];

// Group applicants by status for Kanban
const applicantsByStatus = React.useMemo(() => {
  const grouped: Record<string, typeof currentApplicants> = {};
  STATUS_COLUMNS.forEach((col) => { grouped[col.id] = []; });
  currentApplicants.forEach((app) => {
    if (grouped[app.status]) {
      grouped[app.status].push(app);
    } else {
      grouped[app.status] = [app];
    }
  });
  return grouped;
}, [currentApplicants]);

// Drag and drop handlers for Kanban
const [draggedId, setDraggedId] = useState<string | null>(null);

const handleDragStart = (e: React.DragEvent, appId: string) => {
  setDraggedId(appId);
  e.dataTransfer.effectAllowed = "move";
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
};

const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
  e.preventDefault();
  if (!draggedId || draggedId === targetStatus) return;
  
  setDraggedId(null);
  
  // Find the application being dragged
  const app = currentApplicants.find((a) => a.id === draggedId);
  if (!app) return;
  
  // Optimistic update
  setDraggedId(null);
  
  try {
    await updateJobApplicationStatus(draggedId, targetStatus);
    if (activeTab === "jobs") {
      loadJobApplicants(selectedId);
    } else if (activeTab === "internships") {
      // For internships, we'd need a similar update function
      loadInternshipApplicants(selectedId);
    }
    toast(`Application moved to ${targetStatus}`);
  } catch (cause) {
    console.error("Failed to update status:", cause);
    toast("Failed to update status");
  }
};

// Kanban Card Component
function KanbanCard({ app }: { app: ApplicationDto | JobApplicationDto }) {
  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={(e) => handleDragStart(e, app.id)}
      onClick={() => setSelectedApplicantId(app.id)}
    >
      <div className="kanban-card-header">
        <div className="candidate-info">
          <div className="candidate-avatar">
            <Icon name="user" size={16} />
          </div>
          <div>
            <div className="candidate-name">Candidate {app.user_id.slice(0, 8)}…</div>
            <div className="candidate-date">{app.created_at.split("T")[0]}</div>
          </div>
        </div>
        {app.shortlisted && (
          <span className="tg blue" style={{ fontSize: "9px" }}>
            <Icon name="check" size={9} /> Shortlisted
          </span>
        )}
      </div>
      <div className="kanban-card-body">
        <StatusBadge status={app.status} />
        <div className="kanban-card-meta">
          <span className="tg blue"><Icon name="doc" size={10} /> View Details</span>
        </div>
      </div>
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({ column, apps }: { column: KanbanColumnConfig; apps: typeof currentApplicants }) {
  const colorMap: Record<string, string> = {
    blue: "var(--blue)",
    gold: "var(--gold)",
    green: "var(--green)",
    red: "var(--red)",
    dark: "var(--ink)",
  };
  const tintMap: Record<string, string> = {
    blue: "var(--blue-tint)",
    gold: "var(--gold-tint)",
    green: "var(--green-tint)",
    red: "var(--red-tint)",
    dark: "var(--ink-1)",
  };
  const color = colorMap[column.color] || "var(--ink)";
  const tint = tintMap[column.color] || "var(--paper-2)";

  return (
    <div 
      className="kanban-column"
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, column.id)}
    >
      <div className="kanban-column-header" style={{ background: tint, borderColor: color }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color }}>
            <Icon name={column.icon} size={14} />
          </span>
          <span style={{ fontWeight: 700, fontSize: "13px", color }}>{column.label}</span>
        </div>
        <span className="kanban-count" style={{ background: color, color: "white" }}>
          {apps.length}
        </span>
      </div>
      <div className="kanban-cards">
        {apps.length === 0 ? (
          <div className="kanban-empty" style={{ color: "var(--muted)" }}>
            <div style={{ opacity: 0.3, marginBottom: "8px", display: "block" }}>
              <Icon name="inbox" size={24} />
            </div>
            Drop here
          </div>
        ) : (
          apps.map((app) => <KanbanCard key={app.id} app={app} />)
        )}
      </div>
    </div>
  );
}

// Kanban Board Component
function KanbanBoard() {
  return (
    <div className="kanban-board">
      {STATUS_COLUMNS.map((column) => (
        <KanbanColumn 
          key={column.id} 
          column={column} 
          apps={applicantsByStatus[column.id] || []} 
        />
      ))}
    </div>
  );
}

  const totalApplicants = Object.values(
    activeTab === "internships" ? internshipApplicants : jobApplicants
  ).flat().length;
  const shortlistedCount = Object.values(
    activeTab === "internships" ? internshipApplicants : jobApplicants
  ).flat().filter((a) => a.shortlisted).length;

  const allShortlisted = [...shortlistedInternships, ...shortlistedJobs];
  const totalShortlisted = allShortlisted.length;

  return (
    <>
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Applicants</h1>
            <p className="page-subtitle">
              {totalApplicants} candidate{totalApplicants === 1 ? "" : "s"} · {shortlistedCount} shortlisted
            </p>
          </div>
          <div className="header-actions">
            {selectedId && activeTab === "internships" && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleExportPlacementApplicants(selectedId)}>
                <Icon name="download" size={13} /> Export CSV
              </button>
            )}
            {selectedId && activeTab === "jobs" && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleExportJobApplicants(selectedId)}>
                <Icon name="download" size={13} /> Export CSV
              </button>
            )}
            {activeTab !== "shortlisted" && (
              <div className="view-mode-toggle" style={{ display: "flex", gap: "4px", background: "var(--paper-2)", borderRadius: "var(--r-md)", padding: "4px", border: "1px solid var(--rule)" }}>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "transparent", border: "none", cursor: "pointer", color: viewMode === "table" ? "var(--blue)" : "var(--ink-2)", fontWeight: 600, fontSize: "12px" }}
                >
                  <Icon name="brief" size={14} /> Table
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === "kanban" ? "active" : ""}`}
                  onClick={() => setViewMode("kanban")}
                  style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "transparent", border: "none", cursor: "pointer", color: viewMode === "kanban" ? "var(--blue)" : "var(--ink-2)", fontWeight: 600, fontSize: "12px" }}
                >
                  <Icon name="inbox" size={14} /> Kanban
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="tab-bar">
          <button 
            type="button" 
            className={`tab-btn ${activeTab === "internships" ? "active" : ""}`}
            onClick={() => setActiveTab("internships")}
          >
            <Icon name="brief" size={14} /> Internships
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === "jobs" ? "active" : ""}`}
            onClick={() => setActiveTab("jobs")}
          >
            <Icon name="brief" size={14} /> Jobs
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === "shortlisted" ? "active" : ""}`}
            onClick={() => setActiveTab("shortlisted")}
          >
            <Icon name="check" size={14} /> Shortlisted
            {totalShortlisted > 0 && <span className="tab-badge">{totalShortlisted}</span>}
          </button>
        </div>
      </div>

      {activeTab !== "shortlisted" && currentItems.length > 0 && (
        <div className="selection-panel">
          <label className="selection-label">Select {activeTab === "internships" ? "placement" : "job"}</label>
          <select
            value={selectedId}
            onChange={(e) => handleSelectionChange(e.target.value)}
            className="select-field"
          >
            {currentItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({activeTab === "internships"
                  ? (item as Placement).applicants
                  : (item as Job).applicants || 0} applicants)
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab !== "shortlisted" && currentItems.length === 0 && (
        <EmptyState
          icon="brief"
          title={`No ${activeTab === "internships" ? "placements" : "jobs"} posted yet`}
          description={`Create your first ${activeTab === "internships" ? "placement" : "job"} to start receiving applications.`}
          action={
            <button type="button" className="btn btn-blue" onClick={() => dashGo(activeTab === "internships" ? "placements" : "jobs")}>
              <Icon name="plus" size={14} /> Create {activeTab === "internships" ? "Placement" : "Job"}
            </button>
          }
        />
      )}

      <div className="data-panel">
        {activeTab === "shortlisted" ? (
          <> 
            {loadingShortlisted ? (
              <LoadingSpinner text="Loading shortlisted candidates..." />
            ) : totalShortlisted === 0 ? (
              <EmptyState
                icon="check"
                title="No shortlisted candidates yet"
                description="Shortlist applicants from your placements or jobs to see them here."
              />
            ) : (
              <div className="shortlisted-grid">
                {allShortlisted.map((app) => {
                  const isInternship = (app as ApplicationDto).placement_id !== undefined;
                  return (
                    <ShortlistedCard
                      key={app.id}
                      student={app}
                      isInternship={isInternship}
                      onRemove={() => isInternship ? handleShortlistInternship(app.id, false) : handleShortlistJob(app.id, false)}
                      onView={() => setSelectedApplicantId(app.id)}
                      onInvite={() => console.log("Invite", app.id)}
                    />
                  );
                })}
              </div>
            )}
          </>
) : (
            <>
              {(loading ? (
                <LoadingSpinner text="Loading applicants..." />
              ) : currentApplicants.length === 0 ? (
                <EmptyState
                  icon="user"
                  title={`No applicants for this ${activeTab === "internships" ? "placement" : "job"}`}
                  description="When candidates apply, they will appear here."
                />
              ) : viewMode === "kanban" ? (
                <KanbanBoard />
              ) : (
                <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th className="hide-xs">Documents</th>
                      <th className="hide-xs">Fit</th>
                      <th style={{ width: "220px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentApplicants.map((app) => (
                      <tr key={app.id}>
                        <td className="candidate-cell" data-label="Candidate">
                          <div className="candidate-info">
                            <div className="candidate-avatar">
                              <Icon name="user" size={18} />
                            </div>
                            <div>
                              <div className="candidate-name">Candidate {app.user_id.slice(0, 8)}…</div>
                              <div className="candidate-date">{app.created_at.split("T")[0]}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="hide-xs" data-label="Documents">
                          {activeTab === "internships" ? (
                            <span className="tg green"><Icon name="check" size={10} /> 3 of 3 verified</span>
                          ) : (
                            <span className="tg blue"><Icon name="doc" size={10} /> View CV</span>
                          )}
                        </td>
                        <td className="hide-xs num" data-label="Fit">
                          {activeTab === "internships" ? "93%" : "—"}
                        </td>
                        <td className="actions-cell" data-label="Actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setSelectedApplicantId(app.id)}
                            style={{ marginRight: "8px" }}
                          >
                            <Icon name="eye" size={12} /> View
                          </button>
                          {activeTab === "jobs" && ["Submitted", "In Review"].includes(app.status) && (
                            <div className="action-group">
                              <button
                                type="button"
                                className="btn btn-sm btn-blue"
                                disabled={updating === app.id}
                                onClick={() => handleStatusUpdate(app.id, "Accepted")}
                              >
                                <Icon name="check" size={12} /> Accept
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-red"
                                disabled={updating === app.id}
                                onClick={() => handleStatusUpdate(app.id, "Rejected")}
                              >
                                <Icon name="x" size={12} /> Reject
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={updating === app.id}
                                onClick={() => handleStatusUpdate(app.id, "In Review")}
                              >
                                <Icon name="eye" size={12} /> Review
                              </button>
                            </div>
                          )}
                          {activeTab === "internships" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => console.log("Invite", app.id)}
                            >
                              <Icon name="send" size={12} /> Invite
                            </button>
                          )}
                          {["Submitted", "In Review", "Accepted"].includes(app.status) && (
                            <button
                              type="button"
                              className={`btn btn-sm ${app.shortlisted ? "btn-blue shortlisted" : "btn-ghost"}`}
                              disabled={updating === app.id}
                              onClick={() => {
                                if (activeTab === "internships") {
                                  handleShortlistInternship(app.id, !app.shortlisted);
                                } else {
                                  handleShortlistJob(app.id, !app.shortlisted);
                                }
                              }}
                            >
                              <Icon name={app.shortlisted ? "check" : "plus"} size={12} />
                              {app.shortlisted ? " Shortlisted" : " Shortlist"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .page-header {
          padding: 8px 0 20px;
          border-bottom: 2px solid var(--rule);
          margin-bottom: 8px;
        }
        .header-content {
          display: flex;
          alignItems: center;
          justifyContent: space-between;
          flexWrap: wrap;
          gap: 16px;
          marginBottom: 16px;
        }
        .page-title {
          fontWeight: 800;
          fontSize: 32px;
          marginBottom: 4px;
          color: var(--ink);
          letterSpacing: -0.5px;
          lineHeight: 1.15;
        }
        .page-subtitle {
          color: var(--ink-2);
          fontSize: 15px;
          fontWeight: 500;
          margin: 0;
        }
        .header-actions {
          display: flex;
          gap: 10px;
          flexWrap: wrap;
        }
        .tab-bar {
          display: flex;
          gap: 4px;
          background: var(--paper-2);
          borderRadius: var(--r-lg);
          padding: 4px;
          border: 1px solid var(--rule);
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
          position: relative;
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
        .tab-badge {
          background: var(--blue);
          color: white;
          fontSize: 10px;
          fontWeight: 700;
          padding: 2px 7px;
          borderRadius: var(--r-pill);
          marginLeft: 4px;
        }
        .selection-panel {
          marginBottom: 20px;
        }
        .selection-label {
          display: block;
          fontSize: 12.5px;
          fontWeight: 600;
          color: var(--ink-2);
          marginBottom: 8px;
        }
        .select-field {
          border: 1px solid var(--rule-2);
          borderRadius: var(--r-md);
          background: var(--white);
          height: 48px;
          padding: 0 16px;
          paddingRight: 44px;
          fontSize: 14px;
          outline: 0;
          maxWidth: 480px;
          width: 100%;
          appearance: none;
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";
          backgroundRepeat: no-repeat;
          backgroundPosition: right 14px center;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .select-field:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px var(--blue-tint);
        }
        .data-panel {
          background: var(--white);
          border: 1px solid var(--rule);
          borderRadius: var(--r-xl);
          boxShadow: 0 1px 3px var(--shadow-1), 0 0 0 1px var(--rule-2);
          overflow: hidden;
        }
        .table-container {
          overflowX: auto;
        }
        .data-table {
          width: 100%;
          borderCollapse: collapse;
          fontSize: 13.5px;
        }
        .data-table th {
          textAlign: left;
          padding: 14px 18px;
          fontWeight: 600;
          fontSize: 11.5px;
          textTransform: uppercase;
          letterSpacing: 0.05em;
          color: var(--muted);
          background: var(--paper-2);
          borderBottom: 1px solid var(--rule);
        }
        .data-table td {
          padding: 16px 18px;
          borderBottom: 1px solid var(--rule-2);
          verticalAlign: middle;
        }
        .data-table tr:last-child td {
          borderBottom: none;
        }
        .data-table tbody tr {
          transition: background-color 0.1s;
        }
        .data-table tbody tr:hover {
          background: var(--paper-2);
        }
        .candidate-cell {
          minWidth: 220px;
        }
        .candidate-info {
          display: flex;
          alignItems: center;
          gap: 12px;
        }
        .candidate-avatar {
          width: 36px;
          height: 36px;
          borderRadius: var(--r-lg);
          background: var(--blue-tint);
          color: var(--blue);
          display: flex;
          alignItems: center;
          justifyContent: center;
        }
        .candidate-name {
          fontWeight: 600;
          fontSize: 14px;
          color: var(--ink);
        }
        .candidate-date {
          fontSize: 12px;
          color: var(--muted);
        }
        .candidate-meta {
          display: flex;
          alignItems: center;
          gap: 8px;
          marginTop: 4px;
        }
        .actions-cell {
          whiteSpace: nowrap;
        }
        .action-group {
          display: flex;
          gap: 8px;
          flexWrap: wrap;
        }
        .shortlisted-card {
          background: var(--white);
          border: 1px solid var(--rule);
          borderRadius: var(--r-xl);
          padding: 20px;
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .shortlisted-card:hover {
          boxShadow: 0 4px 12px var(--shadow-2);
          borderColor: var(--blue);
        }
        .card-main {
          display: flex;
          alignItems: center;
          justifyContent: space-between;
          marginBottom: 16px;
        }
        .candidate-info {
          display: flex;
          alignItems: center;
          gap: 12px;
        }
        .candidate-avatar {
          width: 40px;
          height: 40px;
          borderRadius: var(--r-lg);
          background: var(--blue-tint);
          color: var(--blue);
          display: flex;
          alignItems: center;
          justifyContent: center;
        }
        .candidate-name {
          fontWeight: 600;
          fontSize: 14.5px;
          color: var(--ink);
        }
        .candidate-meta {
          display: flex;
          alignItems: center;
          gap: 10px;
          marginTop: 4px;
          fontSize: 12.5px;
          color: var(--muted);
        }
        .candidate-status {
          flexShrink: 0;
        }
        .card-actions {
          display: flex;
          gap: 8px;
          borderTop: 1px solid var(--rule);
          paddingTop: 16px;
          justifyContent: flex-end;
        }
        .card-actions .btn {
          flexShrink: 0;
        }
        .remove-btn {
          color: var(--red);
          borderColor: var(--red);
        }
        .remove-btn:hover {
          background: var(--red-tint);
        }
        .shortlisted-grid {
          display: grid;
          gap: 16px;
          gridTemplateColumns: repeat(auto-fill, minmax(380px, 1fr));
        }
        .btn {
          display: inline-flex;
          alignItems: center;
          justifyContent: center;
          gap: 8px;
          padding: 0 16px;
          borderRadius: var(--r-md);
          fontSize: 13px;
          fontWeight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-sm { height: 40px; padding: 0 14px; font-size: 12.5px; }
        .btn-blue { background: var(--blue); color: white; border-color: var(--blue); }
        .btn-blue:hover:not(:disabled) { background: var(--blue-2); }
        .btn-blue:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-blue.shortlisted { background: var(--blue); color: white; }
        .btn-red { background: var(--red); color: white; border-color: var(--red); }
        .btn-red:hover:not(:disabled) { background: var(--red-2); }
        .btn-red:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
        .btn-ghost:hover:not(:disabled) { background: var(--paper-2); }
        .btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
        .tg {
          display: inline-flex;
          alignItems: center;
          gap: 5px;
          padding: 4px 10px;
          borderRadius: var(--r-pill);
          fontSize: 11px;
          fontWeight: 600;
        }
        .tg.blue { background: var(--blue-tint); color: var(--blue); }
        .tg.gold { background: var(--gold-tint); color: var(--gold); }
        .tg.green { background: var(--green-tint); color: var(--green); }
        .tg.red { background: var(--red-tint); color: var(--red); }
        .tg.dark { background: var(--ink-1); color: var(--ink); }
        
        @media (max-width: 768px) {
          .page-title { fontSize: 26px; }
          .tab-btn { padding: 10px 12px; fontSize: 12px; }
          .shortlisted-grid { gridTemplateColumns: 1fr; }
        }
      `}</style>
      {selectedApplicantId && (
        <ApplicantDetailView
          applicationId={selectedApplicantId}
          onClose={() => setSelectedApplicantId(null)}
        />
      )}
    </>
  );
}