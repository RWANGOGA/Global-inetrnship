"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

export function StudentPack() {
  const {
    pack,
    docs,
    applications,
    recommendations,
    student,
    getPlacement,
    getOrg,
    previewPack,
    editPack,
    editPackTargets,
    go,
    toast,
  } = useApp();
  const attached = docs.filter((d) => d.status !== "missing");
  const missingDocs = docs.filter((d) => d.status === "missing");
  const pendingDocs = docs.filter((d) => d.status === "pending");
  const hasStatement = pack.statement.trim().length > 0;
  // "Ready to send" was a static green chip, so a pack with no statement or
  // unverified documents still advertised itself as sendable.
  const readyToSend =
    hasStatement && missingDocs.length === 0 && pendingDocs.length === 0;
  const averageMatch = recommendations?.items.length
    ? Math.round(
        recommendations.items.reduce((sum, item) => sum + item.match.score, 0) /
          recommendations.items.length
      )
    : null;

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Application pack</h2>
          <p>
            Written once, sent in one click — statement, verified documents and target roles
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-blue"
          onClick={previewPack}
        >
          See what an employer gets
        </button>
      </div>

      <div className="pack">
        <div className="pack-doc">
          <div className="ph">
            <div>
              <span className="lbl">
                Pack · {attached.length} of {docs.length} documents
              </span>
              <h3 style={{ marginTop: "6px" }}>{student.name} — {student.course || "Student"}</h3>
            </div>
            {readyToSend ? (
              <span className="tg green">Ready to send</span>
            ) : missingDocs.length > 0 ? (
              <span className="tg red">
                {missingDocs.length} document{missingDocs.length === 1 ? "" : "s"} missing
              </span>
            ) : pendingDocs.length > 0 ? (
              <span className="tg gold">
                {pendingDocs.length} awaiting verification
              </span>
            ) : (
              <span className="tg gold">Statement empty</span>
            )}
          </div>
          <div className="lbl" style={{ marginTop: "16px" }}>
            Statement
          </div>
          <p>{pack.statement}</p>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: "12px" }}
            onClick={editPack}
          >
            Edit statement
          </button>
          <div className="pack-stat">
            <div>
              <b>{attached.length}</b>
              <span>docs attached</span>
            </div>
            <div>
              <b>{pack.targets.length}</b>
              <span>target roles</span>
            </div>
            <div>
              <b>{averageMatch === null ? "—" : `${averageMatch}%`}</b>
              <span>avg. match</span>
            </div>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              marginTop: "14px",
              lineHeight: 1.6,
            }}
          >
            The pack is the same file for every application. Only the role reference and the closing line change — the statement, documents and verified status stay attached.
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Attachments</span>
              <span className="lbl">verified only</span>
            </div>
            <div className="pb">
              {docs.map((d) => {
                const isAttached = d.status !== "missing";
                return (
                  <div
                    key={d.name}
                    className={`attach ${isAttached ? "on" : ""}`}
                    onClick={() => toast(`${d.name}: ${d.status}`)}
                  >
                    <span className="ck">
                      {isAttached && <Icon name="check" size={9} />}
                    </span>
                    <span>{d.name}</span>
                    <span
                      className={`tg ${
                        d.status === "verified"
                          ? "green"
                          : d.status === "pending"
                          ? "gold"
                          : "red"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Target roles</span>
              <button
                type="button"
                className="lbl blue"
                onClick={editPackTargets}
              >
                Edit
              </button>
            </div>
            <div className="pb">
              <div className="doclist">
                {pack.targets.map((t) => (
                  <span key={t} className="doc">
                    {t}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-block"
                style={{ marginTop: "12px" }}
                onClick={() => go("placements")}
              >
                Apply to a placement
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Sent this term</span>
            </div>
            <div
              className="pb"
              style={{ display: "grid", gap: "8px", fontSize: "11.5px" }}
            >
              {applications.length === 0 ? (
                <span className="muted">No applications submitted yet.</span>
              ) : (
                applications.slice(0, 3).map((application) => {
                  const placement = getPlacement(application.placement_id);
                  const org = placement ? getOrg(placement.orgId) : undefined;
                  return (
                    <div key={application.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>
                        {placement?.title || "Internship application"}
                        {org ? ` · ${org.name}` : ""}
                      </span>
                      <b>{application.status}</b>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
