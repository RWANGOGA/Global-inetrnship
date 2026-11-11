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

export interface CompanyProfile {
  id: string;
  name: string;
  type: string;
  sector: string;
  loc: string;
  seal: string;
  about: string;
  billing_email?: string | null;
  tax_id?: string | null;
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
  // Opportunity type: internship | gig | entry_level
  opportunityType: string;
  // Gig-specific fields
  durationHours: number | null;
  budgetRange: string | null;
  milestones: string[] | null;
  remoteOk: boolean | null;
  // Entry-level specific fields
  salaryRange: string | null;
  probationPeriod: string | null;
  trainingIncluded: boolean | null;
  careerPath: string | null;
  // Skill requirements (for matching)
  skillsRequired: string[] | null;
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
  applicants?: number;
  org?: {
    id: string;
    name: string;
    type: string;
    sector: string;
    loc: string;
    seal: string;
    about: string;
  };
}

export interface JobPostingInput {
  title: string;
  loc: string;
  mode: string;
  employment_type: string;
  salary: string;
  closes_at: string;
  summary: string;
  requirements: string[];
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
  is_public: boolean;
  author_role?: "student" | "employer" | "employee" | "admin";
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

export interface ActivityItem {
  who: string;
  action: string;
  time: string;
}

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

export type UserRole = "student" | "jobseeker" | "employer" | "admin" | "employee";
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
  user_name?: string;
  user_email?: string;
  placement_id: string;
  placement_title?: string;
  job_id?: string;
  job_title?: string;
  type?: "internship" | "job";
  status: string;
  statement: string;
  created_at: string;
  updated_at: string;
  // Rich application data
  cv_url: string | null;
  cover_letter: string;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  academic_papers: string[];
  // References
  reference_1_name: string;
  reference_1_email: string;
  reference_1_phone: string;
  reference_1_relationship: string;
  reference_2_name: string;
  reference_2_email: string;
  reference_2_phone: string;
  reference_2_relationship: string;
  // Document IDs
  document_ids: string[];
  // Shortlist flag
  shortlisted: boolean;
}

export interface JobApplicationDto {
  id: string;
  user_id: string;
  job_id: string;
  status: string;
  statement: string;
  created_at: string;
  updated_at: string | null;
  // Rich application data
  cv_url: string | null;
  cover_letter: string;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  academic_papers: string[];
  // References
  reference_1_name: string;
  reference_1_email: string;
  reference_1_phone: string;
  reference_1_relationship: string;
  reference_2_name: string;
  reference_2_email: string;
  reference_2_phone: string;
  reference_2_relationship: string;
  // Document IDs
  document_ids: string[];
  // Shortlist flag
  shortlisted: boolean;
}

export interface ApplicationsResponse {
  total: number;
  items: ApplicationDto[];
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
  | "applicants"
  | "organizations"
  | "users"
  | "jobs"
  | "action-logs"
  | "reports"
  | "profile";

export interface OrganizationRead {
  id: string;
  name: string;
  type: string;
  sector: string;
  loc: string;
  seal: string;
  about: string;
  billing_email?: string | null;
  tax_id?: string | null;
  billing_address: Record<string, unknown>;
  created_at: string;
  is_active: boolean;
}

export interface OrganizationDetailResponse {
  organization: OrganizationRead;
  stats: Record<string, unknown>;
  active_placements: number;
  total_hired: number;
  total_revenue_cents: number;
  compliance_score: number;
  active_postings: number;
  subscription: {
    plan: string;
    billing: string;
    seats: number;
    status: string;
  };
  billing_email?: string;
  tax_id?: string;
}

export interface OrganizationListResponse {
  total: number;
  items: OrganizationRead[];
}

export interface OrganizationSanctionRequest {
  action: "suspend" | "unsuspend" | "sanction";
  reason: string;
}

export interface OrganizationSanctionResponse {
  organization: OrganizationRead;
  action: string;
  reason: string;
  message: string;
}

export interface OrganizationListResponse {
  total: number;
  items: OrganizationRead[];
}

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

export interface AdminActionLogRead {
  id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string | null;
  target_user_email: string | null;
  action: string;
  reason: string;
  details: string | null;
  created_at: string;
}

export interface ModalConfig {
  title: string;
  body: React.ReactNode;
  okLabel?: string | null;
  onOk?: (() => void) | null;
}
