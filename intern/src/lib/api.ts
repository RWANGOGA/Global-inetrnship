// Thin browser client for the FastAPI backend.
//
// The static site is deployed to GitHub Pages where no backend runs, so the
// base URL is optional: when NEXT_PUBLIC_API_BASE_URL is unset the app keeps
// using the bundled seed. When it IS set (local dev against uvicorn, or once
// the API is hosted on Neon/Render), reads come from the database instead.
//
// The backend speaks snake_case; the UI types are camelCase. This module is the
// single translation boundary, so components never learn about either shape.
import { Job, Org, Placement, ApplicationDto, JobApplicationDto, CompanyProfile, AdminActionLogRead, LearningResource } from "../types";

export type { LearningResource } from "../types";

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

async function deleteJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...authHeader(),
    },
  });
  if (!res.ok) await readError(res, path);
  return (await res.json()) as T;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
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

export async function fetchJobDetail(jobId: string): Promise<Job> {
  const data = await getJson<ApiJob>(`/jobs/${jobId}`);
  return mapJob(data);
}

export async function fetchOrganization(orgId: string): Promise<CompanyProfile> {
  return getJson<CompanyProfile>(`/organization/public/${orgId}`);
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

export async function toggleJobApplicationShortlist(applicationId: string): Promise<JobApplicationDto> {
  return patchJson<JobApplicationDto>(`/jobs/applications/${applicationId}/shortlist`, {});
}

// ---- Internship Application Shortlist ---------------------------------------

export async function toggleInternshipApplicationShortlist(applicationId: string): Promise<ApplicationDto> {
  return patchJson<ApplicationDto>(`/applications/${applicationId}/shortlist`, {});
}

// ---- Saved Jobs -----------------------------------------------------------

export async function fetchSavedJobs(): Promise<string[]> {
  return getJson<string[]>("/jobs/saved");
}

export async function checkSavedJob(jobId: string): Promise<boolean> {
  return getJson<boolean>(`/jobs/saved/${jobId}`);
}

export async function toggleSavedJob(jobId: string): Promise<boolean> {
  return postJson<boolean>(`/jobs/saved/${jobId}/toggle`, {});
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

export type { AdminActionLogRead } from "../types";

// Admin Action Logs
export interface AdminActionLogsParams {
  admin_id?: string;
  target_user_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface AdminActionLogListResponse {
  total: number;
  items: AdminActionLogRead[];
}

export async function fetchAdminActionLogs(params?: AdminActionLogsParams): Promise<AdminActionLogListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.admin_id) searchParams.append("admin_id", params.admin_id);
  if (params?.target_user_id) searchParams.append("target_user_id", params.target_user_id);
  if (params?.action) searchParams.append("action", params.action);
  if (params?.start_date) searchParams.append("start_date", params.start_date);
  if (params?.end_date) searchParams.append("end_date", params.end_date);
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.page_size) searchParams.append("page_size", String(params.page_size));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getJson<AdminActionLogListResponse>(`/admin/action-logs${query}`);
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

export async function closePlacement(
  placementId: string
): Promise<Placement> {
  const data = await patchJson<ApiPlacement>(
    `/admin/placements/${placementId}/close`,
    {}
  );
  return mapPlacement(data);
}

export async function reopenPlacement(
  placementId: string
): Promise<Placement> {
  const data = await patchJson<ApiPlacement>(
    `/admin/placements/${placementId}/reopen`,
    {}
  );
  return mapPlacement(data);
}

export interface PlacementRequirementsInput {
  courses?: string[];
  grade?: string;
  docs?: string[];
  testimonial?: boolean;
  requirements?: string[];
}

export async function updatePlacementRequirementsApi(
  placementId: string,
  input: PlacementRequirementsInput
): Promise<Placement> {
  const data = await patchJson<ApiPlacement>(
    `/placements/${placementId}/requirements`,
    input
  );
  return mapPlacement(data);
}

// GET /placements -> placements plus the orgs referenced by them (deduped from
// the nested `org` the repository resolves, so we don't need a separate
// /organisations endpoint).
export async function fetchCatalog(opportunityType?: string): Promise<Catalog> {
  const params = new URLSearchParams();
  if (opportunityType) params.append("opportunity_type", opportunityType);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await getJson<ApiListResponse<ApiPlacement>>(`/placements${query}`);
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
  talent_search_opt_in?: boolean;
  skills_confidence: Record<string, number>;
  skills_source: Record<string, string>;
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

export interface SkillSuggestionDto {
  name: string;
  category: string;
  demand: number;
  placement_ids: string[];
}

export interface SkillSuggestionListDto {
  total: number;
  items: SkillSuggestionDto[];
}

export async function fetchSkillSuggestions(): Promise<SkillSuggestionListDto> {
  return getJson<SkillSuggestionListDto>("/profile/skill-suggestions");
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
  limit = 6,
  opportunityType?: string,
  skillsConfidence: Record<string, number> = {}
): Promise<MatchResponse> {
  const data = await postJson<MatchDto>("/match", {
    skills,
    course,
    cgpa,
    limit,
    opportunity_type: opportunityType,
    skills_confidence: skillsConfidence,
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
  
  // ---- AI Enrichment --------------------------------------------------------

  export interface EnrichmentRequest {
    personal_statement: string;
    existing_skills: string[];
  }

  export interface SkillCompetencyDto {
    skill_id: string;
    canonical_name: string;
    aliases: string[];
    category: string;
    proficiency: number;
    confidence_score: number;
    evidence: string[];
    years_experience: number;
    learning_velocity: number;
  }

  export interface SoftSkillProfileDto {
    leadership: number;
    communication: number;
    teamwork: number;
    adaptability: number;
    problem_solving: number;
    initiative: number;
    organization: number;
    cultural_awareness: number;
  }

  export interface CareerTrajectoryDto {
    current_stage: string;
    target_roles: string[];
    career_aspirations: string[];
    domain_interests: string[];
    learning_goals: string[];
    work_preferences: string;
    values_signals: string[];
  }

  export interface CulturalValuesDto {
    autonomy_preference: number;
    mission_alignment: number;
    collaboration_style: string;
    risk_tolerance: number;
    learning_appetite: number;
    work_life_integration: number;
    feedback_receptivity: number;
    diversity_value: number;
  }

  export interface AdvancedStudentProfileDto {
    user_id: string;
    skills: SkillCompetencyDto[];
    career_trajectory: CareerTrajectoryDto;
    soft_skills: SoftSkillProfileDto;
    cultural_values: CulturalValuesDto;
    profile_embedding: number[];
    skills_embedding: number[];
    bio_embedding: number[];
    course: string;
    university: string;
    cgpa: number;
    graduation_year: number;
    location_preferences: string[];
    remote_ok: boolean;
    availability: string;
  }

  export interface EnrichmentResponse {
    profile: AdvancedStudentProfileDto;
    message: string;
  }

  export async function enrichProfile(
    personalStatement: string,
    existingSkills: string[] = []
  ): Promise<AdvancedStudentProfileDto> {
    const data = await postJson<EnrichmentResponse>("/enrich", {
      personal_statement: personalStatement,
      existing_skills: existingSkills,
    });
    return data.profile;
  }

  export async function checkEnrichmentStatus(): Promise<{ configured: boolean; model: string | null }> {
    return getJson<{ configured: boolean; model: string | null }>("/enrich/status");
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
  history: { id: string; who: string; text: string }[] = [],
  isFirstMessage: boolean = false
): Promise<AdvisorResponse> {
  const data = await postJson<AdvisorResponse>("/advisor", {
    message,
    skills,
    course,
    cgpa,
    role,
    history,
    is_first_message: isFirstMessage,
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
  org_types: Record<string, number>;
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

// ---- Admin Reports ------------------------------------------------------

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  org_id?: string;
  placement_id?: string;
}

export interface PlacementReportItem {
  placement_id: string;
  title: string;
  organization: string;
  org_type: string;
  status: string;
  review_status: string;
  published_at: string;
  closes_at: string;
  starts_at: string;
  slots: number;
  applicants: number;
  filled: number;
  stipend: string;
  location: string;
  mode: string;
}

export interface PlacementReportResponse {
  total: number;
  items: PlacementReportItem[];
  summary: Record<string, any>;
}

export interface ApplicationReportItem {
  application_id: string;
  type: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  placement_id?: string;
  placement_title?: string;
  job_id?: string;
  job_title?: string;
  organization?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationReportResponse {
  total: number;
  items: ApplicationReportItem[];
  summary: Record<string, any>;
}

export interface HireReportItem {
  application_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  placement_id: string;
  placement_title: string;
  organization: string;
  org_type: string;
  hired_at: string;
  stipend: string;
  duration: string;
}

export interface HireReportResponse {
  total: number;
  items: HireReportItem[];
  summary: Record<string, any>;
}

export interface VerificationReportItem {
  document_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  document_type: string;
  filename: string;
  status: string;
  uploaded_at: string;
  verified_at?: string;
  verified_by?: string;
  rejection_reason: string;
}

export interface VerificationReportResponse {
  total: number;
  items: VerificationReportItem[];
  summary: Record<string, any>;
}

export async function fetchPlacementsReport(filters?: ReportFilters): Promise<PlacementReportResponse> {
  return postJson<PlacementReportResponse>("/admin/reports/placements", filters || {});
}

export async function fetchApplicationsReport(filters?: ReportFilters): Promise<ApplicationReportResponse> {
  return postJson<ApplicationReportResponse>("/admin/reports/applications", filters || {});
}

export async function fetchHiresReport(filters?: ReportFilters): Promise<HireReportResponse> {
  return postJson<HireReportResponse>("/admin/reports/hires", filters || {});
}

export async function fetchVerificationReport(filters?: ReportFilters): Promise<VerificationReportResponse> {
  return postJson<VerificationReportResponse>("/admin/reports/verification", filters || {});
}

export async function exportPlacementsReportCsv(filters?: ReportFilters): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/reports/placements.csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/csv",
      ...authHeader(),
    },
    body: JSON.stringify(filters || {}),
  });
  if (!res.ok) throw new Error("Failed to export placements report");
  return res.blob();
}

export async function exportApplicationsReportCsv(filters?: ReportFilters): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/reports/applications.csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/csv",
      ...authHeader(),
    },
    body: JSON.stringify(filters || {}),
  });
  if (!res.ok) throw new Error("Failed to export applications report");
  return res.blob();
}

export async function exportHiresReportCsv(filters?: ReportFilters): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/reports/hires.csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/csv",
      ...authHeader(),
    },
    body: JSON.stringify(filters || {}),
  });
  if (!res.ok) throw new Error("Failed to export hires report");
  return res.blob();
}

export async function exportVerificationReportCsv(filters?: ReportFilters): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/reports/verification.csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/csv",
      ...authHeader(),
    },
    body: JSON.stringify(filters || {}),
  });
  if (!res.ok) throw new Error("Failed to export verification report");
  return res.blob();
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
  org_types: Record<string, number>;
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

export async function fetchOrganizationShortlistedInternships(): Promise<ApplicationDto[]> {
  return getJson<ApplicationDto[]>("/organization/shortlisted");
}

export async function fetchOrganizationShortlistedJobs(): Promise<JobApplicationDto[]> {
  return getJson<JobApplicationDto[]>("/organization/shortlisted/jobs");
}

export async function fetchOrganizationProfile(): Promise<CompanyProfile> {
  return getJson<CompanyProfile>("/organization/profile");
}

export interface OrganizationProfileUpdate {
  name?: string;
  type?: string;
  sector?: string;
  loc?: string;
  seal?: string;
  about?: string;
  billing_email?: string;
  tax_id?: string;
  billing_address?: Record<string, unknown>;
}

export async function updateOrganizationProfile(
  payload: OrganizationProfileUpdate
): Promise<CompanyProfile> {
  return patchJson<CompanyProfile>("/organization/profile", payload);
}

export interface TalentSearchFilters {
  skills?: string[];
  course?: string;
  location?: string;
  university?: string;
  limit?: number;
  offset?: number;
}

export interface StudentProfileSearchResult {
  user_id: string;
  course: string;
  year: string;
  cgpa: number;
  university: string;
  skills: string[];
  talent_search_opt_in: boolean;
}

export async function searchStudentProfiles(
  filters: TalentSearchFilters
): Promise<StudentProfileSearchResult[]> {
  return postJson<StudentProfileSearchResult[]>("/organization/talent-search", filters);
}

export async function fetchTalentSearchCourses(): Promise<string[]> {
  return getJson<string[]>("/organization/talent-search/courses");
}

export async function fetchTalentSearchLocations(): Promise<string[]> {
  return getJson<string[]>("/organization/talent-search/locations");
}

export async function fetchTalentSearchUniversities(): Promise<string[]> {
  return getJson<string[]>("/organization/talent-search/universities");
}

export interface ApplicantMatchScore {
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  course_fit: boolean;
  grade_fit: boolean;
}

export interface ApplicantDetail {
  application_id: string;
  application_type: "internship" | "job";
  status: string;
  statement: string;
  cover_letter: string;
  cv_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  academic_papers: any[];
  reference_1_name: string;
  reference_1_email: string;
  reference_1_phone: string;
  reference_1_relationship: string;
  reference_2_name: string;
  reference_2_email: string;
  reference_2_phone: string;
  reference_2_relationship: string;
  document_ids: string[];
  shortlisted: boolean;
  created_at: string;
  updated_at: string | null;
  student_id: string;
  student_name: string;
  student_email: string;
  student_course: string;
  student_year: string;
  student_cgpa: number;
  student_university: string;
  student_skills: string[];
  talent_search_opt_in: boolean;
  placement_id: string | null;
  placement_title: string | null;
  placement_opportunity_type: string | null;
  job_id: string | null;
  job_title: string | null;
  documents: any[];
  match_score: ApplicantMatchScore | null;
}

export async function fetchApplicantDetail(
  applicationId: string
): Promise<ApplicantDetail> {
  return getJson<ApplicantDetail>(`/organization/applicants/${applicationId}/detail`);
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
  deleted?: "false" | "true" | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<UserListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.append("role", params.role);
  if (params?.status) searchParams.append("status", params.status);
  if (params?.deleted && params.deleted !== "all") searchParams.append("deleted", params.deleted);
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
  payload:  { action: "suspend" | "activate" | "change_role" | "delete"; reason: string; new_role?: string 
}
): Promise<UserActionResponse> {
  return patchJson<UserActionResponse>(`/admin/users/${userId}/action`, payload);
}

// ---- Organization Team Management ------------------------------------

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface OrganizationMemberListResponse {
  total: number;
  items: OrganizationMember[];
}

export interface InviteMemberRequest {
  email: string;
  role: "owner" | "admin" | "recruiter" | "member";
}

export interface InviteMemberResponse {
  member: OrganizationMember;
  message: string;
}

export interface UpdateMemberRoleRequest {
  role: "owner" | "admin" | "recruiter" | "member";
}

export interface UpdateMemberRoleResponse {
  member: OrganizationMember;
  message: string;
}

export interface RemoveMemberResponse {
  message: string;
}

export async function fetchOrganizationMembers(): Promise<OrganizationMemberListResponse> {
  return getJson<OrganizationMemberListResponse>("/organization/members");
}

export async function inviteOrganizationMember(
  payload: InviteMemberRequest
): Promise<InviteMemberResponse> {
  return postJson<InviteMemberResponse>("/organization/members/invite", payload);
}

export async function updateOrganizationMemberRole(
  memberId: string,
  payload: UpdateMemberRoleRequest
): Promise<UpdateMemberRoleResponse> {
  return patchJson<UpdateMemberRoleResponse>(`/organization/members/${memberId}/role`, payload);
}

export async function removeOrganizationMember(
  memberId: string
): Promise<RemoveMemberResponse> {
  return deleteJson<RemoveMemberResponse>(`/organization/members/${memberId}`);
}

// ---- Hiring Funnel Analytics ------------------------------------

export interface FunnelStageMetrics {
  stage: string;
  count: number;
  conversion_rate: number;
  avg_days_in_stage: number | null;
}

export interface AdminHiringFunnelAnalytics {
  period_start: string;
  period_end: string;
  total_organizations: number;
  total_postings: number;
  total_applications: number;
  applications_by_type: Record<string, number>;
  applications_by_status: Record<string, number>;
  overall_stages: FunnelStageMetrics[];
  avg_time_to_hire_days: number | null;
  top_organizations_by_hires: Array<{ organization_id: string; organization_name: string; hires: number }>;
  top_skills_platform: Array<{ skill: string; count: number }>;
  conversion_by_org_type: Record<string, number>;
  conversion_by_opportunity_type: Record<string, number>;
}

export interface EmployerHiringFunnelAnalytics {
  organization_id: string;
  period_start: string;
  period_end: string;
  total_postings: number;
  total_applications: number;
  applications_by_status: Record<string, number>;
  applications_by_type: Record<string, number>;
  stages: FunnelStageMetrics[];
  avg_time_to_hire_days: number | null;
  top_skills_in_demand: Array<{ skill: string; count: number }>;
  conversion_by_posting: Array<{
    placement_id: string;
    placement_title: string;
    opportunity_type: string;
    total_applications: number;
    accepted: number;
    conversion_rate: number;
  }>;
}

export interface AdminHiringFunnelRequest {
  period_start: string;
  period_end: string;
  org_type?: string;
  opportunity_type?: string;
}

export interface EmployerHiringFunnelRequest {
  period_start: string;
  period_end: string;
  placement_id?: string;
}

export async function fetchAdminHiringFunnelAnalytics(
  params: AdminHiringFunnelRequest
): Promise<AdminHiringFunnelAnalytics> {
  const searchParams = new URLSearchParams();
  searchParams.append("period_start", params.period_start);
  searchParams.append("period_end", params.period_end);
  if (params.org_type) searchParams.append("org_type", params.org_type);
  if (params.opportunity_type) searchParams.append("opportunity_type", params.opportunity_type);
  return getJson<AdminHiringFunnelAnalytics>(`/admin/analytics/hiring-funnel?${searchParams.toString()}`);
}

export async function fetchEmployerHiringFunnelAnalytics(
  params: EmployerHiringFunnelRequest
): Promise<EmployerHiringFunnelAnalytics> {
  const searchParams = new URLSearchParams();
  searchParams.append("period_start", params.period_start);
  searchParams.append("period_end", params.period_end);
  if (params.placement_id) searchParams.append("placement_id", params.placement_id);
  return getJson<EmployerHiringFunnelAnalytics>(`/organization/analytics/hiring-funnel?${searchParams.toString()}`);
}

// ---- Learning resources ----------------------------------------------------

export interface LearningResourceDto {
  id: string;
  title: string;
  url: string;
  provider: string;
  description: string;
  skill: string;
  placement_id: string;
  level: string;
  resource_type: string;
  duration: string;
  created_at: string;
}

export interface LearningResourceListDto {
  total: number;
  items: LearningResourceDto[];
}

export interface LearningResourceInput {
  title: string;
  url: string;
  provider: string;
  description: string;
  skill: string;
  placement_id: string;
  level: string;
  resource_type: string;
  duration: string;
}

export function mapLearningResource(r: LearningResourceDto): LearningResource {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    provider: r.provider,
    description: r.description,
    skill: r.skill,
    placementId: r.placement_id,
    level: r.level,
    resourceType: r.resource_type,
    duration: r.duration,
    createdAt: r.created_at,
  };
}

export async function fetchLearningResources(params?: {
  skill?: string;
  placementId?: string;
}): Promise<LearningResource[]> {
  const searchParams = new URLSearchParams();
  if (params?.skill) searchParams.append("skill", params.skill);
  if (params?.placementId) searchParams.append("placement_id", params.placementId);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const data = await getJson<LearningResourceListDto>(`/learning-resources${query}`);
  return data.items.map(mapLearningResource);
}

export async function createLearningResource(
  input: LearningResourceInput
): Promise<LearningResource> {
  const data = await postJson<LearningResourceDto>("/learning-resources", input);
  return mapLearningResource(data);
}

export async function updateLearningResource(
  id: string,
  input: LearningResourceInput
): Promise<LearningResource> {
  const data = await putJson<LearningResourceDto>(
    `/learning-resources/${id}`,
    input
  );
  return mapLearningResource(data);
}

export async function deleteLearningResource(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/learning-resources/${id}`, {
    method: "DELETE",
    headers: { Accept: "application/json", ...authHeader() },
  });
  if (!res.ok) await readError(res, `/learning-resources/${id}`);
}

// ---- Testimonials (public) --------------------------------------------------

export interface TestimonialDto {
  id: string;
  user_id: string;
  filename: string;
  document_type: string;
  status: string;
  is_public: boolean;
  uploaded_at: string;
  author_role: string;
}

export async function fetchPublicTestimonials(limit = 10, role?: string): Promise<TestimonialDto[]> {
  const params = new URLSearchParams();
  params.append("limit", String(limit));
  if (role) params.append("role", role);
  return getJson<TestimonialDto[]>(`/admin/testimonials?${params.toString()}`);
}

// ---- Contact info -----------------------------------------------------------

export interface ContactInfoDto {
  email: string;
  whatsapp: string;
}

export async function fetchContactInfo(): Promise<ContactInfoDto> {
  return getJson<ContactInfoDto>("/contact/info");
}

// ---- Featured placements (for home page) ------------------------------------

export interface FeaturedPlacementDto {
  id: string;
  title: string;
  organization: string;
  organization_type: string;
  location: string;
  mode: string;
  duration: string;
  stipend: string;
  deadline: string;
  opportunity_type: string;
  skills_required: string[];
}

export async function fetchFeaturedPlacements(limit = 6): Promise<FeaturedPlacementDto[]> {
  return getJson<FeaturedPlacementDto[]>(`/placements?limit=${limit}`);
}

// ---- Student learning tracking ----------------------------------------------

export interface LearningProgressDto {
  course_id: string;
  course_name: string;
  completed_modules: number;
  total_modules: number;
  progress_percentage: number;
  last_accessed: string;
  badge_earned: string | null;
}

export interface StudentLearningProfileDto {
  user_id: string;
  completed_courses: LearningProgressDto[];
  in_progress_courses: LearningProgressDto[];
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    earned_at: string;
    badge_icon: string;
  }>;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    earned: boolean;
    earned_at?: string;
  }>;
}

export async function fetchStudentLearningProfile(): Promise<StudentLearningProfileDto> {
  return getJson<StudentLearningProfileDto>("/student/learning/profile");
}

export async function markModuleComplete(courseId: string, moduleId: string): Promise<{ success: boolean; badge_earned?: string }> {
  const data = await postJson<{ success: boolean; badge_earned?: string }>("/student/learning/complete-module", {
    course_id: courseId,
    module_id: moduleId,
  });
  return data;
}

// ---- Home page stats --------------------------------------------------------

export interface HomeStatsDto {
  total_placements: number;
  total_organizations: number;
  total_students: number;
  total_applications: number;
  recent_placements: Array<{
    id: string;
    title: string;
    organization: string;
    organization_type: string;
    opportunity_type: string;
    deadline: string;
  }>;
  org_counts: Record<string, number>;
}

export async function fetchHomeStats(): Promise<HomeStatsDto> {
  return getJson<HomeStatsDto>("/home/stats");
}
