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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      
      // Load shortlisted applications if on shortlisted tab
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
      // Reload the current placement's applicants
      if (selectedId) loadInternshipApplicants(selectedId);
      // Refresh shortlisted list if on that tab
      if (activeTab === "shortlisted") await loadShortlistedApplications();
      toast(shortlist ? "Applicant shortlisted" : "Applicant removed from shortlist");
    } catch {
      toast("Failed to update shortlist");
    }
  }

  async function handleShortlistJob(applicationId: string, shortlist: boolean) {
    try {
      await toggleJobApplicationShortlist(applicationId);
      // Reload the current job's applicants
      if (selectedId) loadJobApplicants(selectedId);
      // Refresh shortlisted list if on that tab
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

  const totalApplicants = Object.values(
    activeTab === "internships" ? internshipApplicants : jobApplicants
  ).flat().length;
  const shortlistedCount = Object.values(
    activeTab === "internships" ? internshipApplicants : jobApplicants
  ).flat().filter((a) => a.shortlisted).length;

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Applicants</h2>
          <p>
            {totalApplicants} candidate{totalApplicants === 1 ? "" : "s"} ·{" "}
            {shortlistedCount} shortlisted
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {selectedId && activeTab === "internships" && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleExportPlacementApplicants(selectedId)}
            >
              <Icon name="download" size={13} /> Export CSV
            </button>
          )}
          {selectedId && activeTab === "jobs" && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleExportJobApplicants(selectedId)}
            >
              <Icon name="download" size={13} /> Export CSV
            </button>
          )}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "internships" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("internships")}
          >
            <Icon name="brief" size={13} /> Internships
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "jobs" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("jobs")}
          >
            <Icon name="brief" size={13} /> Jobs
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "shortlisted" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("shortlisted")}
          >
            <Icon name="check" size={13} /> Shortlisted ({shortlistedCount})
          </button>
        </div>
      </div>

      {activeTab !== "shortlisted" && (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <div className="ph">
            <span className="lbl">Select {activeTab === "internships" ? "placement" : "job"}</span>
          </div>
          <div className="pb" style={{ padding: "12px 16px" }}>
            <select
              value={selectedId}
              onChange={(e) => handleSelectionChange(e.target.value)}
              className="field-input"
              style={{ maxWidth: "420px", height: "40px", padding: "0 12px", border: "1px solid var(--rule-2)", borderRadius: "var(--r-sm)", background: "var(--white)", fontSize: "13px" }}
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
        </div>
      )}

      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>{activeTab === "shortlisted" ? "Type" : activeTab === "internships" ? "Placement" : "Job"}</th>
                  <th>Status</th>
                  <th className="hide-xs">Documents</th>
                  <th className="hide-xs">Fit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === "shortlisted" ? loadingShortlisted : loading) ? (
                  <tr><td colSpan={6}>Loading...</td></tr>
                ) : currentItems.length === 0 && activeTab !== "shortlisted" ? (
                  <tr>
                    <td colSpan={6}>
                      No {activeTab === "internships" ? "placements" : "jobs"} posted yet.
                    </td>
                  </tr>
                ) : currentApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      {activeTab === "shortlisted" ? "No shortlisted candidates yet." : `No applicants for this ${activeTab === "internships" ? "placement" : "job"}.`}
                    </td>
                  </tr>
                ) : (
                  currentApplicants.map((app, i) => (
                    <tr key={app.id}>
                      <td className="who" data-label="Candidate">
                        <b>{app.user_id.slice(0, 8)}…</b>
                        <span>{app.created_at.split("T")[0]}</span>
                      </td>
                      <td data-label={activeTab === "shortlisted" ? "Type" : activeTab === "internships" ? "Placement" : "Job"}>
                        {activeTab === "shortlisted"
                          ? (app as ApplicationDto).placement_id
                            ? (
                              <span className="tg blue">
                                <Icon name="brief" size={10} /> Internship
                              </span>
                            )
                            : (
                              <span className="tg green">
                                <Icon name="brief" size={10} /> Job
                              </span>
                            )
                          : activeTab === "internships"
                          ? (app as ApplicationDto).placement_id
                          : (app as JobApplicationDto).job_id}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="hide-xs" data-label="Documents">
                        {activeTab === "internships" || (activeTab === "shortlisted" && (app as ApplicationDto).placement_id) ? (
                          <span className="tg green">
                            <Icon name="check" size={10} /> 3 of 3 verified
                          </span>
                        ) : (
                          <span className="tg blue">
                            <Icon name="doc" size={10} /> View CV
                          </span>
                        )}
                      </td>
                      <td className="hide-xs num" data-label="Fit">
                        {activeTab === "internships" || (activeTab === "shortlisted" && (app as ApplicationDto).placement_id) ? "93%" : "—"}
                      </td>
                      <td className="act" data-label="Actions">
                        {activeTab === "jobs" && ["Submitted", "In Review"].includes(app.status) && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                            className="btn btn-sm"
                            onClick={() => console.log("Invite", app.id)}
                          >
                            <Icon name="send" size={12} /> Invite
                          </button>
                        )}
                        {["Submitted", "In Review", "Accepted"].includes(app.status) && (
                          <button
                            type="button"
                            className={`btn btn-sm ${app.shortlisted ? "btn-blue" : ""}`}
                            disabled={updating === app.id}
                            onClick={() => {
                              if (activeTab === "internships" || (activeTab === "shortlisted" && (app as ApplicationDto).placement_id)) {
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}