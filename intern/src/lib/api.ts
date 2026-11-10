// Thin browser client for the FastAPI backend.
//
// The static site is deployed to GitHub Pages where no backend runs, so the
// base URL is optional: when NEXT_PUBLIC_API_BASE_URL is unset the app keeps
// using the bundled seed. When it IS set (local dev against uvicorn, or once
// the API is hosted on Neon/Render), reads come from the database instead.
//
// The backend speaks snake_case; the UI types are camelCase. This module is the
// single translation boundary, so components never learn about either shape.
import { Job, Org, Placement, ApplicationDto, JobApplicationDto } from "../types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);

export const isApiEnabled = API_BASE.length > 0;

// ---- Session token store ---------------------------------------------------

// The Bearer token lives in localStorage so a reload restores the session
// without hitting /auth/login again; /auth/me validates it on boot.
const TOKEN_KEY = "intern:token";

let _token: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;

export function getToken(): string | null {
  return _token;
}

export function setToken(token: string | null): void {
  _token = token;
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — session simply won't persist across reloads */
  }
}

function authHeader(): Record<string, string> {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

// Typed error carrying the HTTP status so callers can branch (e.g. show the
// backend's "Incorrect email or password" on 401 instead of a generic failure).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---- Backend DTO shapes (snake_case) ---------------------------------------

interface ApiOrg {
  id: string;
  name: string;
  type: string;
  sector: string;
  loc: string;
  seal: string;
  about: string;
}

interface ApiPlacement {
  id: string;
  title: string;
  org_id: string;
  courses: string[];
  grade: string;
  loc: string;
  mode: string;
  duration: string;
  stipend: string;
  deadline: string;
  slots: number;
  status: string;
  applicants: number;
  docs: string[];
  testimonial: boolean;
  about: string;
  duties: string[];
  review_status: string;
  published_at: string;
  closes_at: string;
  starts_at: string;
  requirements: string[];
  review_reason: string;
  org: ApiOrg | null;
  // Opportunity type: internship | gig | entry_level
  opportunity_type: string;
  // Gig-specific fields
  duration_hours: number | null;
  budget_range: string | null;
  milestones: string[] | null;
  remote_ok: boolean | null;
  // Entry-level specific fields
  salary_range: string | null;
  probation_period: string | null;
  training_included: boolean | null;
  career_path: string | null;
  // Skill requirements (for matching)
  skills_required: string[] | null;
}

interface ApiListResponse<T> {
  total: number;
  items: T[];
}

// ---- Mappers ---------------------------------------------------------------

function mapOrg(o: ApiOrg): Org {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    sector: o.sector,
    loc: o.loc,
    seal: o.seal,
    about: o.about,
  };
}

function mapPlacement(p: ApiPlacement): Placement {
  return {
    id: p.id,
    title: p.title,
    orgId: p.org_id,
    courses: p.courses,
    grade: p.grade,
    loc: p.loc,
    mode: p.mode,
    duration: p.duration,
    stipend: p.stipend,
    deadline: p.deadline,
    slots: p.slots,
    status: p.status,
    applicants: p.applicants,
    docs: p.docs,
    testimonial: p.testimonial,
    about: p.about,
    duties: p.duties,
    reviewStatus: p.review_status,
    publishedAt: p.published_at,
    closesAt: p.closes_at,
    startsAt: p.starts_at,
    requirements: p.requirements,
    reviewReason: p.review_reason,
    opportunityType: p.opportunity_type,
    durationHours: p.duration_hours,
    budgetRange: p.budget_range,
    milestones: p.milestones,
    remoteOk: p.remote_ok,
    salaryRange: p.salary_range,
    probationPeriod: p.probation_period,
    trainingIncluded: p.training_included,
    careerPath: p.career_path,
    skillsRequired: p.skills_required,
  };
}

// ---- Requests --------------------------------------------------------------

async function readError(res: Response, path: string): Promise<never> {
  // Prefer the backend's structured { detail } message; fall back to status.
  let detail = `API ${res.status} on ${path}`;
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") detail = body.detail;
  } catch {
    /* non-JSON error body — keep the status-derived message */
  }
  throw new ApiError(res.status, detail);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", ...authHeader() },
  });
  if (!res.ok) await readError(res, path);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await readError(res, path);
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await readError(res, path);
  return (await res.json()) as T;
}

export interface Catalog {
  placements: Placement[];
  orgs: Org[];
}

interface ApiJob {
  id: string;
  title: string;
  org_id: string;
  loc: string;
  mode: string;
  employment_type: string;
  salary: string;
  closes_at: string;
  summary: string;
  requirements: string[];
  status: string;
  review_status: string;
  published_at: string;
  review_reason: string;
  org: ApiOrg | null;
}

function mapJob(job: ApiJob): Job {
  return {
    id: job.id,
    title: job.title,
    orgId: job.org_id,
    orgName: job.org?.name || "Verified employer",
    loc: job.loc,
    mode: job.mode,
    employmentType: job.employment_type,
    salary: job.salary,
    closesAt: job.closes_at,
    summary: job.summary,
    requirements: job.requirements,
    status: job.status,
    reviewStatus: job.review_status,
    publishedAt: job.published_at,
    reviewReason: job.review_reason,
  };
}

export async function fetchJobs(): Promise<Job[]> {
  const data = await getJson<ApiListResponse<ApiJob>>("/jobs");
  return data.items.map(mapJob);
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

export async function fetchOrganizationJobs(): Promise<Job[]> {
  const data = await getJson<ApiListResponse<ApiJob>>("/organization/jobs");
  return data.items.map(mapJob);
}

export async function createOrganizationJob(input: JobPostingInput): Promise<Job> {
  const data = await postJson<ApiJob>("/organization/jobs", input);
  return mapJob(data);
}

// ---- Job Applications ------------------------------------------------------

export interface JobApplicationListResponse {
  total: number;
  items: JobApplicationDto[];
}

export interface JobApplicationInput {
  statement: string;
  cover_letter: string;
  cv_url: string;
  github_url: string;
  linkedin_url: string;
  portfolio_url: string;
  academic_papers: string[];
  reference_1_name: string;
  reference_1_email: string;
  reference_1_phone: string;
  reference_1_relationship: string;
  reference_2_name: string;
  reference_2_email: string;
  reference_2_phone: string;
  reference_2_relationship: string;
  document_ids: string[];
}

export async function applyToJob(
  jobId: string,
  input: JobApplicationInput
): Promise<JobApplicationDto> {
  return postJson<JobApplicationDto>(`/jobs/${jobId}/apply`, input);
}

export interface ApplicationInput {
  statement: string;
  cover_letter: string;
  cv_url: string;
  github_url: string;
  linkedin_url: string;
  portfolio_url: string;
  academic_papers: string[];
  reference_1_name: string;
  reference_1_email: string;
  reference_1_phone: string;
  reference_1_relationship: string;
  reference_2_name: string;
  reference_2_email: string;
  reference_2_phone: string;
  reference_2_relationship: string;
  document_ids: string[];
}

export async function applyToPlacement(
  placementId: string,
  input: ApplicationInput
): Promise<ApplicationDto> {
  return postJson<ApplicationDto>("/applications", {
    placement_id: placementId,
    ...input,
  });
}

export async function fetchMyJobApplications(): Promise<JobApplicationListResponse> {
  return getJson<JobApplicationListResponse>("/jobs/my/applications");
}

export async function fetchJobApplicants(jobId: string): Promise<JobApplicationListResponse> {
  return getJson<JobApplicationListResponse>(`/jobs/${jobId}/applicants`);
}

export async function updateJobApplicationStatus(
  applicationId: string,
  status: string
): Promise<JobApplicationDto> {
  return patchJson<JobApplicationDto>(`/jobs/applications/${applicationId}/status`, { status });
}

export async function withdrawJobApplication(applicationId: string): Promise<JobApplicationDto> {
  return postJson<JobApplicationDto>(`/jobs/applications/${applicationId}/withdraw`, {});
}

// ---- CSV Exports -----------------------------------------------------------

export async function exportPlacementsCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/placements.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export placements");
  return res.blob();
}

export async function exportJobsCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/jobs.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export jobs");
  return res.blob();
}

export async function exportPlacementApplicantsCsv(placementId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/placement/${placementId}/applicants.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export placement applicants");
  return res.blob();
}

export async function exportJobApplicantsCsv(jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/job/${jobId}/applicants.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export job applicants");
  return res.blob();
}

// Employer exports
export async function exportOrgPlacementsCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/organization/export/placements.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export placements");
  return res.blob();
}

export async function exportOrgJobsCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/organization/export/jobs.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export jobs");
  return res.blob();
}

export async function exportOrgPlacementApplicantsCsv(placementId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/organization/export/placement/${placementId}/applicants.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export placement applicants");
  return res.blob();
}

export async function exportOrgJobApplicantsCsv(jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/organization/export/job/${jobId}/applicants.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export job applicants");
  return res.blob();
}

// Admin Applications
export interface AdminApplicationsParams {
  type?: "internship" | "job";
  status?: string;
  placement_id?: string;
  job_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export async function fetchAdminApplications(params?: AdminApplicationsParams): Promise<ApplicationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.append("type", params.type);
  if (params?.status) searchParams.append("status", params.status);
  if (params?.placement_id) searchParams.append("placement_id", params.placement_id);
  if (params?.job_id) searchParams.append("job_id", params.job_id);
  if (params?.search) searchParams.append("search", params.search);
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.page_size) searchParams.append("page_size", String(params.page_size));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getJson<ApplicationsResponse>(`/admin/applications${query}`);
}

export async function exportAdminApplicationsCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/applications.csv`, {
    headers: { Accept: "text/csv", ...authHeader() },
  });
  if (!res.ok) throw new Error("Failed to export applications");
  return res.blob();
}

export interface ApplicationsResponse {
  total: number;
  items: ApplicationDto[];
}

export interface InternshipPostingInput {
  title: string;
  courses: string[];
  grade: string;
  loc: string;
  mode: string;
  duration: string;
  stipend: string;
  slots: number;
  about: string;
  duties: string[];
  requirements: string[];
  docs: string[];
  testimonial: boolean;
  published_at: string;
  closes_at: string;
  starts_at: string;
  // Opportunity type: internship | gig | entry_level
  opportunity_type: string;
  // Gig-specific fields
  duration_hours?: number | null;
  budget_range?: string | null;
  milestones?: string[] | null;
  remote_ok?: boolean | null;
  // Entry-level specific fields
  salary_range?: string | null;
  probation_period?: string | null;
  training_included?: boolean | null;
  career_path?: string | null;
  // Skill requirements (for matching)
  skills_required?: string[] | null;
}

export async function fetchOrganizationInternships(): Promise<Placement[]> {
  const data = await getJson<ApiListResponse<ApiPlacement>>(
    "/organization/internships"
  );
  return data.items.map(mapPlacement);
}

export async function createOrganizationInternship(
  input: InternshipPostingInput
): Promise<Placement> {
  const data = await postJson<ApiPlacement>("/organization/internships", input);
  return mapPlacement(data);
}

export async function fetchInternshipReviewQueue(): Promise<Placement[]> {
  const data = await getJson<ApiListResponse<ApiPlacement>>(
    "/admin/internships/review"
  );
  return data.items.map(mapPlacement);
}

export interface AdminPlacementListParams {
  reviewStatus?: string;
  status?: string;
  orgId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PlacementListResponse {
  total: number;
  items: Placement[];
}

export async function fetchAdminPlacements(
  params?: AdminPlacementListParams
): Promise<PlacementListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.reviewStatus) searchParams.append("review_status", params.reviewStatus);
  if (params?.status) searchParams.append("status", params.status);
  if (params?.orgId) searchParams.append("org_id", params.orgId);
  if (params?.search) searchParams.append("search", params.search);
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.pageSize) searchParams.append("page_size", String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const data = await getJson<ApiListResponse<ApiPlacement>>(`/admin/placements${query}`);
  return {
    total: data.total,
    items: data.items.map(mapPlacement),
  };
}

export async function reviewInternship(
  internshipId: string,
  decision: "approved" | "rejected",
  reason = ""
): Promise<Placement> {
  const data = await patchJson<ApiPlacement>(
    `/admin/internships/${internshipId}/review`,
    { decision, reason }
  );
  return mapPlacement(data);
}

// GET /placements -> placements plus the orgs referenced by them (deduped from
// the nested `org` the repository resolves, so we don't need a separate
// /organisations endpoint).
export async function fetchCatalog(): Promise<Catalog> {
  const data = await getJson<ApiListResponse<ApiPlacement>>("/placements");
  const placements = data.items.map(mapPlacement);
  const byId = new Map<string, Org>();
  for (const p of data.items) {
    if (p.org && !byId.has(p.org.id)) byId.set(p.org.id, mapOrg(p.org));
  }
  return { placements, orgs: [...byId.values()] };
}

// ---- Catalogue metadata (the tables the frontend used to hardcode) --------

export interface CatalogSkill {
  name: string;
  category: string;
  keywords: string[];
}

export interface CatalogMeta {
  courses: string[];
  orgTypes: string[];
  locations: string[];
  gradeRules: Record<string, number>;
  requiredSkills: Record<string, string[]>;
  skills: CatalogSkill[];
}

// GET /placements/meta -> filter values derived from the live catalog, plus the
// grade thresholds, skill taxonomy and per-placement requirements owned by the
// backend matching domain.
export async function fetchCatalogMeta(): Promise<CatalogMeta> {
  const d = await getJson<{
    courses: string[];
    org_types: string[];
    locations: string[];
    grade_rules: Record<string, number>;
    required_skills: Record<string, string[]>;
    skills: CatalogSkill[];
  }>("/placements/meta");
  return {
    courses: d.courses,
    orgTypes: d.org_types,
    locations: d.locations,
    gradeRules: d.grade_rules,
    requiredSkills: d.required_skills,
    skills: d.skills,
  };
}

// ---- Saved placements (bookmarks) -----------------------------------------

// GET /saved -> the ids the authenticated user has bookmarked. Identity is the
// Bearer token (authHeader), so no user_id is sent.
export async function fetchSaved(): Promise<string[]> {
  const data = await getJson<{ saved_ids: string[] }>("/saved");
  return data.saved_ids;
}

// POST /saved/toggle -> flips the bookmark and returns the new flag plus the
// full updated shortlist, so the client can reconcile without a second GET.
export async function toggleSavedApi(
  placementId: string
): Promise<{ saved: boolean; savedIds: string[] }> {
  const data = await postJson<{ saved: boolean; saved_ids: string[] }>(
    "/saved/toggle",
    { placement_id: placementId }
  );
  return { saved: data.saved, savedIds: data.saved_ids };
}

// ---- Applications ----------------------------------------------------------

export interface StudentProfileDto {
  user_id: string;
  course: string;
  year: string;
  cgpa: number;
  university: string;
  skills: string[];
}

export interface ApplicationPackDto {
  user_id: string;
  statement: string;
  targets: string[];
}

export async function fetchApplicationPack(): Promise<ApplicationPackDto> {
  return getJson<ApplicationPackDto>("/application-pack");
}

export async function updateApplicationPack(
  pack: Omit<ApplicationPackDto, "user_id">
): Promise<ApplicationPackDto> {
  return fetch(`${API_BASE}/application-pack`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(pack),
  }).then(async (res) => {
    if (!res.ok) await readError(res, "/application-pack");
    return (await res.json()) as ApplicationPackDto;
  });
}

export interface ResumeDto {
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export async function fetchResume(): Promise<ResumeDto | null> {
  return getJson<ResumeDto | null>("/resume");
}

export async function uploadResume(file: File): Promise<ResumeDto> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}/resume`, {
    method: "PUT",
    headers: authHeader(),
    body,
  });
  if (!res.ok) await readError(res, "/resume");
  return (await res.json()) as ResumeDto;
}

export interface StudentDocumentDto {
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
}

export async function fetchStudentDocuments(): Promise<StudentDocumentDto[]> {
  const data = await getJson<{ items: StudentDocumentDto[] }>("/documents");
  return data.items;
}

export async function uploadStudentDocument(
  documentType: string,
  file: File
): Promise<StudentDocumentDto> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}/documents/${documentType}`, {
    method: "PUT",
    headers: authHeader(),
    body,
  });
  if (!res.ok) await readError(res, `/documents/${documentType}`);
  return (await res.json()) as StudentDocumentDto;
}

export async function toggleDocumentPublic(
  documentId: string,
  isPublic: boolean
): Promise<StudentDocumentDto> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}/public`, {
    method: "PATCH",
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_public: isPublic }),
  });
  if (!res.ok) await readError(res, `/admin/documents/${documentId}/public`);
  return (await res.json()) as StudentDocumentDto;
}

export async function fetchStudentProfile(): Promise<StudentProfileDto> {
  return getJson<StudentProfileDto>("/profile");
}

export async function updateStudentProfile(
  profile: Omit<StudentProfileDto, "user_id">
): Promise<StudentProfileDto> {
  return fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(profile),
  }).then(async (res) => {
    if (!res.ok) await readError(res, "/profile");
    return (await res.json()) as StudentProfileDto;
  });
}

export interface RankedPlacementDto {
  placement: ApiPlacement;
  match: {
    score: number;
    matched: string[];
    missing: string[];
    course_fit: boolean;
    grade_fit: boolean;
  };
}

export interface MatchDto {
  total: number;
  items: RankedPlacementDto[];
}

// POST /applications -> submit as the authenticated user (idempotent
// server-side: re-applying returns the existing record). Throws on 404 (unknown
// placement) or 409 (closed).
export async function applyApi(
  placementId: string,
  statement: string
): Promise<ApplicationDto> {
  return postJson<ApplicationDto>("/applications", {
    placement_id: placementId,
    statement,
  });
}

export async function fetchApplications(): Promise<ApplicationDto[]> {
  const data = await getJson<ApiListResponse<ApplicationDto>>("/applications");
  return data.items;
}

export async function withdrawApplicationApi(
  applicationId: string
): Promise<ApplicationDto> {
  return postJson<ApplicationDto>(
    `/applications/${applicationId}/withdraw`,
    {}
  );
}

export interface RankedPlacement {
  placement: Placement;
  match: {
    score: number;
    matched: string[];
    missing: string[];
    courseFit: boolean;
    gradeFit: boolean;
  };
}

export interface MatchResponse {
  total: number;
  items: RankedPlacement[];
}

export async function fetchRecommendedInternships(
  skills: string[],
  course: string,
  cgpa: number,
  limit = 6
): Promise<MatchResponse> {
  const data = await postJson<MatchDto>("/match", {
    skills,
    course,
    cgpa,
    limit,
  });
  return {
    total: data.total,
    items: data.items.map((item) => ({
      placement: mapPlacement(item.placement),
      match: {
        score: item.match.score,
        matched: item.match.matched,
        missing: item.match.missing,
        courseFit: item.match.course_fit,
        gradeFit: item.match.grade_fit,
      },
    })),
  };
}

// ---- Subscription (host-org placement-fee plan) ---------------------------

export interface SubscriptionDto {
  org_id: string;
  plan: string;
  billing_cycle: string;
  payment_gateway: string;
  seats: number;
  since: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_premium: boolean;
}

// GET /billing/subscriptions/current -> the authenticated org's live plan (defaults to Free).
export async function fetchSubscription(): Promise<SubscriptionDto> {
  return getJson<SubscriptionDto>("/billing/subscriptions/current");
}

export async function createSubscriptionApi(
  plan: string,
  billing_cycle: "monthly" | "annual",
  payment_gateway: string,
  payment_method_id?: string
): Promise<SubscriptionDto> {
  return postJson<SubscriptionDto>("/billing/subscriptions", {
    plan,
    billing_cycle,
    payment_gateway,
    payment_method_id,
  });
}

export async function updateSubscriptionApi(
  plan?: string,
  billing_cycle?: "monthly" | "annual"
): Promise<SubscriptionDto> {
  return patchJson<SubscriptionDto>("/billing/subscriptions/current", {
    plan,
    billing_cycle,
  });
}

export async function cancelSubscriptionApi(): Promise<SubscriptionDto> {
  return postJson<SubscriptionDto>("/billing/subscriptions/current/cancel", {});
}

export async function resumeSubscriptionApi(): Promise<SubscriptionDto> {
  return postJson<SubscriptionDto>("/billing/subscriptions/current/resume", {});
}

export async function fetchInvoices(
  status?: string
): Promise<InvoiceResponse[]> {
  const params = status ? `?status=${status}` : "";
  return getJson<InvoiceResponse[]>(`/billing/invoices${params}`);
}

export async function fetchTransactions(
  status?: string
): Promise<TransactionResponse[]> {
  const params = status ? `?status=${status}` : "";
  return getJson<TransactionResponse[]>(`/billing/transactions${params}`);
}

export async function payInvoiceApi(
  invoice_id: string,
  payment_method_id: string
): Promise<TransactionResponse> {
  return postJson<TransactionResponse>(`/billing/invoices/${invoice_id}/pay`, {
    payment_method_id,
  });
}

export async function fetchGateways(): Promise<GatewayOption[]> {
  return getJson<GatewayOption[]>("/billing/gateways");
}

export interface GatewayOption {
  id: string;
  name: string;
  currencies: string[];
}

export interface InvoiceResponse {
  id: string;
  org_id: string;
  subscription_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  invoice_number: string;
  description: string | null;
  line_items: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  due_date: string | null;
  paid_at: string | null;
  payment_gateway: string | null;
  gateway_invoice_id: string | null;
  gateway_payment_intent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TransactionResponse {
  id: string;
  org_id: string;
  invoice_id: string | null;
  subscription_id: string | null;
  amount_cents: number;
  currency: string;
  type: string;
  status: string;
  payment_gateway: string;
  gateway_transaction_id: string | null;
  gateway_response: Record<string, unknown>;
  description: string | null;
  metadata: Record<string, unknown>;
  idempotency_key: string | null;
  created_at: string | null;
  processed_at: string | null;
}

// ---- AI advisor ------------------------------------------------------------

// POST /advisor -> a Groq-generated reply grounded by the server-side matcher.
// Throws when Groq isn't configured (503) so the caller can fall back to the
// built-in deterministic assistant.
export interface AdvisorAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface AdvisorResponse {
  reply: string;
  actions: AdvisorAction[];
}

export async function askAdvisor(
  message: string,
  skills: string[],
  course: string,
  cgpa: number,
  role: string = "student",
  history: { id: string; who: string; text: string }[] = []
): Promise<AdvisorResponse> {
  const data = await postJson<AdvisorResponse>("/advisor", {
    message,
    skills,
    course,
    cgpa,
    role,
    history,
  });
  return data;
}

// ---- Admin document verification ------------------------------------------

export interface StudentDocumentRead {
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
}

export async function fetchAllStudentDocuments(
  status?: string
): Promise<StudentDocumentRead[]> {
  const params = status ? `?status=${status}` : "";
  return getJson<StudentDocumentRead[]>(`/admin/documents${params}`);
}

export async function verifyStudentDocument(
  documentId: string,
  status: "verified" | "rejected",
  rejectionReason = ""
): Promise<StudentDocumentRead> {
  return patchJson<StudentDocumentRead>(`/admin/documents/${documentId}/verify`, {
    status,
    rejection_reason: rejectionReason,
  });
}

// ---- Admin dashboard ------------------------------------------------------

export interface AdminDashboardMetrics {
  open_placements: number;
  pending_documents: number;
  students_placed: number;
  placement_record_complete: number;
  total_users: number;
  users_by_role: Record<string, number>;
  total_organizations: number;
  total_applications: number;
  total_revenue_cents: number;
  verification_rate: number;
}

export interface AdminQueueItemRead {
  n: string;
  i: string;
  c: string;
  y: string;
  p: string;
  d: string;
  st: string;
}

export interface AdminQueueListResponse {
  total: number;
  items: AdminQueueItemRead[];
}

export interface AdminActivityItem {
  who: string;
  action: string;
  time: string;
}

export async function fetchAdminMetrics(): Promise<AdminDashboardMetrics> {
  return getJson<AdminDashboardMetrics>("/admin/metrics");
}

export async function fetchAdminQueue(): Promise<AdminQueueListResponse> {
  return getJson<AdminQueueListResponse>("/admin/queue");
}

export async function fetchAdminActivity(): Promise<AdminActivityItem[]> {
  return getJson<AdminActivityItem[]>("/admin/activity");
}

export interface OrganizationRead {
  id: string;
  name: string;
  type: string;
  sector: string;
  loc: string;
  seal: string;
  about: string;
  billing_email: string | null;
  tax_id: string | null;
  billing_address: Record<string, any>;
  created_at: string;
  is_active: boolean;
}

export interface OrganizationListResponse {
  total: number;
  items: OrganizationRead[];
}

export interface OrganizationDetailResponse {
  organization: OrganizationRead;
  stats: Record<string, any>;
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

// ---- Admin dashboard ------------------------------------------------------

export interface AdminDashboardMetrics {
  open_placements: number;
  pending_documents: number;
  students_placed: number;
  placement_record_complete: number;
  total_users: number;
  users_by_role: Record<string, number>;
  total_organizations: number;
  total_applications: number;
  total_revenue_cents: number;
  verification_rate: number;
}

// ---- Organization Management ----------------------------------------------

export async function fetchOrganizationList(params?: {
  status?: string;
  orgType?: string;
  page?: number;
  pageSize?: number;
}): Promise<OrganizationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append("status", params.status);
  if (params?.orgType) searchParams.append("org_type", params.orgType);
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.pageSize) searchParams.append("page_size", String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getJson<OrganizationListResponse>(`/admin/organizations${query}`);
}

export async function fetchOrganizationDetail(
  orgId: string
): Promise<any> {
  return getJson<any>(`/admin/organizations/${orgId}`);
}

export async function sanctionOrganization(
  orgId: string,
  payload: { action: "suspend" | "unsuspend" | "sanction"; reason: string }
): Promise<any> {
  return patchJson<any>(`/admin/organizations/${orgId}/sanction`, payload);
}

// ---- Employer dashboard ---------------------------------------------------

export async function fetchOrganizationApplicants(
  placementId: string
): Promise<ApplicationDto[]> {
  const data = await getJson<ApiListResponse<ApplicationDto>>(
    `/placements/${placementId}/applicants`
  );
  return data.items;
}

export async function fetchJobApplications(): Promise<ApplicationDto[]> {
  const data = await getJson<ApiListResponse<ApplicationDto>>("/applications");
  return data.items;
}

// ---- Auth (real accounts + tokens) ----------------------------------------

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: string;
  org_id?: string | null;
}

interface ApiAuthResponse {
  access_token: string;
  token_type: string;
  user: ApiUser;
}

// POST /auth/login -> stores the Bearer token and returns the safe user view.
// Throws ApiError(401, "Incorrect email or password") on bad credentials.
export async function loginApi(username: string, password: string): Promise<ApiUser> {
  const data = await postJson<ApiAuthResponse>("/auth/login", { username, password });
  setToken(data.access_token);
  return data.user;
}

// POST /auth/register -> creates the account and signs straight in.
export async function registerApi(
  email: string,
  name: string,
  role: string,
  password: string
): Promise<ApiUser> {
  const data = await postJson<ApiAuthResponse>("/auth/register", {
    email,
    name,
    role,
    password,
  });
  setToken(data.access_token);
  return data.user;
}

// GET /auth/me -> the current account for a stored token, or null when there is
// no token. Clears a token the server rejects so a stale session can't linger.
export async function fetchMe(): Promise<ApiUser | null> {
  if (!_token) return null;
  try {
    return await getJson<ApiUser>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      setToken(null);
    }
    return null;
  }
}

// ---- User Management ------------------------------------------------------

export interface UserRead {
  id: string;
  email: string;
  name: string;
  role: string;
  org_id: string | null;
  created_at: string;
  is_active: boolean;
}

export interface UserListResponse {
  total: number;
  items: UserRead[];
}

export interface UserDetailResponse {
  user: UserRead;
  stats: Record<string, number>;
  applications_count: number;
  documents_count: number;
  testimonials_count: number;
  applications: Array<{
    id: string;
    placement_id: string;
    placement_title: string;
    organization: string;
    status: string;
    created_at: string;
  }>;
  documents: Array<{
    id: string;
    document_type: string;
    filename: string;
    status: string;
    uploaded_at: string;
  }>;
  testimonials: Array<{
    id: string;
    filename: string;
    status: string;
    uploaded_at: string;
  }>;
  subscription: {
    plan: string;
    billing: string;
    seats: number;
    status: string;
  } | null;
}

export interface UserActionRequest {
  action: "suspend" | "activate" | "change_role";
  reason: string;
  new_role?: string;
}

export interface UserActionResponse {
  user: UserRead;
  action: string;
  reason: string;
  message: string;
}

export interface UserListResponse {
  total: number;
  items: UserRead[];
}

export interface UserDetailResponse {
  user: UserRead;
  stats: Record<string, number>;
  applications_count: number;
  documents_count: number;
  testimonials_count: number;
  applications: Array<{
    id: string;
    placement_id: string;
    placement_title: string;
    organization: string;
    status: string;
    created_at: string;
  }>;
  documents: Array<{
    id: string;
    document_type: string;
    filename: string;
    status: string;
    uploaded_at: string;
  }>;
  testimonials: Array<{
    id: string;
    filename: string;
    status: string;
    uploaded_at: string;
  }>;
  subscription: {
    plan: string;
    billing: string;
    seats: number;
    status: string;
  } | null;
}

export interface UserActionRequest {
  action: "suspend" | "activate" | "change_role";
  reason: string;
  new_role?: string;
}

export interface UserActionResponse {
  user: UserRead;
  action: string;
  reason: string;
  message: string;
}

export interface UserListResponse {
  total: number;
  items: UserRead[];
}

export async function fetchUserList(params?: {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<UserListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.append("role", params.role);
  if (params?.status) searchParams.append("status", params.status);
  if (params?.search) searchParams.append("search", params.search);
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.pageSize) searchParams.append("page_size", String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getJson<UserListResponse>(`/admin/users${query}`);
}

export async function fetchUserDetail(
  userId: string
): Promise<UserDetailResponse> {
  return getJson<UserDetailResponse>(`/admin/users/${userId}`);
}

export async function userAction(
  userId: string,
  payload:  { action: "suspend" | "activate" | "change_role"; reason: string; new_role?: string 
}
): Promise<UserActionResponse> {
  return patchJson<UserActionResponse>(`/admin/users/${userId}/action`, payload);
}
