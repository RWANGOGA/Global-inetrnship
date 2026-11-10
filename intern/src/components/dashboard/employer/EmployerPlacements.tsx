"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  createOrganizationInternship,
  fetchOrganizationInternships,
  isApiEnabled,
} from "../../../lib/api";
import { Placement } from "../../../types";

export function EmployerPlacements() {
  const { subscription, isPremium, freeAllowance, employerLiveCount, session } =
    useApp();
  const [employerPlacements, setEmployerPlacements] = React.useState<Placement[]>(
    []
  );
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
    // Gig fields
    durationHours: "",
    budgetRange: "",
    milestones: "",
    remoteOk: false,
    // Entry-level fields
    salaryRange: "",
    probationPeriod: "",
    trainingIncluded: false,
    careerPath: "",
    // Skills
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

      // Add gig-specific fields if opportunity type is gig
      if (form.opportunityType === "gig") {
        postingData.duration_hours = form.durationHours ? Number(form.durationHours) : null;
        postingData.budget_range = form.budgetRange || null;
        postingData.milestones = form.milestones.split("\n").map((value) => value.trim()).filter(Boolean);
        postingData.remote_ok = form.remoteOk;
      }

      // Add entry-level specific fields if opportunity type is entry_level
      if (form.opportunityType === "entry_level") {
        postingData.salary_range = form.salaryRange || null;
        postingData.probation_period = form.probationPeriod || null;
        postingData.training_included = form.trainingIncluded;
        postingData.career_path = form.careerPath || null;
      }

      // Add skills required if provided
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
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Unable to submit internship");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>My placements</h2>
          <p>
            {employerLiveCount} published ·{" "}
            {isPremium ? (
              <>
                <b>{subscription.plan}</b> plan · unlimited postings
                {subscription.since ? ` since ${subscription.since}` : ""}
              </>
            ) : (
              <>
                {remaining} free posting{remaining === 1 ? "" : "s"} left, then a
                placement fee
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-blue"
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? "Close form" : "New internship"}
        </button>
      </div>
      {showForm && (
        <form className="panel" onSubmit={submitPosting} style={{ marginBottom: "14px" }}>
          <div className="ph"><span className="lbl">Submit internship for review</span></div>
          <div className="pb" style={{ display: "grid", gap: "10px" }}>
            <div className="dsplit">
              <label>Title<input className="field" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label>Eligible courses<input className="field" required placeholder="Computer Science, Design" value={form.courses} onChange={(e) => setForm({ ...form, courses: e.target.value })} /></label>
            </div>
            <div className="dsplit">
              <label>Opportunity type
                <select 
                  className="field" 
                  value={form.opportunityType} 
                  onChange={(e) => setForm({ ...form, opportunityType: e.target.value })}
                >
                  <option value="internship">Internship</option>
                  <option value="gig">Gig / Short-term project</option>
                  <option value="entry_level">Entry-level position</option>
                </select>
              </label>
              <label>Location<input className="field" required value={form.loc} onChange={(e) => setForm({ ...form, loc: e.target.value })} /></label>
            </div>
            <div className="dsplit">
              <label>Closing date<input className="field" type="date" required value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></label>
              <label>Start date<input className="field" type="date" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
            </div>
            <div className="dsplit">
              <label>Minimum grade<input className="field" placeholder="CGPA 3.0+" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></label>
              <label>Mode
                <select className="field" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </label>
            </div>
            
            {/* Gig-specific fields */}
            {form.opportunityType === "gig" && (
              <>
                <div className="dsplit">
                  <label>Duration (hours)<input className="field" type="number" placeholder="e.g., 40" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} /></label>
                  <label>Budget range<input className="field" placeholder="e.g., $500-$1,000" value={form.budgetRange} onChange={(e) => setForm({ ...form, budgetRange: e.target.value })} /></label>
                </div>
                <label>Milestones<textarea className="field" rows={2} placeholder="One milestone per line" value={form.milestones} onChange={(e) => setForm({ ...form, milestones: e.target.value })} /></label>
                <div className="dsplit">
                  <label>
                    <input type="checkbox" checked={form.remoteOk} onChange={(e) => setForm({ ...form, remoteOk: e.target.checked })} />
                    Remote work allowed
                  </label>
                </div>
              </>
            )}

            {/* Entry-level specific fields */}
            {form.opportunityType === "entry_level" && (
              <>
                <div className="dsplit">
                  <label>Salary range<input className="field" placeholder="e.g., $30,000-$40,000/year" value={form.salaryRange} onChange={(e) => setForm({ ...form, salaryRange: e.target.value })} /></label>
                  <label>Probation period<input className="field" placeholder="e.g., 3 months" value={form.probationPeriod} onChange={(e) => setForm({ ...form, probationPeriod: e.target.value })} /></label>
                </div>
                <div className="dsplit">
                  <label>
                    <input type="checkbox" checked={form.trainingIncluded} onChange={(e) => setForm({ ...form, trainingIncluded: e.target.checked })} />
                    Training included
                  </label>
                  <label>Career path<textarea className="field" rows={2} placeholder="Growth opportunities" value={form.careerPath} onChange={(e) => setForm({ ...form, careerPath: e.target.value })} /></label>
                </div>
              </>
            )}

            <label>Requirements<textarea className="field" rows={3} placeholder="One requirement per line" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></label>
            
            <label>Skills required (optional)<input className="field" placeholder="Python, React, Project management (comma separated)" value={form.skillsRequired} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} /></label>
            
            <div className="dsplit">
              <label>Duration<input className="field" placeholder="e.g., 3 months" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></label>
              <label>Stipend/Salary<input className="field" placeholder="e.g., $500/month or Competitive" value={form.stipend} onChange={(e) => setForm({ ...form, stipend: e.target.value })} /></label>
            </div>
            
            <label>About this opportunity<textarea className="field" rows={3} placeholder="Detailed description" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></label>
            
            {formError && <p className="error">{formError}</p>}
            <button type="submit" className="btn btn-sm btn-blue" disabled={saving}>{saving ? "Submitting..." : "Submit for admin review"}</button>
          </div>
        </form>
      )}
      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
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
                <tr><td colSpan={7}>Loading internships...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="error">{error}</td></tr>
              ) : employerPlacements.length === 0 ? (
                <tr><td colSpan={7}>No internships submitted yet.</td></tr>
              ) : employerPlacements.map((p) => (
                <tr key={p.id}>
                  <td className="who">
                    <b>{p.title}</b>
                    <span>{p.slots} slots · {p.opportunityType.charAt(0).toUpperCase() + p.opportunityType.slice(1)}</span>
                  </td>
                  <td>
                    <span className={`tg ${p.reviewStatus === "approved" ? "green" : "gold"}`}>
                      {p.reviewStatus === "pending_review" ? "Pending review" : p.reviewStatus}
                    </span>
                  </td>
                  <td className="hide-xs">
                    <span className="tg" style={{
                      background: p.opportunityType === "internship" ? "var(--blue)" :
                                  p.opportunityType === "gig" ? "var(--green)" : "var(--gold)",
                      color: "white"
                    }}>
                      {p.opportunityType.charAt(0).toUpperCase() + p.opportunityType.slice(1)}
                    </span>
                  </td>
                  <td className="hide-xs" style={{ fontSize: "11px" }}>
                    {p.courses.join(", ")}
                  </td>
                  <td className="num">{p.grade}</td>
                  <td className="num">{p.applicants}</td>
                  <td className="num">{p.closesAt || p.deadline}</td>
                  <td className="act"><span className="lbl">{p.startsAt ? `Starts ${p.startsAt}` : ""}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
