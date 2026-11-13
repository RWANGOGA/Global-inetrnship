"use client";

import React, { useCallback, useState } from "react";
import type { Placement } from "../../../types";
import type { PlacementRequirementsInput } from "../../../lib/api";

interface Props {
  placement: Placement;
  availableCourses: string[];
  gradeOptions: string[];
  onSave: (input: PlacementRequirementsInput) => void;
}

const DOC_OPTIONS = [
  "Transcript",
  "Student ID",
  "National ID",
  "Recommendation letter",
  "Portfolio",
  "CV",
  "Writing sample",
  "Testimonial",
];

export function RequirementsEditor({ placement, availableCourses, gradeOptions, onSave }: Props) {
  const [courses, setCourses] = useState<Set<string>>(new Set(placement.courses));
  const [grade, setGrade] = useState(placement.grade);
  const [testimonial, setTestimonial] = useState(placement.testimonial);
  const [docs, setDocs] = useState<Set<string>>(new Set(placement.docs));
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(
    (set: Set<string>, value: string) => {
      const next = new Set(set);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      set(next);
    },
    []
  );

  const handleSave = useCallback(async () => {
    const input: PlacementRequirementsInput = {
      courses: Array.from(courses),
      grade,
      docs: Array.from(docs),
      testimonial,
    };
    setSaving(true);
    try {
      await onSave(input);
    } finally {
      setSaving(false);
    }
  }, [courses, grade, docs, testimonial, onSave]);

  return (
    <div
      className="form"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "6px 2px",
      }}
    >
      <div className="field">
        <label>Eligible courses</label>
        <div
          className="checks"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "8px",
            marginTop: "6px",
          }}
        >
          {availableCourses.map((c) => (
            <label key={c} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={courses.has(c)}
                onChange={() => toggle(courses, c)}
              />
              {c}
            </label>
          ))}
        </div>
        {availableCourses.length === 0 && (
          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
            No courses defined in the catalogue yet.
          </p>
        )}
      </div>

      <div className="row2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "4px" }}>
        <div className="field">
          <label>Minimum grade</label>
          <select
            className="sel"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", fontSize: "13px", border: "1px solid var(--line)", borderRadius: "8px", background: "#fff" }}
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Testimonial required</label>
          <select
            className="sel"
            value={testimonial ? "Required" : "Not required"}
            onChange={(e) => setTestimonial(e.target.value === "Required")}
            style={{ width: "100%", padding: "6px 8px", fontSize: "13px", border: "1px solid var(--line)", borderRadius: "8px", background: "#fff" }}
          >
            <option value="Required">Required</option>
            <option value="Not required">Not required</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Required documents</label>
        <div
          className="checks"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: "8px",
            marginTop: "6px",
          }}
        >
          {DOC_OPTIONS.map((d) => (
            <label key={d} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={docs.has(d)}
                onChange={() => toggle(docs, d)}
              />
              {d}
            </label>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "4px",
        }}
      >
        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={handleSave}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: saving ? "#e5e7eb" : "#111",
            color: saving ? "#9ca3af" : "#fff",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save requirements"}
        </button>
      </div>
    </div>
  );
}
