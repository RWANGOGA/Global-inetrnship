"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  requiredSkillsFor,
  skillList,
  skillNames,
} from "../../../lib/skills";
import {
  describeApiError,
  fetchRecommendedInternships,
  fetchSkillSuggestions,
  isApiEnabled,
  MatchResponse,
  matchSkillsFromBio,
  SkillMatchItemDto,
  SkillSuggestionDto,
} from "../../../lib/api";

const CONFIDENCE_LEVELS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Beginner", short: "Beginner" },
  { value: 2, label: "Intermediate", short: "Intermediate" },
  { value: 3, label: "Advanced", short: "Advanced" },
];

const LEVEL_LABEL: Record<number, string> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
};

/** Where the last set of matches came from, so the panel can say so. */
type MatchSource = "ai" | "keywords" | "local" | "";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 40) return "var(--gold)";
  return "var(--muted)";
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-lg)",
        padding: "14px 16px",
        background: "var(--white)",
        minWidth: "120px",
      }}
    >
      <div className="lbl" style={{ marginBottom: "4px" }}>
        {label}
      </div>
      <b style={{ fontSize: "22px", lineHeight: 1.1 }}>{value}</b>
      {hint && (
        <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "3px" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function SkillProfile() {
  const {
    student,
    addSkill,
    removeSkill,
    setSkillConfidence,
    openPlacement,
    toast,
    dashboardDataStatus,
  } = useApp();

  const [bio, setBio] = useState("");
  const [intake, setIntake] = useState<SkillMatchItemDto[]>([]);
  const [intakeSource, setIntakeSource] = useState<MatchSource>("");
  const [intakeNote, setIntakeNote] = useState("");
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState("");
  const [intakeDismissed, setIntakeDismissed] = useState<string[]>([]);
  const [picked, setPicked] = useState("");
  const [matches, setMatches] = useState<MatchResponse["items"]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState(false);
  const [suggestions, setSuggestions] = useState<SkillSuggestionDto[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const owned = student.skills;
  const rated = owned.filter((s) => student.skillsConfidence[s]).length;
  const topScore = matches.length
    ? Math.max(...matches.map((m) => m.match.score))
    : 0;
  const visibleSuggestions = suggestions.filter(
    (s) => !owned.includes(s.name) && !dismissed.includes(s.name)
  );
  // A just-accepted skill leaves `intake`, but the profile update is async —
  // filtering on `owned` keeps the row from lingering for a frame.
  const visibleMatches = intake.filter(
    (m) => !owned.includes(m.name) && !intakeDismissed.includes(m.name)
  );

  const runExtract = async () => {
    const text = bio.trim();
    if (!text) return;
    if (!isApiEnabled) {
      // Demo mode has no server to ask, and the skill tables come from the API,
      // so there is nothing honest to show here.
      setIntake([]);
      setIntakeSource("");
      setIntakeNote("Skill matching needs the live catalogue. Connect to the API to use it.");
      return;
    }
    setIntakeLoading(true);
    setIntakeError("");
    setIntakeNote("");
    setIntakeDismissed([]);
    try {
      const result = await matchSkillsFromBio(text, owned);
      setIntake(result.items);
      setIntakeSource(result.source === "ai" ? "ai" : "keywords");
      setIntakeNote(result.note);
    } catch (cause) {
      // No local duplicate of the matcher to fall back on: report the failure
      // instead of quietly showing a shorter, unexplained list.
      setIntake([]);
      setIntakeSource("");
      setIntakeError(
        describeApiError(cause, "Could not read that description. Try again.").message
      );
    } finally {
      setIntakeLoading(false);
    }
  };

  const acceptMatch = (item: SkillMatchItemDto) => {
    addSkill(item.name, "bio");
    if (item.level) setSkillConfidence(item.name, item.level);
    setIntake((prev) => prev.filter((m) => m.name !== item.name));
    toast(
      `${item.name} added${item.level ? ` as ${LEVEL_LABEL[item.level]}` : ""}`
    );
  };

  const addAllMatches = () => {
    const pending = visibleMatches;
    pending.forEach((item) => {
      addSkill(item.name, "bio");
      if (item.level) setSkillConfidence(item.name, item.level);
    });
    setIntake((prev) => prev.filter((m) => !pending.some((p) => p.name === m.name)));
    toast(`${pending.length} skill${pending.length === 1 ? "" : "s"} added to your profile`);
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

  const acceptSuggestion = (name: string) => {
    addSkill(name, "course");
    toast(`${name} added from your course`);
  };

  useEffect(() => {
    if (!isApiEnabled || !student.course) {
      setSuggestions([]);
      setSuggestionsError(false);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    setSuggestionsError(false);
    fetchSkillSuggestions(student.course)
      .then((res) => {
        if (!cancelled) setSuggestions(res.items);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestionsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student.course, owned]);

  useEffect(() => {
    if (!isApiEnabled || !owned.length) {
      setMatches([]);
      setMatchesError(false);
      return;
    }
    let cancelled = false;
    setMatchesLoading(true);
    setMatchesError(false);
    fetchRecommendedInternships(
      owned,
      student.course,
      student.cgpa,
      6,
      undefined,
      student.skillsConfidence
    )
      .then((res) => {
        if (!cancelled) setMatches(res.items);
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
          setMatchesError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owned, student.course, student.cgpa, student.skillsConfidence]);

  const dataLoading = dashboardDataStatus === "loading";
  const dataError = dashboardDataStatus === "error";

  return (
    <>
      <div
        className="dpane-h"
        style={{
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
          marginBottom: "8px",
          paddingBottom: "20px",
          borderBottom: "2px solid var(--rule)",
        }}
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <h2>Skills profile</h2>
          <p>Evidence-backed skills that drive every match score</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "160px",
              height: "8px",
              background: "var(--rule-2)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${owned.length ? (rated / owned.length) * 100 : 0}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--blue), var(--blue-2))",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--ink)",
              whiteSpace: "nowrap",
            }}
          >
            {rated} / {owned.length} rated
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <Stat label="Skills" value={owned.length} hint="on your profile" />
        <Stat
          label="Course"
          value={student.course || "Not set"}
          hint={student.uni || "University not set"}
        />
        <Stat
          label="Best match"
          value={topScore ? `${topScore}%` : "—"}
          hint={
            matches.length
              ? `across ${matches.length} placements`
              : "add skills to rank"
          }
        />
      </div>

      {dataLoading ? (
        <div className="panel">
          <div className="pb" style={{ display: "grid", gap: "10px" }}>
            <b style={{ fontSize: "14px" }}>Loading your profile…</b>
            <p style={{ fontSize: "12.5px", color: "var(--muted)" }}>
              Reading your skills, course and saved ratings.
            </p>
          </div>
        </div>
      ) : dataError ? (
        <div className="panel" style={{ borderColor: "var(--red)" }}>
          <div className="pb">
            <b style={{ fontSize: "14px", color: "var(--red)" }}>
              Could not load your profile
            </b>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--ink-2)",
                marginTop: "6px",
                lineHeight: 1.6,
              }}
            >
              The server did not return your skills. Refresh the page to try
              again.
            </p>
          </div>
        </div>
      ) : (
        <div className="dsplit">
          <div style={{ display: "grid", gap: "14px" }}>
            <div className="panel">
              <div className="ph">
                <span className="lbl">On your profile</span>
                <span className="lbl">{owned.length}</span>
              </div>
              <div className="pb">
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    marginBottom: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  Rate how comfortable you are with each skill. Beginner counts
                  half, Intermediate three quarters and Advanced the full
                  requirement in your match score.
                </p>

                {owned.length === 0 ? (
                  <div
                    style={{
                      border: "2px dashed var(--rule)",
                      borderRadius: "var(--r-lg)",
                      padding: "28px 20px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ fontWeight: 600, fontSize: "14px" }}>
                      No skills yet
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginTop: "4px",
                      }}
                    >
                      Accept a course suggestion, or describe your work below and
                      let the matcher name the skills.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {owned.map((s) => {
                      const level = student.skillsConfidence[s];
                      const source = student.skillsSource[s];
                      return (
                        <div
                          key={s}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            alignItems: "center",
                            gap: "8px",
                            border: "1px solid var(--rule)",
                            borderRadius: "var(--r-md)",
                            padding: "10px 12px",
                            background: "var(--white)",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <b style={{ fontSize: "13px" }}>{s}</b>
                              {source && (
                                <span
                                  className={`tg ${
                                    source === "course" ? "blue" : "dark"
                                  }`}
                                  style={{ fontSize: "9px" }}
                                >
                                  {source}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: "10.5px",
                                color: "var(--muted)",
                                marginTop: "2px",
                              }}
                            >
                              {level
                                ? CONFIDENCE_LEVELS.find(
                                    (l) => l.value === level
                                  )?.label
                                : "Not rated — counts in full"}
                            </div>
                          </div>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: "4px" }}
                            role="group"
                            aria-label={`${s} confidence`}
                          >
                            {CONFIDENCE_LEVELS.map(({ value, short }) => (
                              <button
                                key={value}
                                type="button"
                                className={`btn btn-sm ${
                                  level === value ? "btn-blue" : ""
                                }`}
                                style={{
                                  height: "26px",
                                  padding: "0 7px",
                                  fontSize: "9.5px",
                                  fontWeight: 600,
                                  borderColor:
                                    level === value ? "var(--blue)" : "var(--rule)",
                                }}
                                aria-pressed={level === value}
                                onClick={() => setSkillConfidence(s, value)}
                              >
                                {short}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => removeSkill(s)}
                              aria-label={`Remove ${s}`}
                              style={{
                                background: "none",
                                border: 0,
                                cursor: "pointer",
                                color: "var(--muted)",
                                lineHeight: 1,
                                fontSize: "15px",
                                padding: "0 2px",
                              }}
                            >
                              ×
                            </button>
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
                    {skillList()
                      .filter((s) => !owned.includes(s.name))
                      .map((s) => (
                        <option key={s.name} value={s.name} />
                      ))}
                  </datalist>
                  <button
                    type="button"
                    className="btn btn-sm btn-blue"
                    onClick={manualAdd}
                    disabled={!picked.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="ph">
                <span className="lbl">Suggested from your course</span>
                <span className="lbl">{visibleSuggestions.length}</span>
              </div>
              <div className="pb">
                {suggestionsLoading ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Reading live placement requirements…
                  </p>
                ) : suggestionsError ? (
                  <p style={{ fontSize: "12px", color: "var(--red)" }}>
                    Could not load suggestions. Check your connection and try
                    again.
                  </p>
                ) : !student.course ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Add your course to see skills that placements open to you
                    usually require.
                  </p>
                ) : visibleSuggestions.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    No new course-based suggestions right now. You already cover
                    the skills these placements ask for.
                  </p>
                ) : (
                  <>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginBottom: "10px",
                        lineHeight: 1.5,
                      }}
                    >
                      Required by placements open to {student.course}. Accept
                      what you can evidence; dismiss the rest.
                    </p>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {visibleSuggestions.map((s) => (
                        <div
                          key={s.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            border: "1px solid var(--rule)",
                            borderRadius: "var(--r-sm)",
                            padding: "8px 10px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <b style={{ fontSize: "12.5px" }}>{s.name}</b>
                            <div
                              style={{ fontSize: "10.5px", color: "var(--muted)" }}
                            >
                              {s.category} · needed by {s.demand} placement
                              {s.demand === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "5px",
                              marginLeft: "auto",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-sm btn-blue"
                              style={{
                                height: "28px",
                                padding: "0 9px",
                                fontSize: "10.5px",
                              }}
                              onClick={() => acceptSuggestion(s.name)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                height: "28px",
                                padding: "0 9px",
                                fontSize: "10.5px",
                              }}
                              onClick={() =>
                                setDismissed((prev) => [...prev, s.name])
                              }
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginTop: "10px" }}
                      onClick={() => {
                        visibleSuggestions.forEach((s) =>
                          addSkill(s.name, "course")
                        );
                        toast(
                          `${visibleSuggestions.length} course skill${
                            visibleSuggestions.length === 1 ? "" : "s"
                          } added`
                        );
                      }}
                    >
                      Accept all {visibleSuggestions.length}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="ph">
                <span className="lbl">Describe what you have done</span>
                {intakeSource === "ai" && (
                  <span className="tg blue" style={{ fontSize: "8.5px" }}>
                    AI matched
                  </span>
                )}
                {intakeSource === "keywords" && (
                  <span className="tg" style={{ fontSize: "8.5px" }}>
                    keyword match
                  </span>
                )}
              </div>
              <div className="pb">
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    marginBottom: "10px",
                    lineHeight: 1.6,
                  }}
                >
                  Describe yourself the way you would to a friend — a course, a
                  project, a job, what you actually did. We read it for the
                  skills this platform scores, and you confirm what is true.
                </p>
                <textarea
                  style={{
                    width: "100%",
                    minHeight: "118px",
                    border: "1px solid var(--rule-2)",
                    borderRadius: "var(--r-sm)",
                    padding: "10px 12px",
                    fontSize: "13px",
                    outline: 0,
                    resize: "vertical",
                    fontFamily: "inherit",
                    lineHeight: 1.6,
                  }}
                  placeholder="e.g. I am a second-year student. I redesigned our church website in Figma and built the sign-up form with React. Last term I helped the clinic move their paper patient files into a spreadsheet and wrote the SQL for the monthly report."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={4000}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "10px",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-blue"
                    onClick={runExtract}
                    disabled={!bio.trim() || intakeLoading}
                  >
                    <Icon name="search" size={13} />
                    {intakeLoading ? "Reading…" : "Match skills"}
                  </button>
                  {visibleMatches.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={addAllMatches}
                    >
                      Add all {visibleMatches.length}
                    </button>
                  )}
                  <span
                    style={{ fontSize: "10.5px", color: "var(--faint)", marginLeft: "auto" }}
                  >
                    {bio.length}/4000
                  </span>
                </div>

                {intakeError && (
                  <p
                    style={{
                      fontSize: "11.5px",
                      color: "var(--red)",
                      marginTop: "10px",
                      lineHeight: 1.5,
                    }}
                  >
                    {intakeError}
                  </p>
                )}

                {!intakeLoading && intakeNote && (
                  <p
                    style={{
                      fontSize: "11.5px",
                      color: "var(--muted)",
                      marginTop: "10px",
                      lineHeight: 1.5,
                    }}
                  >
                    {intakeNote}
                  </p>
                )}

                {intakeLoading ? (
                  <p
                    style={{ fontSize: "12px", color: "var(--muted)", marginTop: "12px" }}
                  >
                    Reading your description…
                  </p>
                ) : visibleMatches.length > 0 ? (
                  <div
                    style={{
                      marginTop: "14px",
                      borderTop: "1px solid var(--rule)",
                      paddingTop: "12px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <div className="lbl">
                      {visibleMatches.length} found — confirm what is true
                    </div>
                    {visibleMatches.map((m) => (
                      <div
                        key={m.name}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          border: "1px solid var(--rule)",
                          borderRadius: "var(--r-sm)",
                          padding: "9px 11px",
                          background: "var(--white)",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <b style={{ fontSize: "12.5px" }}>{m.name}</b>
                            {m.category && (
                              <span className="tg" style={{ fontSize: "8.5px" }}>
                                {m.category}
                              </span>
                            )}
                            {m.level ? (
                              <span
                                className="tg gold"
                                style={{ fontSize: "8.5px" }}
                              >
                                {LEVEL_LABEL[m.level]}
                              </span>
                            ) : null}
                          </div>
                          {m.reason && (
                            <div
                              style={{
                                fontSize: "10.5px",
                                color: "var(--muted)",
                                marginTop: "3px",
                                lineHeight: 1.5,
                              }}
                            >
                              {m.reason}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-blue"
                            style={{
                              height: "26px",
                              padding: "0 9px",
                              fontSize: "10px",
                            }}
                            onClick={() => acceptMatch(m)}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              height: "26px",
                              padding: "0 9px",
                              fontSize: "10px",
                            }}
                            onClick={() =>
                              setIntakeDismissed((prev) => [...prev, m.name])
                            }
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  intakeSource !== "" &&
                  !intakeError && (
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginTop: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      Nothing new to add from that. Name a tool, a course or a
                      project and try again.
                    </p>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="panel" style={{ alignSelf: "start" }}>
            <div className="ph">
              <span className="lbl">Best matches for you</span>
              <span className="lbl">{matches.length}</span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "12px" }}>
              {matchesLoading ? (
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Ranking live placements…
                </div>
              ) : matchesError ? (
                <div style={{ fontSize: "12px", color: "var(--red)" }}>
                  Could not load recommendations. Check your connection and try
                  again.
                </div>
              ) : matches.length === 0 ? (
                <div
                  style={{
                    border: "2px dashed var(--rule)",
                    borderRadius: "var(--r-lg)",
                    padding: "28px 20px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: "14px" }}>
                    No ranked placements yet
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      marginTop: "4px",
                    }}
                  >
                    {owned.length === 0
                      ? "Add skills to see personalised recommendations."
                      : "No matching placements found. Try updating your skills or course."}
                  </p>
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
                          style={{
                            color: scoreColor(match.score),
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          {match.score}%
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--muted)",
                          marginTop: "2px",
                        }}
                      >
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

                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}
                      >
                        {match.matched.map((s) => (
                          <span
                            key={s}
                            className="tg green"
                            style={{ fontSize: "8.5px" }}
                          >
                            ✓ {s}
                          </span>
                        ))}
                        {match.missing.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            className="tg"
                            style={{ fontSize: "8.5px" }}
                          >
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
                        <div
                          style={{
                            fontSize: "10.5px",
                            color: "var(--red)",
                            marginTop: "7px",
                          }}
                        >
                          Your course ({student.course}) is not on their eligible
                          list.
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
