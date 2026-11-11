"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { matchPlacement, requiredSkillsFor } from "../../lib/skills";

export function PlacementDetailView() {
  const {
    pid,
    getPlacement,
    getOrg,
    isEligible,
    student,
    docs,
    go,
    applyTo,
    toggleSave,
    isSaved,
    placements,
    meta,
  } = useApp();

  // The catalog arrives from the API; render nothing until it has landed
  // rather than crashing on an undefined placement. (meta is consumed so the
  // view re-renders once the server's matching tables load.)
  void meta;
  if (!placements.length) return null;

  const p = (pid ? getPlacement(pid) : null) || getPlacement(placements[0].id)!;
  const o = getOrg(p.orgId);
  const ok = isEligible(p);
  const saved = isSaved(p.id);
  const required = requiredSkillsFor(p);
  const match = matchPlacement(p, student.skills, student.course, student.cgpa);

  return (
    <>
      <div className="phead">
        <div className="wrap">
          <div className="crumb">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
              className="lbl"
            >
              Home
            </a>
            <span className="lbl">/</span>
            <a
              href="#placements"
              onClick={(e) => {
                e.preventDefault();
                go("placements");
              }}
              className="lbl"
            >
              Placements
            </a>
            <span className="lbl">/</span>
            <span className="lbl ink">{o?.type}</span>
          </div>
          <h1>{p.title}</h1>
          <p>
            {o?.name} · {p.loc} · {p.duration} · closes {p.deadline}
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className="dgrid">
          <div className="dcard">
            <div className="dhead">
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div className="jlogo lg" aria-hidden="true">{o?.seal}</div>
                <div>
                  <h1>{p.title}</h1>
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "var(--muted)",
                      marginTop: "5px",
                    }}
                  >
                    {o?.name} · {o?.sector}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`tg ${ok ? "green" : "red"}`}>
                  {ok ? "You qualify" : "Not eligible"}
                </span>
                <button
                  type="button"
                  className={`jsave ${saved ? "on" : ""}`}
                  aria-pressed={saved}
                  aria-label={saved ? "Remove from saved" : "Save placement"}
                  onClick={() => toggleSave(p.id)}
                >
                  <Icon name="save" size={18} />
                </button>
              </div>
            </div>

            <div className="dbody">
              <h3>About the placement</h3>
              <p>{p.about}</p>

              {o?.about && (
                <>
                  <h3>About {o.name}</h3>
                  <p style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>{o.about}</p>
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "12px 16px",
                      background: "var(--paper-2)",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--rule)",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                      {o.sector && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "var(--muted)" }}><Icon name="bldg" size={13} /></span>
                          <span>{o.sector}</span>
                        </div>
                      )}
                      {o.loc && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "var(--muted)" }}><Icon name="pin" size={13} /></span>
                          <span>{o.loc}</span>
                        </div>
                      )}
                      {o.type && o.type !== "Company" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "var(--muted)" }}><Icon name="shield-check" size={13} /></span>
                          <span>{o.type}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <h3>What you will do</h3>
              <ul>
                {p.duties.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>

              <h3>Requirements</h3>
              <div
                style={{
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  background: "var(--white)",
                }}
              >
                <div className="reqrow" style={{ padding: "11px 14px" }}>
                  <div className="k">Courses</div>
                  <div className="doclist">
                    {p.courses.map((c) => (
                      <span key={c} className="doc">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="reqrow" style={{ padding: "11px 14px" }}>
                  <div className="k">Minimum grade</div>
                  <div>
                    <b>{p.grade}</b>
                  </div>
                </div>
                <div className="reqrow" style={{ padding: "11px 14px" }}>
                  <div className="k">Documents</div>
                  <div className="doclist">
                    {p.docs.map((d) => (
                      <span key={d} className="doc">
                        <Icon name="doc" size={10} /> {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className="reqrow"
                  style={{ padding: "11px 14px", borderBottom: 0 }}
                >
                  <div className="k">Testimonial</div>
                  <div>
                    {p.testimonial
                      ? "Required from a previous supervisor"
                      : "Not required"}
                  </div>
                </div>
              </div>

              <h3>Skills match</h3>
              {required.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--muted)" }}>
                  This placement has no published skill profile yet.
                </p>
              ) : (
                <div className="skillmatch">
                  <div className="sm-head">
                    <b>{match.score}% match</b>
                    <span>
                      {match.matched.length} of {required.length} required skills
                      you already bring
                    </span>
                  </div>
                  <div className="sm-chips">
                    {required.map((s) => {
                      const has = match.matched.includes(s);
                      return (
                        <span key={s} className={`smpill ${has ? "yes" : "no"}`}>
                          <Icon name={has ? "check" : "plus"} size={10} /> {s}
                        </span>
                      );
                    })}
                  </div>
                  {match.missing.length > 0 && (
                    <div className="sm-note">
                      Close the gap on{" "}
                      <b>{match.missing.slice(0, 2).join(" and ")}</b> to lift
                      this match — your Skills profile can claim them from a
                      project or CV.
                    </div>
                  )}
                </div>
              )}

              <h3>Testimonials from past placements</h3>
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  padding: "14px",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-md)",
                  background: "#FBFAF6",
                }}
              >
                <div
                  className="seal"
                  style={{ width: "56px", height: "56px", fontSize: "6.5px" }}
                >
                  Class of<br />2025
                </div>
                <div>
                  <p style={{ fontSize: "13px", lineHeight: 1.65 }}>
                    “The work was real from the second week. I owned a data pipeline that is still running in the ministry.”
                  </p>
                  <div className="lbl" style={{ marginTop: "8px" }}>
                    Joel Mwangi · Statistics · placed 2025
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="side">
            <div className="ticket" style={{ padding: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <span className="lbl">Placement</span>
                <span className={`tg ${p.status === "Open" ? "green" : "gold"}`}>
                  {p.status}
                </span>
              </div>
              <div className="serif" style={{ fontSize: "28px", lineHeight: 1.1 }}>
                {p.stipend}
              </div>
              <div
                style={{
                  fontSize: "11.5px",
                  color: "var(--muted)",
                  marginTop: "2px",
                }}
              >
                {p.duration} · {p.mode}
              </div>
              <div
                style={{
                  margin: "14px 0 12px",
                  borderTop: "1px dashed var(--rule-2)",
                }}
              ></div>
              <div style={{ display: "grid", gap: "7px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Slots</span>
                  <b>{p.slots}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Applicants</span>
                  <b>{p.applicants}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Closes</span>
                  <b>{p.deadline}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Your grade</span>
                  <b>
                    {student.cgpa} · {student.course}
                  </b>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-blue btn-block"
                style={{ marginTop: "14px" }}
                onClick={() => applyTo(p.id)}
              >
                {ok ? "Apply with my pack" : "Request an exception"}
              </button>
              <button
                type="button"
                className="btn btn-block"
                style={{ marginTop: "8px" }}
                onClick={() => go("signin")}
              >
                Open my documents
              </button>
            </div>

            <div className="sbox">
              <div className="sh">
                <span className="lbl">Your documents</span>
                <span className="lbl">
                  {
                    p.docs.filter((d) => {
                      const h = docs.find((x) => x.name === d);
                      return h && h.status !== "missing";
                    }).length
                  }{" "}
                  of {p.docs.length}
                </span>
              </div>
              <div className="sb">
                {p.docs.map((d) => {
                  const have = docs.find((x) => x.name === d);
                  return (
                    <div
                      key={d}
                      className="file"
                      style={{ padding: "7px 0" }}
                    >
                      <span className="fi">
                        {have && have.status !== "missing" ? "✓" : "!"}
                      </span>
                      <div>
                        <b>{d}</b>
                        <span>{have ? have.status : "not uploaded"}</span>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="btn btn-sm btn-block"
                  style={{ marginTop: "10px" }}
                  onClick={() => go("signin")}
                >
                  Upload missing
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
