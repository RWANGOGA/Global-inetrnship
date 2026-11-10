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
  exportOrgPlacementApplicantsCsv,
  exportOrgJobApplicantsCsv,
} from "../../../lib/api";
import { Job, JobPostingInput } from "../../../types";

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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
      Open: "green",
      Closing: "amber",
      Closed: "red",
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
          <h2>My job postings</h2>
          <p>Full-time & graduate roles for verified employers</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportJobs}
          >
            Export Jobs CSV
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportPlacements}
          >
            Export Placements CSV
          </button>
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={() => setShowCreate(true)}
          >
            Post a job
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <div className="ph"><span className="lbl">Create job posting</span></div>
          <form onSubmit={handleSubmit} className="pb" style={{ display: "grid", gap: "14px" }}>
            <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <div>
                <label className="lbl">Job title</label>
                <input
                  type="text"
                  className="field"
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="lbl">Location</label>
                <input
                  type="text"
                  className="field"
                  value={form.loc}
                  onChange={(e) => handleChange("loc", e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Work mode</label>
                <select
                  className="field"
                  value={form.mode}
                  onChange={(e) => handleChange("mode", e.target.value)}
                >
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
              <div>
                <label className="lbl">Employment type</label>
                <select
                  className="field"
                  value={form.employment_type}
                  onChange={(e) => handleChange("employment_type", e.target.value)}
                >
                  <option value="Full time">Full time</option>
                  <option value="Part time">Part time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div>
                <label className="lbl">Salary</label>
                <input
                  type="text"
                  className="field"
                  value={form.salary}
                  onChange={(e) => handleChange("salary", e.target.value)}
                  placeholder="e.g. $5,000/month or UGX 2,000,000/month"
                />
              </div>
              <div>
                <label className="lbl">Closes on</label>
                <input
                  type="date"
                  className="field"
                  value={form.closes_at}
                  onChange={(e) => handleChange("closes_at", e.target.value)}
                  required
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <div>
              <label className="lbl">Summary</label>
              <textarea
                className="field"
                rows={3}
                value={form.summary}
                onChange={(e) => handleChange("summary", e.target.value)}
                placeholder="Brief description of the role..."
              />
            </div>
            <div>
              <label className="lbl">Requirements (one per line)</label>
              <textarea
                className="field"
                rows={4}
                value={form.requirements.join("\n")}
                onChange={(e) => handleChange("requirements", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                placeholder="Python&#10;React&#10;3+ years experience"
              />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-blue" disabled={creating}>
                {creating ? "Posting..." : "Post job"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
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
                <tr><td colSpan={7}>No jobs posted yet. Click "Post a job" to create one.</td></tr>
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
    </>
  );
}