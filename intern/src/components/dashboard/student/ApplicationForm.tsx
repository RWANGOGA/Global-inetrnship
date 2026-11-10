"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { ApplicationInput } from "../../../lib/api";
import { Icon } from "../../icons/Icons";

interface ApplicationFormProps {
  placementId: string;
  onClose: () => void;
  onSubmit: (input: ApplicationInput) => Promise<void>;
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

function ReferenceFieldset({ index, form, handleChange }: { index: 1 | 2; form: ApplicationInput; handleChange: (key: string, value: string) => void }) {
  const ref = index === 1 ? "reference_1" : "reference_2";
  return (
    <fieldset style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px", background: "var(--white)" }}>
      <legend style={{ fontWeight: 600, fontSize: "11px", marginBottom: "10px", padding: "0 8px", color: "var(--ink)" }}>Reference {index}</legend>
      <div style={{ display: "grid", gap: "10px" }}>
        <div className="field">
          <label className="lbl">Full Name</label>
          <input
            type="text"
            className="field-input"
            placeholder="Full Name"
            value={form[`${ref}_name` as keyof ApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_name`, e.target.value)}
          />
        </div>
        <div className="field">
          <label className="lbl">Email</label>
          <input
            type="email"
            className="field-input"
            placeholder="email@example.com"
            value={form[`${ref}_email` as keyof ApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_email`, e.target.value)}
          />
        </div>
        <div className="field">
          <label className="lbl">Phone</label>
          <input
            type="tel"
            className="field-input"
            placeholder="+256 7XX XXX XXX"
            value={form[`${ref}_phone` as keyof ApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_phone`, e.target.value)}
          />
        </div>
        <div className="field">
          <label className="lbl">Relationship</label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g., Former Supervisor, Professor"
            value={form[`${ref}_relationship` as keyof ApplicationInput] as string}
            onChange={(e) => handleChange(`${ref}_relationship`, e.target.value)}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function ApplicationForm({ placementId, onClose, onSubmit }: ApplicationFormProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<ApplicationInput>({
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
      const input: ApplicationInput = {
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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px", padding: "20px" }}>
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
        <button
          type="button"
          className="btn btn-sm"
          onClick={onClose}
        >
          <Icon name="x" size={13} /> Cancel
        </button>
        <button
          type="submit"
          className="btn btn-sm btn-blue"
          disabled={submitting || !form.statement.trim()}
        >
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
        .file-input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </form>
  );
}