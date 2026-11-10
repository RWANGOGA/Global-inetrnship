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
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const ROLE_LABELS: Record<TestimonialRole, string> = {
  all: "All",
  student: "Students",
  employer: "Employers",
  employee: "Employees",
  admin: "Admins",
};

const ROLE_COLORS: Record<TestimonialRole, string> = {
  all: "var(--ink)",
  student: "var(--blue)",
  employer: "var(--green)",
  employee: "var(--gold)",
  admin: "var(--red)",
};

interface TestimonialCarouselProps {
  testimonials: StudentDocument[];
  autoScroll?: boolean;
  interval?: number;
}

export function TestimonialCarousel({ 
  testimonials, 
  autoScroll = true, 
  interval = 5000 
}: TestimonialCarouselProps) {
  const { openPlacement } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeRole, setActiveRole] = useState<TestimonialRole>("all");
  const carouselRef = useRef<HTMLDivElement>(null);

  const filteredTestimonials = useMemo(() => 
    activeRole === "all" 
      ? testimonials 
      : testimonials.filter(t => t.author_role === activeRole),
    [activeRole, testimonials]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!autoScroll || prefersReducedMotion || testimonials.length <= 1) return;
    
    const timer = setInterval(() => {
      if (!isPaused) {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, [autoScroll, prefersReducedMotion, testimonials.length, isPaused, interval]);

  // Reset index when role filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeRole]);

  if (testimonials.length === 0) {
    return null;
  }

  const current = filteredTestimonials[currentIndex];

  function renderEmptyState() {
    return (
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-h" style={{ marginBottom: "16px" }}>
            <div>
              <span className="lbl">Testimonials</span>
              <h2 style={{ marginTop: "6px" }}>
                What our community says<br />
                about BrighterWorks.
              </h2>
            </div>
          </div>
          <div className="panel" style={{ textAlign: "center", padding: "40px" }}>
            <p className="lbl" style={{ color: "var(--muted)" }}>
              No {ROLE_LABELS[activeRole].toLowerCase()} testimonials yet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  function renderTestimonials() {
    if (filteredTestimonials.length === 0) {
      return renderEmptyState();
    }

    return (
      <div>
        <div
          ref={carouselRef}
          className="testimonial-carousel"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "320px",
            overflow: "hidden",
            position: "relative",
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          role="region"
          aria-label="Community testimonials carousel"
          aria-live="polite"
        >
          {filteredTestimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="testimonial-card"
              style={{
                flex: "0 0 100%",
                minWidth: "100%",
                opacity: index === currentIndex ? 1 : 0,
                transform: `translateY(${(index - currentIndex) * 100}%)`,
                transition: "opacity 0.4s ease, transform 0.4s ease",
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                pointerEvents: index === currentIndex ? "auto" : "none",
              }}
            >
              <article
                style={{
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-lg)",
                  padding: "20px",
                  background: "#FBFAF6",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  height: "100%",
                  borderLeft: `4px solid ${ROLE_COLORS[testimonial.author_role as TestimonialRole] || "var(--blue)"}`,
                }}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div
                    className="seal"
                    style={{
                      width: "56px",
                      height: "56px",
                      flexShrink: 0,
                      fontSize: "6.5px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                      background: ROLE_COLORS[testimonial.author_role as TestimonialRole] || "var(--blue)",
                      color: "white",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "10px" }}>{ROLE_LABELS[testimonial.author_role as TestimonialRole] || "User"}</span>
                    <span style={{ fontSize: "9px" }}>{formatDate(testimonial.uploaded_at)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13.5px", lineHeight: 1.65, marginBottom: "8px" }}>
                      &ldquo;{testimonial.filename.replace(".txt", "")}&rdquo;
                    </p>
                    <div className="lbl" style={{ marginTop: "4px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      <span>{testimonial.user_id.slice(0, 8)}&hellip;</span>
                      <span style={{ color: ROLE_COLORS[testimonial.author_role as TestimonialRole] || "var(--blue)" }}>
                        &middot; {ROLE_LABELS[testimonial.author_role as TestimonialRole] || "User"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--rule-2)",
                  }}
                >
                  <span className="tg green" style={{ fontSize: "10px" }}>
                    <Icon name="check" size={8} /> Verified
                  </span>
                  <span className="tg blue" style={{ fontSize: "10px" }}>
                    <Icon name="user" size={8} /> Public
                  </span>
                  <span style={{ flex: 1 }}></span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: "10px", padding: "4px 8px" }}
                    onClick={() => openPlacement("p2")}
                    disabled={index !== currentIndex}
                  >
                    Read more
                    <Icon name="arrow" size={8} />
                  </button>
                </div>
              </article>
            </div>
          ))}
        </div>

        {/* Navigation dots */}
        {filteredTestimonials.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "8px",
              zIndex: 10,
            }}
            role="tablist"
            aria-label="Testimonial navigation"
          >
            {filteredTestimonials.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Go to testimonial ${index + 1}`}
                onClick={() => setCurrentIndex(index)}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  border: "none",
                  background: index === currentIndex ? "var(--blue)" : "var(--muted)",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* Pause/Play button */}
        {filteredTestimonials.length > 1 && (
          <button
            type="button"
            className="btn btn-sm"
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 10,
              padding: "6px 10px",
              fontSize: "10px",
            }}
            onClick={() => setIsPaused(!isPaused)}
            aria-label={isPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {isPaused ? (
              <>
                <Icon name="plus" size={10} /> Resume
              </>
            ) : (
              <>
                <Icon name="x" size={10} /> Pause
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="sec" style={{ paddingTop: 0 }}>
      <div className="wrap">
        {renderTestimonials()}
        <p className="lbl" style={{ textAlign: "center", marginTop: "12px", color: "var(--muted)" }}>
          {filteredTestimonials.length} verified {ROLE_LABELS[activeRole].toLowerCase()} testimonial{filteredTestimonials.length !== 1 ? "s" : ""}
        </p>
      </div>
    </section>
  );
}
