"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  searchStudentProfiles,
  fetchTalentSearchCourses,
  fetchTalentSearchLocations,
  fetchTalentSearchUniversities,
  isApiEnabled,
} from "../../../lib/api";
import { Icon, IconName } from "../../icons/Icons";

function Field({ label, children, fullWidth, hint }: { label: string; children: React.ReactNode; fullWidth?: boolean; hint?: string }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
      <label className="lbl" style={{ fontWeight: 600, fontSize: "12.5px", marginBottom: "6px", display: "block", color: "var(--ink-2)", letterSpacing: "0.01em" }}>
        {label}
      </label>
      {children}
      {hint && <span className="hint" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", display: "block" }}>{hint}</span>}
    </div>
  );
}

function Input({ className = "field-input", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-md)",
        background: "var(--white)",
        height: "48px",
        padding: "0 16px",
        fontSize: "14px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; e.currentTarget.style.background = "var(--white)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "var(--white)"; }}
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
        borderRadius: "var(--r-md)",
        background: "var(--white)",
        height: "48px",
        padding: "0 16px",
        fontSize: "14px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
        paddingRight: "44px",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; e.currentTarget.style.background = "var(--white)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "var(--white)"; }}
      {...props}
    />
  );
}

function SectionCard({ title, children, icon, subtitle, action }: { title: string; children: React.ReactNode; icon?: IconName; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="section-card">
      <div className="section-header">
        <div className="section-title-group">
          {icon && <span className="section-icon"><Icon name={icon} size={20} /></span>}
          <div>
            <h3 className="section-title">{title}</h3>
            {subtitle && <p className="section-description">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="section-action">{action}</div>}
      </div>
      <div className="section-content">{children}</div>
    </div>
  );
}

function SkillChip({ skill, onRemove }: { skill: string; onRemove: () => void }) {
  return (
    <span className="skill-chip">
      <span>{skill}</span>
      <button type="button" onClick={onRemove} className="chip-remove" aria-label={`Remove ${skill}`}>
        <Icon name="x" size={12} />
      </button>
    </span>
  );
}

function StatBadge({ label, value, color = "blue" }: { label: string; value: string | number; color?: "blue" | "green" | "amber" | "ink" }) {
  const colorMap = {
    blue: "var(--blue)",
    green: "var(--green)",
    amber: "var(--gold)",
    ink: "var(--ink)",
  };
  const tintMap = {
    blue: "var(--blue-tint)",
    green: "var(--green-tint)",
    amber: "var(--gold-tint)",
    ink: "var(--ink-1)",
  };
  return (
    <div className="stat-badge" style={{ borderColor: colorMap[color] }}>
      <div className="stat-value" style={{ color: colorMap[color] }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function StudentCard({ student }: { student: any }) {
  const skills = student.skills || [];
  const displaySkills = skills.slice(0, 5);
  const remainingSkills = skills.length > 5 ? skills.length - 5 : 0;

  return (
    <div className="student-card">
      <div className="card-header">
        <div className="student-identity">
          <div className="student-avatar">
            <Icon name="user" size={20} />
          </div>
          <div>
            <div className="student-name">Student {student.user_id.slice(0, 8)}…</div>
            <div className="student-meta">
              <span>{student.university}</span>
              <span className="meta-divider" />
              <span>{student.course}</span>
              <span className="meta-divider" />
              <span>Year {student.year}</span>
            </div>
          </div>
        </div>
        <span className="status-badge available">
          <Icon name="check" size={10} /> Available
        </span>
      </div>

      <div className="card-stats">
        <StatBadge label="CGPA" value={student.cgpa.toFixed(2)} color="green" />
      </div>

      <div className="skills-section">
        <div className="skills-label">Skills</div>
        <div className="skills-list">
          {displaySkills.map((s: string) => (
            <span key={s} className="skill-pill verified">
              <Icon name="check" size={10} /> {s}
            </span>
          ))}
          {remainingSkills > 0 && (
            <span className="skill-pill more">
              +{remainingSkills} more
            </span>
          )}
        </div>
      </div>

      <div className="card-actions">
        <button type="button" className="btn btn-sm btn-ghost">
          <Icon name="eye" size={13} /> View Profile
        </button>
        <button type="button" className="btn btn-sm btn-blue">
          <Icon name="send" size={13} /> Invite to Apply
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner({ size = 32, text }: { size?: number; text?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
      <div className="spinner" style={{ width: size, height: size, border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      {text && <span style={{ marginTop: "12px", fontSize: "14px", color: "var(--ink-2)" }}>{text}</span>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={56} /></div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

function FilterGroup({ columns = 3, children }: { columns?: number; children: React.ReactNode }) {
  return (
    <div className="filter-group" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}

export function EmployerTalentSearch() {
  const { session, toast } = useApp();
  const [courses, setCourses] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [filters, setFilters] = useState({
    course: "",
    location: "",
    university: "",
  });
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "employer") {
      setFiltersLoading(false);
      return;
    }
    loadFilters();
  }, [session]);

  async function loadFilters() {
    setFiltersLoading(true);
    try {
      const [c, l, u] = await Promise.all([
        fetchTalentSearchCourses(),
        fetchTalentSearchLocations(),
        fetchTalentSearchUniversities(),
      ]);
      setCourses(c);
      setLocations(l);
      setUniversities(u);
    } catch (error) {
      console.error("Failed to load talent search filters:", error);
    } finally {
      setFiltersLoading(false);
    }
  }

  function addSkill() {
    const skill = skillInput.trim();
    if (skill && !selectedSkills.includes(skill)) {
      setSelectedSkills((prev) => [...prev, skill]);
      setSkillInput("");
    }
  }

  function removeSkill(skill: string) {
    setSelectedSkills((prev) => prev.filter((s) => s !== skill));
  }

  async function handleSearch() {
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchStudentProfiles({
        ...filters,
        skill: selectedSkills[0] || undefined,
        limit: 20,
      });
      setResults(data);
      toast(`Found ${data.length} candidate${data.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSelectedSkills([]);
    setSkillInput("");
    setFilters({ course: "", location: "", university: "" });
    setResults([]);
    setHasSearched(false);
  }

  if (filtersLoading) {
    return <LoadingSpinner text="Loading talent search..." />;
  }

  return (
    <>
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Talent Search</h1>
            <p className="page-subtitle">Search verified student profiles who opted in to be discovered by employers.</p>
          </div>
        </div>
      </div>

      <div className="search-layout">
        {/* Filters Panel */}
        <SectionCard 
          title="Search Filters" 
          icon="search"
          subtitle="Combine multiple filters to narrow down candidates"
          action={
            <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters} disabled={loading}>
              <Icon name="x" size={14} /> Clear All
            </button>
          }
        >
          <Field label="Skills" fullWidth hint="Add multiple skills - search will use the first skill">
            <div className="skill-chips" role="list" aria-label="Selected skills">
              {selectedSkills.map((s) => (
                <SkillChip key={s} skill={s} onRemove={() => removeSkill(s)} />
              ))}
            </div>
            <div className="skill-input-wrapper">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter..."
                aria-label="Add skill"
              />
              <button 
                type="button" 
                className="btn btn-sm btn-blue" 
                onClick={addSkill} 
                disabled={!skillInput.trim() || loading}
              >
                <Icon name="plus" size={14} /> Add
              </button>
            </div>
          </Field>

          <FilterGroup columns={3}>
            <Field label="Course">
              <Select
                value={filters.course}
                onChange={(e) => setFilters({ ...filters, course: e.target.value })}
              >
                <option value="">All courses</option>
                {courses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Select
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              >
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="University">
              <Select
                value={filters.university}
                onChange={(e) => setFilters({ ...filters, university: e.target.value })}
              >
                <option value="">All universities</option>
                {universities.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </Field>
          </FilterGroup>

          <div className="filter-actions">
            <button type="button" className="btn btn-lg btn-blue" onClick={handleSearch} disabled={loading}>
              {loading ? (
                <>
                  <span className="btn-spinner" style={{ width: "18px", height: "18px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px", display: "inline-block" }} />
                  Searching...
                </>
              ) : (
                <>
                  <Icon name="search" size={14} /> Search Candidates
                </>
              )}
            </button>
          </div>
        </SectionCard>

        {/* Results */}
        <SectionCard 
          title={hasSearched ? `Results (${results.length})` : "Results"} 
          icon="user"
          subtitle={hasSearched ? undefined : "Enter search criteria and click Search Candidates to find talent"}
        >
          {loading ? (
            <LoadingSpinner text="Searching candidates..." />
          ) : hasSearched && results.length === 0 ? (
            <EmptyState
              icon="user"
              title="No matching candidates"
              description="Try adjusting your filters or search terms to broaden the results."
            />
          ) : !hasSearched ? (
            <EmptyState
              icon="search"
              title="Ready to search"
              description="Select skills, course, location, or university to find candidates who have opted in to talent search."
            />
          ) : (
            <div className="results-grid">
              {results.map((student) => (
                <StudentCard key={student.user_id} student={student} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .page-header {
          padding: 8px 0 24px;
          border-bottom: 2px solid var(--rule);
          margin-bottom: 8px;
        }
        .header-content {
          display: flex;
          alignItems: center;
          justifyContent: space-between;
          flexWrap: wrap;
          gap: 16px;
        }
        .page-title {
          fontWeight: 800;
          fontSize: 32px;
          marginBottom: 6px;
          color: var(--ink);
          letterSpacing: -0.5px;
          lineHeight: 1.15;
        }
        .page-subtitle {
          color: var(--ink-2);
          fontSize: 15px;
          fontWeight: 500;
          margin: 0;
        }
        .search-layout {
          display: grid;
          gap: 24px;
          gridTemplateColumns: 1fr;
        }
        @media (min-width: 1024px) {
          .search-layout {
            gridTemplateColumns: 380px 1fr;
            alignItems: start;
          }
        }
        .section-card {
          background: var(--white);
          border: 1px solid var(--rule);
          borderRadius: var(--r-xl);
          padding: 28px;
          boxShadow: 0 1px 3px var(--shadow-1), 0 0 0 1px var(--rule-2);
        }
        .section-header {
          display: flex;
          alignItems: flex-start;
          justifyContent: space-between;
          flexWrap: wrap;
          gap: 16px;
          marginBottom: 24px;
          paddingBottom: 18px;
          borderBottom: 1px solid var(--rule);
        }
        .section-title-group {
          display: flex;
          alignItems: flex-start;
          gap: 12px;
        }
        .section-icon {
          color: var(--blue);
          flexShrink: 0;
          marginTop: 2px;
        }
        .section-title {
          fontWeight: 700;
          fontSize: 17px;
          margin: 0 0 4px;
          color: var(--ink);
          letterSpacing: -0.01em;
        }
        .section-description {
          fontSize: 13px;
          color: var(--muted);
          margin: 0;
          fontWeight: 400;
        }
        .section-action {
          flexShrink: 0;
        }
        .section-content {
          minWidth: 0;
        }
        .field {
          minWidth: 0;
        }
        .lbl {
          display: block;
          fontWeight: 600;
          fontSize: 12.5px;
          marginBottom: 6px;
          color: var(--ink-2);
          letterSpacing: 0.01em;
        }
        .field-input {
          border: 1px solid var(--rule-2);
          borderRadius: var(--r-md);
          background: var(--white);
          height: 48px;
          padding: 0 16px;
          fontSize: 14px;
          outline: 0;
          width: 100%;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .field-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px var(--blue-tint);
          background: var(--white);
        }
        .field-input::placeholder {
          color: var(--muted);
        }
        .hint {
          fontSize: 11px;
          color: var(--muted);
          marginTop: 6px;
          display: block;
        }
        .skill-chips {
          display: flex;
          flexWrap: wrap;
          gap: 8px;
          marginBottom: 12px;
          minHeight: 36px;
        }
        .skill-chip {
          display: inline-flex;
          alignItems: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--blue-tint);
          color: var(--blue);
          borderRadius: var(--r-pill);
          fontSize: 12.5px;
          fontWeight: 500;
        }
        .chip-remove {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          color: var(--blue);
          borderRadius: 50%;
          width: 20px;
          height: 20px;
          alignItems: center;
          justifyContent: center;
          transition: background-color 0.15s;
        }
        .chip-remove:hover {
          background: var(--blue-tint-2);
        }
        .skill-input-wrapper {
          display: flex;
          gap: 10px;
        }
        .skill-input-wrapper .field-input {
          flex: 1;
        }
        .filter-group {
          display: grid;
          gap: 16px;
        }
        .filter-actions {
          marginTop: 8px;
        }
        .btn {
          display: inline-flex;
          alignItems: center;
          justifyContent: center;
          gap: 8px;
          padding: 0 20px;
          borderRadius: var(--r-md);
          fontSize: 13.5px;
          fontWeight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-sm { height: 44px; padding: 0 18px; font-size: 13px; }
        .btn-lg { height: 52px; padding: 0 24px; font-size: 14.5px; width: 100%; }
        .btn-blue { background: var(--blue); color: white; border-color: var(--blue); }
        .btn-blue:hover:not(:disabled) { background: var(--blue-2); }
        .btn-blue:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
        .btn-ghost:hover:not(:disabled) { background: var(--paper-2); }
        .btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner { animation: spin 0.8s linear infinite; }
        
        /* Results */
        .results-grid {
          display: grid;
          gap: 16px;
          gridTemplateColumns: repeat(auto-fill, minmax(340px, 1fr));
        }
        .student-card {
          background: var(--white);
          border: 1px solid var(--rule);
          borderRadius: var(--r-xl);
          padding: 24px;
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .student-card:hover {
          boxShadow: 0 4px 12px var(--shadow-2);
          borderColor: var(--blue);
        }
        .card-header {
          display: flex;
          alignItems: flex-start;
          justifyContent: space-between;
          marginBottom: 16px;
        }
        .student-identity {
          display: flex;
          alignItems: center;
          gap: 12px;
        }
        .student-avatar {
          width: 44px;
          height: 44px;
          borderRadius: var(--r-lg);
          background: var(--blue-tint);
          color: var(--blue);
          display: flex;
          alignItems: center;
          justifyContent: center;
        }
        .student-name {
          fontWeight: 700;
          fontSize: 15px;
          color: var(--ink);
          marginBottom: 4px;
        }
        .student-meta {
          display: flex;
          alignItems: center;
          gap: 6px;
          fontSize: 12.5px;
          color: var(--muted);
        }
        .meta-divider {
          color: var(--rule);
        }
        .status-badge {
          display: inline-flex;
          alignItems: center;
          gap: 5px;
          padding: 5px 11px;
          borderRadius: var(--r-pill);
          fontSize: 11px;
          fontWeight: 600;
        }
        .status-badge.available {
          background: var(--green-tint);
          color: var(--green);
        }
        .card-stats {
          display: flex;
          gap: 12px;
          marginBottom: 16px;
        }
        .stat-badge {
          flex: 1;
          padding: 12px 16px;
          background: var(--paper-2);
          border: 1px solid;
          borderRadius: var(--r-md);
          textAlign: center;
        }
        .stat-value {
          fontWeight: 700;
          fontSize: 18px;
          lineHeight: 1.2;
        }
        .stat-label {
          fontSize: 11px;
          color: var(--muted);
          fontWeight: 500;
          textTransform: uppercase;
          letterSpacing: 0.05em;
          marginTop: 2px;
        }
        .skills-section {
          marginBottom: 20px;
        }
        .skills-label {
          fontSize: 11.5px;
          fontWeight: 600;
          color: var(--muted);
          textTransform: uppercase;
          letterSpacing: 0.05em;
          marginBottom: 10px;
        }
        .skills-list {
          display: flex;
          flexWrap: wrap;
          gap: 8px;
        }
        .skill-pill {
          display: inline-flex;
          alignItems: center;
          gap: 5px;
          padding: 6px 11px;
          borderRadius: var(--r-pill);
          fontSize: 12px;
          border: 1px solid var(--rule-2);
        }
        .skill-pill.verified {
          background: var(--green-tint);
          border-color: transparent;
          color: var(--green);
        }
        .skill-pill.more {
          background: var(--paper-2);
          border-style: dashed;
          color: var(--muted-strong);
        }
        .card-actions {
          display: flex;
          gap: 10px;
          borderTop: 1px solid var(--rule);
          paddingTop: 16px;
        }
        .card-actions .btn {
          flex: 1;
        }
        .empty-state {
          textAlign: center;
          padding: 60px 40px;
          color: var(--muted);
        }
        .empty-icon {
          opacity: 0.25;
          marginBottom: 20px;
        }
        .empty-title {
          fontWeight: 700;
          fontSize: 18px;
          marginBottom: 8px;
          color: var(--ink);
        }
        .empty-description {
          fontSize: 14.5px;
          lineHeight: 1.6;
          maxWidth: 320px;
          margin: 0 auto;
        }
        
        @media (max-width: 768px) {
          .page-title { fontSize: 26px; }
          .results-grid { gridTemplateColumns: 1fr; }
          .filter-group { gridTemplateColumns: 1fr; }
          .card-stats { flexDirection: column; }
        }
      `}</style>
    </>
  );
}