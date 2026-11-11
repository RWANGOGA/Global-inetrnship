import React from "react";

export type IconName =
  | "doc"
  | "check"
  | "arrow"
  | "search"
  | "upload"
  | "download"
  | "filter"
  | "send"
  | "trash"
  | "eye"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "chevron-down"
  | "file-text"
  | "bldg"
  | "gov"
  | "uni"
  | "brief"
  | "user"
  | "clock"
  | "bell"
  | "x"
  | "plus"
  | "menu"
  | "save"
  | "pin"
  | "home"
  | "spinner"
  | "alert-triangle"
  | "inbox"
  | "user-check"
  | "shield-check";

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 12.5l5 5L20 6.5" strokeLinecap="square" />
        </symbol>
        <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 12h15M14 6l6 6-6 6" strokeLinecap="square" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M20 20l-4.7-4.7" strokeLinecap="square" />
        </symbol>
        <symbol id="i-upload" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M4 17v3h16v-3" />
        </symbol>
        <symbol id="i-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 8v12M7 13l5 5 5-5" />
          <path d="M4 20v-3h16v3" />
        </symbol>
        <symbol id="i-filter" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 5h18M7 12h10M11 19h2" />
        </symbol>
        <symbol id="i-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </symbol>
        <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </symbol>
        <symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </symbol>
        <symbol id="i-chevron-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 18l-6-6 6-6" strokeLinecap="square" />
        </symbol>
        <symbol id="i-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18l6-6-6-6" strokeLinecap="square" />
        </symbol>
        <symbol id="i-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 15l-6-6-6 6" strokeLinecap="square" />
        </symbol>
        <symbol id="i-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="square" />
        </symbol>
        <symbol id="i-file-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13h-6M16 17h-6M10 9h6" />
        </symbol>
        <symbol id="i-bldg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 21V6l8-3v18" />
          <path d="M12 10h8v11" />
          <path d="M7 9h2M7 13h2M7 17h2M16 14h1M16 17h1" />
        </symbol>
        <symbol id="i-gov" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 10l9-6 9 6" />
          <path d="M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18" />
        </symbol>
        <symbol id="i-uni" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M2 9l10-5 10 5-10 5z" />
          <path d="M6 12v6c0 1.5 3 3 6 3s6-1.5 6-3v-6" />
        </symbol>
        <symbol id="i-brief" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="3" y="7" width="18" height="13" />
          <path d="M9 7V4h6v3" />
          <path d="M3 12h18" />
        </symbol>
        <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
        </symbol>
        <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </symbol>
        <symbol id="i-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M6 16V10a6 6 0 0112 0v6l2 2H4z" />
          <path d="M10 20h4" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 6l12 12M18 6L6 18" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </symbol>
        <symbol id="i-save" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 4h12v16l-6-4-6 4z" strokeLinejoin="round" />
        </symbol>
        <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </symbol>
        <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </symbol>
        <symbol id="i-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l3 3M17 17l3 3M7 17l3-3M17 7l-3 3" />
        </symbol>
        <symbol id="i-alert-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 2l11 18H3z" />
          <path d="M12 9v4M12 17h.01" />
        </symbol>
        <symbol id="i-inbox" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M4 12h16" />
          <path d="M12 4v8" />
        </symbol>
        <symbol id="i-user-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
          <path d="M9 12l2 2 4-4" strokeLinecap="square" strokeWidth="1.8" />
        </symbol>
        <symbol id="i-shield-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" strokeLinecap="square" strokeWidth="1.8" />
        </symbol>
      </defs>
    </svg>
  );
}

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 14, className = "ic" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
