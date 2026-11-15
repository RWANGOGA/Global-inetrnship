"use client";

import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

export function StudentTestimonial() {
  const { toast, uploadDocumentFile, docs, placements } = useApp();
  const [supervisor, setSupervisor] = useState("");
  const [role, setRole] = useState("");
  const [project, setProject] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const testimonialDoc = docs.find((d) => d.name === "testimonial");
  const isUploaded = testimonialDoc && testimonialDoc.status !== "missing";
  const transcriptDoc = docs.find((d) => d.name === "transcript");
  const transcriptVerified = transcriptDoc?.status === "verified";
  const transcriptPending = transcriptDoc?.status === "pending";
  // "Required by 9 of your 12 eligible placements" and a dated "Transcript
  // verified" line were static copy; derive both from the live placements and
  // the student's own documents.
  const askingPlacements = placements.filter((p) => p.testimonial);
  const requiredCopy =
    placements.length === 0
      ? "No live placements to check against yet"
      : askingPlacements.length === 0
      ? `None of your ${placements.length} live placements require one`
      : `Required by ${askingPlacements.length} of your ${placements.length} live placements`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisor.trim() || !role.trim() || !project.trim() || !testimonial.trim()) {
      toast("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      // Create a text file with the testimonial content
      const content = `Testimonial for ${project}\n\nSupervisor: ${supervisor}\nRole: ${role}\n\n${testimonial}`;
      const file = new File([content], "testimonial.txt", { type: "text/plain" });
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
          <h2>Testimonial</h2>
          <p>{requiredCopy}</p>
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
                  <label>Supervisor name</label>
                  <input
                    placeholder="Dr. Sarah Nabukeera"
                    value={supervisor}
                    onChange={(e) => setSupervisor(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Role</label>
                  <input
                    placeholder="Senior lecturer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label>Placement or project</label>
                <input
                  placeholder="Kite Campus design system"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Testimonial</label>
                <textarea
                  placeholder="Describe the work and how it was supervised."
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
              {isUploaded ? (
                <div className="ci done">
                  <span className="box">
                    <Icon name="check" size={9} />
                  </span>
                  <div className="t">
                    <b>Testimonial submitted</b>
                    <span>{testimonialDoc?.status === "verified" ? "Verified" : "Pending review"}</span>
                  </div>
                  <span className="st">
                    {testimonialDoc?.status === "verified" ? "Met" : "Pending"}
                  </span>
                </div>
              ) : (
                <div className="ci todo">
                  <span className="box"></span>
                  <div className="t">
                    <b>Not submitted</b>
                    <span>
                      Needed for {askingPlacements.length} live placement
                      {askingPlacements.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="st">Action</span>
                </div>
              )}
              {transcriptVerified ? (
                <div className="ci done">
                  <span className="box">
                    <Icon name="check" size={9} />
                  </span>
                  <div className="t">
                    <b>Transcript verified</b>
                    <span>Cleared by the registry</span>
                  </div>
                  <span className="st">Met</span>
                </div>
              ) : transcriptPending ? (
                <div className="ci todo">
                  <span className="box"></span>
                  <div className="t">
                    <b>Transcript in review</b>
                    <span>Awaiting verification</span>
                  </div>
                  <span className="st">Pending</span>
                </div>
              ) : (
                <div className="ci todo">
                  <span className="box"></span>
                  <div className="t">
                    <b>Transcript not uploaded</b>
                    <span>Upload it under Documents</span>
                  </div>
                  <span className="st">Action</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
