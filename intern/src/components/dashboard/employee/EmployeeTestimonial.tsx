"use client";

import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

export function EmployeeTestimonial() {
  const { toast, uploadDocumentFile } = useApp();
  const [supervisor, setSupervisor] = useState("");
  const [role, setRole] = useState("");
  const [project, setProject] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisor.trim() || !role.trim() || !project.trim() || !testimonial.trim()) {
      toast("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      // Create a text file with the testimonial content
      const content = `Employee Testimonial for ${project}\n\nSupervisor: ${supervisor}\nRole: ${role}\n\n${testimonial}`;
      const file = new File([content], "employee-testimonial.txt", { type: "text/plain" });
      await uploadDocumentFile("testimonial", file);
      toast("Testimonial submitted for verification");
      setSupervisor("");
      setRole("");
      setProject("");
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
          <h2>Employee Testimonial</h2>
          <p>Share your workplace experience and insights</p>
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
              <div className="row2">
                <div className="field">
                  <label>Supervisor / Manager name</label>
                  <input
                    placeholder="James Okello"
                    value={supervisor}
                    onChange={(e) => setSupervisor(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Your role</label>
                  <input
                    placeholder="Software Engineer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label>Project / Department</label>
                <input
                  placeholder="Backend Engineering - Payments Team"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Testimonial</label>
                <textarea
                  placeholder="Describe your experience, growth, and workplace culture."
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
                  <span>Share your workplace experience</span>
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