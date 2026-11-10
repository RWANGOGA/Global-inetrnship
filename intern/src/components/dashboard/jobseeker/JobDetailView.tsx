"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { fetchJobDetail, applyToJob, isApiEnabled, JobApplicationInput, toggleSavedJob } from "../../../lib/api";
import { Job } from "../../../types";
import { Icon, IconName } from "../../icons/Icons";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Open: "green",
    Closing: "amber",
    Closed: "red",
    Draft: "ink",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    amber: "tg gold",
    red: "tg red",
    ink: "tg dark",
  };
  return <span className={classMap[color] || "tg"}>{status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "Full time": "blue",
    "Part time": "green",
    Contract: "gold",
    Internship: "blue",
  };
  const color = colors[type] || "blue";
  return (
    <span
      className="tg"
      style={{
        background: `var(--${color}-tint)`,
        color: `var(--${color})`,
        textTransform: "capitalize",
      }}
    >
      {type}
    </span>
  );
}

function DetailSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: IconName }) {
  return (
    <section style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        {icon && (
          <span style={{ color: "var(--blue)" }}>
            <Icon name={icon} size={20} />
          </span>
        )}
        <h3 style={{ fontWeight: 700, fontSize: "16px", margin: 0, color: "var(--ink)" }}>{title}</h3>
      </div>
      <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string | React.ReactNode; icon?: IconName }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
      {icon && (
        <span style={{ color: "var(--muted)", marginTop: "2px", flexShrink: 0 }}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "2px" }}>{label}</span>
        <span style={{ fontSize: "14px", color: "var(--ink)" }}>{value}</span>
      </div>
    </div>
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

  const clearFile = () => {
    setFileName("");
    onChange(null);
  };

  return (
    <div className="field">
      <label className="lbl">{label}</label>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        id={`file-${label.replace(/\s+/g, "-").toLowerCase()}`}
        className="file-input"
        style={{ display: "none" }}
      />
      <button
        type="button"
        className={`btn btn-sm ${fileName ? "btn-blue" : ""}`}
        onClick={() => document.getElementById(`file-${label.replace(/\s+/g, "-").toLowerCase()}`)?.click()}
      >
        {fileName ? (
          <>
            <Icon name="doc" size={13} /> {fileName}
          </>
        ) : (
          <>
            <Icon name="upload" size={13} /> Choose file
          </>
        )}
      </button>
      {fileName && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={clearFile}
          style={{ marginLeft: "8px" }}
        >
          <Icon name="trash" size={13} /> Remove
        </button>
      )}
      {error && <span className="error" style={{ fontSize: "11px", marginTop: "4px", display: "block", color: "var(--red)" }}>{error}</span>}
      <span className="hint" style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
        PDF only, max {maxSizeMB}MB
      </span>
    </div>
  );
}

function SectionTitle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px", marginTop: "16px" }}>
      <legend style={{ fontWeight: 600, fontSize: "12px", marginBottom: "12px", padding: "0 8px", color: "var(--ink)" }}>{title}</legend>
      <div style={{ display: "grid", gap: "12px" }}>{children}</div>
    </fieldset>
  );
}

function ReferenceFieldset({ index, form, handleChange }: { index: 1 | 2; form: JobApplicationInput; handleChange: (key: string, value: string) => void }) {
  const ref = index === 1 ? "reference_1" : "reference_2";
  return (
    <fieldset style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px", background: "var(--white)" }}>
      <legend style={{ fontWeight: 600, fontSize: "11px", marginBottom: "10px", padding: "0 8px" }}>Reference {index}</legend>
      <div style={{ display: "grid", gap: "10px" }}>
        <div className="field">
          <label className="lbl">Full Name</label>
          <input
            type="text"
            className="field-input"
            placeholder="Full Name"
            value={form[`${ref}_name` as keyof JobApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_name`, e.target.value)}
          />
        </div>
        <div className="field">
          <label className="lbl">Email</label>
          <input
            type="email"
            className="field-input"
            placeholder="email@example.com"
            value={form[`${ref}_email` as keyof JobApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_email`, e.target.value)}
          />
        </div>
        <div className="field">
          <label className="lbl">Phone</label>
          <input
            type="tel"
            className="field-input"
            placeholder="+256 7XX XXX XXX"
            value={form[`${ref}_phone` as keyof JobApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_phone`, e.target.value)}
          />
        </div>
        <div className="field">
          <label className="lbl">Relationship</label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g., Former Supervisor, Professor"
            value={form[`${ref}_relationship` as keyof JobApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_relationship`, e.target.value)}
          />
        </div>
      </div>
    </fieldset>
  );
}

function SaveButton({ isSaved, onClick, disabled, title }: { isSaved: boolean; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${isSaved ? "btn-blue" : "btn-ghost"}`}
      onClick={onClick}
      disabled={disabled}
      style={{ minWidth: "44px", height: "40px", padding: "0 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s" }}
      title={title}
    >
      <Icon name={isSaved ? "check" : "plus"} size={15} />
      <span style={{ fontSize: "12px", fontWeight: 500, display: "none" }}>{isSaved ? "Saved" : "Save"}</span>
    </button>
  );
}

interface JobDetailViewProps {
  jobId: string;
  onClose: () => void;
}

export function JobDetailView({ jobId, onClose }: JobDetailViewProps) {
  const { session, toast } = useApp();
  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [applying, setApplying] = React.useState(false);
  const [showApply, setShowApply] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    loadJob();
  }, [jobId]);

  async function loadJob() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJobDetail(jobId);
      setJob(data);
    } catch (cause) {
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!session) {
      toast("Please sign in to save jobs");
      return;
    }
    try {
      const isNowSaved = await toggleSavedJob(jobId);
      setSaved(isNowSaved);
      toast(isNowSaved ? "Job saved" : "Job removed from saved");
    } catch {
      toast("Failed to update saved jobs");
    }
  }

  async function handleApply() {
    setShowApply(true);
  }

  async function submitApply(input: JobApplicationInput) {
    setApplying(true);
    try {
      await applyToJob(jobId, input);
      toast("Application submitted successfully!");
      setShowApply(false);
    } catch (cause) {
      const errorMsg = cause instanceof Error ? cause.message : "Unable to submit application";
      setError(errorMsg);
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--muted)" }}>Loading job details...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <span style={{ opacity: 0.5, marginBottom: "16px", display: "block" }}>
          <Icon name="bell" size={48} />
        </span>
        <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>Unable to load job</h3>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>{error}</p>
        <button type="button" className="btn btn-blue" onClick={onClose}>
          <span style={{ marginRight: "8px" }}>
            <Icon name="x" size={14} />
          </span> Close
        </button>
      </div>
    );
  }

  if (!job) return null;

  const isJobOpen = job.status === "Open";
  const org = job.org;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <h1 style={{ fontWeight: 800, fontSize: "28px", margin: 0, color: "var(--ink)" }}>{job.title}</h1>
            {job.status && <StatusBadge status={job.status} />}
          </div>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", margin: 0 }}>
            {org?.name || "Employer"} · {job.loc} · {job.employmentType}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <SaveButton
            isSaved={saved}
            onClick={handleSave}
            title={saved ? "Remove from saved" : "Save job"}
          />
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      {job.salary && (
        <div style={{ marginBottom: "24px", padding: "16px 20px", background: "var(--blue-tint)", borderRadius: "var(--r-lg)", border: "1px solid var(--blue)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "var(--blue)" }}>
              <Icon name="doc" size={24} />
            </span>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block" }}>Salary</span>
              <span style={{ fontWeight: 700, fontSize: "20px", color: "var(--blue)" }}>{job.salary}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: "24px" }}>
        <InfoRow label="Work Mode" value={job.mode} icon="brief" />
        <InfoRow label="Type" value={<TypeBadge type={job.employmentType} />} />
        <InfoRow label="Location" value={job.loc} icon="brief" />
        <InfoRow label="Closes" value={job.closesAt} icon="clock" />
        <InfoRow label="Published" value={job.publishedAt ? job.publishedAt.split("T")[0] : "—"} icon="clock" />
        <InfoRow label="Applicants" value={job.applicants !== undefined ? String(job.applicants) : "—"} icon="user" />
      </div>

      <DetailSection title="About this Role" icon="brief">
        <p style={{ whiteSpace: "pre-wrap" }}>{job.summary || "No description provided."}</p>
      </DetailSection>

      {job.requirements?.length && (
        <DetailSection title="Requirements" icon="brief">
          <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "8px" }}>
            {job.requirements.map((req, i) => (
              <li key={i} style={{ lineHeight: 1.6, color: "var(--ink-2)" }}>{req}</li>
            ))}
          </ul>
        </DetailSection>
      )}

      {org?.about && (
        <DetailSection title="About the Organisation" icon="bldg">
          <p style={{ whiteSpace: "pre-wrap", color: "var(--ink-2)" }}>{org.about}</p>
        </DetailSection>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--rule)" }}>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <span style={{ marginRight: "8px" }}>
            <Icon name="x" size={13} />
          </span> Close
        </button>
        {isJobOpen && session && !applying && (
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={handleApply}
            style={{ minWidth: "180px" }}
          >
            <span style={{ marginRight: "8px" }}>
              <Icon name="send" size={13} />
            </span> Apply Now
          </button>
        )}
        {!isJobOpen && (
          <button type="button" className="btn btn-sm" disabled style={{ minWidth: "180px" }}>
            <span style={{ marginRight: "8px" }}>
              <Icon name="x" size={13} />
            </span> Not Accepting Applications
          </button>
        )}
        {!session && isJobOpen && (
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={() => { onClose(); (window as any).go?.("signin"); }}
            style={{ minWidth: "180px" }}
          >
            <span style={{ marginRight: "8px" }}>
              <Icon name="user" size={13} />
            </span> Sign in to Apply
          </button>
        )}
      </div>

      {showApply && (
        <ApplicationForm
          jobId={jobId}
          onClose={() => setShowApply(false)}
          onSubmit={submitApply}
        />
      )}
    </>
  );
}

function ApplicationForm({ jobId, onClose, onSubmit }: { jobId: string; onClose: () => void; onSubmit: (input: JobApplicationInput) => Promise<void> }) {
  const [submitting, setSubmitting] = React.useState(false);
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

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleArrayChange = (key: string, value: string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.statement.trim()) return;
    setSubmitting(true);
    try {
      const input: JobApplicationInput = {
        ...form,
        cv_url: form.cv_url,
        academic_papers: form.academic_papers.filter(Boolean),
        document_ids: form.document_ids.filter(Boolean),
      };
      await onSubmit(input);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: "24px", background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
      <div className="ph" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="lbl">Application Form</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} style={{ padding: 0 }}>
          <Icon name="x" size={15} />
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: "24px", display: "grid", gap: "20px" }}>
        <div className="field">
          <label className="lbl">Personal Statement <span style={{ color: "var(--red)" }}>*</span></label>
          <textarea
            className="field-input"
            rows={5}
            value={form.statement}
            onChange={(e) => handleChange("statement", e.target.value)}
            placeholder="Tell us why you're a great fit for this role... Highlight your relevant experience, skills, and motivation."
            required
            style={{ minHeight: "120px" }}
          />
        </div>

        <div className="field">
          <label className="lbl">Cover Letter</label>
          <textarea
            className="field-input"
            rows={4}
            value={form.cover_letter}
            onChange={(e) => handleChange("cover_letter", e.target.value)}
            placeholder="Optional: Paste or write your cover letter here..."
            style={{ minHeight: "100px" }}
          />
        </div>

        <FileUpload
          label="CV / Resume (PDF, max 5MB)"
          accept=".pdf"
          onChange={(file) => {
            setCvFile(file);
            if (file) {
              setForm((prev) => ({ ...prev, cv_url: file.name }));
            } else {
              setForm((prev) => ({ ...prev, cv_url: "" }));
            }
          }}
        />

        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div className="field">
            <label className="lbl">GitHub Profile</label>
            <input
              type="url"
              className="field-input"
              value={form.github_url}
              onChange={(e) => handleChange("github_url", e.target.value)}
              placeholder="https://github.com/username"
            />
          </div>
          <div className="field">
            <label className="lbl">LinkedIn Profile</label>
            <input
              type="url"
              className="field-input"
              value={form.linkedin_url}
              onChange={(e) => handleChange("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </div>
          <div className="field">
            <label className="lbl">Portfolio / Personal Website</label>
            <input
              type="url"
              className="field-input"
              value={form.portfolio_url}
              onChange={(e) => handleChange("portfolio_url", e.target.value)}
              placeholder="https://your-portfolio.com"
            />
          </div>
        </div>

        <div className="field">
          <label className="lbl">Academic Papers / Publications (one URL per line)</label>
          <textarea
            className="field-input"
            rows={3}
            value={form.academic_papers.join("\n")}
            onChange={(e) => handleArrayChange("academic_papers", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
            placeholder="https://example.com/paper1.pdf&#10;https://example.com/paper2.pdf"
            style={{ minHeight: "80px" }}
          />
        </div>

        <SectionTitle title="Professional References">
          <ReferenceFieldset index={1} form={form} handleChange={handleChange} />
          <ReferenceFieldset index={2} form={form} handleChange={handleChange} />
        </SectionTitle>

        <SectionTitle title="Additional Documents">
          <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "12px" }}>
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
        </SectionTitle>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--rule)", paddingTop: "16px", marginTop: "8px" }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            <Icon name="x" size={13} /> Cancel
          </button>
          <button type="submit" className="btn btn-sm btn-blue" disabled={submitting || !form.statement.trim()}>
            {submitting ? (
              <>
                <div className="spinner" style={{ width: "13px", height: "13px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "8px" }} />
                Submitting...
              </>
            ) : (
              <>
                <Icon name="send" size={13} /> Submit Application
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}