"use client";

import React, { useRef, useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { StudentDocument } from "../../types";

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
  const carouselRef = useRef<HTMLDivElement>(null);

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

  if (testimonials.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const current = testimonials[currentIndex];

  return (
    <section className="sec" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-h" style={{ marginBottom: "16px" }}>
          <div>
            <span className="lbl">Testimonials</span>
            <h2 style={{ marginTop: "6px" }}>
              What students say<br />
              about their placements.
            </h2>
          </div>
        </div>

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
          aria-label="Student testimonials carousel"
          aria-live="polite"
        >
          {testimonials.map((testimonial, index) => (
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
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Class of</span>
                    <span>{formatDate(current.uploaded_at)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13.5px", lineHeight: 1.65, marginBottom: "8px" }}>
                      &ldquo;{current.filename.replace(".txt", "")}&rdquo;
                    </p>
                    <div className="lbl" style={{ marginTop: "4px" }}>
                      {current.user_id.slice(0, 8)}&hellip; &middot; {current.document_type}
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
                    onClick={() => openPlacement("p2")} // TODO: link to actual placement
                    disabled={index !== currentIndex}
                  >
                    Read more
                    <Icon name="arrow" size={8} />
                  </button>
                </div>
              </article>
            </div>
          ))}

          {/* Navigation dots */}
          {testimonials.length > 1 && (
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
              {testimonials.map((_, index) => (
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
          {testimonials.length > 1 && (
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

        <p className="lbl" style={{ textAlign: "center", marginTop: "12px", color: "var(--muted)" }}>
          {testimonials.length} verified student testimonial{testimonials.length !== 1 ? "s" : ""}
        </p>
      </div>
    </section>
  );
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