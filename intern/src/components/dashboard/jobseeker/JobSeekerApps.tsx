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
            <Icon name="brief" size={13} /> Internships
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "jobs" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("jobs")}
          >
            <Icon name="brief" size={13} /> Jobs
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
                <tr><td colSpan={5}>Loading applications...</td></tr>
              ) : !currentApps || currentApps.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    <span style={{ opacity: 0.3, marginBottom: "12px", display: "block" }}>
                    <Icon name="file-text" size={48} />
                  </span>
                    <div>No applications yet</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>Browse roles to get started</div>
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
                      <td className="num">{app.created_at.split("T")[0]}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td className="act">
                        {["Submitted", "In Review"].includes(app.status) && (
                          <button
                            type="button"
                            className={`btn btn-sm ${withdrawing === app.id ? "btn-red" : ""}`}
                            disabled={withdrawing === app.id}
                            onClick={() => handleWithdraw(app.id, activeTab === "internships" ? "internship" : "job")}
                          >
                            {withdrawing === app.id ? (
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}