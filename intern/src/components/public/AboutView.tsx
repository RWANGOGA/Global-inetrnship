"use client";

import React from "react";
import { useApp } from "../../context/AppContext";

export function AboutView() {
  const { go } = useApp();

  return (
    <>
      <div className="phead">
        <div className="wrap">
          <div className="crumb">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
              className="lbl"
            >
              Home
            </a>
            <span className="lbl">/</span>
            <span className="lbl ink">About</span>
          </div>
          <h1>
            A placement and skills platform,<br />
            not just a job board.
          </h1>
          <p>
            BrighterWorks exists because the first rung of a career is decided by information — who tells you the requirement,
            whether your skills match, and whether anyone verifies that you meet it.
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className="about-lead">
          <div>
            <span className="lbl">Why we built it</span>
            <h2 style={{ marginTop: "12px" }}>
              Students were applying blind.<br />
              Universities were tracking in spreadsheets.
            </h2>
            <p>
              In most placement offices, requirements live in an email, documents live in a folder, and nobody can answer
              “does this student qualify?” without opening three files. Meanwhile companies, ministries and NGOs each publish
              placements in a different format, if at all, and students have no way to see how their skills compare.
            </p>
            <p>
              We built one record: the placement with its stated bar, the student with their verified documents and skill
              profile, and the office that sits between them — with skill-based matching, a guided application process,
              employer talent search, and transparent billing. Government listings are first-class citizens, not an afterthought.
            </p>
          </div>
          <div className="photo-frame tall">
            <img
              src="./img/classroom.jpg"
              alt="Students in a lecture room"
              loading="lazy"
              decoding="async"
              width={700}
              height={876}
            />
          </div>
        </div>
      </div>

      <section className="sec" style={{ paddingTop: "20px" }}>
        <div className="wrap">
          <div className="sec-h">
            <div>
              <span className="lbl">01 — Principles</span>
              <h2 style={{ marginTop: "12px" }}>Four rules we do not trade.</h2>
            </div>
            <p>These decide what gets built and what gets refused, including requests from employers.</p>
          </div>
          <div className="principles">
            <div className="principle">
              <span className="n">01</span>
              <h3>Requirements are public</h3>
              <p>Courses, grade, documents and testimonial rule are visible before an application. No hidden filters, no “strong preference” language.</p>
            </div>
            <div className="principle">
              <span className="n">02</span>
              <h3>Documents are verified, not trusted</h3>
              <p>The university approves every transcript, ID and recommendation. An employer never receives an unverified file.</p>
            </div>
            <div className="principle">
              <span className="n">03</span>
              <h3>Government listings are equal</h3>
              <p>Ministries and agencies use the same fields, the same deadline logic and the same index as companies, NGOs, and university departments.</p>
            </div>
            <div className="principle">
              <span className="n">04</span>
              <h3>Free for students and graduates</h3>
              <p>Browsing, applying, skill matching and document verification are free. Universities and host organisations fund the service.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap placed">
          <div>
            <span className="lbl">02 — How the index works</span>
            <h2
              className="serif"
              style={{
                fontSize: "clamp(26px,3vw,38px)",
                lineHeight: 1.05,
                margin: "12px 0 14px",
              }}
            >
              Four checks before<br />a placement goes live.
            </h2>
            <div className="principles" style={{ borderTop: "1px solid var(--ink)", marginTop: "10px" }}>
              <div className="principle" style={{ gridTemplateColumns: "44px 1fr" }}>
                <span className="n">01</span>
                <div>
                  <h3 style={{ fontSize: "18px" }}>Organisation verified</h3>
                  <p style={{ marginTop: "6px" }}>Registration or ministry charter, named supervisor, confirmed stipend.</p>
                </div>
              </div>
              <div className="principle" style={{ gridTemplateColumns: "44px 1fr" }}>
                <span className="n">02</span>
                <div>
                  <h3 style={{ fontSize: "18px" }}>Requirements checked</h3>
                  <p style={{ marginTop: "6px" }}>Courses exist in the university catalogue; the grade threshold is a real band.</p>
                </div>
              </div>
              <div className="principle" style={{ gridTemplateColumns: "44px 1fr", borderBottom: 0 }}>
                <span className="n">03</span>
                <div>
                  <h3 style={{ fontSize: "18px" }}>Deadline and slots confirmed</h3>
                  <p style={{ marginTop: "6px" }}>Re-checked every six hours; closed placements leave the index the same day.</p>
                </div>
              </div>
              <div className="principle" style={{ gridTemplateColumns: "44px 1fr", borderBottom: 0 }}>
                <span className="n">04</span>
                <div>
                  <h3 style={{ fontSize: "18px" }}>Skill match computed</h3>
                  <p style={{ marginTop: "6px" }}>Each student's skills, course and grade are matched against the placement's requirements, so eligibility is visible before applying.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="photo-frame wide">
            <img
              src="./img/building.jpg"
              alt="A university building and lawn"
              loading="lazy"
              decoding="async"
              width={1000}
              height={562}
            />
          </div>
        </div>
      </section>

      <section className="band-dark">
        <div className="wrap band-grid">
          <div>
            <span className="lbl">03 — The office</span>
            <h2 style={{ marginTop: "12px" }}>
              Small team.<br />One <em>record</em>.
            </h2>
            <p>
              We are a placement-software team working with universities and employers across Uganda, Kenya, Tanzania and
              Ethiopia. We help students and graduates find verified opportunities, help employers find matched talent,
              and we do not sell candidate data or rank students beyond the published criteria.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "22px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "#4A5D77", color: "#EDEAE0" }}
                onClick={() => go("contact")}
              >
                Contact the office
              </button>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "transparent", color: "#9DBBB2" }}
                onClick={() => go("universities")}
              >
                For universities
              </button>
            </div>
          </div>
          <div className="team" style={{ borderColor: "#2C3E59" }}>
            <div className="mem" style={{ borderColor: "#2C3E59" }}>
              <span className="seal blue" style={{ width: "56px", height: "56px", borderColor: "#4A5D77", color: "#9DBBB2" }}>
                AK
              </span>
              <b style={{ color: "#F0EDE4" }}>A. K.</b>
              <span style={{ color: "#8FA2BE" }}>Placement systems</span>
            </div>
            <div className="mem" style={{ borderColor: "#2C3E59" }}>
              <span className="seal blue" style={{ width: "56px", height: "56px", borderColor: "#4A5D77", color: "#9DBBB2" }}>
                JM
              </span>
              <b style={{ color: "#F0EDE4" }}>J. M.</b>
              <span style={{ color: "#8FA2BE" }}>Verification</span>
            </div>
            <div className="mem" style={{ borderColor: "#2C3E59" }}>
              <span className="seal blue" style={{ width: "56px", height: "56px", borderColor: "#4A5D77", color: "#9DBBB2" }}>
                SN
              </span>
              <b style={{ color: "#F0EDE4" }}>S. N.</b>
              <span style={{ color: "#8FA2BE" }}>University partnerships</span>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap">
          <h2>
            If you run a placement office,<br />
            we should talk.
          </h2>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-blue"
              onClick={() => go("contact")}
            >
              Request a demo
            </button>
            <button
              type="button"
              className="btn"
              style={{ borderColor: "#5A6058", color: "#EDEAE0" }}
              onClick={() => go("signin")}
            >
              Sign in
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
