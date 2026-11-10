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
} from "../../../lib/api";
import { Placement, ApplicationDto, Job, JobApplicationDto } from "../../../types";

export function EmployerApplicants() {
  const { session, dashGo, toast } = useApp();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [internshipApplicants, setInternshipApplicants] = useState<Record<string, ApplicationDto[]>>({});
  const [jobApplicants, setJobApplicants] = useState<Record<string, JobApplicationDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"internships" | "jobs">("internships");
  const [selectedId, setSelectedId] = useState<string>("");
  const [updating, setUpdating] = useState<string | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      // Refresh the current list
      if (activeTab === "jobs") {
        loadJobApplicants(selectedId);
      }
    } catch (cause) {
      console.error("Failed to update status:", cause);
    } finally {
      setUpdating(null);
    }
  }

  const currentItems = activeTab === "internships" ? placements : jobs;
  const currentApplicants = activeTab === "internships" 
    ? internshipApplicants[selectedId] || [] 
    : jobApplicants[selectedId] || [];

  const totalApplicants = Object.values(
    activeTab === "internships" ? internshipApplicants : jobApplicants
  ).flat().length;
  const shortlisted = Object.values(
    activeTab === "internships" ? internshipApplicants : jobApplicants
  ).flat().filter((a) => a.status === "Accepted").length;

  function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
      Submitted: "blue",
      "In Review": "amber",
      Accepted: "green",
      Rejected: "red",
      Withdrawn: "ink",
    };
    return (
      <span
        className="tg"
        style={{
          background: `var(--${colors[status] || "ink"}-1)`,
          color: `var(--${colors[status] || "ink"})`,
        }}
      >
        {status}
      </span>
    );
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Applicants</h2>
          <p>
            {totalApplicants} candidate{totalApplicants === 1 ? "" : "s"} ·{" "}
            {shortlisted} shortlisted
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {selectedId && activeTab === "internships" && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleExportPlacementApplicants(selectedId)}
            >
              Export Applicants CSV
            </button>
          )}
          {selectedId && activeTab === "jobs" && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleExportJobApplicants(selectedId)}
            >
              Export Applicants CSV
            </button>
          )}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "internships" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("internships")}
          >
            Internships
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "jobs" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("jobs")}
          >
            Jobs
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "14px" }}>
        <div className="ph">
          <span className="lbl">Select {activeTab === "internships" ? "placement" : "job"}</span>
        </div>
        <div className="pb">
          <select
            value={selectedId}
            onChange={(e) => handleSelectionChange(e.target.value)}
            className="field"
            style={{ maxWidth: "400px" }}
          >
            {currentItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({activeTab === "internships" 
                  ? (item as Placement).applicants 
                  : (item as Job).applicants} applicants)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>{activeTab === "internships" ? "Course" : "Applied"}</th>
                <th>{activeTab === "internships" ? "Grade" : "Status"}</th>
                <th className="hide-xs">Documents</th>
                <th>Fit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}>Loading...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    No {activeTab === "internships" ? "placements" : "jobs"} posted yet.
                  </td>
                </tr>
              ) : currentApplicants.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    No applicants for this {activeTab === "internships" ? "placement" : "job"}.
                  </td>
                </tr>
              ) : (
                currentApplicants.map((app, i) => (
                  <tr key={app.id}>
                    <td className="who">
                      <b>{app.user_id.slice(0, 8)}…</b>
                      <span>
                        {activeTab === "internships" ? "Year 3" : app.created_at}
                      </span>
                    </td>
                    <td>
                      {activeTab === "internships" 
                        ? (app as ApplicationDto).placement_id 
                        : app.created_at}
                    </td>
                    <td className="num">
                      {activeTab === "internships" ? "3.7" : (
                        <StatusBadge status={app.status} />
                      )}
                    </td>
                    <td className="hide-xs">
                      {activeTab === "internships" ? (
                        <span className="tg green">3 of 3 verified</span>
                      ) : (
                        <span className="tg blue">View CV</span>
                      )}
                    </td>
                    <td className="num">
                      {activeTab === "internships" ? "93%" : "—"}
                    </td>
                    <td className="act">
                      {activeTab === "jobs" && ["Submitted", "In Review"].includes(app.status) && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-blue"
                            disabled={updating === app.id}
                            onClick={() => handleStatusUpdate(app.id, "Accepted")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={updating === app.id}
                            onClick={() => handleStatusUpdate(app.id, "Rejected")}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={updating === app.id}
                            onClick={() => handleStatusUpdate(app.id, "In Review")}
                          >
                            Review
                          </button>
                        </div>
                      )}
                      {activeTab === "internships" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => console.log("Invite", app.id)}
                        >
                          Invite
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
    </>
  );
}