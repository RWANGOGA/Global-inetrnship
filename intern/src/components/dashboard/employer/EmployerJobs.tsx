"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchOrganizationJobs,
  createOrganizationJob,
  isApiEnabled,
  exportOrgJobsCsv,
  exportOrgPlacementsCsv,
} from "../../../lib/api";
import { Job, JobPostingInput } from "../../../types";
import { Icon } from "../../icons/Icons";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Open: "green",
    Closing: "amber",
    Closed: "red",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    amber: "tg gold",
    red: "tg red",
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

export function EmployerJobs() {
  const { session, toast } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<JobPostingInput>({
    title: "",
    loc: "",
    mode: "On-site",
    employment_type: "Full time",
    salary: "",
    closes_at: "",
    summary: "",
    requirements: [],
  });

  const handleExportJobs = async () => {
    try {
      const blob = await exportOrgJobsCsv();
      downloadBlob(blob, "my_jobs.csv");
      toast("Jobs exported!");
    } catch {
      toast("Failed to export jobs");
    }
  };

  const handleExportPlacements = async () => {
    try {
      const blob = await exportOrgPlacementsCsv();
      downloadBlob(blob, "my_placements.csv");
      toast("Placements exported!");
    } catch {
      toast("Failed to export placements");
    }
  };

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "employer") {
      setLoading(false);
      return;
    }
    loadJobs();
  }, [session]);

  async function loadJobs() {
    setLoading(true);
    try {
      const items = await fetchOrganizationJobs();
      setJobs(items);
      setLoading(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load jobs");
      setLoading(false);
    }
  }

  function handleChange(key: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createOrganizationJob(form);
      toast("Job posted successfully!");
      setShowCreate(false);
      setForm({
        title: "",
        loc: "",
        mode: "On-site",
        employment_type: "Full time",
        salary: "",
        closes_at: "",
        summary: "",
        requirements: [],
      });
      loadJobs();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to create job");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>My job postings</h2>
          <p>Full-time & graduate roles for verified employers</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportJobs}
          >
            <Icon name="download" size={13} /> Export Jobs
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportPlacements}
          >
            <Icon name="download" size={13} /> Export Placements
          </button>
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={() => setShowCreate(true)}
          >
            <Icon name="plus" size={13} /> Post a job
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <div className="ph">
            <span className="lbl">Create job posting</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowCreate(false)}
              style={{ padding: 0 }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="pb" style={{ display: "grid", gap: "16px", padding: "20px" }}>
            <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <div className="field">
                <label className="lbl">Job title <span style={{ color: "var(--red)" }}>*</span></label>
                <input
                  type="text"
                  className="field-input"
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  required
                  placeholder="e.g., Senior Software Engineer"
                />
              </div>
              <div className="field">
                <label className="lbl">Location</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.loc}
                  onChange={(e) => handleChange("loc", e.target.value)}
                  placeholder="Kampala, Uganda"
                />
              </div>
              <div className="field">
                <label className="lbl">Work mode</label>
                <select
                  className="field-input"
                  value={form.mode}
                  onChange={(e) => handleChange("mode", e.target.value)}
                >
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
              <div className="field">
                <label className="lbl">Employment type</label>
                <select
                  className="field-input"
                  value={form.employment_type}
                  onChange={(e) => handleChange("employment_type", e.target.value)}
                >
                  <option value="Full time">Full time</option>
                  <option value="Part time">Part time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div className="field">
                <label className="lbl">Salary</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.salary}
                  onChange={(e) => handleChange("salary", e.target.value)}
                  placeholder="e.g. $5,000/month or UGX 2,000,000/month"
                />
              </div>
              <div className="field">
                <label className="lbl">Closes on <span style={{ color: "var(--red)" }}>*</span></label>
                <input
                  type="date"
                  className="field-input"
                  value={form.closes_at}
                  onChange={(e) => handleChange("closes_at", e.target.value)}
                  required
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <div className="field">
              <label className="lbl">Summary</label>
              <textarea
                className="field-input"
                rows={3}
                value={form.summary}
                onChange={(e) => handleChange("summary", e.target.value)}
                placeholder="Brief description of the role..."
                style={{ minHeight: "80px" }}
              />
            </div>
            <div className="field">
              <label className="lbl">Requirements (one per line)</label>
              <textarea
                className="field-input"
                rows={4}
                value={form.requirements.join("\n")}
                onChange={(e) => handleChange("requirements", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                placeholder="Python&#10;React&#10;3+ years experience"
                style={{ minHeight: "100px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--rule)", paddingTop: "16px", marginTop: "8px" }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowCreate(false)}>
                <Icon name="x" size={13} /> Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-blue" disabled={creating}>
                {creating ? (
                  <>
                    <div className="spinner" style={{ width: "13px", height: "13px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "8px" }} />
                    Posting...
                  </>
                ) : (
                  <>
                    <Icon name="send" size={13} /> Post job
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Pay</th>
                  <th>Closes</th>
                  <th>Status</th>
                  <th>Applicants</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}>Loading...</td></tr>
                ) : jobs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "var(--muted)" }}>
                      <span style={{ opacity: 0.3, display: "block" }}>
                        <Icon name="brief" size={48} />
                      </span>
                      <span>No jobs posted yet</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-blue"
                        onClick={() => setShowCreate(true)}
                      >
                        <Icon name="plus" size={13} /> Post your first job
                      </button>
                    </div>
                  </td></tr>
                ) : jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="who">
                      <b>{j.title}</b>
                      <span>{j.employmentType}</span>
                    </td>
                    <td>{j.loc}</td>
                    <td>{j.mode}</td>
                    <td className="num">{j.salary}</td>
                    <td className="num">{j.closesAt}</td>
                    <td><StatusBadge status={j.status} /></td>
                    <td className="num">{j.applicants || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .field-input {
          border: 1px solid var(--rule-2);
          border-radius: var(--r-sm);
          background: var(--white);
          height: 40px;
          padding: 0 12px;
          font-size: 13px;
          outline: 0;
          width: 100%;
        }
        .field-input:focus {
          border-color: var(--blue);
        }
        .field textarea.field-input {
          height: 84px;
          padding: 10px 12px;
          resize: vertical;
        }
      `}</style>
    </>
  );
}