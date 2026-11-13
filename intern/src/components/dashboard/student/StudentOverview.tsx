"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

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
  
  // Simple monthly application counter (current month only)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyApps = applications.filter(a => 
    a.created_at?.startsWith(currentMonth)
  ).length;
  const FREE_LIMIT = 30;
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
  const currentApplication = applications[0];
  const currentPlacement = currentApplication
    ? getPlacement(currentApplication.placement_id)
    : undefined;
  const currentOrg = currentPlacement ? getOrg(currentPlacement.orgId) : undefined;
  const matches = recommendations?.items || [];

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>{firstName ? `Good morning, ${firstName}` : "Good morning"}</h2>
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
                {["Submitted", "Documents", "Review", "Decision"].map(
                  (s, i) => (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      borderRight: i < 3 ? "1px solid var(--rule)" : 0,
                      paddingRight: "10px",
                    }}
                  >
                    <div
                      className="lbl"
                      style={{
                        color: i < 2 ? "var(--green)" : "var(--faint)",
                      }}
                    >
                      0{i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        marginTop: "3px",
                        color: i < 2 ? "var(--ink)" : "var(--muted)",
                      }}
                    >
                      {s}
                    </div>
                  </div>
                  )
                )}
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
