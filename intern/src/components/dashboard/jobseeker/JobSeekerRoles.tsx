"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchJobs,
  applyToJob,
  isApiEnabled,
  JobApplicationInput,
} from "../../../lib/api";
import { Job } from "../../../types";

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

function FileUpload({ label, accept, onChange, maxSizeMB = 5 }: { label: string; accept: string; onChange: (file: File | null) => void; maxSizeMB?: number }) {
  const [fileName, setFileName] = React.useState("");
  const [error, setError] = React.useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File must be less than ${maxSizeMB}MB`);
        setFileName("");
        onChange(null);
        return;
      }
      setFileName(file.name);
      setError("");
      onChange(file);
    }
  };

  return (
    <div>
      <label className="lbl">{label}</label>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="field"
        style={{ display: "none" }}
        id={`file-${label.replace(/\s+/g, "-").toLowerCase()}`}
      />
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => document.getElementById(`file-${label.replace(/\s+/g, "-").toLowerCase()}`)?.click()}
      >
        {fileName ? `📄 ${fileName}` : "Choose file"}
      </button>
      {fileName && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => { setFileName(""); onChange(null); }}
          style={{ marginLeft: "8px" }}
        >
          Remove
        </button>
      )}
      {error && <span className="error" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>{error}</span>}
      <span className="hint" style={{ fontSize: "11px", color: "var(--ink-2)" }}>
        PDF only, max {maxSizeMB}MB
      </span>
    </div>
  );
}

export function JobSeekerRoles() {
  const { session, toast } = useApp();
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState("");
  const [applyingTo, setApplyingTo] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [form, setForm] = React.useState<JobApplicationInput>({
    statement: "",
    cover_letter: "",
    cv_url: "",
    github_url: "",
    linkedin_url: "",
    portfolio_url: "",
    academic_papers: [],
    reference_1_name: "",
    reference_1_email: "",
    reference_1_phone: "",
    reference_1_relationship: "",
    reference_2_name: "",
    reference_2_email: "",
    reference_2_phone: "",
    reference_2_relationship: "",
    document_ids: [],
  });
  const [cvFile, setCvFile] = React.useState<File | null>(null);

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
    setForm({
      statement: "",
      cover_letter: "",
      cv_url: "",
      github_url: "",
      linkedin_url: "",
      portfolio_url: "",
      academic_papers: [],
      reference_1_name: "",
      reference_1_email: "",
      reference_1_phone: "",
      reference_1_relationship: "",
      reference_2_name: "",
      reference_2_email: "",
      reference_2_phone: "",
      reference_2_relationship: "",
      document_ids: [],
    });
    setCvFile(null);
  }

  async function submitApply() {
    if (!applyingTo) return;
    setApplying(true);
    try {
      const input: JobApplicationInput = {
        ...form,
        cv_url: form.cv_url,
        academic_papers: form.academic_papers.filter(Boolean),
        document_ids: form.document_ids.filter(Boolean),
      };
      await applyToJob(applyingTo, input);
      toast("Application submitted successfully!");
      setApplyingTo(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to submit application");
    } finally {
      setApplying(false);
    }
  }

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleArrayChange = (key: string, value: string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
          <div className="pb" style={{ display: "grid", gap: "16px" }}>
            {/* Personal Statement */}
            <div>
              <label className="lbl">Personal Statement *</label>
              <textarea
                className="field"
                rows={4}
                value={form.statement}
                onChange={(e) => handleChange("statement", e.target.value)}
                placeholder="Tell us why you're a great fit for this role..."
                required
              />
            </div>

            {/* Cover Letter */}
            <div>
              <label className="lbl">Cover Letter</label>
              <textarea
                className="field"
                rows={4}
                value={form.cover_letter}
                onChange={(e) => handleChange("cover_letter", e.target.value)}
                placeholder="Optional: Upload or paste your cover letter..."
              />
            </div>

            {/* CV/Resume Upload */}
            <FileUpload
              label="CV / Resume (PDF, max 5MB)"
              accept=".pdf"
              onChange={(file) => {
                setCvFile(file);
                if (file) {
                  // In a real app, you'd upload to a storage service and get a URL
                  // For now, we'll store the file name as a placeholder
                  setForm((prev) => ({ ...prev, cv_url: file.name }));
                } else {
                  setForm((prev) => ({ ...prev, cv_url: "" }));
                }
              }}
            />

            {/* Links Section */}
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <div>
                <label className="lbl">GitHub Profile</label>
                <input
                  type="url"
                  className="field"
                  value={form.github_url}
                  onChange={(e) => handleChange("github_url", e.target.value)}
                  placeholder="https://github.com/username"
                />
              </div>
              <div>
                <label className="lbl">LinkedIn Profile</label>
                <input
                  type="url"
                  className="field"
                  value={form.linkedin_url}
                  onChange={(e) => handleChange("linkedin_url", e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <label className="lbl">Portfolio / Personal Website</label>
                <input
                  type="url"
                  className="field"
                  value={form.portfolio_url}
                  onChange={(e) => handleChange("portfolio_url", e.target.value)}
                  placeholder="https://your-portfolio.com"
                />
              </div>
            </div>

            {/* Academic Papers */}
            <div>
              <label className="lbl">Academic Papers / Publications (one URL per line)</label>
              <textarea
                className="field"
                rows={3}
                value={form.academic_papers.join("\n")}
                onChange={(e) => handleArrayChange("academic_papers", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                placeholder="https://example.com/paper1.pdf&#10;https://example.com/paper2.pdf"
              />
            </div>

            {/* References */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <h4 style={{ marginBottom: "12px" }}>Professional References</h4>
              <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {/* Reference 1 */}
                <fieldset style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                  <legend style={{ fontWeight: 600, marginBottom: "8px" }}>Reference 1</legend>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <input
                      type="text"
                      className="field"
                      placeholder="Full Name"
                      value={form.reference_1_name}
                      onChange={(e) => handleChange("reference_1_name", e.target.value)}
                    />
                    <input
                      type="email"
                      className="field"
                      placeholder="Email"
                      value={form.reference_1_email}
                      onChange={(e) => handleChange("reference_1_email", e.target.value)}
                    />
                    <input
                      type="tel"
                      className="field"
                      placeholder="Phone"
                      value={form.reference_1_phone}
                      onChange={(e) => handleChange("reference_1_phone", e.target.value)}
                    />
                    <input
                      type="text"
                      className="field"
                      placeholder="Relationship (e.g., Former Supervisor, Professor)"
                      value={form.reference_1_relationship}
                      onChange={(e) => handleChange("reference_1_relationship", e.target.value)}
                    />
                  </div>
                </fieldset>

                {/* Reference 2 */}
                <fieldset style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                  <legend style={{ fontWeight: 600, marginBottom: "8px" }}>Reference 2</legend>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <input
                      type="text"
                      className="field"
                      placeholder="Full Name"
                      value={form.reference_2_name}
                      onChange={(e) => handleChange("reference_2_name", e.target.value)}
                    />
                    <input
                      type="email"
                      className="field"
                      placeholder="Email"
                      value={form.reference_2_email}
                      onChange={(e) => handleChange("reference_2_email", e.target.value)}
                    />
                    <input
                      type="tel"
                      className="field"
                      placeholder="Phone"
                      value={form.reference_2_phone}
                      onChange={(e) => handleChange("reference_2_phone", e.target.value)}
                    />
                    <input
                      type="text"
                      className="field"
                      placeholder="Relationship (e.g., Former Supervisor, Professor)"
                      value={form.reference_2_relationship}
                      onChange={(e) => handleChange("reference_2_relationship", e.target.value)}
                    />
                  </div>
                </fieldset>
              </div>
            </div>

            {/* Additional Documents */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <h4 style={{ marginBottom: "12px" }}>Additional Documents</h4>
              <p className="hint" style={{ fontSize: "12px", color: "var(--ink-2)", marginBottom: "12px" }}>
                Upload reference letters, transcripts, certificates, etc. (PDF, max 5MB each)
              </p>
              <FileUpload
                label="Reference Letter 1"
                accept=".pdf"
                onChange={(file) => {
                  if (file) {
                    setForm((prev) => ({ ...prev, document_ids: [...prev.document_ids, file.name] }));
                  }
                }}
              />
              <FileUpload
                label="Reference Letter 2"
                accept=".pdf"
                onChange={(file) => {
                  if (file) {
                    setForm((prev) => ({ ...prev, document_ids: [...prev.document_ids, file.name] }));
                  }
                }}
              />
              <FileUpload
                label="Transcript / Certificate"
                accept=".pdf"
                onChange={(file) => {
                  if (file) {
                    setForm((prev) => ({ ...prev, document_ids: [...prev.document_ids, file.name] }));
                  }
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
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
                disabled={applying || !form.statement.trim()}
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