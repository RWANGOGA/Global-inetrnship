"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import { Placement } from "../../types";
import { Icon } from "../icons/Icons";

const TYPE_TONE: Record<string, string> = {
  Government: "blue",
  NGO: "green",
  University: "gold",
  Company: "",
};

const OPPORTUNITY_TYPE_LABEL: Record<string, string> = {
  internship: "Internship",
  gig: "Gig",
  entry_level: "Entry-level",
};

const OPPORTUNITY_TYPE_TONE: Record<string, string> = {
  internship: "blue",
  gig: "purple",
  entry_level: "green",
};

// A job-board style placement card, benchmarked against the reference
// products: logo tile, title, employer · location, tags, stipend and closing
// date, with a bookmark that persists. Kept in our identity — hairline card,
// rounded scale, no heavy shadow — rather than a literal copy.
export function PlacementCard({ placement }: { placement: Placement }) {
  const { getOrg, openPlacement, toggleSave, isSaved } = useApp();
  const o = getOrg(placement.orgId);
  const saved = isSaved(placement.id);
  const extraCourses = placement.courses.length - 2;
  const oppTypeLabel = OPPORTUNITY_TYPE_LABEL[placement.opportunityType] || placement.opportunityType;
  const oppTypeTone = OPPORTUNITY_TYPE_TONE[placement.opportunityType] || "";

  return (
    <article
      className="jcard"
      onClick={() => openPlacement(placement.id)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") openPlacement(placement.id);
      }}
    >
      <div className="jlogo" aria-hidden="true">
        {o?.seal || placement.title.slice(0, 2).toUpperCase()}
      </div>

      <div className="jbody">
        <div className="jtop">
          <h3 className="jtitle">{placement.title}</h3>
          <button
            type="button"
            className={`jsave ${saved ? "on" : ""}`}
            aria-label={saved ? "Remove from saved" : "Save placement"}
            aria-pressed={saved}
            onClick={(e) => {
              e.stopPropagation();
              toggleSave(placement.id);
            }}
          >
            <Icon name="save" size={16} />
          </button>
        </div>

        <div className="jmeta">
          <span className="jorg">{o?.name}</span>
          <span className="jdot" aria-hidden="true">·</span>
          <span className="jloc">
            <Icon name="pin" size={12} /> {o?.loc || placement.loc}
          </span>
        </div>

        <div className="jtags">
          <span className={`tg ${TYPE_TONE[o?.type || ""] || ""}`}>
            {o?.type || "Placement"}
          </span>
          <span className={`tg ${oppTypeTone}`}>
            {oppTypeLabel}
          </span>
          {placement.courses.slice(0, 2).map((c) => (
            <span key={c} className="jcourse">
              {c}
            </span>
          ))}
          {extraCourses > 0 && <span className="jcourse">+{extraCourses}</span>}
        </div>

        <div className="jfoot">
          <span className="jpay">{placement.stipend}</span>
          <span className="jdur">{placement.duration}</span>
          <span className="jclose">Closes {placement.deadline}</span>
        </div>
      </div>
    </article>
  );
}
