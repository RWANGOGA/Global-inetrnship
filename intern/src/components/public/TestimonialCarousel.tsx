"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { StudentDocument } from "../../types";

type TestimonialRole = "all" | "student" | "employer" | "employee" | "admin";

interface TestimonialCarouselProps {
  testimonials: StudentDocument[];
  autoScroll?: boolean;
  interval?: number;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const ROLE_LABELS: Record<TestimonialRole, string> = {
  all: "All", student: "Students", employer: "Employers", employee: "Employees", admin: "Admins",
};
const ROLE_COLORS: Record<TestimonialRole, string> = {
  all: "var(--ink)", student: "var(--blue)", employer: "var(--green)", employee: "var(--gold)", admin: "var(--red)",
};

export function TestimonialCarousel({
  testimonials: raw,
  autoScroll = true,
  interval = 5000,
}: TestimonialCarouselProps) {
  const { openPlacement } = useApp();
  const testimonials = Array.isArray(raw) ? raw : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeRole, setActiveRole] = useState<TestimonialRole>("all");
  const carouselRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => activeRole === "all" ? testimonials : testimonials.filter(t => t.author_role === activeRole),
    [activeRole, testimonials]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!autoScroll || prefersReducedMotion || filtered.length <= 1) return;
    const timer = setInterval(() => {
      if (!isPaused) setCurrentIndex(p => (p + 1) % filtered.length);
    }, interval);
    return () => clearInterval(timer);
  }, [autoScroll, prefersReducedMotion, filtered.length, isPaused, interval]);

  useEffect(() => { setCurrentIndex(0); }, [activeRole]);

  if (testimonials.length === 0) return null;

  const roleOf = (r?: string) => (r ?? "") as TestimonialRole;

  return (
    <section className="sec" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-h" style={{ marginBottom: 16 }}>
          <div>
            <span className="lbl">Testimonials</span>
            <h2 style={{ marginTop: 6 }}>What our community says<br />about BrighterWorks.</h2>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {(["all", "student", "employer", "employee", "admin"] as TestimonialRole[]).map(role => {
              const count = role === "all" ? testimonials.length : testimonials.filter(t => t.author_role === role).length;
              if (count === 0 && role !== "all") return null;
              const active = activeRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  className={`btn btn-sm ${active ? "btn-blue" : ""}`}
                  style={{
                    borderColor: active ? "transparent" : "var(--rule)",
                    background: active ? ROLE_COLORS[role] : "transparent",
                    color: active ? "white" : "var(--ink)",
                    borderLeftWidth: 3,
                    borderLeftColor: ROLE_COLORS[role],
                  }}
                  onClick={() => setActiveRole(role)}
                >
                  {ROLE_LABELS[role]}
                  <span className="tg" style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: "var(--r-pill)" }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: 40 }}>
            <p className="lbl" style={{ color: "var(--muted)" }}>
              No {ROLE_LABELS[activeRole].toLowerCase()} testimonials yet.
            </p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <div
              ref={carouselRef}
              className="testimonial-carousel"
              style={{ height: 200, overflow: "hidden", position: "relative" }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              role="region"
              aria-label="Community testimonials carousel"
              aria-live="polite"
            >
              {filtered.map((t, index) => {
                const color = ROLE_COLORS[roleOf(t.author_role)] || "var(--blue)";
                const label = ROLE_LABELS[roleOf(t.author_role)] || "User";
                return (
                  <div
                    key={t.id}
                    className="testimonial-card"
                    style={{
                      position: "absolute", top: 0, left: 0, width: "100%",
                      opacity: index === currentIndex ? 1 : 0,
                      transform: `translateY(${(index - currentIndex) * 100}%)`,
                      transition: "opacity 0.4s ease, transform 0.4s ease",
                      pointerEvents: index === currentIndex ? "auto" : "none",
                    }}
                  >
                    <article
                      style={{
                        border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: 20,
                        background: "#FBFAF6", display: "flex", flexDirection: "column", gap: 12,
                        borderLeft: `4px solid ${color}`,
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div
                          className="seal"
                          style={{
                            width: 56, height: 56, flexShrink: 0, display: "flex", flexDirection: "column",
                            justifyContent: "center", alignItems: "center", textAlign: "center",
                            background: color, color: "white", borderRadius: "var(--r-md)",
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 10 }}>{label}</span>
                          <span style={{ fontSize: 9 }}>{formatDate(t.uploaded_at)}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, lineHeight: 1.65, marginBottom: 8 }}>
                            &ldquo;{(t.filename ?? "").replace(".txt", "")}&rdquo;
                          </p>
                          <div className="lbl" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>{(t.user_id ?? "").slice(0, 8)}&hellip;</span>
                            <span style={{ color }}>&middot; {label}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid var(--rule-2)" }}>
                        <span className="tg green" style={{ fontSize: 10 }}><Icon name="check" size={8} /> Verified</span>
                        <span className="tg blue" style={{ fontSize: 10 }}><Icon name="user" size={8} /> Public</span>
                        <span style={{ flex: 1 }} />
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: 10, padding: "4px 8px" }}
                          onClick={() => openPlacement("p2")}
                          disabled={index !== currentIndex}
                        >
                          Read more <Icon name="arrow" size={8} />
                        </button>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>

            {filtered.length > 1 && (
              <>
                <div
                  style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}
                  role="tablist"
                  aria-label="Testimonial navigation"
                >
                  {filtered.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === currentIndex}
                      aria-label={`Go to testimonial ${i + 1}`}
                      onClick={() => setCurrentIndex(i)}
                      style={{
                        width: 10, height: 10, borderRadius: "50%", border: "none", padding: 0,
                        background: i === currentIndex ? "var(--blue)" : "var(--muted)", cursor: "pointer",
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ position: "absolute", top: 12, right: 12, zIndex: 10, padding: "6px 10px", fontSize: 10 }}
                  onClick={() => setIsPaused(p => !p)}
                  aria-label={isPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
                >
                  {isPaused ? <><Icon name="plus" size={10} /> Resume</> : <><Icon name="x" size={10} /> Pause</>}
                </button>
              </>
            )}
          </div>
        )}

        <p className="lbl" style={{ textAlign: "center", marginTop: 12, color: "var(--muted)" }}>
          {filtered.length} verified {ROLE_LABELS[activeRole].toLowerCase()} testimonial{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>
    </section>
  );
}
