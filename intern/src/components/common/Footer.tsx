"use client";

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { UserRole } from "../../types";
import { Icon } from "../icons/Icons";

type FooterLink =
  | { label: string; route: string }
  | { label: string; role: UserRole };

// Organisations lead: they are the side of the marketplace that supplies the
// placements, and the header already opens with that group. Each column is one
// audience and each label is the same shape — verb, then object — so the three
// audience lists read across as one sentence instead of three unrelated ones.
// "The office" is the one exception and stays noun-first, because "Read our
// privacy policy" is not how anybody looks for it.
const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Employers",
    links: [
      { label: "Post a placement", route: "employers" },
      { label: "Compare plans", route: "plans" },
      { label: "Sign in as an employer", role: "employer" },
    ],
  },
  {
    heading: "Universities",
    links: [
      { label: "List a placement", route: "universities" },
      { label: "How verification works", route: "about" },
      { label: "Sign in to the office", role: "admin" },
    ],
  },
  {
    heading: "Students & graduates",
    links: [
      { label: "Find an internship", route: "placements" },
      { label: "Find a job", route: "jobs" },
      { label: "Sign in as a student", role: "student" },
    ],
  },
  {
    heading: "The office",
    links: [
      { label: "Contact", route: "contact" },
      { label: "Privacy policy", route: "privacy" },
      { label: "Accessibility", route: "accessibility" },
    ],
  },
];

export function Footer() {
  const { go } = useApp();
  // Hydrated from the visitor's clock; a hardcoded year silently rots.
  const [year] = useState(() => new Date().getFullYear());

  const handleLink = (link: FooterLink) => {
    if ("role" in link) go("signin");
    else go(link.route);
  };

  const backToTop = () => {
    // CSS cannot suppress a scripted scroll, so reduced-motion has to be
    // honoured here rather than relying on the prefers-reduced-motion rule.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="fgrid">
          <div className="fbrand">
            <a
              href="#home"
              className="logo"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
            >
              <i></i>
              <span>
                <b>BrighterWorks</b>
                <small>PLACEMENT SYSTEM</small>
              </span>
            </a>
            <p>
              A placement and skills platform for students, graduates, universities and employers — with
              verified documents, skill-based matching, and a transparent application process.
            </p>
            <a
              className="fmore"
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                go("about");
              }}
            >
              About BrighterWorks <Icon name="arrow" size={11} />
            </a>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} className="fcol" aria-label={col.heading}>
              <h5>{col.heading}</h5>
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={"role" in link ? "#signin" : `#${link.route}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLink(link);
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>

        <div className="fbase">
          <span>
            © {year} BrighterWorks. Kampala · Nairobi · Berlin.
          </span>
          <span className="fnote">
            Requirements and eligibility are set by each university.
          </span>
          <button type="button" className="ftop" onClick={backToTop}>
            Back to top <Icon name="chevron-up" size={12} />
          </button>
        </div>
      </div>
    </footer>
  );
}
