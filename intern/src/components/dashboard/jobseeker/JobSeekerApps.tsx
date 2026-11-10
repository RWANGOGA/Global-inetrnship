"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchJobApplications,
  fetchMyJobApplications,
  withdrawJobApplication,
  withdrawApplicationApi,
  isApiEnabled,
} from "../../../lib/api";
import { ApplicationDto, JobApplicationDto } from "../../../types";

export function JobSeekerApps() {
  const { session, toast } = useApp();
  const [applications, setApplications] = useState<ApplicationDto[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplicationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"internships" | "jobs">("internships");
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "jobseeker") {
      setLoading(false);
      return;
    }
    loadApplications();
  }, [session]);

  async function loadApplications() {
    setLoading(true);
    try {
      const [internships, jobs] = await Promise.all([
        fetchJobApplications(),
        fetchMyJobApplications(),
      ]);
      setApplications(internships);
      setJobApplications(jobs.items);
      setLoading(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load applications");
      setLoading(false);
    }
  }

  async function handleWithdraw(
    id: string,
    type: "internship" | "job"
  ) {
    setWithdrawing(id);
    try {
      if (type === "internship") {
        await withdrawApplicationApi(id);
      } else {
        await withdrawJobApplication(id);
      }
      toast("Application withdrawn");
      loadApplications();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to withdraw");
    } finally {
      setWithdrawing(null);
    }
  }

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

  const currentApps = activeTab === "internships" ? applications : jobApplications;
  const openCount = currentApps.filter(
    (a) => !["Accepted", "Rejected", "Withdrawn"].includes(a.status)
  ).length;

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Applications</h2>
          <p>
            {currentApps.length} application{currentApps.length === 1 ? "" : "s"} ·
            {openCount} open
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
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
      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Role</th>
                <th>Organisation</th>
                <th>Applied</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading applications...</td>
                </tr>
              ) : !currentApps || currentApps.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    No applications yet. Browse roles to get started.
                  </td>
                </tr>
              ) : (
                currentApps.map((app) => {
                  const isInternship = activeTab === "internships";
                  const appAny = app as ApplicationDto | JobApplicationDto;
                  return (
                    <tr key={app.id}>
                      <td className="who">
                        <b>
                          {isInternship
                            ? (appAny as ApplicationDto).placement_id
                            : (appAny as JobApplicationDto).job_id}
                        </b>
                        <span>{isInternship ? "Internship" : "Full time"}</span>
                      </td>
                      <td>Employer</td>
                      <td className="num">{app.created_at}</td>
                      <td>
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="act">
                        {["Submitted", "In Review"].includes(app.status) && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={withdrawing === app.id}
                            onClick={() => handleWithdraw(app.id, activeTab === "internships" ? "internship" : "job")}
                          >
                            {withdrawing === app.id ? "..." : "Withdraw"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}