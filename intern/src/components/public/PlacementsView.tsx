"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { PlacementCard } from "./PlacementCard";

export function PlacementsView() {
  const {
    placements,
    getOrg,
    meta,
    typeFilter,
    setTypeFilter,
    sectorFilter,
    setSectorFilter,
    courseFilter,
    setCourseFilter,
    searchQuery,
    setSearchQuery,
    opportunityFilter,
    setOpportunityFilter,
    go,
    saved,
    catalogStatus,
  } = useApp();

  const [savedOnly, setSavedOnly] = useState(false);

  const sectors = useMemo(() => {
    const list = placements.map((p) => getOrg(p.orgId)?.sector).filter(Boolean) as string[];
    return ["All", ...Array.from(new Set(list))];
  }, [placements, getOrg]);

  const opportunityTabs = ["All", "Internship", "Gig", "Entry-level"] as const;

  const filtered = useMemo(() => {
    return placements.filter((p) => {
      const o = getOrg(p.orgId);
      if (!o) return false;
      if (savedOnly && !saved.includes(p.id)) return false;
      const t = typeFilter === "All" || o.type === typeFilter;
      const s = sectorFilter === "All" || o.sector === sectorFilter;
      const c = courseFilter === "All" || p.courses.includes(courseFilter);
      const opp = opportunityFilter === "All" || p.opportunityType === opportunityFilter.toLowerCase().replace("-", "_");
      const q =
        !searchQuery ||
        (p.title + " " + o.name).toLowerCase().includes(searchQuery.toLowerCase());
      return t && s && c && opp && q;
    });
  }, [placements, getOrg, typeFilter, sectorFilter, courseFilter, opportunityFilter, searchQuery, savedOnly, saved]);

  const handleReset = () => {
    setTypeFilter("All");
    setSectorFilter("All");
    setCourseFilter("All");
    setOpportunityFilter("All");
    setSearchQuery("");
    setSavedOnly(false);
  };

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
            <span className="lbl ink">Placements</span>
          </div>
          <h1>Find placements</h1>
          <p id="pcount">
            {catalogStatus === "loading"
              ? "Loading verified placements from the live catalogue."
              : catalogStatus === "error"
              ? "The live placement catalogue is unavailable. Please try again shortly."
              : `${filtered.length} of ${placements.length} open placements. Government and NGO listings carry the same requirement fields as companies.`}
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className="otabs" role="tablist" aria-label="Opportunity type">
          {opportunityTabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={opportunityFilter === tab}
              className={`otab ${opportunityFilter === tab ? "on" : ""}`}
              onClick={() => setOpportunityFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="fbar">
          <div className="fld">
            <label className="lbl">Organisation type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All organisations</option>
              {meta.orgTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "Company"
                    ? "Companies"
                    : t === "Government"
                    ? "Government agencies"
                    : t === "NGO"
                    ? "NGOs"
                    : t === "University"
                    ? "Universities"
                    : t}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label className="lbl">Sector</label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All sectors" : s}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label className="lbl">Course</label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="All">Any course</option>
              {meta.courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="fld" style={{ minWidth: "200px" }}>
            <label className="lbl">Search</label>
            <input
              id="pq"
              placeholder="Role or organisation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="spacer"></div>
          <button
            type="button"
            className={`chip ${savedOnly ? "on" : ""}`}
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly((v) => !v)}
          >
            <Icon name="save" size={13} /> Saved
            <b>{saved.length}</b>
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>

        <div className="dgrid" style={{ paddingTop: 0 }}>
          <div>
            {catalogStatus === "loading" ? (
              <div className="catalog-state" role="status">
                Loading internships…
              </div>
            ) : catalogStatus === "error" ? (
              <div className="catalog-state catalog-state-error" role="alert">
                We could not load internships from the live catalogue.
              </div>
            ) : filtered.length > 0 ? (
              <div className="jcards" id="plistBody">
                {filtered.map((p) => (
                  <PlacementCard key={p.id} placement={p} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "30px",
                  textAlign: "center",
                  color: "var(--muted)",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-lg)",
                }}
              >
                No internships match these filters.
              </div>
            )}
          </div>

          <aside className="side">
            <div className="sbox">
              <div className="sh">
                <span className="lbl">How eligibility works</span>
              </div>
              <div className="sb">
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--ink-2)",
                    lineHeight: 1.65,
                  }}
                >
                  A placement is open to you when your course is listed <b>and</b> your grade meets the stated minimum. Both fields are set by the university and the host organisation.
                </p>
                <div className="rule" style={{ margin: "12px 0" }}></div>
                <div className="lbl" style={{ marginBottom: "8px" }}>
                  Your record
                </div>
                <div style={{ fontSize: "12px" }}>Design · Year 3 · CGPA 3.7</div>
                <a
                  href="#signin"
                  className="btn btn-sm btn-block"
                  style={{ marginTop: "12px" }}
                  onClick={(e) => {
                    e.preventDefault();
                    go("signin");
                  }}
                >
                  Check my eligibility
                </a>
              </div>
            </div>

            <div className="sbox">
              <div className="sh">
                <span className="lbl">Documents usually asked for</span>
              </div>
              <div className="sb">
                <div className="doclist">
                  <span className="doc">
                    <Icon name="doc" size={10} /> Transcript
                  </span>
                  <span className="doc">
                    <Icon name="doc" size={10} /> Student ID
                  </span>
                  <span className="doc">
                    <Icon name="doc" size={10} /> Recommendation
                  </span>
                  <span className="doc">
                    <Icon name="doc" size={10} /> Testimonial
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
