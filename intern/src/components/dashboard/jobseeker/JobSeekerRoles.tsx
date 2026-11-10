"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchJobs,
  applyToJob,
  isApiEnabled,
} from "../../../lib/api";
import { Job } from "../../../types";

export function JobSeekerRoles() {
  const { session, toast } = useApp();
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState("");
  const [applyingTo, setApplyingTo] = React.useState<string | null>(null);
  const [statement, setStatement] = React.useState("");
  const [applying, setApplying] = React.useState(false);

  React.useEffect(() => {
    if (!isApiEnabled || session?.role !== "jobseeker") {
      setState("ready");
      return;
    }
    fetchJobs()
      .then((items) => {
        setJobs(items);
        setState("ready");
      })
      .catch((cause) => {
        setError(cause instanceof ApiError ? cause.message : "Unable to load jobs");
        setState("error");
      });
  }, [session]);

  function openApply(jobId: string) {
    setApplyingTo(jobId);
    setStatement("");
  }

  async function submitApply() {
    if (!applyingTo) return;
    setApplying(true);
    try {
      await applyToJob(applyingTo, statement);
      toast("Application submitted!");
      setApplyingTo(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to submit application");
    } finally {
      setApplying(false);
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

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Graduate roles</h2>
          <p>Beyond internships · verified employers only</p>
        </div>
      </div>
      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Role</th>
                <th>Organisation</th>
                <th className="hide-xs">Location</th>
                <th>Pay</th>
                <th>Closes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state === "loading" ? (
                <tr><td colSpan={6}>Loading jobs...</td></tr>
              ) : state === "error" ? (
                <tr><td colSpan={6} className="error">{error}</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6}>No open jobs are available.</td></tr>
              ) : jobs.map((r) => (
                <tr key={r.id}>
                  <td className="who">
                    <b>{r.title}</b>
                    <span>{r.employmentType}</span>
                  </td>
                  <td>{r.orgName}</td>
                  <td className="hide-xs">{r.loc}</td>
                  <td className="num">{r.salary}</td>
                  <td className="num">{r.closesAt}</td>
                  <td className="act">
                    {r.status === "Open" ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-blue"
                        disabled={applying}
                        onClick={() => openApply(r.id)}
                      >
                        Apply
                      </button>
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {applyingTo && (
        <div className="panel" style={{ marginTop: "14px" }}>
          <div className="ph"><span className="lbl">Apply to role</span></div>
          <div className="pb" style={{ display: "grid", gap: "10px" }}>
            <textarea
              className="field"
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Write a brief statement about why you're a good fit..."
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setApplyingTo(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-blue"
                disabled={applying || !statement.trim()}
                onClick={submitApply}
              >
                {applying ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}