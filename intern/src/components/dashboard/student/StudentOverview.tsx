"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchStudentUsage, isApiEnabled } from "../../../lib/api";
import { Icon } from "../../icons/Icons";

// Fallback only; the live limit comes from GET /billing/student/usage.
const DEMO_FREE_LIMIT = 30;

const APPLICATION_STEPS = ["Submitted", "Documents", "Review", "Decision"];

// Furthest stage each backend status has actually reached. Statuses are Title
// Case and come from the API (APPLICATION_STATUSES on the server).
const STEP_BY_STATUS: Record<string, number> = {
  Submitted: 0,
  "In Review": 2,
  Accepted: 3,
  Rejected: 3,
  Withdrawn: 0,
};

export function StudentOverview() {
  const {
    dashGo,
    session,
    applications,
    recommendations,
    dashboardDataStatus,
    getPlacement,
    getOrg,
  } = useApp();
  
  // The server counts applications for the billing period and is the only
  // authority on the free limit; the calendar-month tally below is a fallback
  // for when the API is switched off.
  const [usage, setUsage] = useState<{
    application_count: number;
    free_limit: number;
  } | null>(null);
  useEffect(() => {
    if (!isApiEnabled || !session) return;
    let alive = true;
    fetchStudentUsage()
      .then((value) => {
        if (alive) {
          setUsage({
            application_count: value.application_count,
            free_limit: value.free_limit,
          });
        }
      })
      .catch(() => {
        /* keep the local fallback */
      });
    return () => {
      alive = false;
    };
  }, [session, applications.length]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const localMonthlyApps = applications.filter(a => 
    a.created_at?.startsWith(currentMonth)
  ).length;
  const monthlyApps = usage?.application_count ?? localMonthlyApps;
  const FREE_LIMIT = usage?.free_limit ?? DEMO_FREE_LIMIT;
  const overLimit = monthlyApps >= FREE_LIMIT;
  if (dashboardDataStatus === "loading" || dashboardDataStatus === "idle") {
    return (
      <div className="dpane-h">
        <div>
          <h2>Loading your dashboard</h2>
          <p>Fetching your applications and internship recommendations…</p>
        </div>
      </div>
    );
  }
  if (dashboardDataStatus === "error") {
    return (
      <div className="dpane-h">
        <div>
          <h2>Dashboard unavailable</h2>
          <p>We could not load your live internship dashboard. Please try again.</p>
        </div>
      </div>
    );
  }
  const firstName = (session?.name || "").trim().split(/\s+/)[0];
  // The header said "Good morning" all day. Computed after the loading guard
  // above, so the server render never disagrees with the client.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const currentApplication = applications[0];
  const currentPlacement = currentApplication
    ? getPlacement(currentApplication.placement_id)
    : undefined;
  const currentOrg = currentPlacement ? getOrg(currentPlacement.orgId) : undefined;
  const matches = recommendations?.items || [];
  // The tracker used to be hardcoded to "two steps green". Drive it off the
  // application's real status so a rejected or withdrawn application stops
  // looking like it is still moving forward.
  const reachedStep = STEP_BY_STATUS[currentApplication?.status ?? ""] ?? 0;
  const declined = currentApplication?.status === "Rejected";

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>{firstName ? `${greeting}, ${firstName}` : greeting}</h2>
          <p>
            {applications.length} live application{applications.length === 1 ? "" : "s"} ·{" "}
            {matches.length} recommended internship{matches.length === 1 ? "" : "s"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={() => dashGo("placements")}
          >
            Find placements
          </button>
          {/* Application limit counter */}
          <div
            className="ticket"
            style={{
              padding: "10px 14px",
              minWidth: "220px",
              borderColor: overLimit ? "var(--red)" : monthlyApps >= FREE_LIMIT * 0.8 ? "var(--amber)" : "var(--green)",
              background: overLimit ? "var(--red-tint)" : monthlyApps >= FREE_LIMIT * 0.8 ? "var(--amber-tint)" : "var(--green-tint)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <span style={{ fontWeight: 600, color: overLimit ? "var(--red)" : monthlyApps >= FREE_LIMIT * 0.8 ? "var(--amber)" : "var(--green)" }}>
                {monthlyApps} / {FREE_LIMIT}
              </span>
              <span style={{ color: "var(--muted)", fontSize: "11px" }}>this month</span>
              {overLimit && (
                <span className="tg red" style={{ fontSize: "10px", marginLeft: "auto" }}>
                  Overage
                </span>
              )}
            </div>
            <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
              {overLimit
                ? "Free limit exceeded · overage invoices apply"
                : `${FREE_LIMIT - monthlyApps} free applications remaining`}
            </div>
          </div>
        </div>
      </div>

      <div className="dsplit">
        <div style={{ display: "grid", gap: "14px" }}>
          <div className="ticket" style={{ padding: "18px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <div>
                <span className="lbl">Current application</span>
                <h3
                  className="serif"
                  style={{
                    fontSize: "26px",
                    lineHeight: 1.1,
                    marginTop: "6px",
                  }}
                >
                  {currentPlacement?.title || "No application submitted yet"}
                </h3>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    marginTop: "3px",
                  }}
                >
                  {currentPlacement
                    ? `${currentOrg?.name || "Organisation"} · ${currentPlacement.loc} · closes ${currentPlacement.deadline}`
                    : "Choose a live internship to start your application"}
                </div>
              </div>
              {currentApplication && (
                <span className="tg gold">{currentApplication.status}</span>
              )}
            </div>
            {currentApplication && (
              <div
              style={{
                display: "flex",
                gap: 0,
                marginTop: "18px",
                borderTop: "1px dashed var(--rule-2)",
                paddingTop: "14px",
              }}
              >
                {APPLICATION_STEPS.map((s, i) => {
                  const reached = i <= reachedStep;
                  const tone = !reached
                    ? "var(--faint)"
                    : declined && i === reachedStep
                    ? "var(--red)"
                    : "var(--green)";
                  return (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      borderRight:
                        i < APPLICATION_STEPS.length - 1
                          ? "1px solid var(--rule)"
                          : 0,
                      paddingRight: "10px",
                    }}
                  >
                    <div
                      className="lbl"
                      style={{
                        color: tone,
                      }}
                    >
                      0{i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        marginTop: "3px",
                        color: reached ? "var(--ink)" : "var(--muted)",
                      }}
                    >
                      {s}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Recommended internships</span>
              <span className="lbl">{matches.length} live matches</span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "10px" }}>
              {matches.slice(0, 3).map(({ placement, match }) => (
                <button
                  key={placement.id}
                  type="button"
                  className="dashboard-recommendation"
                  onClick={() => dashGo("placements")}
                >
                  <span>
                    <b>{placement.title}</b>
                    <small>{placement.org?.name || "Organisation"} · {placement.loc}</small>
                  </span>
                  <strong>{match.score}%</strong>
                </button>
              ))}
              {!matches.length && <span className="muted">No recommendations are available.</span>}
              <button
                type="button"
                className="btn btn-sm btn-blue"
                onClick={() => dashGo("placements")}
              >
                View all recommendations
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Live match summary</span>
            </div>
            <div
              className="pb"
              style={{ display: "grid", gap: "7px", fontSize: "11.5px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Recommendations</span>
                <b>{matches.length}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Strong matches</span>
                <b>{matches.filter(({ match }) => match.score >= 70).length}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Best match</span>
                <b>{matches[0]?.match.score ?? 0}%</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Applications</span>
                <b>{applications.length}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
