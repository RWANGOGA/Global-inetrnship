"use client";

import React, { useCallback } from "react";
import { useApp } from "../../../context/AppContext";

const TEMPLATE = {
  courses: ["Relevant degree", "Coursework in the role's domain"],
  grade: "Second Class Upper",
  docs: ["Transcript", "CV", "Recommendation letter"],
  testimonial: false,
};

export function AdminRequirements() {
  const { placements, getOrg, setPlacements, editRequirements, toast } = useApp();

  const list = placements.filter((p) => p.reviewStatus === "approved");

  const applyTemplate = useCallback(() => {
    if (!list.length) {
      toast("No placements to apply a template to");
      return;
    }
    setPlacements((prev) =>
      prev.map((p) =>
        list.some((x) => x.id === p.id)
          ? {
              ...p,
              courses: TEMPLATE.courses,
              grade: TEMPLATE.grade,
              docs: TEMPLATE.docs,
              testimonial: TEMPLATE.testimonial,
            }
          : p
      )
    );
    toast(`Requirement template applied to ${list.length} placements`);
  }, [list, setPlacements, toast]);

  if (!list.length) {
    return (
      <div className="dpane-h">
        <div>
          <h2>Requirements</h2>
          <p>
            Eligible courses, minimum grade, documents and testimonial rule —
            per placement
          </p>
        </div>
        <div style={{ marginTop: "14px", padding: "26px", borderRadius: "14px", border: "1px dashed var(--line)", background: "#fafafa", color: "var(--muted)" }}>
          No approved placements yet. Publish placements first, then set their
          requirements here.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dpane-h" style={{ marginBottom: "14px" }}>
        <div>
          <h2>Requirements</h2>
          <p>
            Eligible courses, minimum grade, documents and testimonial rule —
            per placement
          </p>
          <span className="lbl" style={{ display: "inline-block", marginTop: "6px", fontSize: "12px" }}>
            {list.length} placement{list.length === 1 ? "" : "s"} listed
          </span>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={applyTemplate}
          style={{ marginLeft: "10px" }}
        >
          Apply a template
        </button>
      </div>
      <div
        className="reqgrid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {list.map((p) => {
          const o = getOrg(p.orgId);
          return (
            <div key={p.id} className="fold" style={{ padding: "18px", borderRadius: "14px", border: "1px solid var(--line)", background: "#fff", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                <div>
                  <span className="lbl">
                    {o?.type} · {p.deadline}
                  </span>
                  <h3
                    className="serif"
                    style={{
                      fontSize: "21px",
                      marginTop: "5px",
                      lineHeight: 1.1,
                    }}
                  >
                    {p.title}
                  </h3>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--muted)",
                      marginTop: "2px",
                    }}
                  >
                    {o?.name}
                  </div>
                </div>
                <span className={`tg ${p.testimonial ? "gold" : ""}`}>
                  {p.testimonial ? "Testimonial" : "No testimonial"}
                </span>
              </div>

              {p.skillsRequired?.length ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginTop: "2px",
                  }}
                >
                  <span className="lbl" style={{ fontSize: "11px", opacity: 0.8 }}>Skills</span>{" "}
                  {p.skillsRequired.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "#f3f4f6",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}

              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className="reqrow" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="k">Courses</div>
                  <div className="doclist" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {p.courses.map((c) => (
                      <span key={c} className="doc">
                        {c}
                      </span>
                    ))}
                    {p.courses.length === 0 && <span style={{ color: "var(--muted)", fontSize: "12px" }}>(none set)</span>}
                  </div>
                </div>
                <div className="reqrow" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="k">Grade</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <b style={{ fontSize: "15px" }}>{p.grade || "—"}</b>
                  </div>
                </div>
                <div className="reqrow" style={{ padding: "8px 0", borderBottom: 0 }}>
                  <div className="k">Documents</div>
                  <div className="doclist" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {p.docs.map((d) => (
                      <span key={d} className="doc">
                        {d}
                      </span>
                    ))}
                    {p.docs.length === 0 && <span style={{ color: "var(--muted)", fontSize: "12px" }}>(none set)</span>}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "8px",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <span className="lbl">{p.applicants} applicants</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => editRequirements(p.id)}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
