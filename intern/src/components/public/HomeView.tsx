"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { PlacementCard } from "./PlacementCard";
import { TestimonialCarousel } from "./TestimonialCarousel";
import { fetchCatalog, fetchJobs, isApiEnabled, fetchPublicTestimonials, fetchHomeStats } from "../../lib/api";
import type { Placement } from "../../types";

export function HomeView() {
  const {
    placements,
    go,
    setType,
    openPlacement,
    setTypeFilter,
    setSearchQuery,
  } = useApp();

  const [heroType, setHeroType] = useState("All");
  const [heroQuery, setHeroQuery] = useState("");
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setTypeFilter(heroType);
    setSearchQuery(heroQuery.trim());
    go("placements");
  };

  // Keep the home page up-to-date with the backend: refresh the catalogue and
  // job listings on mount so no figure is hard-coded.
  const [catalog, setCatalog] = useState<{ placements: Placement[]; orgs: any[] } | null>(null);
  const [orgCounts, setOrgCounts] = useState<Record<string, number>>({});
  const [jobs, setJobs] = useState<any[]>([]);

  const latest = placements.slice(0, 6);

  useEffect(() => {
    if (!isApiEnabled || window.location.hash === "#") return;
    (async () => {
      try {
        const cat = await fetchCatalog();
        setCatalog(cat);
        const typeMap = new Map<string, string>();
        cat.orgs.forEach((o: any) => { typeMap.set(o.type, o.type); });
        const counts: Record<string, number> = {};
        cat.placements.forEach((p: Placement) => {
          const t = typeMap.get(p.org?.id ?? "") || "Unknown";
          counts[t] = (counts[t] || 0) + 1;
        });
        setOrgCounts(counts);
        const jobList = await fetchJobs();
        setJobs(jobList);
      } catch (err) {
        console.error("backend fetch error", err);
      }
    })();
  }, []);

  // Fetch testimonials for carousel
  useEffect(() => {
    if (!isApiEnabled) return;
    (async () => {
      try {
        const data = await fetchPublicTestimonials(10);
        setTestimonials(data);
      } catch (err) {
        console.error("Failed to fetch testimonials", err);
      }
    })();
  }, []);

  // Fetch home stats
  useEffect(() => {
    if (!isApiEnabled) return;
    (async () => {
      try {
        const data = await fetchHomeStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch home stats", err);
      }
    })();
  }, []);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <span className="lbl blue">The placement office, in software</span>
            </div>
            <h1>
              Placement.
            </h1>
            <p className="lede">
              Universities list internships from companies, government agencies and NGOs in one place — with the required courses, the minimum grade and the exact documents stated before anyone applies.
            </p>

            <form className="searchcard" onSubmit={handleHeroSearch}>
              <div className="searchgrid">
                <div className="sf">
                  <label className="lbl">Search</label>
                  <input
                    id="hq"
                    placeholder="Role, skill or organisation"
                    value={heroQuery}
                    onChange={(e) => setHeroQuery(e.target.value)}
                  />
                </div>
                <div className="sf">
                  <label className="lbl">Placement type</label>
                  <select
                    id="hType"
                    value={heroType}
                    onChange={(e) => setHeroType(e.target.value)}
                  >
                    <option value="All">All organisations</option>
                    <option value="Company">Companies</option>
                    <option value="Government">Government agencies</option>
                    <option value="NGO">NGOs and foundations</option>
                    <option value="University">University departments</option>
                  </select>
                </div>
                <div className="sf">
                  <label className="lbl">Location</label>
                  <select id="hLoc">
                    <option>Anywhere</option>
                    <option>Kampala</option>
                    <option>Nairobi</option>
                    <option>Remote</option>
                  </select>
                </div>
                <button type="submit" aria-label="Search">
                  <Icon name="search" size={16} />
                </button>
              </div>
            <div className="search-meta">
              <span>No account needed to browse.</span>
              <span><b>{catalog ? catalog.placements.length : placements.length}</b> open placements this term</span>
              <span><b>100%</b> state their requirements</span>
            </div>
            </form>
          </div>

          <div>
            <div className="arch-photo hero-photo">
              <img
                src="./img/hero.jpg"
                alt="Students working together on a laptop in a university library"
                loading="eager"
              />
              <div className="cap">Makerere University · placement briefing</div>
            </div>
            <div className="counts">
              <div><b>620</b><span>Companies</span></div>
              <div><b>214</b><span>Government</span></div>
              <div><b>96</b><span>NGOs</span></div>
              <div><b>38</b><span>University</span></div>
            </div>
          </div>
        </div>

        <div className="wrap">
          <div className="trust">
            <span>Makerere University</span>
            <span>University of Nairobi</span>
            <span>Kyambogo</span>
            <span>Addis Ababa University</span>
            <span>Ashesi</span>
            <span>University of Dar es Salaam</span>
          </div>
          <div className="freebar">
            <div>
              <b>Free for students</b>
              <span>Applications, pack and verified documents — forever.</span>
            </div>
            <div>
              <b>First three placements free</b>
              <span>Companies and agencies, before any invoice.</span>
            </div>
            <div>
              <b>Public universities start free</b>
              <span>A full campus term, no card.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-h">
            <div>
              <span className="lbl">01 — Who lists with BrighterWorks</span>
              <h2>
                Three kinds of host,<br />
                one <em>stated</em> standard.
              </h2>
            </div>
            <p>
              Every organisation is verified before a placement goes live. Government agencies and NGOs publish the same requirement fields as companies.
            </p>
          </div>
          <div className="orgs">
            <div className="orgcard">
              <div className="shape"></div>
              <span className="num">01</span>
              <h3>Companies</h3>
              <p>Studios, banks and technology firms posting paid internships with named mentors and a defined workstream.</p>
              <a
                href="#placements"
                onClick={(e) => {
                  e.preventDefault();
                  setType("Company");
                }}
              >
                620 placements <Icon name="arrow" size={11} />
              </a>
            </div>
            <div className="orgcard">
              <div className="shape"></div>
              <span className="num">02</span>
              <h3>Government agencies</h3>
              <p>Ministries, authorities and city offices running attachment programmes with public-sector supervision.</p>
              <a
                href="#placements"
                onClick={(e) => {
                  e.preventDefault();
                  setType("Government");
                }}
              >
                214 placements <Icon name="arrow" size={11} />
              </a>
            </div>
            <div className="orgcard">
              <div className="shape"></div>
              <span className="num">03</span>
              <h3>NGOs and universities</h3>
              <p>Foundations, research groups and university departments with fieldwork or lab-based placements.</p>
              <a
                href="#placements"
                onClick={(e) => {
                  e.preventDefault();
                  setType("NGO");
                }}
              >
                134 placements <Icon name="arrow" size={11} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap placed">
          <div className="photo-frame wide">
            <img src="./img/students.jpg" alt="Five students sitting together on campus" loading="lazy" />
          </div>
          <div>
            <span className="lbl">Students</span>
            <h2
              className="serif"
              style={{
                fontSize: "clamp(26px,3vw,38px)",
                lineHeight: 1.05,
                margin: "12px 0 14px",
              }}
            >
              Students see their own eligibility before applying; the index shows the requirement before the application, not after the rejection.
            </h2>
            <p
              style={{
                fontSize: "13.5px",
                lineHeight: 1.7,
                color: "var(--ink-2)",
                maxWidth: "420px",
              }}
            >
              Each one applied with a verified record and a stated eligibility check. The index shows the requirement before the application, not after the rejection.
            </p>
            <div className="mini-quote">
              <p>“I knew I qualified before I applied. That had never happened.”</p>
              <div className="who">
                <span className="av">
                  <img src="./img/portrait.jpg" alt="" />
                </span>
                <span>Amina Nakato · Design · Lumen Labs</span>
              </div>
            </div>
            <div className="mini-quote">
              <p>“The office verified my transcript in a day and the ministry called that week.”</p>
              <div className="who">
                <span className="av">
                  <img src="./img/hero.jpg" alt="" />
                </span>
                <span>Joel Mwangi · Statistics · NITA</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: "16px" }}
              onClick={() => go("placements")}
            >
              See who is listing <Icon name="arrow" size={12} />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonial Carousel */}
      <TestimonialCarousel testimonials={testimonials} />

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="spec">
            <div>
              <span className="lbl">02 — Requirements</span>
              <h2
                className="serif"
                style={{
                  fontSize: "clamp(28px,3.2vw,44px)",
                  lineHeight: 1.03,
                  margin: "14px 0 16px",
                }}
              >
                The bar is published,<br />not discovered later.
              </h2>
              <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.7, maxWidth: "430px" }}>
                Each placement carries its eligible courses, minimum grade, required documents and whether a supervisor testimonial is needed. Students see their own eligibility before they apply; the placement office sees every submission against the same fields.
              </p>
              <div style={{ display: "flex", gap: "22px", marginTop: "24px", flexWrap: "wrap" }}>
                <div>
                  <div className="serif" style={{ fontSize: "28px" }}>6</div>
                  <div className="lbl">requirement fields</div>
                </div>
                <div>
                  <div className="serif" style={{ fontSize: "28px" }}>48h</div>
                  <div className="lbl">verification window</div>
                </div>
                <div>
                  <div className="serif" style={{ fontSize: "28px" }}>100%</div>
                  <div className="lbl">documents tracked</div>
                </div>
              </div>
            </div>

            <div className="reqcard">
              <div className="rh">
                <div>
                  <span className="lbl">Government agency · Kampala</span>
                  <h3 style={{ marginTop: "6px" }}>Data Analyst Intern</h3>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>
                    National Information Technology Authority
                  </div>
                </div>
                <span className="seal blue">
                  Open<br />12 Mar
                </span>
              </div>
              <div style={{ marginTop: "10px" }}>
                <div className="reqrow">
                  <div className="k">Courses</div>
                  <div className="doclist">
                    {["Statistics", "Computer Science", "Economics"].map((c) => (
                      <span key={c} className="doc">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="reqrow">
                  <div className="k">Minimum grade</div>
                  <div>
                    <b style={{ fontSize: "12.5px" }}>Second Class Upper</b>{" "}
                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                      · CGPA 3.3 and above
                    </span>
                  </div>
                </div>
                <div className="reqrow">
                  <div className="k">Documents</div>
                  <div className="doclist">
                    {["Transcript", "National ID", "Recommendation"].map((d) => (
                      <span key={d} className="doc">
                        <Icon name="doc" size={10} /> {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="reqrow">
                  <div className="k">Testimonial</div>
                  <div>Required from a previous supervisor</div>
                </div>
                <div className="reqrow" style={{ borderBottom: 0 }}>
                  <div className="k">Eligibility</div>
                  <div>
                    <span className="tg green">You qualify</span>
                  </div>
                </div>
              </div>
              <div className="reqfoot">
                <span className="lbl">6 months · UGX 1,200,000 / month</span>
                <button
                  type="button"
                  className="btn btn-sm btn-solid"
                  onClick={() => openPlacement("p2")}
                >
                  Open placement
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-h">
            <div>
              <span className="lbl">03 — Latest</span>
              <h2 style={{ marginTop: "14px" }}>Listed in the last seven days.</h2>
            </div>
            <p>Every row shows the organisation type, the eligible courses and the closing date. Nothing is hidden behind a sign-up.</p>
          </div>
          <div className="jcards">
            {latest.map((p) => (
              <PlacementCard key={p.id} placement={p} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span className="lbl">Showing 6 of live placements</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => go("placements")}
            >
              Open the index <Icon name="arrow" size={12} />
            </button>
          </div>
        </div>
      </section>

      <section className="band-dark">
        <div className="wrap band-grid">
          <div>
            <span className="lbl">04 — For universities</span>
            <h2 style={{ marginTop: "12px" }}>
              Your placement office,<br />
              with a <em>record</em>.
            </h2>
            <p>Publish placements, set requirements once, verify documents and see which students are actually placed. Government and NGO listings feed the same index.</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "#4A5D77", color: "#EDEAE0" }}
                onClick={() => go("universities")}
              >
                How it works
              </button>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "transparent", color: "#9DBBB2" }}
                onClick={() => go("signin")}
              >
                Open a dashboard
              </button>
            </div>
          </div>
          <div className="mini">
            <div className="mh">
              <span className="lbl">Placements this term</span>
              <span className="lbl">Open</span>
            </div>
            <div className="mrow">
              <div><b>Ministry of ICT</b><span>Government · 12 applicants</span></div>
              <span className="v">Open</span>
              <span className="v">6 slots</span>
            </div>
            <div className="mrow">
              <div><b>Lumen Labs</b><span>Company · 41 applicants</span></div>
              <span className="v">Open</span>
              <span className="v">4 slots</span>
            </div>
            <div className="mrow">
              <div><b>Atlas Health</b><span>Company · 64 applicants</span></div>
              <span className="v">Closing</span>
              <span className="v">8 slots</span>
            </div>
            <div className="mrow">
              <div><b>Twaweza</b><span>NGO · 29 applicants</span></div>
              <span className="v">Open</span>
              <span className="v">4 slots</span>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="quote">
          <div>
            <div className="portrait" style={{ width: "96px", height: "96px" }}>
              <img src="./img/portrait.jpg" alt="Portrait of Amina Nakato" />
            </div>
            <div className="seal" style={{ marginTop: "14px" }}>
              Verified<br />placement<br />2026
            </div>
          </div>
          <blockquote>
            “I applied to eleven places through email and heard from two. BrighterWorks told me the grade requirement before I applied — so I only applied to four, and <em>three</em> replied.”
          </blockquote>
          <div className="who">
            <b>Amina Nakato</b>
            <span>
              Year 3, Design<br />
              Makerere University<br />
              Placed at Lumen Labs
            </span>
          </div>
        </div>
      </div>

      <section className="cta">
        <div className="wrap">
          <h2>
            List a placement. State the requirements.<br />
            Let the index do the rest.
          </h2>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-blue"
              onClick={() => go("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className="btn"
              style={{ borderColor: "#5A6058", color: "#EDEAE0" }}
              onClick={() => go("contact")}
            >
              Talk to the office
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
