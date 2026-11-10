"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  createOrganizationInternship,
  fetchOrganizationInternships,
  isApiEnabled,
  exportOrgPlacementsCsv,
} from "../../../lib/api";
import { Placement } from "../../../types";
import { Icon } from "../../icons/Icons";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: "green",
    pending_review: "amber",
    rejected: "red",
  };
  const color = colors[status] || "ink";
  const classMap: Record<string, string> = {
    green: "tg green",
    amber: "tg gold",
    red: "tg red",
  };
  return <span className={classMap[color] || "tg"}>{status.replace("_", " ")}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    internship: "blue",
    gig: "green",
    entry_level: "gold",
  };
  const color = colors[type] || "blue";
  return (
    <span
      className="tg"
      style={{
        background: `var(--${color})`,
        color: "white",
        textTransform: "capitalize",
      }}
    >
      {type.replace("_", " ")}
    </span>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SectionTitle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: "16px", marginTop: "8px" }}>
      <legend style={{ fontWeight: 600, fontSize: "12px", marginBottom: "12px", padding: "0 8px", color: "var(--ink)" }}>{title}</legend>
      <div style={{ display: "grid", gap: "12px" }}>{children}</div>
    </fieldset>
  );
}

function FieldGroup({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div style={{ display: "grid", gap: "14px", gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}

function Field({ label, required, children, error, hint }: { label: string; required?: boolean; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <div className="field">
      <label className="lbl">{label} {required && <span style={{ color: "var(--red)" }}>*</span>}</label>
      {children}
      {error && <span className="error" style={{ fontSize: "11px", marginTop: "4px", display: "block", color: "var(--red)" }}>{error}</span>}
      {hint && <span className="hint" style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "4px", display: "block" }}>{hint}</span>}
    </div>
  );
}

export function EmployerPlacements() {
  const { subscription, isPremium, freeAllowance, employerLiveCount, session, toast } = useApp();
  const [employerPlacements, setEmployerPlacements] = React.useState<Placement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [form, setForm] = React.useState({
    title: "",
    courses: "",
    grade: "",
    loc: "",
    mode: "On-site",
    duration: "",
    stipend: "",
    slots: "1",
    about: "",
    requirements: "",
    closesAt: "",
    startsAt: "",
    opportunityType: "internship",
    durationHours: "",
    budgetRange: "",
    milestones: "",
    remoteOk: false,
    salaryRange: "",
    probationPeriod: "",
    trainingIncluded: false,
    careerPath: "",
    skillsRequired: "",
  });
  const remaining = Math.max(0, freeAllowance - employerLiveCount);

  React.useEffect(() => {
    if (!isApiEnabled || session?.role !== "employer") {
      setLoading(false);
      return;
    }
    fetchOrganizationInternships()
      .then(setEmployerPlacements)
      .catch((cause) => {
        setError(cause instanceof ApiError ? cause.message : "Unable to load internships");
      })
      .finally(() => setLoading(false));
  }, [session]);

  async function submitPosting(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const postingData: any = {
        title: form.title,
        courses: form.courses.split(",").map((value) => value.trim()).filter(Boolean),
        grade: form.grade,
        loc: form.loc,
        mode: form.mode,
        duration: form.duration,
        stipend: form.stipend,
        slots: Number(form.slots) || 1,
        about: form.about,
        duties: [],
        requirements: form.requirements.split("\n").map((value) => value.trim()).filter(Boolean),
        docs: [],
        testimonial: false,
        published_at: new Date().toISOString().slice(0, 10),
        closes_at: form.closesAt,
        starts_at: form.startsAt,
        opportunity_type: form.opportunityType,
      };

      if (form.opportunityType === "gig") {
        postingData.duration_hours = form.durationHours ? Number(form.durationHours) : null;
        postingData.budget_range = form.budgetRange || null;
        postingData.milestones = form.milestones.split("\n").map((value) => value.trim()).filter(Boolean);
        postingData.remote_ok = form.remoteOk;
      }

      if (form.opportunityType === "entry_level") {
        postingData.salary_range = form.salaryRange || null;
        postingData.probation_period = form.probationPeriod || null;
        postingData.training_included = form.trainingIncluded;
        postingData.career_path = form.careerPath || null;
      }

      if (form.skillsRequired) {
        postingData.skills_required = form.skillsRequired.split(",").map((value) => value.trim()).filter(Boolean);
      }

      const created = await createOrganizationInternship(postingData);
      setEmployerPlacements((current) => [created, ...current]);
      setShowForm(false);
      setForm({
        title: "", courses: "", grade: "", loc: "", mode: "On-site",
        duration: "", stipend: "", slots: "1", about: "", requirements: "",
        closesAt: "", startsAt: "",
        opportunityType: "internship",
        durationHours: "", budgetRange: "", milestones: "", remoteOk: false,
        salaryRange: "", probationPeriod: "", trainingIncluded: false, careerPath: "",
        skillsRequired: "",
      });
      toast("Placement submitted for review!");
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Unable to submit placement");
    } finally {
      setSaving(false);
    }
  }

  const handleExport = async () => {
    try {
      const blob = await exportOrgPlacementsCsv();
      downloadBlob(blob, "my_placements.csv");
      toast("Placements exported!");
    } catch {
      toast("Failed to export placements");
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minClosesAt = tomorrow.toISOString().split("T")[0];

  return (
    <>
      <div className="dpane-h" style={{ flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: "280px" }}>
          <h2 style={{ fontWeight: 700, fontSize: "22px", marginBottom: "4px" }}>My Placements</h2>
          <p style={{ color: "var(--ink-2)", fontSize: "13px" }}>
            {employerLiveCount} published ·{" "}
            {isPremium ? (
              <>
                <b>{subscription.plan}</b> plan · unlimited postings
                {subscription.since ? ` since ${subscription.since}` : ""}
              </>
            ) : (
              <>
                {remaining} free posting{remaining === 1 ? "" : "s"} left, then a placement fee applies
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sm" onClick={handleExport}>
            <Icon name="download" size={13} /> Export CSV
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showForm ? "btn-blue" : ""}`}
            onClick={() => setShowForm((current) => !current)}
          >
            <Icon name={showForm ? "x" : "plus"} size={13} /> {showForm ? "Close form" : "New placement"}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="panel" onSubmit={submitPosting} style={{ marginBottom: "20px" }}>
          <div className="ph" style={{ textAlign: "center", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
            <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "4px" }}>Submit Placement for Review</h3>
            <p style={{ color: "var(--ink-2)", fontSize: "13px" }}>All fields marked with * are required. Your posting will be reviewed by the placement office before going live.</p>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowForm(false)}
              style={{ position: "absolute", right: "16px", top: "16px", padding: 0 }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>

          <div className="pb" style={{ display: "grid", gap: "18px", padding: "24px" }}>
            {formError && (
              <div className="panel" style={{ background: "var(--red-tint)", border: "1px solid var(--red)", borderRadius: "var(--r-md)", padding: "12px 16px", color: "var(--red)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="bell" size={14} />
                {formError}
              </div>
            )}

            <SectionTitle title="Basic Information">
              <FieldGroup columns={2}>
                <Field label="Placement Title" required>
                  <input
                    type="text"
                    className="field-input"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Software Engineering Intern"
                  />
                </Field>
                <Field label="Opportunity Type" required>
                  <select
                    className="field-input"
                    required
                    value={form.opportunityType}
                    onChange={(e) => setForm({ ...form, opportunityType: e.target.value })}
                  >
                    <option value="internship">Internship</option>
                    <option value="gig">Gig / Short-term Project</option>
                    <option value="entry_level">Entry-level Position</option>
                  </select>
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Location" required>
                  <input
                    type="text"
                    className="field-input"
                    required
                    value={form.loc}
                    onChange={(e) => setForm({ ...form, loc: e.target.value })}
                    placeholder="Kampala, Uganda"
                  />
                </Field>
                <Field label="Work Mode">
                  <select
                    className="field-input"
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  >
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Eligible Courses" required>
                  <input
                    type="text"
                    className="field-input"
                    required
                    value={form.courses}
                    onChange={(e) => setForm({ ...form, courses: e.target.value })}
                    placeholder="Computer Science, Design, Business (comma separated)"
                  />
                </Field>
                <Field label="Minimum Grade">
                  <input
                    type="text"
                    className="field-input"
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="CGPA 3.0+"
                  />
                </Field>
              </FieldGroup>
            </SectionTitle>

            <SectionTitle title="Dates & Capacity">
              <FieldGroup columns={2}>
                <Field label="Closing Date" required>
                  <input
                    type="date"
                    className="field-input"
                    required
                    min={minClosesAt}
                    value={form.closesAt}
                    onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
                  />
                </Field>
                <Field label="Start Date" required>
                  <input
                    type="date"
                    className="field-input"
                    required
                    min={minClosesAt}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Duration">
                  <input
                    type="text"
                    className="field-input"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="e.g., 3 months"
                  />
                </Field>
                <Field label="Stipend / Salary">
                  <input
                    type="text"
                    className="field-input"
                    value={form.stipend}
                    onChange={(e) => setForm({ ...form, stipend: e.target.value })}
                    placeholder="e.g., $500/month or Competitive"
                  />
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Available Slots" required>
                  <input
                    type="number"
                    className="field-input"
                    required
                    min="1"
                    value={form.slots}
                    onChange={(e) => setForm({ ...form, slots: e.target.value })}
                  />
                </Field>
              </FieldGroup>
            </SectionTitle>

            {form.opportunityType === "gig" && (
              <SectionTitle title="Gig Details">
                <FieldGroup columns={2}>
                  <Field label="Duration (Hours)">
                    <input
                      type="number"
                      className="field-input"
                      placeholder="e.g., 40"
                      value={form.durationHours}
                      onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
                    />
                  </Field>
                  <Field label="Budget Range">
                    <input
                      type="text"
                      className="field-input"
                      placeholder="e.g., $500-$1,000"
                      value={form.budgetRange}
                      onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
                <Field label="Milestones (one per line)">
                  <textarea
                    className="field-input"
                    rows={2}
                    placeholder="Design phase&#10;Development&#10;Testing & Delivery"
                    value={form.milestones}
                    onChange={(e) => setForm({ ...form, milestones: e.target.value })}
                  />
                </Field>
                <Field label="Remote Work Allowed">
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.remoteOk}
                      onChange={(e) => setForm({ ...form, remoteOk: e.target.checked })}
                      style={{ width: "18px", height: "18px", accentColor: "var(--blue)" }}
                    />
                    <span>Allow remote work for this gig</span>
                  </label>
                </Field>
              </SectionTitle>
            )}

            {form.opportunityType === "entry_level" && (
              <SectionTitle title="Entry-Level Details">
                <FieldGroup columns={2}>
                  <Field label="Salary Range">
                    <input
                      type="text"
                      className="field-input"
                      placeholder="e.g., $30,000-$40,000/year"
                      value={form.salaryRange}
                      onChange={(e) => setForm({ ...form, salaryRange: e.target.value })}
                    />
                  </Field>
                  <Field label="Probation Period">
                    <input
                      type="text"
                      className="field-input"
                      placeholder="e.g., 3 months"
                      value={form.probationPeriod}
                      onChange={(e) => setForm({ ...form, probationPeriod: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
                <FieldGroup columns={2}>
                  <Field label="Training Included">
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.trainingIncluded}
                        onChange={(e) => setForm({ ...form, trainingIncluded: e.target.checked })}
                        style={{ width: "18px", height: "18px", accentColor: "var(--blue)" }}
                      />
                      <span>This position includes structured training</span>
                    </label>
                  </Field>
                  <Field label="Career Path">
                    <textarea
                      className="field-input"
                      rows={2}
                      placeholder="Growth opportunities and progression"
                      value={form.careerPath}
                      onChange={(e) => setForm({ ...form, careerPath: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
              </SectionTitle>
            )}

            <SectionTitle title="Requirements & Skills">
              <Field label="Requirements (one per line)">
                <textarea
                  className="field-input"
                  rows={4}
                  placeholder="Bachelor's degree in Computer Science&#10;Strong Python and React skills&#10;Experience with REST APIs&#10;Good communication skills"
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                />
              </Field>

              <Field label="Skills Required (comma separated)">
                <input
                  type="text"
                  className="field-input"
                  placeholder="Python, React, SQL, Git, Agile"
                  value={form.skillsRequired}
                  onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })}
                />
              </Field>
            </SectionTitle>

            <SectionTitle title="About This Opportunity">
              <Field label="Description">
                <textarea
                  className="field-input"
                  rows={4}
                  placeholder="Describe the role, team, projects, and what makes this opportunity exciting..."
                  value={form.about}
                  onChange={(e) => setForm({ ...form, about: e.target.value })}
                />
              </Field>
            </SectionTitle>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid var(--rule)", paddingTop: "16px", marginTop: "8px" }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>
                <Icon name="x" size={13} /> Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-blue" disabled={saving}>
                {saving ? (
                  <>
                    <div className="spinner" style={{ width: "13px", height: "13px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "8px" }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon name="send" size={13} /> Submit for Admin Review
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>Placement</th>
                  <th>Status</th>
                  <th className="hide-xs">Type</th>
                  <th className="hide-xs">Courses</th>
                  <th>Grade</th>
                  <th>Applicants</th>
                  <th>Closes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8}>Loading placements...</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} className="error">{error}</td></tr>
                ) : employerPlacements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                      <span style={{ opacity: 0.3, display: "block", marginBottom: "12px" }}>
                        <Icon name="brief" size={48} />
                      </span>
                      <p>No placements submitted yet.</p>
                      <button
                        type="button"
                        className="btn btn-sm btn-blue"
                        style={{ marginTop: "12px" }}
                        onClick={() => setShowForm(true)}
                      >
                        <Icon name="plus" size={13} /> Create your first placement
                      </button>
                    </td>
                  </tr>
                ) : employerPlacements.map((p) => (
                  <tr key={p.id}>
                    <td className="who">
                      <b>{p.title}</b>
                      <span>{p.slots} slots · {p.opportunityType.charAt(0).toUpperCase() + p.opportunityType.slice(1)}</span>
                    </td>
                    <td><StatusBadge status={p.reviewStatus} /></td>
                    <td className="hide-xs"><TypeBadge type={p.opportunityType} /></td>
                    <td className="hide-xs" style={{ fontSize: "11px", color: "var(--ink-2)" }}>
                      {p.courses.join(", ")}
                    </td>
                    <td className="num">{p.grade}</td>
                    <td className="num">{p.applicants}</td>
                    <td className="num">{p.closesAt || p.deadline}</td>
                    <td className="act">
                      {p.startsAt && <span className="lbl" style={{ fontSize: "11px" }}>Starts {p.startsAt}</span>}
                    </td>
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