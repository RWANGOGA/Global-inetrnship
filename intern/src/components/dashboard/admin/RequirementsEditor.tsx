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
    (s: Set<string>, value: string) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
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
    <div className="form">
      <div className="field">
        <label>Eligible courses</label>
        <div className="checks">
          {availableCourses.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={courses.has(c)}
                onChange={() => setCourses(toggle(courses, c))}
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

      <div className="row2">
        <div className="field">
          <label>Minimum grade</label>
          <select
            className="sel"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
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
          >
            <option value="Required">Required</option>
            <option value="Not required">Not required</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Required documents</label>
        <div className="checks">
          {DOC_OPTIONS.map((d) => (
            <label key={d}>
              <input
                type="checkbox"
                checked={docs.has(d)}
                onChange={() => setDocs(toggle(docs, d))}
              />
              {d}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-sm btn-solid"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save requirements"}
        </button>
      </div>
    </div>
  );
}
