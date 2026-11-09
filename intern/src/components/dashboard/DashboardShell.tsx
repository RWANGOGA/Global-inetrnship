"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import { NAV, ROLE_META } from "../../data";
import { DashboardView, UserRole } from "../../types";
import { Icon } from "../icons/Icons";

// Views
import { AdminOverview } from "./admin/AdminOverview";
import { AdminPlacements } from "./admin/AdminPlacements";
import { AdminRequirements } from "./admin/AdminRequirements";
import { AdminStudents } from "./admin/AdminStudents";
import { AdminDocuments } from "./admin/AdminDocuments";
import { AdminTestimonial } from "./admin/AdminTestimonial";

import { StudentOverview } from "./student/StudentOverview";
import { StudentApplications } from "./student/StudentApplications";
import { SkillProfile } from "./student/SkillProfile";
import { StudentPlacements } from "./student/StudentPlacements";
import { StudentDocs } from "./student/StudentDocs";
import { StudentPack } from "./student/StudentPack";
import { StudentTestimonial } from "./student/StudentTestimonial";

import { EmployerOverview } from "./employer/EmployerOverview";
import { EmployerPlacements } from "./employer/EmployerPlacements";
import { EmployerApplicants } from "./employer/EmployerApplicants";
import { EmployerTestimonial } from "./employer/EmployerTestimonial";

import { EmployeeTestimonial } from "./employee/EmployeeTestimonial";

import { JobSeekerOverview } from "./jobseeker/JobSeekerOverview";
import { JobSeekerRoles } from "./jobseeker/JobSeekerRoles";
import { JobSeekerApps } from "./jobseeker/JobSeekerApps";

export function DashboardShell() {
  const {
    role,
    dash,
    dashGo,
    go,
    session,
    signOut,
    isSideDrawerOpen,
    openSide,
    closeSide,
    toast,
  } = useApp();

  const meta = ROLE_META[role] || ROLE_META.student;
  const navItems = NAV[role] || NAV.student;

  // Identity shown in the sidebar / "me" chip comes from the signed-in account,
  // not the hardcoded ROLE_META name. Falls back only if somehow unauthed.
  const initials = (n: string) => {
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "··";
    return parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const displayName = session ? session.name : meta[1];
  const displayMono = session ? initials(session.name) : meta[2];

  const titles: Record<string, string> = {
    overview: "Overview",
    skills: "Skills profile",
    placements: "Placements",
    applications: "Applications",
    requirements: "Requirements",
    students: "Students",
    documents: "Documents",
    testimonial: "Testimonial",
    pack: "Application pack",
    roles: "Graduate roles",
    apps: "Applications",
    applicants: "Applicants",
  };

  const currentTitle = titles[dash] || "Overview";
  const crumb = `/ ${role === "admin" ? "placement office" : role}`;

  const renderActiveView = () => {
    if (role === "admin") {
      switch (dash) {
        case "overview":
          return <AdminOverview />;
        case "placements":
          return <AdminPlacements />;
        case "requirements":
          return <AdminRequirements />;
        case "students":
          return <AdminStudents />;
        case "documents":
          return <AdminDocuments />;
        case "testimonial":
          return <AdminTestimonial />;
        default:
          return <AdminOverview />;
      }
    } else if (role === "student") {
      switch (dash) {
        case "overview":
          return <StudentOverview />;
        case "skills":
          return <SkillProfile />;
        case "placements":
          return <StudentPlacements />;
        case "applications":
          return <StudentApplications />;
        case "documents":
          return <StudentDocs />;
        case "pack":
          return <StudentPack />;
        case "testimonial":
          return <StudentTestimonial />;
        default:
          return <StudentOverview />;
      }
    } else if (role === "employer") {
      switch (dash) {
        case "overview":
          return <EmployerOverview />;
        case "placements":
          return <EmployerPlacements />;
        case "applicants":
          return <EmployerApplicants />;
        case "testimonial":
          return <EmployerTestimonial />;
        default:
          return <EmployerOverview />;
      }
    } else if (role === "employee") {
      switch (dash) {
        case "overview":
          return <EmployeeTestimonial />;
        case "testimonial":
          return <EmployeeTestimonial />;
        default:
          return <EmployeeTestimonial />;
      }
    } else {
      switch (dash) {
        case "overview":
          return <JobSeekerOverview />;
        case "roles":
          return <JobSeekerRoles />;
        case "apps":
          return <JobSeekerApps />;
        default:
          return <JobSeekerOverview />;
      }
    }
  };

  const sidebarContent = (
    <>
      <div className="logo" style={{ padding: "0 18px 16px" }}>
        <i></i>
        <span>
          <b>BrighterWorks</b>
          <small>PLACEMENT SYSTEM</small>
        </span>
      </div>
      <div className="rolechip">
        <span className="rc">{displayMono}</span>
        <div>
          <b>{displayName}</b>
          <span>{meta[0]}</span>
        </div>
      </div>
      <nav className="snav">
        {navItems.map(([id, label, n]) => (
          <a
            key={id}
            className={`sitem ${dash === id ? "on" : ""}`}
            href={`#dashboard-${role}-${id}`}
            onClick={(e) => {
              e.preventDefault();
              dashGo(id as DashboardView);
            }}
          >
            <span className="n">{n}</span>
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sfoot">
        <a
          className="slink"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <Icon name="home" size={13} /> Back to site
        </a>
        <a
          className="slink"
          href="#plans"
          onClick={(e) => {
            e.preventDefault();
            go("plans");
          }}
        >
          <Icon name="brief" size={13} /> Plans and billing
        </a>
        <a
          className="slink"
          href="#signin"
          onClick={(e) => {
            e.preventDefault();
            closeSide();
            signOut();
          }}
        >
          <Icon name="user" size={13} /> Sign out
        </a>
      </div>
    </>
  );

  const avBg =
    role === "admin"
      ? "var(--red)"
      : role === "employer"
      ? "var(--ink)"
      : "var(--blue)";

  return (
    <div id="app" className="on">
      <aside className="side" id="side">
        {sidebarContent}
      </aside>

      <div className="main">
        <div className="dash-top">
          <div className="left">
            <button
              type="button"
              className="iconbtn side-toggle"
              onClick={openSide}
              aria-label="Menu"
            >
              <Icon name="menu" size={15} />
            </button>
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
              className="iconbtn"
              title="Back to site"
            >
              <Icon name="home" size={14} />
            </a>
            <div className="sep"></div>
            <h1 id="dashTitle">{currentTitle}</h1>
            <span className="crumbs" id="dashCrumb">
              {crumb}
            </span>
          </div>

          <div className="dash-actions">
            <button
              type="button"
              className="iconbtn"
              onClick={() => toast("No new notifications")}
              aria-label="Notifications"
            >
              <Icon name="bell" size={14} />
            </button>
            <div className="me">
              <span className="av" id="meAv" style={{ background: avBg }}>
                {displayMono}
              </span>
              <div>
                <b id="meName">{displayName}</b>
                <span id="meRole">{meta[0]}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dpane" id="dashMain">
          {renderActiveView()}
        </div>
      </div>

      <div
        className={`sidedrawer ${isSideDrawerOpen ? "on" : ""}`}
        id="sideDrawer"
      >
        {sidebarContent}
      </div>
      <div
        className={`drawer-veil ${isSideDrawerOpen ? "on" : ""}`}
        id="veil"
        onClick={closeSide}
      ></div>
    </div>
  );
}
