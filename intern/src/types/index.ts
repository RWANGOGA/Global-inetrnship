import React from "react";

export type OrgType = "Company" | "Government" | "NGO" | "University" | "All";

export interface Org {
  id: string;
  name: string;
  type: string;
  sector: string;
  loc: string;
  seal: string;
  about: string;
}

export interface Placement {
  id: string;
  title: string;
  orgId: string;
  courses: string[];
  grade: string;
  loc: string;
  mode: string;
  duration: string;
  stipend: string;
  deadline: string;
  slots: number;
  status: "Open" | "Closing" | string;
  applicants: number;
  docs: string[];
  testimonial: boolean;
  about: string;
  duties: string[];
  reviewStatus: string;
  publishedAt: string;
  closesAt: string;
  startsAt: string;
  requirements: string[];
  reviewReason: string;
  org?: Org;
}

export interface Job {
  id: string;
  title: string;
  orgId: string;
  orgName: string;
  loc: string;
  mode: string;
  employmentType: string;
  salary: string;
  closesAt: string;
  summary: string;
  requirements: string[];
  status: string;
  reviewStatus?: string;
  publishedAt?: string;
  reviewReason?: string;
}

export interface GradRole {
  id: string;
  title: string;
  org: string;
  loc: string;
  pay: string;
  type: string;
  closes: string;
}

export interface Student {
  name: string;
  course: string;
  year: string;
  cgpa: number;
  uni: string;
  // Confirmed skills on the profile. Seeded, then edited by the student from
  // pasted projects/CV text. Drives the match score.
  skills: string[];
}

export interface DocItem {
  name: string;
  status: "verified" | "pending" | "missing" | string;
  file: string;
  size: string;
}

export interface StudentDocument {
  id: string;
  user_id: string;
  document_type: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  rejection_reason: string;
  uploaded_at: string;
}

export interface AdminQueueItem {
  n: string;
  i: string;
  c: string;
  y: string;
  p: string;
  d: string;
  st: "Review" | "Ready" | "Incomplete" | string;
}

export type ActivityItem = [string, string, string];

export interface PlanTier {
  name: string;
  price: string;
  per: string;
  desc: string;
  kind: "line" | "dark" | string;
  ribbon?: string;
  features: [string, 0 | 1][];
  cta: string;
}

export interface PlanSegment {
  label: string;
  intro: string;
  tiers: PlanTier[];
  table: [string, string, string, string][];
}

export interface ApplicationPack {
  statement: string;
  targets: string[];
}

export type UserRole = "student" | "jobseeker" | "employer" | "admin";
export type Portal = "internships" | "jobs";

// A host organisation's live billing state. Free accounts publish up to
// FREE_PLACEMENT_ALLOWANCE placements, then a placement fee is required. The
// "premium for universities" side of the business is the same shape on an
// institution plan. Persisted to localStorage so it survives reloads; the
// backend will own it in Phase 2.
export interface Subscription {
  plan: string; // "Free" | "Pro" | "Enterprise"
  billing_cycle: "monthly" | "annual" | "";
  payment_gateway: "stripe" | "paypal" | "flutterwave" | "mpesa" | "bank_transfer" | "crypto" | "";
  seats: number;
  since: string; // ISO date the paid plan started, "" for free
  status: "active" | "trialing" | "past_due" | "cancelled" | "";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}


export interface MatchDto {
  score: number;
  matched: string[];
  missing: string[];
  courseFit: boolean;
  gradeFit: boolean;
}

export interface RankedPlacement {
  placement: Placement;
  match: MatchDto;
}

export interface MatchResponse {
  total: number;
  items: RankedPlacement[];
}

export interface ApplicationDto {
  id: string;
  user_id: string;
  placement_id: string;
  status: string;
  statement: string;
  created_at: string;
}

export type DashboardView =
  | "overview"
  | "skills"
  | "placements"
  | "applications"
  | "requirements"
  | "students"
  | "documents"
  | "pack"
  | "testimonial"
  | "roles"
  | "apps"
  | "applicants";

export interface ChatMessage {
  id: string;
  who: "INTERN" | "me";
  text: string;
  isTyping?: boolean;
  actions?: AdvisorAction[];
}

export interface AdvisorAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface ModalConfig {
  title: string;
  body: React.ReactNode;
  okLabel?: string | null;
  onOk?: (() => void) | null;
}
