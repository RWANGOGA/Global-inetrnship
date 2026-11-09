"use client";

import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

export function AdminTestimonial() {
  const { toast, uploadDocumentFile, session } = useApp();
  const [title, setTitle] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !testimonial.trim()) {
      toast("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      // Create a text file with the testimonial content
      const content = `Admin Testimonial: ${title}\n\n${testimonial}\n\n— ${session?.name || "Platform Admin"}`;
      const file = new File([content], "admin-testimonial.txt", { type: "text/plain" });
      await uploadDocumentFile("testimonial", file);
      toast("Testimonial submitted for verification");
      setTitle("");
      setTestimonial("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to submit testimonial");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Admin Testimonial</h2>
          <p>Share platform insights, governance updates, or success stories</p>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "14px",
        }}
        className="reqgrid"
      >
        <div className="panel">
          <div className="ph">
            <span className="lbl">Submit a testimonial</span>
          </div>
          <div className="pb">
            <form className="form" onSubmit={handleSubmit}>
              <div className="field">
                <label>Title</label>
                <input
                  placeholder="Platform integrity update: Q4 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Testimonial</label>
                <textarea
                  placeholder="Share platform updates, governance decisions, or success stories..."
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                ></textarea>
              </div>
              <div>
                <button className="btn btn-sm btn-blue" type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit for verification"}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="panel">
          <div className="ph">
            <span className="lbl">Status</span>
          </div>
          <div className="pb">
            <div className="check">
              <div className="ci todo">
                <span className="box"></span>
                <div className="t">
                  <b>Not submitted</b>
                  <span>Share platform insights</span>
                </div>
                <span className="st">Action</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}