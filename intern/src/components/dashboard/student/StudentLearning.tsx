"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ApiError,
  fetchLearningResources,
  isApiEnabled,
  LearningResource,
} from "../../../lib/api";

type Scope = "all" | "mine" | "gaps";

function levelTone(level: string): string {
  if (level === "Advanced") return "red";
  if (level === "Intermediate") return "gold";
  return "green";
}

// The catalogue is curated by hand, so the stored link is whatever was pasted
// into the admin form and can arrive without a scheme ("www.coursera.org/x").
// The browser resolves that against our own page, sending the student to a 404
// on the app's domain instead of the course — which is what "opening a resource
// threw me out of the system" actually was. Anything that is not an http(s)
// address is not a link we are willing to render.
function externalUrl(raw: string): string {
  const value = (raw || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+\S*$/.test(value)) return `https://${value}`;
  return "";
}

export function StudentLearning() {
  const { student, placements, openPlacement, dashGo } = useApp();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [skillFilter, setSkillFilter] = useState("");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isApiEnabled) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError("");
    fetchLearningResources()
      .then((items) => {
        if (!cancelled) {
          setResources(items);
          setStatus("ready");
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Unable to load learning resources"
          );
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const owned = useMemo(
    () => new Set(student.skills.map((s) => s.toLowerCase())),
    [student.skills]
  );
  const ownsSkill = (skill: string) =>
    Boolean(skill) && owned.has(skill.toLowerCase());

  const skills = useMemo(() => {
    const values = new Set<string>();
    resources.forEach((r) => r.skill && values.add(r.skill));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [resources]);

  const counts = useMemo(
    () => ({
      all: resources.length,
      mine: resources.filter((r) => ownsSkill(r.skill)).length,
      gaps: resources.filter((r) => r.skill && !ownsSkill(r.skill)).length,
    }),
    // ownsSkill is derived from owned; listing it is unnecessary and noisy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resources, owned]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (skillFilter && r.skill !== skillFilter) return false;
      if (scope === "mine" && !ownsSkill(r.skill)) return false;
      if (scope === "gaps" && (!r.skill || ownsSkill(r.skill))) return false;
      if (!term) return true;
      return [r.title, r.provider, r.description, r.skill, r.resourceType]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, scope, skillFilter, search, owned]);

  const placementFor = (id: string) => placements.find((p) => p.id === id);

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
          <h2>Learning resources</h2>
          <p>
            Courses and guides for the skills placements ask for — curated by
            your placement office
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => dashGo("skills")}
        >
          <Icon name="user" size={13} /> Review your skills
        </button>
      </div>

      <div
        style={{
          // Filters over an unloaded or empty catalogue are dead controls with
          // a row of zero counts, so they wait for the first page of results.
          display: status === "ready" && resources.length > 0 ? "flex" : "none",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        {(
          [
            ["all", `All ${counts.all}`],
            ["mine", `For your skills ${counts.mine}`],
            ["gaps", `Skill gaps ${counts.gaps}`],
          ] as [Scope, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${scope === value ? "btn-blue" : ""}`}
            style={{ height: "30px", padding: "0 11px", fontSize: "11px" }}
            onClick={() => setScope(value)}
            aria-pressed={scope === value}
          >
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources…"
          style={{
            border: "1px solid var(--rule-2)",
            borderRadius: "var(--r-sm)",
            height: "34px",
            padding: "0 11px",
            fontSize: "12px",
            outline: 0,
            minWidth: "200px",
          }}
        />
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          style={{
            border: "1px solid var(--rule-2)",
            borderRadius: "var(--r-sm)",
            height: "34px",
            padding: "0 9px",
            fontSize: "12px",
            outline: 0,
            background: "var(--white)",
          }}
          aria-label="Filter by skill"
        >
          <option value="">All skills</option>
          {skills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
      </div>

      {status === "loading" ? (
        <div className="panel">
          <div className="pb">
            <b style={{ fontSize: "14px" }}>Loading the catalogue…</b>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "4px" }}>
              Fetching resources linked to your skills and placements.
            </p>
          </div>
        </div>
      ) : status === "error" ? (
        <div className="panel" style={{ borderColor: "var(--red)" }}>
          <div className="pb">
            <b style={{ fontSize: "14px", color: "var(--red)" }}>
              Could not load learning resources
            </b>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--ink-2)",
                marginTop: "6px",
                lineHeight: 1.6,
              }}
            >
              {error}.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: "12px" }}
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      ) : !isApiEnabled ? (
        <div className="panel">
          <div className="pb">
            <b style={{ fontSize: "14px" }}>Catalogue unavailable offline</b>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--muted)",
                marginTop: "6px",
                lineHeight: 1.6,
              }}
            >
              Learning resources are served by the placement office. Connect the
              API to browse the live catalogue.
            </p>
          </div>
        </div>
      ) : resources.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--rule)",
            borderRadius: "var(--r-lg)",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: "15px" }}>
            No learning resources yet
          </p>
          <p
            style={{
              fontSize: "12.5px",
              color: "var(--muted)",
              marginTop: "5px",
            }}
          >
            Your placement office has not published any resources. Check back
            after the next catalogue update.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--rule)",
            borderRadius: "var(--r-lg)",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: "15px" }}>
            Nothing matches those filters
          </p>
          <p
            style={{
              fontSize: "12.5px",
              color: "var(--muted)",
              marginTop: "5px",
            }}
          >
            Clear the search or choose another filter to see the rest of the
            catalogue.
          </p>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: "12px" }}
            onClick={() => {
              setScope("all");
              setSkillFilter("");
              setSearch("");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: "14px",
          }}
        >
          {filtered.map((r) => {
            const placement = r.placementId
              ? placementFor(r.placementId)
              : undefined;
            const matched = ownsSkill(r.skill);
            return (
              <div
                key={r.id}
                className="panel"
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div className="pb" style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      flexWrap: "wrap",
                      marginBottom: "9px",
                    }}
                  >
                    <span className="tg dark" style={{ fontSize: "9px" }}>
                      {r.resourceType || "Course"}
                    </span>
                    {r.level && (
                      <span
                        className={`tg ${levelTone(r.level)}`}
                        style={{ fontSize: "9px" }}
                      >
                        {r.level}
                      </span>
                    )}
                    {r.skill && (
                      <span
                        className={`tg ${matched ? "green" : "blue"}`}
                        style={{ fontSize: "9px" }}
                        title={
                          matched
                            ? "Already on your skills profile"
                            : "Not on your profile yet — this closes a gap"
                        }
                      >
                        {r.skill}
                      </span>
                    )}
                  </div>

                  <b style={{ fontSize: "14px", lineHeight: 1.35 }}>{r.title}</b>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--muted)",
                      marginTop: "3px",
                    }}
                  >
                    {r.provider || "Independent"}
                    {r.duration ? ` · ${r.duration}` : ""}
                  </div>

                  {r.description && (
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-2)",
                        lineHeight: 1.55,
                        marginTop: "9px",
                      }}
                    >
                      {r.description}
                    </p>
                  )}

                  {placement && (
                    <button
                      type="button"
                      onClick={() => openPlacement(placement.id)}
                      style={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        marginTop: "10px",
                        fontSize: "11px",
                        color: "var(--blue)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Helps with {placement.title} →
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "10px 14px",
                    borderTop: "1px solid var(--rule)",
                    background: "var(--paper-2)",
                  }}
                >
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                    {matched
                      ? "Builds on a skill you have"
                      : r.skill
                      ? "Closes a gap on your profile"
                      : "Open to all students"}
                  </span>
                  {externalUrl(r.url) ? (
                    <a
                      className="btn btn-sm btn-blue"
                      href={externalUrl(r.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Opens ${r.provider || "the provider"} in a new tab`}
                      style={{
                        height: "28px",
                        padding: "0 10px",
                        fontSize: "10.5px",
                        textDecoration: "none",
                      }}
                    >
                      Open <Icon name="arrow" size={11} />
                    </a>
                  ) : (
                    <span
                      className="tg"
                      style={{ fontSize: "9px" }}
                      title="The placement office saved this resource without a web address"
                    >
                      No link yet
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
