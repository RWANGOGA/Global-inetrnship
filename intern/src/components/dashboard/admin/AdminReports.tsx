"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ApiError,
  fetchPlacementsReport,
  fetchApplicationsReport,
  fetchHiresReport,
  fetchVerificationReport,
  exportPlacementsReportCsv,
  exportApplicationsReportCsv,
  exportHiresReportCsv,
  exportVerificationReportCsv,
  isApiEnabled,
  ReportFilters,
  PlacementReportResponse,
  ApplicationReportResponse,
  HireReportResponse,
  VerificationReportResponse,
  PlacementReportItem,
  ApplicationReportItem,
  HireReportItem,
  VerificationReportItem,
} from "../../../lib/api";
import { IconName } from "../../../components/icons/Icons";

type ReportType = "placements" | "applications" | "hires" | "verification";

interface ReportTab {
  id: ReportType;
  label: string;
  icon: IconName;
}

const REPORT_TABS: ReportTab[] = [
  { id: "placements", label: "Placements", icon: "brief" as const },
  { id: "applications", label: "Applications", icon: "file-text" as const },
  { id: "hires", label: "Hires", icon: "user-check" as const },
  { id: "verification", label: "Verification", icon: "shield-check" as const },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Open: "green",
    Closing: "amber",
    Closed: "red",
    Submitted: "blue",
    "In Review": "amber",
    Accepted: "green",
    Rejected: "red",
    Withdrawn: "ink",
    approved: "green",
    pending_review: "amber",
    rejected: "red",
    pending: "gold",
    verified: "green",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    amber: "tg gold",
    red: "tg red",
    blue: "tg blue",
    gold: "tg gold",
    ink: "tg dark",
  };
  return <span className={classMap[color] || "tg"}>{status.replace("_", " ")}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="tg"
      style={{
        background: type === "job" ? "var(--blue-tint)" : "var(--green-tint)",
        color: type === "job" ? "var(--blue)" : "var(--green)",
      }}
    >
      {type === "job" ? "Job" : "Internship"}
    </span>
  );
}

export function AdminReports() {
  const { toast, session } = useApp();
  const [activeTab, setActiveTab] = useState<ReportType>("placements");
  const [filters, setFilters] = useState<ReportFilters>({
    start_date: "",
    end_date: "",
    org_id: "",
    placement_id: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Report data states
  const [placementsData, setPlacementsData] = useState<PlacementReportResponse | null>(null);
  const [applicationsData, setApplicationsData] = useState<ApplicationReportResponse | null>(null);
  const [hiresData, setHiresData] = useState<HireReportResponse | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationReportResponse | null>(null);
  
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const loadReport = async (type: ReportType) => {
    setStatus("loading");
    setError("");
    try {
      switch (type) {
        case "placements": {
          const data = await fetchPlacementsReport(filters);
          setPlacementsData(data);
          break;
        }
        case "applications": {
          const data = await fetchApplicationsReport(filters);
          setApplicationsData(data);
          break;
        }
        case "hires": {
          const data = await fetchHiresReport(filters);
          setHiresData(data);
          break;
        }
        case "verification": {
          const data = await fetchVerificationReport(filters);
          setVerificationData(data);
          break;
        }
      }
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : `Unable to load ${type} report`
      );
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadReport(activeTab);
  }, [session, activeTab, filters]);

  const handleExport = async (type: ReportType) => {
    setExporting(type);
    try {
      let blob: Blob;
      switch (type) {
        case "placements":
          blob = await exportPlacementsReportCsv(filters);
          break;
        case "applications":
          blob = await exportApplicationsReportCsv(filters);
          break;
        case "hires":
          blob = await exportHiresReportCsv(filters);
          break;
        case "verification":
          blob = await exportVerificationReportCsv(filters);
          break;
      }
      downloadBlob(blob, `${type}_report.csv`);
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} report exported!`);
    } catch {
      toast(`Failed to export ${type} report`);
    } finally {
      setExporting(null);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ start_date: "", end_date: "", org_id: "", placement_id: "" });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const renderSummaryCards = () => {
    switch (activeTab) {
      case "placements": {
        const s = placementsData?.summary || {};
        return (
          <>
            <div className="kpi">
              <b>{s.total_placements ?? 0}</b>
              <span className="lbl">total placements</span>
            </div>
            <div className="kpi">
              <b>{s.open_placements ?? 0}</b>
              <span className="lbl">open placements</span>
            </div>
            <div className="kpi">
              <b>{s.total_slots ?? 0}</b>
              <span className="lbl">total slots</span>
            </div>
            <div className="kpi">
              <b>{s.total_applicants ?? 0}</b>
              <span className="lbl">total applicants</span>
            </div>
            <div className="kpi">
              <b>{s.total_filled ?? 0}</b>
              <span className="lbl">positions filled</span>
            </div>
            <div className="kpi">
              <b>{s.fill_rate_percent ?? 0}%</b>
              <span className="lbl">fill rate</span>
            </div>
          </>
        );
      }
      case "applications": {
        const s = applicationsData?.summary || {};
        return (
          <>
            <div className="kpi">
              <b>{s.total_applications ?? 0}</b>
              <span className="lbl">total applications</span>
            </div>
            <div className="kpi">
              <b>{s.by_type?.internship ?? 0}</b>
              <span className="lbl">internship apps</span>
            </div>
            <div className="kpi">
              <b>{s.by_type?.job ?? 0}</b>
              <span className="lbl">job apps</span>
            </div>
            {Object.entries(s.by_status || {}).map(([status, count]) => (
              <div key={status} className="kpi">
                <b>{count as number}</b>
                <span className="lbl">{status.toLowerCase()}</span>
              </div>
            ))}
          </>
        );
      }
      case "hires": {
        const s = hiresData?.summary || {};
        return (
          <>
            <div className="kpi">
              <b>{s.total_hires ?? 0}</b>
              <span className="lbl">total hires</span>
            </div>
            {Object.entries(s.by_org_type || {}).map(([type, count]) => (
              <div key={type} className="kpi">
                <b>{count as number}</b>
                <span className="lbl">{type.toLowerCase()} hires</span>
              </div>
            ))}
          </>
        );
      }
      case "verification": {
        const s = verificationData?.summary || {};
        return (
          <>
            <div className="kpi">
              <b>{s.total_documents ?? 0}</b>
              <span className="lbl">total documents</span>
            </div>
            <div className="kpi">
              <b>{s.verification_rate_percent ?? 0}%</b>
              <span className="lbl">verification rate</span>
            </div>
            {Object.entries(s.by_status || {}).map(([status, count]) => (
              <div key={status} className="kpi">
                <b>{count as number}</b>
                <span className="lbl">{status}</span>
              </div>
            ))}
            {Object.entries(s.by_type || {}).map(([type, count]) => (
              <div key={type} className="kpi">
                <b>{count as number}</b>
                <span className="lbl">{type}</span>
              </div>
            ))}
          </>
        );
      }
    }
  };

  const renderTable = () => {
    switch (activeTab) {
      case "placements": {
        const items = placementsData?.items || [];
        if (status === "loading") {
          return <tr><td colSpan={10}>Loading placements report...</td></tr>;
        }
        if (items.length === 0) {
          return <tr><td colSpan={10}>No placements found for the selected filters.</td></tr>;
        }
        return items.map((p: PlacementReportItem) => (
          <tr key={p.placement_id}>
            <td className="who">
              <b>{p.title}</b>
              <span style={{ fontFamily: "var(--mono)", fontSize: "9px" }}>{p.placement_id}</span>
            </td>
            <td>{p.organization}</td>
            <td>
              <span className="tg" style={{ background: `var(--${p.org_type === "Government" ? "green" : p.org_type === "NGO" ? "red" : p.org_type === "University" ? "gold" : "blue"}-tint)`, color: `var(--${p.org_type === "Government" ? "green" : p.org_type === "NGO" ? "red" : p.org_type === "University" ? "gold" : "blue"})` }}>
                {p.org_type}
              </span>
            </td>
            <td><StatusBadge status={p.status} /></td>
            <td><StatusBadge status={p.review_status} /></td>
            <td className="num">{p.slots}</td>
            <td className="num">{p.applicants}</td>
            <td className="num">{p.filled}</td>
            <td className="num">{p.stipend}</td>
            <td className="num">{p.location}</td>
            <td className="num">{p.mode}</td>
          </tr>
        ));
      }
      case "applications": {
        const items = applicationsData?.items || [];
        if (status === "loading") {
          return <tr><td colSpan={9}>Loading applications report...</td></tr>;
        }
        if (items.length === 0) {
          return <tr><td colSpan={9}>No applications found for the selected filters.</td></tr>;
        }
        return items.map((a: ApplicationReportItem) => (
          <tr key={a.application_id}>
            <td className="who">
              <b>{a.user_name || a.user_id.slice(0, 8) + "…"}</b>
              <span>{a.user_email}</span>
            </td>
            <td><TypeBadge type={a.type} /></td>
            <td>{a.type === "internship" ? a.placement_title : a.job_title}</td>
            <td>{a.organization}</td>
            <td><StatusBadge status={a.status} /></td>
            <td className="num">{a.created_at.split("T")[0]}</td>
            <td className="num">{a.updated_at?.split("T")[0] || "—"}</td>
          </tr>
        ));
      }
      case "hires": {
        const items = hiresData?.items || [];
        if (status === "loading") {
          return <tr><td colSpan={8}>Loading hires report...</td></tr>;
        }
        if (items.length === 0) {
          return <tr><td colSpan={8}>No hires found for the selected filters.</td></tr>;
        }
        return items.map((h: HireReportItem) => (
          <tr key={h.application_id}>
            <td className="who">
              <b>{h.user_name}</b>
              <span>{h.user_email}</span>
            </td>
            <td>{h.placement_title}</td>
            <td>{h.organization}</td>
            <td>
              <span className="tg" style={{ background: `var(--${h.org_type === "Government" ? "green" : h.org_type === "NGO" ? "red" : h.org_type === "University" ? "gold" : "blue"}-tint)`, color: `var(--${h.org_type === "Government" ? "green" : h.org_type === "NGO" ? "red" : h.org_type === "University" ? "gold" : "blue"})` }}>
                {h.org_type}
              </span>
            </td>
            <td className="num">{h.hired_at.split("T")[0]}</td>
            <td className="num">{h.stipend}</td>
            <td className="num">{h.duration}</td>
          </tr>
        ));
      }
      case "verification": {
        const items = verificationData?.items || [];
        if (status === "loading") {
          return <tr><td colSpan={8}>Loading verification report...</td></tr>;
        }
        if (items.length === 0) {
          return <tr><td colSpan={8}>No documents found for the selected filters.</td></tr>;
        }
        return items.map((v: VerificationReportItem) => (
          <tr key={v.document_id}>
            <td className="who">
              <b>{v.user_name || v.user_id.slice(0, 8) + "…"}</b>
              <span>{v.user_email}</span>
            </td>
            <td>
              <span className="tg gold">{v.document_type}</span>
            </td>
            <td>{v.filename}</td>
            <td><StatusBadge status={v.status} /></td>
            <td className="num">{v.uploaded_at.split("T")[0]}</td>
            <td className="num">{v.rejection_reason || "—"}</td>
          </tr>
        ));
      }
    }
  };

  const renderTableHeaders = () => {
    switch (activeTab) {
      case "placements":
        return (
          <thead>
            <tr>
              <th>Placement</th>
              <th>Organization</th>
              <th>Type</th>
              <th>Status</th>
              <th>Review</th>
              <th className="num">Slots</th>
              <th className="num">Applicants</th>
              <th className="num">Filled</th>
              <th>Stipend</th>
              <th>Location</th>
              <th>Mode</th>
            </tr>
          </thead>
        );
      case "applications":
        return (
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Type</th>
              <th>Position</th>
              <th>Organization</th>
              <th>Status</th>
              <th>Applied</th>
              <th>Updated</th>
            </tr>
          </thead>
        );
      case "hires":
        return (
          <thead>
            <tr>
              <th>Hire</th>
              <th>Placement</th>
              <th>Organization</th>
              <th>Org Type</th>
              <th>Hired</th>
              <th>Stipend</th>
              <th>Duration</th>
            </tr>
          </thead>
        );
      case "verification":
        return (
          <thead>
            <tr>
              <th>Student</th>
              <th>Document Type</th>
              <th>Filename</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>Rejection Reason</th>
            </tr>
          </thead>
        );
    }
  };

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Reports</h2>
          <p>Analytics and exports for platform activity</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className={`btn btn-sm ${exporting === activeTab ? "btn-loading" : ""}`}
            onClick={() => handleExport(activeTab)}
            disabled={exporting !== null}
          >
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

      {/* Tab Navigation */}
      <div className="panel" style={{ marginBottom: "14px" }}>
        <div className="pb" style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${activeTab === tab.id ? "btn-blue" : "btn-ghost"}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Icon name={tab.icon} size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="panel" style={{ marginBottom: "14px" }}>
          <div className="pb" style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", padding: "16px" }}>
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
            <div className="field">
              <label className="lbl">Organization ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="Filter by organization..."
                value={filters.org_id}
                onChange={(e) => handleFilterChange("org_id", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="lbl">Placement/Job ID</label>
              <input
                type="text"
                className="field-input"
                placeholder="Filter by placement/job..."
                value={filters.placement_id}
                onChange={(e) => handleFilterChange("placement_id", e.target.value)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}>
                <Icon name="x" size={13} /> Clear
              </button>
            </div>
          </div>
          {hasActiveFilters && (
            <div style={{ padding: "0 16px 16px", fontSize: "11px", color: "var(--muted)" }}>
              Active filters: {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="kpis" style={{ marginBottom: "14px" }}>
        {renderSummaryCards()}
      </div>

      {/* Data Table */}
      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              {renderTableHeaders()}
              <tbody>
                {renderTable()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}