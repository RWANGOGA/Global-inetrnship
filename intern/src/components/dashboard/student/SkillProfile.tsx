"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  extractSkills,
  requiredSkillsFor,
  skillList,
  skillNames,
} from "../../../lib/skills";
import {
  fetchRecommendedInternships,
  isApiEnabled,
  MatchResponse,
} from "../../../lib/api";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 40) return "var(--gold)";
  return "var(--muted)";
}

export function SkillProfile() {
  const {
    student,
    addSkill,
    removeSkill,
    setSkills,
    setSkillConfidence,
    openPlacement,
    toast,
  } = useApp();

  const [text, setText] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [picked, setPicked] = useState("");
  const [matches, setMatches] = useState<MatchResponse["items"]>([]);
  const [loading, setLoading] = useState(false);

  const owned = student.skills;
  const rated = owned.filter((s) => student.skillsConfidence[s]).length;

  const runExtract = () => {
    const found = extractSkills(text).filter((s) => !owned.includes(s));
    setSuggested(found);
    if (found.length === 0) {
      toast("No new skills recognised — add a project or paste more detail");
    }
  };

  const addAllSuggested = () => {
    setSkills([...owned, ...suggested]);
    setSuggested([]);
    toast(`${suggested.length} skill${suggested.length === 1 ? "" : "s"} added to your profile`);
  };

  const manualAdd = () => {
    const name = picked.trim();
    if (!name) return;
    if (!skillNames().includes(name)) {
      toast("Choose a skill from the list");
      return;
    }
    addSkill(name);
    setPicked("");
  };

  useEffect(() => {
    if (!isApiEnabled || !owned.length) {
      setMatches([]);
      return;
    }
    setLoading(true);
    fetchRecommendedInternships(
      owned,
      student.course,
      student.cgpa,
      6,
      student.skillsConfidence
    )
      .then((res) => {
        setMatches(res.items);
        setLoading(false);
      })
      .catch(() => {
        setMatches([]);
        setLoading(false);
      });
  }, [owned, student.course, student.cgpa, student.skillsConfidence]);

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Skills profile</h2>
          <p>
            {owned.length} skill{owned.length === 1 ? "" : "s"} on record ·{" "}
            {rated} rated · ranked against {matches.length} live placements
          </p>
        </div>
      </div>

      <div className="dsplit">
        <div style={{ display: "grid", gap: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Build from your experience</span>
            </div>
            <div className="pb">
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "10px", lineHeight: 1.6 }}>
                Paste project descriptions, coursework or CV bullets. We read
                out the skills we recognise — you confirm what is true.
              </p>
              <textarea
                className="field-textarea"
                style={{
                  width: "100%",
                  minHeight: "96px",
                  border: "1px solid var(--rule-2)",
                  borderRadius: "var(--r-sm)",
                  padding: "10px 12px",
                  fontSize: "13px",
                  outline: 0,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                placeholder="e.g. Built a React dashboard for a campus club, cleaned survey data in Excel, ran usability tests in Figma…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-blue"
                style={{ marginTop: "10px" }}
                onClick={runExtract}
                disabled={!text.trim()}
              >
                <Icon name="user" size={13} /> Extract skills
              </button>

              {suggested.length > 0 && (
                <div
                  style={{
                    marginTop: "14px",
                    borderTop: "1px solid var(--rule)",
                    paddingTop: "12px",
                  }}
                >
                  <div className="lbl" style={{ marginBottom: "8px" }}>
                    Found {suggested.length} — confirm to add
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {suggested.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="tg"
                        onClick={() => addSkill(s)}
                        title="Add to profile"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: "10px" }}
                    onClick={addAllSuggested}
                  >
                    Add all {suggested.length}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">On your profile</span>
              <span className="lbl">{owned.length}</span>
            </div>
            <div className="pb">
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px", lineHeight: 1.6 }}>
                Rate how comfortable you are with each skill. Beginner counts
                half, Intermediate three quarters and Advanced the full
                requirement in your match score.
              </p>
              {owned.length === 0 ? (
                <p style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                  No skills yet. Extract from text above or add one below.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {owned.map((s) => {
                    const level = student.skillsConfidence[s];
                    return (
                      <div
                        key={s}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                          padding: "8px 10px",
                          border: "1px solid var(--rule)",
                          borderRadius: "var(--r-sm)",
                        }}
                      >
                        <span className="tg blue" style={{ gap: "6px" }}>
                          {s}
                          <button
                            type="button"
                            onClick={() => removeSkill(s)}
                            aria-label={`Remove ${s}`}
                            style={{
                              background: "none",
                              border: 0,
                              cursor: "pointer",
                              color: "inherit",
                              lineHeight: 1,
                              fontSize: "13px",
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </span>
                        <div
                          style={{ display: "flex", gap: "4px", marginLeft: "auto" }}
                          role="group"
                          aria-label={`${s} confidence`}
                        >
                          {[
                            [1, "Beginner"],
                            [2, "Intermediate"],
                            [3, "Advanced"],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              className={`btn btn-sm ${level === value ? "btn-blue" : ""}`}
                              style={{
                                height: "26px",
                                padding: "0 8px",
                                fontSize: "10px",
                                fontWeight: 600,
                                borderColor:
                                  level === value ? "var(--blue)" : "var(--rule)",
                              }}
                              aria-pressed={level === value}
                              onClick={() => setSkillConfidence(s, value as number)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                <input
                  list="skill-list"
                  value={picked}
                  onChange={(e) => setPicked(e.target.value)}
                  placeholder="Add a skill…"
                  style={{
                    flex: 1,
                    border: "1px solid var(--rule-2)",
                    borderRadius: "var(--r-sm)",
                    height: "40px",
                    padding: "0 12px",
                    fontSize: "12.5px",
                    outline: 0,
                  }}
                />
                <datalist id="skill-list">
                  {skillList().filter((s) => !owned.includes(s.name)).map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={manualAdd}
                  disabled={!picked.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ alignSelf: "start" }}>
          <div className="ph">
            <span className="lbl">Best matches for you</span>
          </div>
          <div className="pb" style={{ display: "grid", gap: "12px" }}>
            {loading ? (
              <div>Loading recommendations...</div>
            ) : matches.length === 0 ? (
              <div style={{ color: "var(--muted)" }}>
                {owned.length === 0
                  ? "Add skills to your profile to see personalised recommendations."
                  : "No matching placements found. Try updating your skills or course."}
              </div>
            ) : (
              matches.map(({ placement: p, match }) => {
                const org = p.org;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPlacement(p.id)}
                    style={{
                      textAlign: "left",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--r-md)",
                      padding: "12px 13px",
                      background: "var(--white)",
                      cursor: "pointer",
                      display: "block",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "10px",
                      }}
                    >
                      <b style={{ fontSize: "13px" }}>{p.title}</b>
                      <span
                        className="mono"
                        style={{ color: scoreColor(match.score), fontSize: "13px", fontWeight: 600 }}
                      >
                        {match.score}%
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                      {org?.name} · {p.loc}
                    </div>

                    <div
                      style={{
                        height: "6px",
                        background: "var(--paper-2)",
                        borderRadius: "var(--r-pill)",
                        margin: "9px 0",
                        overflow: "hidden",
                      }}
                    >
                      <i
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${match.score}%`,
                          background: scoreColor(match.score),
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {match.matched.map((s) => (
                        <span key={s} className="tg green" style={{ fontSize: "8.5px" }}>
                          ✓ {s}
                        </span>
                      ))}
                      {match.missing.slice(0, 2).map((s) => (
                        <span key={s} className="tg" style={{ fontSize: "8.5px" }}>
                          {s}
                        </span>
                      ))}
                      {requiredSkillsFor(p).length === 0 && (
                        <span className="tg" style={{ fontSize: "8.5px" }}>
                          no skill list
                        </span>
                      )}
                    </div>
                    {!match.courseFit && (
                      <div style={{ fontSize: "10.5px", color: "var(--red)", marginTop: "7px" }}>
                        Your course ({student.course}) is not on their eligible list.
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}