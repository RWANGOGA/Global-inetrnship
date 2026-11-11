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

function Field({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
      <label className="lbl" style={{ fontWeight: 600, fontSize: "12px", marginBottom: "6px", display: "block" }}>
        {label}
      </label>
      {children}
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

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: IconName }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: "24px", boxShadow: "0 1px 3px var(--shadow-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
        {icon && <span style={{ color: "var(--blue)" }}><Icon name={icon} size={20} /></span>}
        <h3 style={{ fontWeight: 700, fontSize: "16px", margin: 0, color: "var(--ink)" }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>{children}</div>
    </div>
  );
}

function SkillChip({ skill, onRemove }: { skill: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "var(--blue-tint)", color: "var(--blue)", borderRadius: "var(--r-pill)", fontSize: "12px", fontWeight: 500 }}>
      {skill}
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", color: "var(--blue)" }}>
        <Icon name="x" size={12} />
      </button>
    </span>
  );
}

function StudentCard({ student }: { student: any }) {
  const skills = student.skills || [];
  const displaySkills = skills.slice(0, 5);
  const remainingSkills = skills.length > 5 ? skills.length - 5 : 0;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: "20px", transition: "box-shadow 0.15s, border-color 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)" }}>Student {student.user_id.slice(0, 8)}…</div>
          <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "2px" }}>
            {student.university} · {student.course} · Year {student.year}
          </div>
        </div>
        <span className="tg green">Available</span>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <span className="lbl" style={{ marginBottom: "8px", display: "block" }}>CGPA: <b>{student.cgpa.toFixed(2)}</b></span>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <span className="lbl" style={{ marginBottom: "8px", display: "block" }}>Skills</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {displaySkills.map((s: string) => (
            <span key={s} className="smpill yes" style={{ background: "var(--green-tint)", color: "var(--green)", border: "none" }}>
              <Icon name="check" size={10} /> {s}
            </span>
          ))}
          {remainingSkills > 0 && (
            <span className="smpill" style={{ background: "var(--paper-2)", color: "var(--muted)" }}>
              +{remainingSkills} more
            </span>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "16px", display: "flex", gap: "10px" }}>
        <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 1 }}>
          <Icon name="eye" size={13} /> View Profile
        </button>
        <button type="button" className="btn btn-sm btn-blue" style={{ flex: 1 }}>
          <Icon name="send" size={13} /> Invite to Apply
        </button>
      </div>
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
    try {
      const data = await searchStudentProfiles({
        ...filters,
        skill: selectedSkills[0] || undefined, // API currently supports single skill
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
  }

  if (filtersLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
        <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ marginTop: "12px" }}>Loading talent search...</span>
      </div>
    );
  }

  return (
    <>
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
            Talent Search
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", fontWeight: 500 }}>
            Search verified student profiles who opted in to be discovered by employers.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "24px" }}>
        {/* Filters Panel */}
        <SectionCard title="Search Filters" icon="search">
          <Field label="Skills" fullWidth>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {selectedSkills.map((s) => (
                <SkillChip key={s} skill={s} onRemove={() => removeSkill(s)} />
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter..."
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-sm btn-blue" onClick={addSkill} disabled={!skillInput.trim()}>
                <Icon name="plus" size={14} /> Add
              </button>
            </div>
          </Field>

          <FieldGroup columns={3}>
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
          </FieldGroup>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button type="button" className="btn btn-sm" onClick={clearFilters} disabled={loading}>
              <Icon name="x" size={14} /> Clear
            </button>
            <button type="button" className="btn btn-sm btn-blue" onClick={handleSearch} disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px" }} />
                  Searching...
                </>
              ) : (
                <>
                  <Icon name="search" size={14} /> Search
                </>
              )}
            </button>
          </div>
        </SectionCard>

        {/* Results */}
        <SectionCard title={`Results ${results.length ? `(${results.length})` : ""}`} icon="user">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
              <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <span style={{ marginTop: "12px" }}>Searching candidates...</span>
            </div>
          ) : results.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--muted)" }}>
              <div style={{ opacity: 0.3, marginBottom: "16px" }}>
                <Icon name="user" size={48} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>
                {filters.course || filters.location || filters.university || selectedSkills.length > 0 ? "No matching candidates" : "Enter search criteria"}
              </h3>
              <p>
                {filters.course || filters.location || filters.university || selectedSkills.length > 0
                  ? "Try adjusting your filters or search terms."
                  : "Select skills, course, location, or university to find candidates."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
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
        .smpill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: var(--r-pill);
          font-size: 12px;
          border: 1px solid var(--rule-2);
        }
        .smpill.yes { background: var(--green-tint); border-color: transparent; color: var(--green); }
        .smpill.no { background: transparent; border-style: dashed; color: var(--muted-strong); }
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

function FieldGroup({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div style={{ display: "grid", gap: "16px", gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}