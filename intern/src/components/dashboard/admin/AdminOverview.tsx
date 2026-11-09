"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import { ApiError, fetchAdminMetrics, fetchAdminQueue, fetchAdminActivity, isApiEnabled } from "../../../lib/api";
import { AdminQueueItem, ActivityItem } from "../../../types";

export function AdminOverview() {
  const { dashGo, newPlacement, reviewStudent, session } = useApp();
  const [metrics, setMetrics] = useState<{
    open_placements: number;
    pending_documents: number;
    students_placed: number;
    placement_record_complete: number;
  } | null>(null);
  const [queue, setQueue] = useState<AdminQueueItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadData();
  }, [session]);

  async function loadData() {
    setStatus("loading");
    try {
      const [metricsRes, queueRes, activityRes] = await Promise.all([
        fetchAdminMetrics(),
        fetchAdminQueue(),
        fetchAdminActivity(),
      ]);
      setMetrics(metricsRes);
      setQueue(queueRes.items);
      setActivity(activityRes);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load admin dashboard"
      );
      setStatus("error");
    }
  }

  const adminQueue = queue.slice(0, 5);

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Placement office</h2>
          <p>
            Makerere University · term 2, 2026 · {metrics?.open_placements ?? 42} open placements
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => dashGo("students")}
          >
            Review queue
          </button>
          <button
            type="button"
            className="btn btn-sm btn-blue"
            onClick={newPlacement}
          >
            <Icon name="plus" size={12} /> New placement
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="delta">+6</span>
          <b>{metrics?.open_placements ?? 42}</b>
          <span className="lbl">open placements</span>
        </div>
        <div className="kpi alert">
          <span className="delta">{metrics?.pending_documents ?? 23} due</span>
          <b>{metrics?.pending_documents ?? 23}</b>
          <span className="lbl">documents to verify</span>
        </div>
        <div className="kpi">
          <span className="delta">+18</span>
          <b>{metrics?.students_placed ?? 186}</b>
          <span className="lbl">students placed</span>
        </div>
        <div className="kpi">
          <b>{metrics?.placement_record_complete ?? 94}%</b>
          <span className="lbl">placement record complete</span>
        </div>
      </div>

      <div className="dsplit">
        <div className="panel">
          <div className="ph">
            <span className="lbl">Approval queue</span>
            <button
              type="button"
              className="lbl blue"
              onClick={() => dashGo("students")}
            >
              View all
            </button>
          </div>
          <div className="pb" style={{ padding: 0 }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Placement</th>
                  <th>Docs</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {status === "loading" ? (
                  <tr><td colSpan={5}>Loading queue...</td></tr>
                ) : !adminQueue || adminQueue.length === 0 ? (
                  <tr><td colSpan={5}>No students in the review queue.</td></tr>
                ) : (
                  adminQueue.map((s) => (
                    <tr key={s.n}>
                      <td className="who">
                        <b>{s.n}</b>
                        <span>
                          {s.c} · {s.y}
                        </span>
                      </td>
                      <td>{s.p}</td>
                      <td className="num">{s.d}</td>
                      <td>
                        <span
                          className={`tg ${
                            s.st === "Ready"
                              ? "green"
                              : s.st === "Review"
                              ? "gold"
                              : "red"
                          }`}
                        >
                          {s.st}
                        </span>
                      </td>
                      <td className="act">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => reviewStudent(s.n)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div className="panel">
            <div className="ph">
              <span className="lbl">Placements by organisation type</span>
            </div>
            <div className="pb bars">
              <div className="bar-row">
                <span>Companies</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: "64%" }}></div>
                </div>
                <b>27</b>
              </div>
              <div className="bar-row">
                <span>Government</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: "38%", background: "var(--green)" }}
                  ></div>
                </div>
                <b>9</b>
              </div>
              <div className="bar-row">
                <span>NGOs</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: "22%", background: "var(--red)" }}
                  ></div>
                </div>
                <b>4</b>
              </div>
              <div className="bar-row">
                <span>Universities</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: "12%", background: "var(--gold)" }}
                  ></div>
                </div>
                <b>2</b>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="lbl">Recent activity</span>
            </div>
            <div className="pb" style={{ display: "grid", gap: "9px" }}>
              {status === "loading" ? (
                <div>Loading activity...</div>
              ) : activity && activity.length === 0 ? (
                <div className="muted">No recent activity.</div>
              ) : (
                (activity || []).map(({ who: w, action: a, time: t }, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "8px",
                      fontSize: "11.5px",
                      borderBottom: "1px solid var(--rule)",
                      paddingBottom: "8px",
                    }}
                  >
                    <div>
                      <b style={{ fontWeight: 600 }}>{w}</b>{" "}
                      <span style={{ color: "var(--muted)" }}>{a}</span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "9px",
                        color: "var(--faint)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
