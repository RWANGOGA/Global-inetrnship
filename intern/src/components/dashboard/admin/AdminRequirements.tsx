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

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Requirements</h2>
          <p>
            Eligible courses, minimum grade, documents and testimonial rule —
            per placement
          </p>
          <span className="lbl" style={{ display: "block", marginTop: "8px" }}>
            {list.length} placement{list.length === 1 ? "" : "s"} listed
          </span>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={applyTemplate}
          disabled={!list.length}
        >
          Apply a template
        </button>
      </div>

      {list.length === 0 ? (
        <div className="panel">
          <div className="pb">
            <p className="muted">
              No approved placements yet. Publish placements first, then set
              their requirements here.
            </p>
          </div>
        </div>
      ) : (
        <div className="reqgrid">
          {list.map((p) => {
            const o = getOrg(p.orgId);
            return (
              <div key={p.id} className="reqcard">
                <div className="rh">
                  <div>
                    <span className="lbl">
                      {o?.type} · {p.deadline}
                    </span>
                    <h3 style={{ marginTop: "6px" }}>{p.title}</h3>
                    <div className="org">{o?.name}</div>
                  </div>
                  <span className={`tg${p.testimonial ? " gold" : ""}`}>
                    {p.testimonial ? "Testimonial" : "No testimonial"}
                  </span>
                </div>

                <div style={{ marginTop: "10px" }}>
                  <div className="reqrow">
                    <div className="k">Courses</div>
                    <div className="doclist">
                      {p.courses.length ? (
                        p.courses.map((c) => (
                          <span key={c} className="doc">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="muted">None set</span>
                      )}
                    </div>
                  </div>

                  {p.skillsRequired?.length ? (
                    <div className="reqrow">
                      <div className="k">Skills</div>
                      <div className="doclist">
                        {p.skillsRequired.map((s) => (
                          <span key={s} className="doc">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="reqrow">
                    <div className="k">Minimum grade</div>
                    <div>
                      <b>{p.grade || "—"}</b>
                    </div>
                  </div>

                  <div className="reqrow" style={{ borderBottom: 0 }}>
                    <div className="k">Documents</div>
                    <div className="doclist">
                      {p.docs.length ? (
                        p.docs.map((d) => (
                          <span key={d} className="doc">
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="muted">None set</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="reqfoot">
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
      )}
    </>
  );
}
