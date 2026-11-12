"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import { skillNames } from "../../../lib/skills";
import {
  ApiError,
  createLearningResource,
  deleteLearningResource,
  fetchLearningResources,
  isApiEnabled,
  LearningResource,
  LearningResourceInput,
  updateLearningResource,
} from "../../../lib/api";

const EMPTY_FORM: LearningResourceInput = {
  title: "",
  url: "",
  provider: "",
  description: "",
  skill: "",
  placement_id: "",
  level: "",
  resource_type: "Course",
  duration: "",
};

const LEVELS = ["", "Beginner", "Intermediate", "Advanced"];
const RESOURCE_TYPES = ["Course", "Video", "Article", "Guide", "Workshop", "Other"];

export function AdminLearning() {
  const { session, placements, toast } = useApp();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LearningResourceInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage = isApiEnabled && session?.role === "admin";

  async function loadResources() {
    setStatus("loading");
    setError("");
    try {
      const items = await fetchLearningResources();
      setResources(items);
      setStatus("ready");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load learning resources"
      );
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!canManage) {
      setStatus("ready");
      return;
    }
    void loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const skillOptions = useMemo(() => {
    const values = new Set<string>(skillNames());
    resources.forEach((r) => r.skill && values.add(r.skill));
    placements.forEach((p) =>
      (p.skillsRequired || []).forEach((s) => values.add(s))
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [resources, placements]);

  const placementTitle = (id: string) =>
    placements.find((p) => p.id === id)?.title || id;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (resource: LearningResource) => {
    setEditingId(resource.id);
    setForm({
      title: resource.title,
      url: resource.url,
      provider: resource.provider,
      description: resource.description,
      skill: resource.skill,
      placement_id: resource.placementId,
      level: resource.level,
      resource_type: resource.resourceType || "Course",
      duration: resource.duration,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateLearningResource(editingId, form);
        toast("Learning resource updated");
      } else {
        await createLearningResource(form);
        toast("Learning resource added");
      }
      closeForm();
      await loadResources();
    } catch (cause) {
      toast(
        cause instanceof ApiError
          ? cause.message
          : "Could not save the learning resource"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource: LearningResource) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove "${resource.title}" from the catalogue?`)
    ) {
      return;
    }
    setDeletingId(resource.id);
    try {
      await deleteLearningResource(resource.id);
      setResources((prev) => prev.filter((r) => r.id !== resource.id));
      toast("Learning resource removed");
    } catch (cause) {
      toast(
        cause instanceof ApiError
          ? cause.message
          : "Could not remove the learning resource"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Learning resources</h2>
          <p>
            Curate courses and guides that help students close the skill gaps on
            their match cards
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-blue"
          onClick={formOpen ? closeForm : openCreate}
          disabled={!isApiEnabled}
        >
          <Icon name={formOpen ? "x" : "plus"} size={12} />
          {formOpen ? "Close form" : "Add resource"}
        </button>
      </div>

      {!isApiEnabled && (
        <div className="panel">
          <div className="pb">
            <b style={{ fontSize: "14px" }}>Catalogue unavailable offline</b>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "6px" }}>
              Connect the API to manage the learning catalogue. The site keeps
              working from the bundled seed while no backend is configured.
            </p>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="panel" style={{ marginBottom: "16px" }}>
          <div className="ph">
            <span className="lbl">
              {editingId ? "Edit resource" : "New resource"}
            </span>
            {editingId && <span className="tg dark">editing</span>}
          </div>
          <div className="pb">
            <form className="form" onSubmit={handleSubmit}>
              <div className="row2">
                <div className="field">
                  <label htmlFor="lr-title">Title</label>
                  <input
                    id="lr-title"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. Python for Everybody"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="lr-url">URL</label>
                  <input
                    id="lr-url"
                    type="url"
                    value={form.url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://…"
                    required
                  />
                </div>
              </div>

              <div className="row2" style={{ marginTop: "12px" }}>
                <div className="field">
                  <label htmlFor="lr-provider">Provider</label>
                  <input
                    id="lr-provider"
                    value={form.provider}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, provider: e.target.value }))
                    }
                    placeholder="e.g. University of Michigan"
                  />
                </div>
                <div className="field">
                  <label htmlFor="lr-duration">Duration</label>
                  <input
                    id="lr-duration"
                    value={form.duration}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, duration: e.target.value }))
                    }
                    placeholder="e.g. 8 weeks"
                  />
                </div>
              </div>

              <div className="row2" style={{ marginTop: "12px" }}>
                <div className="field">
                  <label htmlFor="lr-skill">Skill</label>
                  <select
                    id="lr-skill"
                    value={form.skill}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, skill: e.target.value }))
                    }
                  >
                    <option value="">No linked skill</option>
                    {skillOptions.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="lr-placement">Placement</label>
                  <select
                    id="lr-placement"
                    value={form.placement_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        placement_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">No linked placement</option>
                    {placements.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row2" style={{ marginTop: "12px" }}>
                <div className="field">
                  <label htmlFor="lr-level">Level</label>
                  <select
                    id="lr-level"
                    value={form.level}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, level: e.target.value }))
                    }
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level || "Any level"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="lr-type">Type</label>
                  <select
                    id="lr-type"
                    value={form.resource_type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        resource_type: e.target.value,
                      }))
                    }
                  >
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: "12px" }}>
                <label htmlFor="lr-description">Description</label>
                <textarea
                  id="lr-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="What the student will learn and why it matters for the linked skill or placement."
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button
                  type="submit"
                  className="btn btn-sm btn-blue"
                  disabled={saving || !form.title.trim() || !form.url.trim()}
                >
                  <Icon name="save" size={13} />
                  {saving
                    ? "Saving…"
                    : editingId
                    ? "Save changes"
                    : "Add resource"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="ph">
          <span className="lbl">Catalogue</span>
          <span className="lbl">
            {resources.length} resource{resources.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="pb" style={{ padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Linked to</th>
                <th>Level</th>
                <th>Type</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                <tr>
                  <td colSpan={6}>Loading learning resources…</td>
                </tr>
              ) : status === "error" ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--red)" }}>
                    {error}{" "}
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginLeft: "8px" }}
                      onClick={() => void loadResources()}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ padding: "18px 8px" }}>
                      <b style={{ fontSize: "13px" }}>No resources yet</b>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--muted)",
                          marginTop: "4px",
                        }}
                      >
                        Add a course or guide and link it to a skill or
                        placement. Students will see it in their Learning view.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                resources.map((r) => (
                  <tr key={r.id}>
                    <td className="who" style={{ maxWidth: "320px" }}>
                      <b>{r.title}</b>
                      <span>
                        {r.provider || "Independent"}
                        {r.description ? ` · ${r.description}` : ""}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        {r.skill ? (
                          <span className="tg blue">{r.skill}</span>
                        ) : (
                          <span className="tg">Any skill</span>
                        )}
                        {r.placementId && (
                          <span className="tg" title={placementTitle(r.placementId)}>
                            {placementTitle(r.placementId)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{r.level || "Any level"}</td>
                    <td>{r.resourceType || "Course"}</td>
                    <td className="num">{r.duration || "—"}</td>
                    <td className="act">
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <a
                          className="btn btn-sm"
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ height: "28px", padding: "0 9px" }}
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ height: "28px", padding: "0 9px" }}
                          onClick={() => openEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ height: "28px", padding: "0 9px" }}
                          onClick={() => void handleDelete(r)}
                          disabled={deletingId === r.id}
                          aria-label={`Delete ${r.title}`}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
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
