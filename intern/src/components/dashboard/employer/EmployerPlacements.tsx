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
import { Icon, IconName } from "../../icons/Icons";

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
    gig: "purple",
    entry_level: "gold",
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

function FieldGroup({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div style={{ display: "grid", gap: "16px", gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}

function Field({ label, required, children, error, hint, fullWidth }: { label: string; required?: boolean; children: React.ReactNode; error?: string; hint?: string; fullWidth?: boolean }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
      <label className="lbl" style={{ fontWeight: 600, fontSize: "12px", marginBottom: "6px", display: "block" }}>
        {label} {required && <span style={{ color: "var(--red)" }}>*</span>}
      </label>
      {children}
      {error && <span className="error" style={{ fontSize: "11px", marginTop: "4px", display: "block", color: "var(--red)" }}>{error}</span>}
      {hint && <span className="hint" style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "4px", display: "block" }}>{hint}</span>}
    </div>
  );
}

function Input({ className = "field-input", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-sm)",
        background: "var(--white)",
        height: "44px",
        padding: "0 14px",
        fontSize: "13.5px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; }}
      {...props}
    />
  );
}

function Select({ className = "field-input", style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-sm)",
        background: "var(--white)",
        height: "44px",
        padding: "0 14px",
        fontSize: "13.5px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s, box-shadow 0.15s",
        appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "40px",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; }}
      {...props}
    />
  );
}

function Textarea({ className = "field-input", style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-sm)",
        background: "var(--white)",
        minHeight: "96px",
        padding: "12px 14px",
        fontSize: "13.5px",
        outline: 0,
        width: "100%",
        resize: "vertical",
        fontFamily: "inherit",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; }}
      {...props}
    />
  );
}

function Checkbox({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (checked: boolean) => void; description?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", padding: "8px 0" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: "20px",
          height: "20px",
          accentColor: "var(--blue)",
          marginTop: "2px",
          flexShrink: 0,
        }}
      />
      <div>
        <span style={{ fontWeight: 500, fontSize: "13.5px", color: "var(--ink)" }}>{label}</span>
        {description && <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", display: "block" }}>{description}</span>}
      </div>
    </label>
  );
}

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: IconName }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: "24px", boxShadow: "0 1px 3px var(--shadow-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
        {icon && <span style={{ color: "var(--blue)" }}><Icon name={icon} size={20} /></span>}
        <h3 style={{ fontWeight: 700, fontSize: "16px", margin: 0, color: "var(--ink)" }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gap: "16px" }}>{children}</div>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div style={{ background: "var(--red-tint)", border: "1px solid var(--red)", borderRadius: "var(--r-md)", padding: "14px 16px", color: "var(--red)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ marginTop: "2px", flexShrink: 0 }}><Icon name="bell" size={16} /></span>
      <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{message}</span>
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
      {/* Header */}
      <div className="dpane-h" style={{ 
        flexWrap: "wrap", 
        gap: "20px", 
        alignItems: "center",
        marginBottom: "8px",
        paddingBottom: "20px",
        borderBottom: "2px solid var(--rule)",
      }}>
        <div style={{ flex: 1, minWidth: "280px" }}>
          <h1 style={{ 
            fontWeight: 800, 
            fontSize: "32px", 
            marginBottom: "8px",
            color: "var(--ink)",
            letterSpacing: "-0.5px",
          }}>
            My Placements
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", fontWeight: 500 }}>
            {employerLiveCount} published ·{" "}
            {isPremium ? (
              <>
                <span style={{ background: "var(--blue-tint)", color: "var(--blue)", padding: "4px 10px", borderRadius: "var(--r-pill)", fontSize: "12px", fontWeight: 600, marginRight: "8px" }}>
                  {subscription.plan}
                </span>
                <span>unlimited postings</span>
                {subscription.since && <span style={{ marginLeft: "8px", opacity: 0.7 }}>since {subscription.since}</span>}
              </>
            ) : (
              <>
                <span style={{ background: "var(--gold-tint)", color: "var(--gold)", padding: "4px 10px", borderRadius: "var(--r-pill)", fontSize: "12px", fontWeight: 600, marginRight: "8px" }}>
                  {remaining} free left
                </span>
                <span>then placement fee applies</span>
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sm" onClick={handleExport} style={{ height: "44px" }}>
            <span style={{ marginRight: "8px" }}><Icon name="download" size={14} /></span> Export CSV
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showForm ? "btn-blue" : ""}`}
            onClick={() => setShowForm((current) => !current)}
            style={{ height: "44px" }}
          >
            <span style={{ marginRight: "8px" }}><Icon name={showForm ? "x" : "plus"} size={14} /></span>
            {showForm ? "Close form" : "Create new placement"}
          </button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="panel" style={{ 
          marginBottom: "24px",
          background: "var(--white)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 10px 40px var(--shadow-2)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ 
            background: "linear-gradient(135deg, var(--blue) 0%, var(--blue-2) 100%)",
            color: "white",
            padding: "28px 32px",
            textAlign: "center",
            position: "relative",
          }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                position: "absolute",
                right: "24px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "white",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
            >
              <Icon name="x" size={18} />
            </button>
            <span style={{ marginBottom: "12px", opacity: 0.9, display: "block" }}>
              <Icon name="brief" size={36} />
            </span>
            <h2 style={{ fontWeight: 800, fontSize: "28px", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
              Create New Placement
            </h2>
            <p style={{ fontSize: "15px", opacity: 0.85, maxWidth: "500px", margin: "0 auto" }}>
              Fill in the details below. Your placement will be reviewed by our team before going live.
            </p>
          </div>

          {/* Placement Limit Warning */}
          {!isPremium && remaining <= 2 && (
            <div
              style={{
                margin: "16px 32px 0",
                padding: "14px 18px",
                borderRadius: "10px",
                background: remaining === 0 ? "var(--red-tint)" : "var(--amber-tint)",
                border: `1px solid ${remaining === 0 ? "var(--red)" : "var(--amber)"}`,
                color: remaining === 0 ? "var(--red)" : "var(--amber)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <Icon name={remaining === 0 ? "alert-triangle" : "alert-triangle"} size={16} />
              <div>
                <strong>{remaining === 0 ? "Placement limit reached" : "Approaching placement limit"}</strong>
                <div style={{ marginTop: "2px", fontSize: "12px", opacity: 0.9 }}>
{remaining === 0
                      ? "Your Free plan allows 3 placements. Upgrade to Pro for unlimited."
                      : `You have ${remaining} of ${freeAllowance} free placements remaining.`}
                </div>
              </div>
            </div>
          )}
          
          {/* Form Content */}
          <form onSubmit={submitPosting} style={{ padding: "32px" }}>
            {formError && <FormError message={formError} />}

            {/* Basic Information */}
            <SectionCard title="Basic Information" icon="brief">
              <FieldGroup columns={2}>
                <Field label="Placement Title" required>
                  <Input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Software Engineering Intern"
                  />
                </Field>
                <Field label="Opportunity Type" required>
                  <Select
                    required
                    value={form.opportunityType}
                    onChange={(e) => setForm({ ...form, opportunityType: e.target.value })}
                  >
                    <option value="internship">Internship</option>
                    <option value="gig">Gig / Short-term Project</option>
                    <option value="entry_level">Entry-level Position</option>
                  </Select>
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Location" required>
                  <Input
                    required
                    value={form.loc}
                    onChange={(e) => setForm({ ...form, loc: e.target.value })}
                    placeholder="Kampala, Uganda"
                  />
                </Field>
                <Field label="Work Mode">
                  <Select
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  >
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </Select>
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Eligible Courses" required hint="Comma separated (e.g., Computer Science, Design, Business)">
                  <Input
                    required
                    value={form.courses}
                    onChange={(e) => setForm({ ...form, courses: e.target.value })}
                    placeholder="Computer Science, Design, Business"
                  />
                </Field>
                <Field label="Minimum Grade" hint="e.g., CGPA 3.0+">
                  <Input
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="CGPA 3.0+"
                  />
                </Field>
              </FieldGroup>
            </SectionCard>

            {/* Dates & Capacity */}
            <SectionCard title="Dates & Capacity" icon="clock">
              <FieldGroup columns={2}>
                <Field label="Closing Date" required>
                  <Input
                    type="date"
                    required
                    min={minClosesAt}
                    value={form.closesAt}
                    onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
                  />
                </Field>
                <Field label="Start Date" required>
                  <Input
                    type="date"
                    required
                    min={minClosesAt}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Duration" hint="e.g., 3 months">
                  <Input
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="3 months"
                  />
                </Field>
                <Field label="Stipend / Salary" hint="e.g., $500/month or Competitive">
                  <Input
                    value={form.stipend}
                    onChange={(e) => setForm({ ...form, stipend: e.target.value })}
                    placeholder="$500/month or Competitive"
                  />
                </Field>
              </FieldGroup>

              <FieldGroup columns={2}>
                <Field label="Available Slots" required>
                  <Input
                    type="number"
                    required
                    min="1"
                    value={form.slots}
                    onChange={(e) => setForm({ ...form, slots: e.target.value })}
                  />
                </Field>
              </FieldGroup>
            </SectionCard>

            {/* Gig-specific fields */}
            {form.opportunityType === "gig" && (
              <SectionCard title="Gig Details" icon="brief">
                <FieldGroup columns={2}>
                  <Field label="Duration (Hours)" hint="Total hours for the project">
                    <Input
                      type="number"
                      value={form.durationHours}
                      onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
                      placeholder="40"
                    />
                  </Field>
                  <Field label="Budget Range" hint="e.g., $500-$1,000">
                    <Input
                      value={form.budgetRange}
                      onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}
                      placeholder="$500-$1,000"
                    />
                  </Field>
                </FieldGroup>
                <Field fullWidth label="Milestones (one per line)">
                  <Textarea
                    rows={3}
                    placeholder="Design phase&#10;Development&#10;Testing & Delivery"
                    value={form.milestones}
                    onChange={(e) => setForm({ ...form, milestones: e.target.value })}
                  />
                </Field>
                <Field fullWidth label="Remote Work Allowed">
                  <Checkbox
                    label="Allow remote work for this gig"
                    checked={form.remoteOk}
                    onChange={(checked) => setForm({ ...form, remoteOk: checked })}
                    description="Candidates can work remotely if selected"
                  />
                </Field>
              </SectionCard>
            )}

            {/* Entry-level specific fields */}
            {form.opportunityType === "entry_level" && (
              <SectionCard title="Entry-Level Details" icon="brief">
                <FieldGroup columns={2}>
                  <Field label="Salary Range" hint="e.g., $30,000-$40,000/year">
                    <Input
                      value={form.salaryRange}
                      onChange={(e) => setForm({ ...form, salaryRange: e.target.value })}
                      placeholder="$30,000-$40,000/year"
                    />
                  </Field>
                  <Field label="Probation Period" hint="e.g., 3 months">
                    <Input
                      value={form.probationPeriod}
                      onChange={(e) => setForm({ ...form, probationPeriod: e.target.value })}
                      placeholder="3 months"
                    />
                  </Field>
                </FieldGroup>
                <FieldGroup columns={2}>
                  <Field fullWidth label="Training Included">
                    <Checkbox
                      label="This position includes structured training"
                      checked={form.trainingIncluded}
                      onChange={(checked) => setForm({ ...form, trainingIncluded: checked })}
                    />
                  </Field>
                  <Field label="Career Path" hint="Growth opportunities and progression">
                    <Textarea
                      rows={2}
                      placeholder="Describe career progression opportunities..."
                      value={form.careerPath}
                      onChange={(e) => setForm({ ...form, careerPath: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
              </SectionCard>
            )}

            {/* Requirements & Skills */}
            <SectionCard title="Requirements & Skills" icon="brief">
              <Field fullWidth label="Requirements (one per line)" hint="List each requirement on a new line">
                <Textarea
                  rows={5}
                  placeholder="Bachelor's degree in Computer Science&#10;Strong Python and React skills&#10;Experience with REST APIs&#10;Good communication skills"
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                />
              </Field>

              <Field fullWidth label="Skills Required (comma separated)" hint="e.g., Python, React, SQL, Git, Agile">
                <Input
                  value={form.skillsRequired}
                  onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })}
                  placeholder="Python, React, SQL, Git, Agile"
                />
              </Field>
            </SectionCard>

            {/* About */}
            <SectionCard title="About This Opportunity" icon="brief">
              <Field fullWidth label="Description" hint="Describe the role, team, projects, and what makes this opportunity exciting">
                <Textarea
                  rows={4}
                  placeholder="Describe the role, team, projects, and what makes this opportunity exciting..."
                  value={form.about}
                  onChange={(e) => setForm({ ...form, about: e.target.value })}
                />
              </Field>
            </SectionCard>

            {/* Actions */}
            <div style={{ 
              display: "flex", 
              gap: "12px", 
              justifyContent: "flex-end", 
              borderTop: "1px solid var(--rule)", 
              paddingTop: "24px", 
              marginTop: "8px" 
            }}>
              <button 
                type="button" 
                className="btn btn-sm" 
                onClick={() => setShowForm(false)}
                style={{ height: "44px" }}
              >
                <span style={{ marginRight: "8px" }}><Icon name="x" size={14} /></span> Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-sm btn-blue" 
                disabled={saving || (!isPremium && remaining === 0)}
                style={{ height: "44px", opacity: (!isPremium && remaining === 0) ? 0.6 : 1 }}
              >
                {saving ? (
                  <>
                    <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px" }} />
                    Submitting for review...
                  </>
                ) : (!isPremium && remaining === 0) ? (
                  <>
                    <span style={{ marginRight: "8px" }}><Icon name="pin" size={14} /></span> Upgrade Required
                  </>
                ) : (
                  <>
                    <span style={{ marginRight: "8px" }}><Icon name="send" size={14} /></span> Submit for Admin Review
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Placements Table */}
      <div className="panel" style={{ 
        background: "var(--white)", 
        border: "1px solid var(--rule)", 
        borderRadius: "var(--r-xl)", 
        overflow: "hidden",
        boxShadow: "0 1px 3px var(--shadow-1)",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table className="dtable" style={{ width: "100%" }}>
            <thead style={{ background: "var(--paper-2)" }}>
              <tr>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Placement</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Status</th>
                <th className="hide-xs" style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Type</th>
                <th className="hide-xs" style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Courses</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Grade</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Applicants</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>Closes</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "60px", color: "var(--muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <span>Loading placements...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "60px", color: "var(--red)" }}>
                    <span style={{ opacity: 0.5, marginBottom: "12px", display: "block" }}>
                      <Icon name="bell" size={32} />
                    </span>
                    <span>{error}</span>
                  </td>
                </tr>
              ) : employerPlacements.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "80px 40px", color: "var(--muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                      <div style={{ opacity: 0.2 }}>
                        <Icon name="brief" size={64} />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: "20px", marginBottom: "8px", color: "var(--ink)" }}>No placements yet</h3>
                        <p style={{ fontSize: "15px" }}>Create your first placement to start attracting candidates.</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-blue"
                        onClick={() => setShowForm(true)}
                        style={{ height: "48px", padding: "0 28px", fontSize: "14px" }}
                      >
                        <span style={{ marginRight: "10px" }}><Icon name="plus" size={16} /></span> Create your first placement
                      </button>
                    </div>
                  </td>
                </tr>
              ) : employerPlacements.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--rule)", transition: "background 0.15s" }}>
                  <td data-label="Placement" style={{ padding: "18px 20px" }}>
                    <div className="who" style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)" }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                      {p.slots} slots · {p.opportunityType.charAt(0).toUpperCase() + p.opportunityType.slice(1)}
                    </div>
                  </td>
                  <td data-label="Status" style={{ padding: "18px 20px" }}>
                    <StatusBadge status={p.reviewStatus} />
                  </td>
                  <td className="hide-xs" data-label="Type" style={{ padding: "18px 20px" }}>
                    <TypeBadge type={p.opportunityType} />
                  </td>
                  <td className="hide-xs" data-label="Courses" style={{ padding: "18px 20px", fontSize: "13px", color: "var(--ink-2)" }}>
                    {p.courses.join(", ")}
                  </td>
                  <td data-label="Grade" style={{ padding: "18px 20px", fontWeight: 600, fontSize: "14px", color: "var(--ink)" }}>
                    {p.grade}
                  </td>
                  <td data-label="Applicants" style={{ padding: "18px 20px", fontWeight: 600, fontSize: "14px", color: "var(--blue)" }}>
                    {p.applicants}
                  </td>
                  <td data-label="Closes" style={{ padding: "18px 20px", fontSize: "13px", color: "var(--ink-2)" }}>
                    {p.closesAt || p.deadline}
                  </td>
                  <td data-label="Starts" style={{ padding: "18px 20px" }}>
                    {p.startsAt && <span style={{ fontSize: "12px", color: "var(--muted)", background: "var(--paper-2)", padding: "4px 10px", borderRadius: "var(--r-pill)" }}>Starts {p.startsAt}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .panel {
          background: var(--white);
          border: 1px solid var(--rule);
          border-radius: var(--r-lg);
        }
        .ph {
          padding: 16px 20px;
          border-bottom: 1px solid var(--rule);
          background: var(--paper-2);
          border-radius: var(--r-lg) var(--r-lg) 0 0;
        }
        .pb {
          padding: 20px;
        }
        .lbl {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-2);
          margin-bottom: 6px;
        }
        .field-input {
          border: 1px solid var(--rule-2);
          border-radius: var(--r-sm);
          background: var(--white);
          height: 44px;
          padding: 0 14px;
          font-size: 13.5px;
          outline: 0;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px var(--blue-tint);
        }
        .field textarea.field-input {
          min-height: 96px;
          padding: 12px 14px;
          resize: vertical;
        }
        .dtable {
          width: 100%;
          border-collapse: collapse;
        }
        .dtable th {
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--muted);
        }
        .dtable td {
          border-top: 1px solid var(--rule);
        }
        .dtable tbody tr:hover {
          background: var(--paper-2);
        }
        .who b {
          display: block;
          font-weight: 700;
        }
        .who span {
          font-size: 13px;
          color: var(--muted);
          margin-top: 4px;
        }
        .num {
          font-weight: 600;
          font-size: 14px;
        }
        .act {
          white-space: nowrap;
        }
        .tg {
          display: inline-block;
          padding: 4px 10px;
          border-radius: var(--r-pill);
          font-size: 11px;
          font-weight: 600;
        }
        .tg.blue { background: var(--blue-tint); color: var(--blue); }
        .tg.gold { background: var(--gold-tint); color: var(--gold); }
        .tg.green { background: var(--green-tint); color: var(--green); }
        .tg.red { background: var(--red-tint); color: var(--red); }
        .tg.dark { background: var(--ink-1); color: var(--ink); }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: var(--r-sm);
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-sm { height: 40px; padding: 0 14px; font-size: 12.5px; }
        .btn-blue { background: var(--blue); color: white; border-color: var(--blue); }
        .btn-blue:hover { background: var(--blue-2); }
        .btn-blue:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
        .btn-ghost:hover { background: var(--paper-2); }
        .spinner {
          animation: spin 0.8s linear infinite;
}
  `}</style>
    </>
  );
}