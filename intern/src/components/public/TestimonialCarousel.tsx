"use client";

import React, { useState } from "react";
import type { TestimonialDto } from "../../lib/api";
import styles from "./TestimonialCarousel.module.css";

interface TestimonialCarouselProps {
  testimonials: TestimonialDto[];
  loading?: boolean;
  autoScroll?: boolean;
  interval?: number;
}

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  employer: "Employer",
  employee: "Employee",
  admin: "Placement office",
};

function getTestimonialText(testimonial: TestimonialDto): string {
  return testimonial.testimonial_text
    .split(/\r?\n/)
    .filter((line) => !/^(?:(?:employer|employee)\s+)?testimonial for\b|^(?:supervisor|role):/i.test(line.trim()))
    .join("\n")
    .trim();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function TestimonialCarousel({
  testimonials,
  loading = false,
  autoScroll = true,
  interval = 5000,
}: TestimonialCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);
  const visibleTestimonials = testimonials
    .map((testimonial) => ({ testimonial, text: getTestimonialText(testimonial) }))
    .filter(({ text }) => text.length > 0);

  const duration = Math.max(20, (visibleTestimonials.length * interval) / 1000);
  const loopCopies = autoScroll && visibleTestimonials.length > 1 ? [0, 1] : [0];

  return (
    <section className={`sec ${styles.section}`} aria-labelledby="testimonials-heading">
      <div className="wrap">
        <div className="sec-h">
          <div>
            <span className="lbl">Community stories</span>
            <h2 id="testimonials-heading">What our community says.</h2>
          </div>
          {!loading && visibleTestimonials.length > 0 && (
            <span className="lbl">
              {visibleTestimonials.length} verified testimonial{visibleTestimonials.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loading ? (
          <div className={`panel ${styles.empty}`} role="status">Loading testimonials…</div>
        ) : visibleTestimonials.length === 0 ? (
          <div className={`panel ${styles.empty}`}>
            Verified public testimonials will appear here once they are approved.
          </div>
        ) : (
          <div
            className={styles.viewport}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            tabIndex={0}
            role="region"
            aria-label="Verified community testimonials scrolling upward"
          >
            <div
              className={styles.track}
              style={{
                animationName: autoScroll && visibleTestimonials.length > 1 ? undefined : "none",
                animationDuration: `${duration}s`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            >
              {loopCopies.map((copy) => (
                <div
                  className={styles.group}
                  key={copy}
                  aria-hidden={copy === 1}
                >
                  {visibleTestimonials.map(({ testimonial, text }) => (
                    <article
                      className={styles.card}
                      data-role={testimonial.author_role}
                      key={`${copy}-${testimonial.id}`}
                    >
                      <p className={styles.quote}>&ldquo;{text}&rdquo;</p>
                      <div className={styles.meta}>
                        <span className={styles.role}>
                          {ROLE_LABELS[testimonial.author_role] || "Community member"}
                        </span>
                        <span>Verified</span>
                        {formatDate(testimonial.uploaded_at) && (
                          <time dateTime={testimonial.uploaded_at}>
                            {formatDate(testimonial.uploaded_at)}
                          </time>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
