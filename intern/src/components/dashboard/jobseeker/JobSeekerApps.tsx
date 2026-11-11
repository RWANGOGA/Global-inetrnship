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
  fetchSavedJobs,
  fetchJobs,
} from "../../../lib/api";
import { ApplicationDto, JobApplicationDto, Job } from "../../../types";
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
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"internships" | "jobs" | "saved">("internships");
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
      const [internships, jobs, saved] = await Promise.all([
        fetchJobApplications(),
        fetchMyJobApplications(),
        fetchSavedJobs(),
      ]);
      setApplications(internships);
      setJobApplications(jobs.items);

      if (saved.length > 0) {
        const allJobs = await fetchJobs();
        const savedJobMap = new Map(allJobs.map((j) => [j.id, j]));
        setSavedJobs(saved.map((id) => savedJobMap.get(id)).filter(Boolean) as Job[]);
      }
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

  const currentApps =
    activeTab === "internships"
      ? applications
      : activeTab === "jobs"
      ? jobApplications
      : savedJobs;
  const openCount = activeTab === "saved"
    ? 0
    : currentApps.filter(
        (a) => !["Accepted", "Rejected", "Withdrawn"].includes(a.status)
      ).length;

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Applications</h2>
          <p>
            {activeTab === "saved"
              ? `${savedJobs.length} saved job{savedJobs.length === 1 ? "" : "s"}`
              : `${currentApps.length} application{currentApps.length === 1 ? "" : "s"} · {openCount} open`}
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
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "saved" ? "btn-blue" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            <Icon name="check" size={13} /> Saved
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
                <th>{activeTab === "saved" ? "Closes" : "Applied"}</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading...</td>
                </tr>
              ) : !currentApps || currentApps.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--muted)",
                    }}
                  >
                    <span
                      style={{
                        opacity: 0.3,
                        display: "block",
                        marginBottom: "12px",
                      }}
                    >
                      <Icon
                        name={activeTab === "saved" ? "check" : "file-text"}
                        size={48}
                      />
                    </span>
                    <p>
                      {activeTab === "saved"
                        ? "No saved jobs yet"
                        : "No applications yet. Browse roles to get started."}
                    </p>
                    {activeTab === "saved" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-blue"
                        style={{ marginTop: "12px" }}
                        onClick={() => setActiveTab("jobs")}
                      >
                        <Icon name="brief" size={13} /> Browse Jobs
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                currentApps.map((app) => {
                  const isInternship = activeTab === "internships";
                  const isJob = activeTab === "jobs";
                  const isSaved = activeTab === "saved";
                  const appAny = app as ApplicationDto | JobApplicationDto | Job;
                  return (
                    <tr key={app.id}>
                      <td className="who" data-label="Role">
                        <b>
                          {isInternship
                            ? (appAny as ApplicationDto).placement_id
                            : isJob
                            ? (appAny as JobApplicationDto).job_id
                            : (appAny as Job).title}
                        </b>
                        <span>
                          {isInternship
                            ? "Internship"
                            : isJob
                            ? "Full time"
                            : (appAny as Job).employmentType}
                        </span>
                      </td>
                      <td data-label="Organisation">
                        {isInternship
                          ? "Employer"
                          : isJob
                          ? "Employer"
                          : (appAny as Job).orgName}
                      </td>
                      <td className="num" data-label={activeTab === "saved" ? "Closes" : "Applied"}>
                        {isInternship || isJob
                          ? (appAny as ApplicationDto | JobApplicationDto).created_at.split("T")[0]
                          : (appAny as Job).closesAt}
                      </td>
                      <td data-label="Status">
                        {isSaved ? (
                          <span className="tg green">Saved</span>
                        ) : (
                          <StatusBadge status={app.status} />
                        )}
                      </td>
                      <td className="act" data-label="Actions">
                        {isSaved && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setActiveTab("jobs")}
                          >
                            <Icon name="send" size={13} /> View & Apply
                          </button>
                        )}
                        {!isSaved &&
                          ["Submitted", "In Review"].includes(app.status) && (
                            <button
                              type="button"
                              className={`btn btn-sm ${withdrawing === app.id ? "btn-red" : ""}`}
                              disabled={withdrawing === app.id}
                              onClick={() =>
                                handleWithdraw(
                                  app.id,
                                  activeTab === "internships" ? "internship" : "job"
                                )
                              }
                            >
                              {withdrawing === app.id ? (
                                <>
                                  <div
                                    className="spinner"
                                    style={{
                                      width: "13px",
                                      height: "13px",
                                      border: "2px solid currentColor",
                                      borderRightColor: "transparent",
                                      borderRadius: "50%",
                                      animation: "spin 0.8s linear infinite",
                                      marginRight: "8px",
                                    }}
                                  />
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
    </>
  );
}