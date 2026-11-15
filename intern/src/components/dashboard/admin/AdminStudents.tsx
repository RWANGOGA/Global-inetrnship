"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { ApiError, fetchAdminQueue, isApiEnabled } from "../../../lib/api";
import { downloadCsv } from "../../../lib/csv";
import { AdminQueueItem } from "../../../types";

export function AdminStudents() {
  const { reviewStudent, toast, session } = useApp();
  const [queue, setQueue] = useState<AdminQueueItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "admin") {
      setStatus("ready");
      return;
    }
    loadQueue();
  }, [session]);

  async function loadQueue() {
    setStatus("loading");
    try {
      const res = await fetchAdminQueue();
      setQueue(res.items);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load student queue"
      );
      setStatus("error");
    }
  }

  /**
   * The queue is already in memory, so the export needs no endpoint. Previously
   * the button only said "not yet implemented".
   */
  function handleExport() {
    if (queue.length === 0) {
      toast("Nothing to export yet.");
      return;
    }
    const rows: Array<Array<unknown>> = [
      ["Student", "Registration", "Course", "Year", "Placement", "Documents", "Status"],
      ...queue.map((s) => [s.n, s.i, s.c, s.y, s.p, s.d, s.st]),
    ];
    downloadCsv(rows, "student_queue.csv");
    toast(`Exported ${queue.length} student record${queue.length === 1 ? "" : "s"}`);
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Students</h2>
          <p>
            {queue.length} records ·{" "}
            {queue.filter((s) => s.st === "Review").length} documents awaiting verification
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExport}
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th className="hide-xs">Placement</th>
                <th>Documents</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                <tr><td colSpan={6}>Loading student queue...</td></tr>
              ) : status === "error" ? (
                <tr><td colSpan={6} className="error">{error}</td></tr>
              ) : !queue || queue.length === 0 ? (
                <tr><td colSpan={6}>No students in the queue.</td></tr>
              ) : (
                (queue || []).map((s) => (
                  <tr key={s.n}>
                    <td className="who">
                      <b>{s.n}</b>
                      <span>
                        {s.y} · {s.i}
                      </span>
                    </td>
                    <td>{s.c}</td>
                    <td className="hide-xs">{s.p}</td>
                    <td className="num">{s.d} verified</td>
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
                        Open record
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
