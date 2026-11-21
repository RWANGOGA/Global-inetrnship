"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ApiError,
  fetchOrganizationInternships,
  fetchOrganizationApplicants,
  toggleInternshipApplicationShortlist,
  isApiEnabled,
} from "../../../lib/api";
import { Placement, ApplicationDto } from "../../../types";

export function EmployerOverview() {
  const { session, dashGo, organizationPlacements, toast } = useApp();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [applicants, setApplicants] = useState<ApplicationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "employer") {
      setLoading(false);
      return;
    }
    loadData();
  }, [session]);

  async function loadData() {
    setLoading(true);
    try {
      const placementsRes = await fetchOrganizationInternships();
      setPlacements(placementsRes);
      const results = await Promise.all(
        placementsRes.map((pl) =>
          fetchOrganizationApplicants(pl.id).catch(() => [] as ApplicationDto[])
        )
      );
      const all = results.flat().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setApplicants(all);
      setLoading(false);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load dashboard"
      );
      setLoading(false);
    }
  }

  const handleShortlist = async (app: ApplicationDto) => {
    try {
      await toggleInternshipApplicationShortlist(app.id);
      setApplicants((list) =>
        list.map((a) => (a.id === app.id ? { ...a, shortlisted: !a.shortlisted } : a))
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update shortlist");
    }
  };

  const totalPlacements = placements.length;
  const totalApplicants = applicants.length;
  const shortlisted = applicants.filter((a) => a.status === "Accepted").length;
  const pendingReview = applicants.filter((a) =>
    ["Submitted", "In Review"].includes(a.status)
  ).length;

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>{session?.name || "Your organisation"}</h2>
          <p>
            {totalPlacements} placement{totalPlacements === 1 ? "" : "s"} listed ·{" "}
            {totalApplicants} applicant{totalApplicants === 1 ? "" : "s"} ·{" "}
            {shortlisted} shortlisted
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-blue"
          onClick={() => dashGo("placements")}
        >
          <Icon name="plus" size={12} /> New internship
        </button>
      </div>
      <div className="kpis">
        <div className="kpi">
          <b>{totalPlacements}</b>
          <span className="lbl">placements live</span>
        </div>
        <div className="kpi">
          <b>{totalApplicants}</b>
          <span className="lbl">applicants</span>
        </div>
        <div className="kpi">
          <b>{shortlisted}</b>
          <span className="lbl">shortlisted</span>
        </div>
        <div className="kpi">
          <b>{pendingReview}</b>
          <span className="lbl">pending review</span>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <span className="lbl">Recent applicants</span>
          <button
            type="button"
            className="lbl blue"
            onClick={() => dashGo("applicants")}
          >
            View all
          </button>
        </div>
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Course</th>
                <th className="hide-xs">University</th>
                <th>Documents</th>
                <th>Fit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading applicants...</td>
                </tr>
              ) : !applicants || applicants.length === 0 ? (
                <tr>
                  <td colSpan={6}>No applicants yet.</td>
                </tr>
              ) : (
                (applicants || []).slice(0, 5).map((app) => (
                  <tr key={app.id}>
                    <td className="who">
                      <b>{app.user_name || app.user_email || `Candidate ${app.user_id.slice(0, 6)}`}</b>
                      <span>{app.user_email || ""}</span>
                    </td>
                    <td>{placements.find((p) => p.id === app.placement_id)?.title || app.placement_id}</td>
                    <td className="hide-xs">{app.created_at?.split("T")[0] || "—"}</td>
                    <td>
                      <span className={app.document_ids?.length ? "tg green" : "tg"}>
                        {app.document_ids?.length ? `${app.document_ids.length} docs` : "No docs"}
                      </span>
                    </td>
                    <td className="num">{app.shortlisted ? "★" : "—"}</td>
                    <td className="act">
                      <button
                        type="button"
                        className={`btn btn-sm ${app.shortlisted ? "btn-blue" : "btn-ghost"}`}
                        onClick={() => void handleShortlist(app)}
                      >
                        {app.shortlisted ? "Shortlisted" : "Shortlist"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dsplit" style={{ marginTop: "14px" }}>
        <div className="panel">
          <div className="ph">
            <span className="lbl">Plan and usage</span>
            <span className="tg gold">Free tier</span>
          </div>
          <div className="pb">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11.5px",
              }}
            >
              <span>Live placements</span>
              <b>{totalPlacements} of 3 free</b>
            </div>
            <div
              className="bar"
              style={{
                height: "5px",
                background: "var(--paper-2)",
                position: "relative",
                margin: "7px 0 12px",
              }}
            >
              <i
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  width: `${totalPlacements > 0 ? (totalPlacements / 3) * 100 : 0}%`,
                  background: "var(--blue)",
                }}
              ></i>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11.5px",
              }}
            >
              <span>Review time</span>
              <b className="gold">72 hours · standard</b>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11.5px",
                marginTop: "8px",
              }}
            >
              <span>Applications this month</span>
              <b>{totalApplicants}</b>
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "14px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-blue"
                onClick={() => dashGo("billing")}
              >
                Compare plans
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => dashGo("billing")}
              >
                Request invoice
              </button>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="ph">
            <span className="lbl">Premium tools</span>
          </div>
          <div className="pb" style={{ display: "grid", gap: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid var(--rule)",
                fontSize: "11.5px",
              }}
            >
              <span>Featured placement</span>
              <span className="tg">Off</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid var(--rule)",
                fontSize: "11.5px",
              }}
            >
              <span>Talent search</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => dashGo("billing")}
              >
                Unlock
              </button>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid var(--rule)",
                fontSize: "11.5px",
              }}
            >
              <span>ATS and calendar sync</span>
              <span className="tg">Off</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 0",
                fontSize: "11.5px",
              }}
            >
              <span>Career page embed</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { navigator.clipboard?.writeText(window.location.origin + "/embed"); toast("Embed code copied"); }}
              >
                Get code
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
