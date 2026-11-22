"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  MouseEvent,
  KeyboardEvent,
} from "react";
import { useApp } from "../../context/AppContext";
import { UserRole } from "../../types";

/*
  A menu entry is a route, an organisation-type filter (a route plus a preset
  filter), or a role-specific sign in. Describing them as data rather than
  hand-written <a> tags is what keeps every entry pointed at a destination
  that nothing else in the bar already occupies.
*/
type Entry =
  | { label: string; route: string }
  | { label: string; role: UserRole };

type Group = {
  key: string;
  label: string;
  heading: string;
  entries: Entry[];
};

const GROUPS: Group[] = [
  {
    key: "internships",
    label: "Internships",
    heading: "University and college opportunities",
    entries: [
      { label: "Internship portal", route: "internships" },
      { label: "Find internships", route: "placements" },
      { label: "For universities", route: "universities" },
      { label: "For host organisations", route: "employers" },
    ],
  },
  {
    key: "jobs",
    label: "Jobs",
    heading: "Opportunities and career growth",
    entries: [
      { label: "Jobs portal", route: "jobs" },
      { label: "Find jobs", route: "jobs" },
      { label: "Companies", route: "employers" },
      { label: "Career support", route: "about" },
    ],
  },
  {
    key: "organisations",
    label: "Organisations",
    heading: "Publish and find talent",
    entries: [
      { label: "For employers", route: "employers" },
      { label: "For universities", route: "universities" },
      { label: "Employer sign in", role: "employer" },
      { label: "Talk to the office", route: "contact" },
    ],
  },
];

const PLAIN = [
  { label: "Plans", route: "plans" },
  { label: "About", route: "about" },
  { label: "Contact", route: "contact" },
];

const entryHref = (entry: Entry) =>
  "role" in entry ? "#signin" : `#${entry.route}`;

export function Header() {
  const { go, openMenu, route, isMenuOpen, session, role, openDashboardFor, portal } =
    useApp();

  /*
    The panel used to open on :hover alone, so its links were unreachable by
    keyboard and by touch. State makes the disclosure explicit; CSS keeps the
    hover behaviour for pointer visitors.
  */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpenKey(null), []);

  useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: globalThis.MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [openKey]);

  // Navigating away must not leave a panel open behind the new page.
  useEffect(() => {
    setOpenKey(null);
  }, [route]);

  const toggle = (group: Group, e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    if (openKey === group.key) {
      setOpenKey(null);
      // The panel holding focus is about to unmount; hand focus back.
      el.focus();
      return;
    }
    lastTrigger.current = el;
    setOpenKey(group.key);
  };

  const onHeaderKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape" || !openKey) return;
    const trigger = lastTrigger.current;
    setOpenKey(null);
    trigger?.focus();
  };

  const run = (entry: Entry) => {
    close();
    if ("role" in entry) go("signin");
    else go(entry.route);
  };

  return (
    <>
      <div className="util">
        <div className="wrap">
          <span>
            Placement and skills platform · students, graduates, universities and employers
          </span>
        </div>
      </div>

      <header className="hdr" ref={headerRef} onKeyDown={onHeaderKeyDown}>
        <div className="wrap">
          <a
            href="#home"
            className="logo"
            onClick={(e) => {
              e.preventDefault();
              close();
              go("home");
            }}
          >
            <i></i>
            <span>
              <b>BrighterWorks</b>
              <small>PLACEMENT SYSTEM</small>
            </span>
          </a>

          <nav aria-label="Primary">
            <ul className="nav">
              {GROUPS.map((group) => {
                const isOpen = openKey === group.key;
                const active =
                (group.key === "internships" && portal === "internships") ||
                (group.key === "jobs" && portal === "jobs") ||
                group.entries.some((entry) => "route" in entry && entry.route === route);
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                      className={active ? "on" : undefined}
                      onClick={(e) => toggle(group, e)}
                    >
                      {group.label} <span className="caret"></span>
                    </button>
                    <div className={`menu${isOpen ? " on" : ""}`}>
                      <div className="m-h lbl">{group.heading}</div>
                      {group.entries.map((entry) => (
                        <a
                          key={entry.label}
                          href={entryHref(entry)}
                          onClick={(e) => {
                            e.preventDefault();
                            run(entry);
                          }}
                        >
                          {entry.label}
                        </a>
                      ))}
                    </div>
                  </li>
                );
              })}

              {PLAIN.map((item) => (
                <li key={item.route}>
                  <a
                    href={`#${item.route}`}
                    aria-current={route === item.route ? "page" : undefined}
                    className={route === item.route ? "on" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      close();
                      go(item.route);
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hdr-actions">
            {session ? (
              <a
                href={`#dashboard-${role}-overview`}
                className="btn btn-blue"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  openDashboardFor(role);
                }}
              >
                Open dashboard
              </a>
            ) : (
              <>
                <a
                  href="#signin"
                  className="hdr-signin"
                  onClick={(e) => {
                    e.preventDefault();
                    close();
                    go("signin");
                  }}
                >
                  Sign in
                </a>
                <a
                  href="#signin"
                  className="btn btn-blue"
                  onClick={(e) => {
                    e.preventDefault();
                    close();
                    go("signin");
                  }}
                >
                  List a placement
                </a>
              </>
            )}
            <button
              type="button"
              className="burger"
              onClick={() => {
                close();
                openMenu();
              }}
              aria-label="Menu"
              aria-expanded={isMenuOpen}
              aria-controls="mmenu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
