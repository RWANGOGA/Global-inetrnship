"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  Org,
  Placement,
  GradRole,
  Student,
  DocItem,
  AdminQueueItem,
  ActivityItem,
  ApplicationPack,
  UserRole,
  DashboardView,
  ChatMessage,
  ModalConfig,
  Subscription,
  Portal,
} from "../types";
import {
  INITIAL_PACK,
} from "../data";
import { matchPlacement, setSkillTables } from "../lib/skills";
import {
  applyApi,
  applyToPlacement,
  askAdvisor,
  cancelSubscriptionApi,
  fetchAdminActivity,
  fetchAdminMetrics,
  fetchAdminQueue,
  fetchCatalog,
  fetchCatalogMeta,
  fetchApplications,
  fetchStudentProfile,
  fetchResume,
  fetchStudentDocuments,
  fetchApplicationPack,
  updateApplicationPack,
  fetchRecommendedInternships,
  fetchOrganizationInternships,
  fetchOrganizationApplicants,
  fetchSubscription,
  createSubscriptionApi,
  updateSubscriptionApi,
  resumeSubscriptionApi,
  MatchResponse,
  fetchMe,
  fetchSaved,
  isApiEnabled,
  loginApi,
  registerApi,
  setToken,
  toggleSavedApi,
  uploadResume,
  uploadStudentDocument,
  withdrawApplicationApi,
  updateStudentProfile,
  fetchOrganizationList,
  fetchOrganizationDetail,
  sanctionOrganization,
  fetchUserList,
  fetchUserDetail,
  userAction,
  type ApiUser,
  type CatalogMeta,
  type SubscriptionDto,
  type MatchDto,
  type ResumeDto,
  type StudentDocumentDto,
  type AdvisorResponse,
  type AdvisorAction,
  type InvoiceResponse,
  type TransactionResponse,
  type GatewayOption,
  type OrganizationRead,
  type OrganizationDetailResponse,
  type OrganizationListResponse,
  type OrganizationSanctionRequest,
  type OrganizationSanctionResponse,
  type UserRead,
  type UserDetailResponse,
  type UserListResponse,
  type UserActionRequest,
  type UserActionResponse,
} from "../lib/api";
import type { ApplicationDto, JobApplicationDto } from "../types";
import { ApplicationForm } from "../components/dashboard/student/ApplicationForm";

// Placement-fee model. Free host organisations (seed org "o4") publish up to
// this many placements, then the fee applies. Mirrors the site's "first three
// placements free" promise and turns it into enforced behaviour.
const FREE_ALLOWANCE = 3;
const SUBSCRIPTION_KEY = "intern:subscription";

// The empty catalogue-meta shape. The UI renders nothing derived from it until
// GET /placements/meta fills it — there is no bundled fallback table.
const EMPTY_META: CatalogMeta = {
  courses: [],
  orgTypes: [],
  locations: [],
  gradeRules: {},
  requiredSkills: {},
  skills: [],
};

// Maps the backend subscription DTO onto the UI's Subscription shape.
function toLocalSubscription(s: SubscriptionDto): Subscription {
  const validBillingCycles = ["monthly", "annual", ""] as const;
  const validGateways = [
    "stripe",
    "paypal",
    "flutterwave",
    "mpesa",
    "bank_transfer",
    "crypto",
    "",
  ] as const;
  const validStatuses = ["active", "trialing", "past_due", "cancelled", ""] as const;

  const billing_cycle = validBillingCycles.includes(
    s.billing_cycle as typeof validBillingCycles[number]
  )
    ? (s.billing_cycle as "monthly" | "annual" | "")
    : "";

  const payment_gateway = validGateways.includes(
    s.payment_gateway as typeof validGateways[number]
  )
    ? (s.payment_gateway as Subscription["payment_gateway"])
    : "";

  const status = validStatuses.includes(s.status as typeof validStatuses[number])
    ? (s.status as "active" | "trialing" | "past_due" | "cancelled" | "")
    : "";

  return {
    plan: s.plan,
    billing_cycle,
    payment_gateway,
    seats: s.seats,
    since: s.since,
    status,
    current_period_start: s.current_period_start,
    current_period_end: s.current_period_end,
    cancel_at_period_end: s.cancel_at_period_end,
  };
}

// The four dashboards are selected by an account's role. Guard against a bad
// value from the API so role-dependent lookups stay total.
function mapApiRole(r: string): UserRole {
  return r === "jobseeker" || r === "employer" || r === "admin" ? r : "student";
}

interface AppContextType {
  route: string;
  portal: Portal;
  catalogStatus: "loading" | "ready" | "error";
  applications: ApplicationDto[];
  resume: ResumeDto | null;
  recommendations: MatchResponse | null;
  dashboardDataStatus: "idle" | "loading" | "ready" | "error";
  pid: string | null;
  typeFilter: string;
  sectorFilter: string;
  courseFilter: string;
  searchQuery: string;
  opportunityFilter: string;
  planSeg: string;
  role: UserRole;
  dash: DashboardView;
  session: ApiUser | null;
  isAuthed: boolean;
  authReady: boolean;

  // Data
  orgs: Org[];
  placements: Placement[];
  meta: CatalogMeta;
  metaReady: boolean;
  student: Student;
  docs: DocItem[];
  adminQueue: AdminQueueItem[];
  activity: ActivityItem[];
  pack: ApplicationPack;
  organizationPlacements: Placement[];

  // UI state
  isMenuOpen: boolean;
  isSideDrawerOpen: boolean;
  toastMessage: string | null;
  modal: ModalConfig | null;
  isChatOpen: boolean;
  chatMessages: ChatMessage[];

  // Setters & Actions
  setTypeFilter: (t: string) => void;
  setSectorFilter: (s: string) => void;
  setCourseFilter: (c: string) => void;
  setSearchQuery: (q: string) => void;
  setOpportunityFilter: (o: string) => void;
  setPlanSeg: (s: string) => void;
  setStatement: (statement: string) => void;

  // Skills profile
  addSkill: (name: string, source?: string) => void;
  removeSkill: (name: string) => void;
  toggleSkill: (name: string) => void;
  setSkills: (skills: string[]) => void;
  setSkillConfidence: (name: string, level: number) => void;

  go: (route: string) => void;
  enterPortal: (portal: Portal) => void;
  openPlacement: (id: string) => void;
  setType: (t: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    name: string,
    role: UserRole,
    password: string
  ) => Promise<void>;
  signOut: () => void;
  openDashboardFor: (r: UserRole) => void;
  dashGo: (view: DashboardView) => void;

  openMenu: () => void;
  closeMenu: () => void;
  openSide: () => void;
  closeSide: () => void;
  toast: (msg: string) => void;
  openModal: (
    title: string,
    body: ReactNode,
    okLabel?: string | null,
    onOk?: (() => void) | null
  ) => void;
  closeModal: () => void;
  modalConfirm: () => void;

  openChat: () => void;
  closeChat: () => void;
  sendChat: (text: string) => void;
  askChat: (text: string) => void;

  // Domain Actions
  applyTo: (id: string) => void;
  reviewStudent: (name: string) => void;
  editRequirements: (id: string) => void;
  newPlacement: () => void;
  uploadDoc: (name: string) => void;
  uploadResumeFile: (file: File) => Promise<void>;
  uploadDocumentFile: (documentType: string, file: File) => Promise<void>;
  withdrawApplication: (applicationId: string) => Promise<void>;
  editPack: () => void;
  previewPack: () => void;
  showEmbed: () => void;
  planAction: (tier: string) => void;

  // Billing / placement fees
  subscription: Subscription;
  isPremium: boolean;
  freeAllowance: number;
  employerLiveCount: number;
  activatePlan: (
    plan: string,
    billing_cycle: "monthly" | "annual",
    payment_gateway: string,
    seats: number
  ) => void;
  cancelPlan: () => void;

  // Saved placements (bookmark, persisted to localStorage)
  saved: string[];
  toggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;

  // Helpers
  getOrg: (id: string) => Org | undefined;
  getPlacement: (id: string) => Placement | undefined;
  isEligible: (p: Placement) => boolean;
  gradeRank: (g: string) => number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<string>("home");
  const [portal, setPortal] = useState<Portal>("internships");
  const [pid, setPid] = useState<string | null>("p1");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [sectorFilter, setSectorFilter] = useState<string>("All");
  const [courseFilter, setCourseFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [opportunityFilter, setOpportunityFilter] = useState<string>("All");
  const [planSeg, setPlanSeg] = useState<string>("companies");
  const [role, setRole] = useState<UserRole>("student");
  const [dash, setDash] = useState<DashboardView>("overview");
  // The signed-in account (id/email/name/role). Null until /auth/me or a login
  // resolves. It is the single source of identity for the whole app now.
  const [session, setSession] = useState<ApiUser | null>(null);
  // True once the initial /auth/me check has finished, so we never flash a
  // "not signed in" redirect while the stored session is still being restored.
  const [authReady, setAuthReady] = useState<boolean>(false);

  // Catalogue comes only from the API now — no bundled seed fallback — so it
  // starts empty and fills from GET /placements on mount.
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<
    "loading" | "ready" | "error"
  >(isApiEnabled ? "loading" : "error");
  const [applications, setApplications] = useState<ApplicationDto[]>([]);
  const [resume, setResume] = useState<ResumeDto | null>(null);
  const [recommendations, setRecommendations] = useState<MatchResponse | null>(null);
  const [dashboardDataStatus, setDashboardDataStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  // Catalogue metadata (courses/types/locations for filters, grade thresholds,
  // skill taxonomy, per-placement requirements) — served by GET
  // /placements/meta. Starts empty for the same reason as the catalog.
  const [meta, setMeta] = useState<CatalogMeta>(EMPTY_META);
  const [metaReady, setMetaReady] = useState<boolean>(false);
  const [student, setStudent] = useState<Student>({
    name: "",
    course: "",
    year: "",
    cgpa: 0,
    uni: "",
    skills: [],
    talent_search_opt_in: false,
    skillsConfidence: {},
    skillsSource: {},
  });
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [adminQueue, setAdminQueue] = useState<AdminQueueItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pack, setPack] = useState<ApplicationPack>(INITIAL_PACK);
  const [organizationPlacements, setOrganizationPlacements] = useState<Placement[]>([]);

  // Billing. Free host organisations publish up to FREE_ALLOWANCE placements,
  // then a placement fee unlocks unlimited posting. Persisted so refreshing
  // keeps the plan; in Phase 2 the FastAPI backend owns this record.
  const [subscription, setSubscription] = useState<Subscription>({
    plan: "Free",
    billing_cycle: "",
    payment_gateway: "",
    seats: 1,
    since: "",
    status: "",
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
  });

  // Bookmarked placements. Persisted so the shortlist survives reloads and is
  // shared across the public index, the card button and the dashboard.
  const [saved, setSaved] = useState<string[]>([]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalConfig | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      who: "INTERN",
      text: "I can check whether you qualify for a placement, list the documents you still need, or explain how verification works. You are signed in as a Design student with a 3.7 CGPA.",
    },
  ]);

  const getOrg = useCallback(
    (id: string) => orgs.find((o) => o.id === id),
    [orgs]
  );

  const getPlacement = useCallback(
    (id: string) => placements.find((p) => p.id === id),
    [placements]
  );

  const gradeRank = useCallback(
    (g: string) => meta.gradeRules[g] || 0,
    [meta]
  );

  const isEligible = useCallback(
    (p: Placement) => {
      return (
        p.courses.includes(student.course) &&
        student.cgpa >= (meta.gradeRules[p.grade] || 0)
      );
    },
    [student, meta]
  );

  const toast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  }, []);

  const uploadResumeFile = useCallback(
    async (file: File) => {
      if (!isApiEnabled || !session || role !== "student") {
        toast("Sign in as a student to upload a resume.");
        return;
      }
      try {
        const saved = await uploadResume(file);
        setResume(saved);
        toast("Resume uploaded and saved.");
      } catch (error) {
        toast(error instanceof Error ? error.message : "Resume upload failed.");
        throw error;
      }
    },
    [role, session, toast]
  );

  const uploadDocumentFile = useCallback(
    async (documentType: string, file: File) => {
      try {
        const saved = await uploadStudentDocument(documentType, file);
        setDocs((current) => [
          ...current.filter((doc) => doc.name !== documentType),
          {
            name: documentType,
            status: saved.status,
            file: saved.filename,
            size: `${Math.ceil(saved.size_bytes / 1024)} KB`,
          },
        ]);
        toast(`${documentType} uploaded and pending verification.`);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Document upload failed.");
        throw error;
      }
    },
    [toast]
  );

  const withdrawApplication = useCallback(
    async (applicationId: string) => {
      try {
        const updated = await withdrawApplicationApi(applicationId);
        setApplications((current) =>
          current.map((application) =>
            application.id === updated.id ? updated : application
          )
        );
        toast("Application withdrawn.");
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Application withdrawal failed."
        );
        throw error;
      }
    },
    [toast]
  );

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    document.body.style.overflow = "";
  }, []);

  const openSide = useCallback(() => {
    setIsSideDrawerOpen(true);
  }, []);

  const closeSide = useCallback(() => {
    setIsSideDrawerOpen(false);
  }, []);

  const openModal = useCallback(
    (
      title: string,
      body: ReactNode,
      okLabel: string | null = "Save",
      onOk: (() => void) | null = null
    ) => {
      setModal({ title, body, okLabel, onOk });
    },
    []
  );

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  const modalConfirm = useCallback(() => {
    if (modal?.onOk) {
      modal.onOk();
    }
    setModal(null);
  }, [modal]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    document.body.style.overflow = "";
  }, []);

  // Sync hash routing
  const navigateByHash = useCallback((hashStr: string) => {
    const raw = hashStr.replace("#", "");
    if (!raw) {
      setRoute("home");
      return;
    }
    if (raw.startsWith("placement-")) {
      const id = raw.split("-")[1];
      setPid(id);
      setRoute("placement");
      setPortal("internships");
    } else if (raw === "internships" || raw.startsWith("internships-")) {
      setPortal("internships");
      setRoute(raw === "internships" ? "internships" : raw.slice("internships-".length));
    } else if (raw === "jobs" || raw.startsWith("jobs-")) {
      setPortal("jobs");
      setRoute(raw === "jobs" ? "jobs" : raw.slice("jobs-".length));
    } else if (raw.startsWith("dashboard")) {
      const parts = raw.split("-");
      const r = (parts[1] as UserRole) || "student";
      const d = (parts[2] as DashboardView) || "overview";
      setRole(r);
      setDash(d);
      setPortal(r === "jobseeker" ? "jobs" : "internships");
      setRoute("dashboard");
    } else if (raw === "ask") {
      setRoute("home");
      setTimeout(() => setIsChatOpen(true), 300);
    } else if (raw === "top") {
      // In-page fragment used by the footer "Back to top" link. It is not a
      // route: without this guard an unknown hash falls through to the
      // public-site switch and silently sends the visitor to Home.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setRoute(raw);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      navigateByHash(window.location.hash);
    };

    if (typeof window !== "undefined") {
      if (window.location.hash) {
        navigateByHash(window.location.hash);
      }
      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }
  }, [navigateByHash]);

  // Catalog read: the placements and organisations come from the database via
  // GET /placements. There is no seed fallback, so the catalogue is only ever
  // what the backend reports (empty when the API isn't configured/reachable).
  useEffect(() => {
    if (!isApiEnabled) {
      setCatalogStatus("error");
      return;
    }
    let cancelled = false;
    fetchCatalog(opportunityFilter === "All" ? undefined : opportunityFilter)
      .then(({ placements: fromApi, orgs: apiOrgs }) => {
        if (cancelled) return;
        setPlacements(fromApi);
        setOrgs(apiOrgs);
        setCatalogStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setCatalogStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [opportunityFilter]);

  // Catalogue metadata read: GET /placements/meta. The filter values and the
  // matching tables (grade thresholds, skill taxonomy, per-placement required
  // skills) are the ones the backend domain owns; feeding them to setSkillTables
  // keeps the local scorer at parity with the server without any bundled copy.
  useEffect(() => {
    if (!isApiEnabled) {
      setMetaReady(true);
      return;
    }
    let cancelled = false;
    fetchCatalogMeta()
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setSkillTables(m);
      })
      .catch(() => {
        /* backend unreachable — filters and scoring degrade to empty tables */
      })
      .finally(() => {
        if (!cancelled) setMetaReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the session once from a stored token. /auth/me is the anchor: it
  // both validates the token and returns the account whose role drives which
  // dashboard the user sees.
  useEffect(() => {
    if (!isApiEnabled) {
      setAuthReady(true);
      return;
    }
    fetchMe()
      .then((user) => {
        if (user) {
          setSession(user);
          setRole(mapApiRole(user.role));
        }
      })
      .finally(() => setAuthReady(true));
  }, []);

  // The dashboard now requires a real, signed-in account: if the session has
  // resolved to nothing and a dashboard is opened (deep link included), route to
  // the sign-in screen instead of showing an identity-less dashboard.
  useEffect(() => {
    if (
      isApiEnabled &&
      authReady &&
      !session &&
      route === "dashboard" &&
      typeof window !== "undefined"
    ) {
      window.location.hash = "#signin";
      setRoute("signin");
    }
  }, [isApiEnabled, authReady, session, route]);

  useEffect(() => {
    if (
      !isApiEnabled ||
      !authReady ||
      !session ||
      route !== "dashboard" ||
      typeof window === "undefined"
    ) {
      return;
    }
    const requestedRole = window.location.hash.split("-")[1];
    const accountRole = mapApiRole(session.role);
    if (requestedRole && requestedRole !== accountRole) {
      setRole(accountRole);
      setDash("overview");
      window.location.hash = `#dashboard-${accountRole}-overview`;
    }
  }, [authReady, route, session]);

  const go = useCallback(
    (newRoute: string) => {
      closeMenu();
      setRoute(newRoute);
      if (newRoute === "internships" || newRoute === "placements" || newRoute === "placement") {
        setPortal("internships");
      } else if (newRoute === "jobs") {
        setPortal("jobs");
      }
      if (typeof window !== "undefined") {
        if (newRoute === "dashboard") {
          window.location.hash = `#dashboard-${role}-${dash}`;
        } else if (newRoute === "placement" && pid) {
          window.location.hash = `#placement-${pid}`;
        } else {
          window.location.hash = `#${newRoute}`;
        }
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [closeMenu, role, dash, pid]
  );

  const enterPortal = useCallback((nextPortal: Portal) => {
    setPortal(nextPortal);
    setRoute(nextPortal);
    if (typeof window !== "undefined") {
      window.location.hash = `#${nextPortal}`;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  const openPlacement = useCallback(
    (id: string) => {
      setPid(id);
      setRoute("placement");
      if (typeof window !== "undefined") {
        window.location.hash = `#placement-${id}`;
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    []
  );

  const setType = useCallback(
    (t: string) => {
      setTypeFilter(t);
      setRoute("placements");
      if (typeof window !== "undefined") {
        window.location.hash = "#placements";
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    []
  );

  const openDashboardFor = useCallback((r: UserRole) => {
    setDash("overview");
    setRoute("dashboard");
    setPortal(r === "jobseeker" ? "jobs" : "internships");
    if (typeof window !== "undefined") {
      window.location.hash = `#dashboard-${r}-overview`;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  // Real login: authenticate against the backend, persist the Bearer token, and
  // let the account's own role drive which dashboard opens. Throws on failure
  // so the sign-in screen can surface the backend's error message.
  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isApiEnabled) throw new Error("Sign-in needs the backend API.");
      const user = await loginApi(email, password);
      const r = mapApiRole(user.role);
      setSession(user);
      setRole(r);
      if (r === "student") setStudent((prev) => ({ ...prev, name: user.name }));
      openDashboardFor(r);
    },
    [openDashboardFor]
  );

  const signUp = useCallback(
    async (
      email: string,
      name: string,
      userRole: UserRole,
      password: string
    ) => {
      if (!isApiEnabled) throw new Error("Sign-up needs the backend API.");
      const user = await registerApi(email, name, userRole, password);
      const r = mapApiRole(user.role);
      setSession(user);
      setRole(r);
      if (r === "student") setStudent((prev) => ({ ...prev, name: user.name }));
      openDashboardFor(r);
    },
    [openDashboardFor]
  );

  const signOut = useCallback(() => {
    setToken(null);
    setSession(null);
    setSaved([]);
    go("home");
  }, [go]);

  const dashGo = useCallback(
    (view: DashboardView) => {
      setDash(view);
      setIsSideDrawerOpen(false);
      setRoute("dashboard");
      if (typeof window !== "undefined") {
        window.location.hash = `#dashboard-${role}-${view}`;
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [role]
  );

  // Chat assistant logic
  const answerChat = useCallback(
    (query: string): string => {
      const q = query.toLowerCase();
      const currentRole = role;

      // Role-specific responses
      if (currentRole === "employer") {
        if (q.includes("applicant") || q.includes("candidate")) {
          return `Use the Applicants tab to review candidates for your placements. You can filter by placement, see match scores, and shortlist candidates.`;
        }
        if (q.includes("post") || q.includes("create") || q.includes("new internship")) {
          return `Go to the Placements tab and click "New internship" to create a posting. You'll specify courses, grade, documents, dates, and duties.`;
        }
        if (q.includes("dashboard") || q.includes("overview")) {
          return `Your employer dashboard shows live placements, applicant counts, shortlisted candidates, and your plan usage.`;
        }
      }

      if (currentRole === "admin") {
        if (q.includes("queue") || q.includes("review") || q.includes("pending")) {
          return `The Admin dashboard has a Review Queue showing students awaiting document verification. Use the Documents tab to verify or reject uploaded files.`;
        }
        if (q.includes("metric") || q.includes("stat") || q.includes("report")) {
          return `Admin Overview shows open placements, pending documents, students placed, and placement record completion rate.`;
        }
        if (q.includes("user") || q.includes("student") || q.includes("organisation")) {
          return `Use the Students and Organisations tabs to manage platform users and host organisations.`;
        }
      }

      if (currentRole === "jobseeker") {
        if (q.includes("job") || q.includes("role") || q.includes("application")) {
          return `Your Applications tab shows all job applications with their status. Browse Roles to find new opportunities.`;
        }
        if (q.includes("profile") || q.includes("cv") || q.includes("resume")) {
          return `Your profile and CV are used to match you with roles. Keep your skills and experience updated.`;
        }
      }

      // Skills-driven career guidance for students (default)
      // ... rest of the existing logic
      const ranked = placements
        .map((p) => ({
          p,
          m: matchPlacement(
            p,
            student.skills,
            student.course,
            student.cgpa,
            student.skillsConfidence
          ),
        }))
        .sort((a, b) => b.m.score - a.m.score);

      // Which missing skill unlocks the most placements the student could
      // realistically land (course + grade already fit).
      const skillImpact = (): { skill: string; count: number }[] => {
        const have = new Set(student.skills);
        const tally = new Map<string, number>();
        for (const { p, m } of ranked) {
          if (!m.courseFit || !m.gradeFit) continue;
          for (const miss of m.missing) {
            if (have.has(miss)) continue;
            tally.set(miss, (tally.get(miss) || 0) + 1);
          }
        }
        return [...tally.entries()]
          .map(([skill, count]) => ({ skill, count }))
          .sort((a, b) => b.count - a.count);
      };

      if (
        q.includes("learn") ||
        q.includes("skill") ||
        q.includes("improve") ||
        q.includes("gap") ||
        q.includes("boost") ||
        q.includes("stronger") ||
        q.includes("increase")
      ) {
        const impact = skillImpact();
        if (!impact.length) {
          const top = ranked[0];
          return `You already cover all required skills for your best fit${top ? ` (${top.p.title}, ${top.m.score}% match)` : ""}. To widen options, add adjacent skills on your Skills profile — pick a placement you can't reach yet and learn its missing skills.`;
        }
        const lead = impact.slice(0, 2);
        return `Fastest wins for your profile (${student.skills.length} skills, ${student.course}, CGPA ${student.cgpa}): ${lead
          .map(
            (i) =>
              `**${i.skill}** (unlocks ${i.count} placement${i.count > 1 ? "s" : ""} you already clear on course/grade)`
          )
          .join("; ")}. Add **${lead[0].skill}** to your Skills profile and watch match scores jump. Paste a project/CV line into the extractor if you've used it before — it'll claim the skill for you.`;
      }

      if (
        q.includes("best") ||
        q.includes("recommend") ||
        q.includes("where do i fit") ||
        q.includes("most match") ||
        q.includes("top match") ||
        q.includes("should i apply") ||
        q.includes("fits me") ||
        q.includes("good for me") ||
        q.includes("which placement")
      ) {
        const top = ranked[0];
        if (!top)
          return `Ask about a specific role and I'll score it against your skills, course and grade.`;
        const org = getOrg(top.p.orgId);
        const near = ranked[1];
        const gapText = top.m.missing.length
          ? ` Missing: ${top.m.missing.join(", ")}.`
          : ` You match every required skill.`;
        return `**Top fit:** ${top.p.title} at ${org?.name || "host org"} — ${top.m.score}% match, closes ${top.p.deadline}.${gapText}${near ? ` Next: ${near.p.title} (${near.m.score}%).` : ""} Open Placements for full ranking or Skills to close the gap.`;
      }

      if (
        q.includes("match") ||
        q.includes("score") ||
        q.includes("how are you ranking") ||
        q.includes("how do you calculate")
      ) {
        return `Match = 60% skill coverage + 25% course fit + 15% CGPA. Fully explainable — every row lists required skills and which you bring. Same score powers the server-side advisor.`;
      }

      if (
        q.includes("eligible") ||
        q.includes("qualify") ||
        q.includes("can i apply")
      ) {
        const found =
          placements.find((x) =>
            q.includes(x.title.toLowerCase().split(" ")[0].toLowerCase())
          ) ||
          (pid ? getPlacement(pid) : null) ||
          placements[1] ||
          placements[0];

        const targetP = found;
        if (!targetP)
          return `Catalog not loaded yet. Open Placements and ask again once the live list appears.`;
        const ok = isEligible(targetP);
        const courseOk = targetP.courses.includes(student.course);
        const targetOrg = getOrg(targetP.orgId);
        const orgName = targetOrg ? targetOrg.name : "the organisation";

        return ok
          ? `**Yes** — ${targetP.title} at ${orgName}. Your course (${student.course}) is listed and CGPA ${student.cgpa} clears ${targetP.grade}. You need ${targetP.docs.filter((d) => {
              const h = docs.find((x) => x.name === d);
              return !h || h.status === "missing";
            }).length} document(s) uploaded before the office forwards your file. Deadline: ${targetP.deadline}.`
          : `**Not on paper.** ${targetP.title} requires ${targetP.grade} and courses ${targetP.courses.join(", ")}. Your record: ${student.course} at ${student.cgpa}${courseOk ? "" : " — course not on their list"}. University can request an exception via the placement office.`;
      }

      if (
        q.includes("document") ||
        q.includes("upload") ||
        q.includes("need")
      ) {
        const missing = docs
          .filter((d) => d.status === "missing")
          .map((d) => d.name);
        return `Three states: **verified**, **pending**, **missing**. You have ${docs.filter((d) => d.status === "verified").length} verified, ${missing.length} missing${missing.length ? ` (${missing.join(", ")})` : ""}. Upload from Documents (PDF/JPG, ≤10 MB). Office reviews in ~48 hrs; rejections keep reasons so you can replace without restarting.`;
      }

      if (
        q.includes("government") ||
        q.includes("ministry") ||
        q.includes("agency")
      ) {
        const gov = placements.filter(
          (p) => getOrg(p.orgId)?.type === "Government"
        );
        const orgNames = Array.from(
          new Set(gov.map((p) => getOrg(p.orgId)?.name || ""))
        )
          .filter(Boolean)
          .slice(0, 3)
          .join(", ");
        return `${gov.length} government placements live (e.g., ${orgNames}). Same requirements as companies — courses, grade, documents, testimonial. Data Analyst Intern closes soonest (28 Feb).`;
      }

      if (
        q.includes("verification") ||
        q.includes("verify") ||
        q.includes("transcript")
      ) {
        return `Transcript & student ID verified by placement office, not employer. Officer checks against university record → marks verified or returns with reason. Median: 48 hrs. Employers only see verified files.`;
      }

      if (
        q.includes("deadline") ||
        q.includes("closing") ||
        q.includes("close")
      ) {
        const soon = placements
          .slice()
          .sort(
            (a, b) =>
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          )
          .slice(0, 3);
        return `Next deadlines: ${soon.map((p) => `${p.title} (${p.deadline})`).join(", ")}. Atlas Health closes first. Ask me to check eligibility for any before you apply.`;
      }

      if (
        q.includes("cost") ||
        q.includes("pay") ||
        q.includes("free") ||
        q.includes("price")
      ) {
        return `Applying is free and always will be. Universities and host organisations fund the service. No premium tier for students, no fee to unlock a placement.`;
      }

      if (
        q.includes("contact") ||
        q.includes("office") ||
        q.includes("phone") ||
        q.includes("email")
      ) {
        return `Office: Plot 9, Nkrumah Road, Kampala — Mon–Fri 08:30–17:00 EAT, 1-day reply. Nairobi & Berlin offices on Contact page.`;
      }

      if (
        q.includes("what is intern") ||
        q.includes("about") ||
        q.includes("how does it work")
      ) {
        return `BrighterWorks = separate internship & jobs portals. Universities publish placements from companies, gov agencies, NGOs with eligible courses, min grade, docs, testimonial rule. Students see eligibility before applying; office verifies docs; employers get qualified files only.`;
      }

      if (
        q.includes("who are you") ||
        q.includes("what are you") ||
        q.includes("identity")
      ) {
        return `I'm your career advisor. I use your actual profile (skills, course, CGPA) to rank placements, suggest skills to learn, check eligibility, list missing documents, and show deadlines. Ask "what should I learn" or "which placement fits me" and I'll use your real data.`;
      }

      return `I rank placements against your skills, suggest the single skill that unlocks the most roles, check eligibility for any placement, list missing documents, and show upcoming deadlines. Ask about a role or say "what should I learn".`;
    },
    [placements, pid, getPlacement, isEligible, student, getOrg, docs, role]
  );

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMsgId = Date.now().toString();
      const typingMsgId = (Date.now() + 1).toString();

      setChatMessages((prev) => [
        ...prev,
        { id: userMsgId, who: "me", text: trimmed },
        { id: typingMsgId, who: "INTERN", text: "···", isTyping: true },
      ]);

      const finalize = (response: AdvisorResponse) =>
        setChatMessages((prev) =>
          prev
            .filter((m) => m.id !== typingMsgId)
            .concat({
              id: Date.now().toString(),
              who: "INTERN",
              text: response.reply,
              actions: response.actions,
            })
        );

      // Prepare history for the advisor (last 6 non-typing messages)
      const history = chatMessages
        .filter((m) => !m.isTyping)
        .slice(-6)
        .map((m) => ({ id: m.id, who: m.who, text: m.text }));

      // Prefer the Groq advisor (grounded by the server-side matcher). If the
      // API is off/unreachable or Groq isn't configured (503), fall back to the
      // built-in deterministic assistant so the chat always answers.
      if (isApiEnabled) {
        askAdvisor(trimmed, student.skills, student.course, student.cgpa, role, history)
          .then(finalize)
          .catch(() => finalize({ reply: answerChat(trimmed), actions: [] }));
        return;
      }

      setTimeout(() => finalize({ reply: answerChat(trimmed), actions: [] }), 650);
    },
    [answerChat, student, role, chatMessages]
  );

  const askChat = useCallback(
    (text: string) => {
      sendChat(text);
    },
    [sendChat]
  );

  // Domain Actions
  const applyTo = useCallback(
    (id: string) => {
      const p = getPlacement(id);
      if (!p) return;
      const o = getOrg(p.orgId);
      const orgName = o ? o.name : "the organisation";

      openModal(
        `Apply — ${p.title}`,
        <ApplicationForm
          placementId={id}
          onClose={() => closeModal()}
          onSubmit={async (input) => {
            if (!isApiEnabled) {
              toast(`Application sent to ${orgName}`);
              return;
            }
            if (!session) {
              toast("Please sign in to apply.");
              go("signin");
              return;
            }
            await applyToPlacement(id, input)
              .then(() => {
                toast(`Application sent to ${orgName}`);
                closeModal();
              })
              .catch(() => toast("Couldn't submit right now — please try again"));
          }}
        />,
        null,
        null
      );
    },
    [getPlacement, getOrg, openModal, closeModal, toast, session, go, isApiEnabled]
  );

  const reviewStudent = useCallback(
    (name: string) => {
      openModal(
        `Student record — ${name}`,
        <div style={{ display: "grid", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12.5px",
            }}
          >
            <span style={{ color: "var(--muted)" }}>Course</span>
            <b>Design · Year 3</b>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12.5px",
            }}
          >
            <span style={{ color: "var(--muted)" }}>CGPA</span>
            <b>3.7</b>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12.5px",
            }}
          >
            <span style={{ color: "var(--muted)" }}>Placement</span>
            <b>Product Design Intern</b>
          </div>
          <div
            style={{
              border: "1px solid var(--rule)",
              padding: "10px",
              marginTop: "6px",
            }}
          >
            {[
              "Transcript — verified",
              "Student ID — verified",
              "Portfolio — pending review",
            ].map((t) => (
              <div
                key={t}
                style={{ fontSize: "11.5px", padding: "4px 0" }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>,
        "Approve record",
        () => {
          setAdminQueue((prev) =>
            prev.map((item) =>
              item.n === name ? { ...item, st: "Ready", d: "3 of 3" } : item
            )
          );
          toast(`${name} approved for placement`);
        }
      );
    },
    [openModal, toast]
  );

  const editRequirements = useCallback(
    (id: string) => {
      const p = getPlacement(id);
      if (!p) return;

      openModal(
        `Requirements — ${p.title}`,
        <div className="form">
          <div className="field">
            <label>Eligible courses</label>
            <div className="checks">
              {meta.courses.map((c) => (
                <label key={c}>
                  <input type="checkbox" defaultChecked={p.courses.includes(c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Minimum grade</label>
              <select defaultValue={p.grade}>
                {Object.keys(meta.gradeRules).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Testimonial required</label>
              <select
                defaultValue={p.testimonial ? "Required" : "Not required"}
              >
                <option value="Required">Required</option>
                <option value="Not required">Not required</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Required documents</label>
            <div className="checks">
              {[
                "Transcript",
                "Student ID",
                "National ID",
                "Recommendation letter",
                "Portfolio",
                "CV",
                "Writing sample",
                "Testimonial",
              ].map((d) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    defaultChecked={p.docs.includes(d)}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
        </div>,
        "Save requirements",
        () => {
          toast(`Requirements updated · ${p.title}`);
        }
      );
    },
    [getPlacement, openModal, toast]
  );

  // Billing actions and derived state. Declared before the domain actions so
  // newPlacement's placement-fee gate can read them.
  const isPremium = subscription.plan !== "Free";
  const employerLiveCount = placements.filter(
    (p) => p.orgId === session?.org_id
  ).length;

  const validGateways = [
    "stripe",
    "paypal",
    "flutterwave",
    "mpesa",
    "bank_transfer",
    "crypto",
    "",
  ] as const;

  const activatePlan = useCallback(
    (plan: string, billing_cycle: "monthly" | "annual", payment_gateway: string, seats: number) => {
      const now = new Date().toISOString();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const gateway = validGateways.includes(
        payment_gateway as typeof validGateways[number]
      )
        ? (payment_gateway as Subscription["payment_gateway"])
        : "";
      const optimistic: Subscription = {
        plan,
        billing_cycle,
        payment_gateway: gateway,
        seats: Math.max(1, seats),
        since: now.slice(0, 10),
        status: "active",
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      };
      setSubscription(optimistic);
      toast(`${plan} plan active (${billing_cycle}) · placement fee applied`);
      if (!isApiEnabled) return;
      createSubscriptionApi(plan, billing_cycle, payment_gateway)
        .then((s) => setSubscription(toLocalSubscription(s)))
        .catch(() => {
          /* server unreachable — keep the optimistic plan for this session */
        });
    },
    [toast]
  );

  const cancelPlan = useCallback(() => {
    setSubscription({
      plan: "Free",
      billing_cycle: "",
      payment_gateway: "",
      seats: 1,
      since: "",
      status: "active",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
    });
    toast("Moved to Free · posting capped at 3 placements");
    if (!isApiEnabled) return;
    cancelSubscriptionApi()
      .then((s) => setSubscription(toLocalSubscription(s)))
      .catch(() => {
        /* server unreachable — keep the optimistic Free plan */
      });
  }, [toast]);

  // Hydrate the live plan once: from the API when configured, otherwise from
  // localStorage. When the API owns the record we don't mirror to storage.
  useEffect(() => {
    if (isApiEnabled) {
      // The org is derived from the Bearer token, so hydrate the plan only for a
      // signed-in employer. Other roles have no subscription record to load.
      if (!session || session.role !== "employer" || !session.org_id) return;
      fetchSubscription()
        .then((s) => setSubscription(toLocalSubscription(s)))
        .catch(() => {
          /* backend unreachable — fall back to any stored plan */
          try {
            const raw = window.localStorage.getItem(SUBSCRIPTION_KEY);
            if (raw) setSubscription(JSON.parse(raw) as Subscription);
          } catch {
            /* ignore */
          }
        });
      return;
    }
    try {
      const raw = window.localStorage.getItem(SUBSCRIPTION_KEY);
      if (raw) setSubscription(JSON.parse(raw) as Subscription);
    } catch {
      /* ignore malformed storage */
    }
  }, [session]);

  useEffect(() => {
    if (!isApiEnabled || !session || role !== "student") {
      setApplications([]);
      setRecommendations(null);
      setDashboardDataStatus("idle");
      return;
    }
    let cancelled = false;
    setDashboardDataStatus("loading");
    Promise.all([
      fetchApplications(),
      fetchStudentProfile(),
      fetchResume(),
      fetchStudentDocuments(),
      fetchApplicationPack(),
    ])
      .then(async ([apps, profile, currentResume, documents, apiPack]) => {
        const nextStudent: Student = {
          name: session.name,
          course: profile.course,
          year: profile.year,
          cgpa: profile.cgpa,
          uni: profile.university,
          skills: profile.skills,
          talent_search_opt_in: profile.talent_search_opt_in || false,
          skillsConfidence: profile.skills_confidence || {},
          skillsSource: profile.skills_source || {},
        };
        if (cancelled) return;
        setStudent(nextStudent);
        setResume(currentResume);
        setDocs(
          documents.map((document) => ({
            name: document.document_type,
            status: document.status,
            file: document.filename,
            size: `${Math.ceil(document.size_bytes / 1024)} KB`,
          }))
        );
        const matches = await fetchRecommendedInternships(
          nextStudent.skills,
          nextStudent.course,
          nextStudent.cgpa,
          6,
          undefined,
          nextStudent.skillsConfidence
        );
        if (cancelled) return;
        setApplications(apps);
        setPack({
          statement: apiPack.statement,
          targets: apiPack.targets,
        });
        setRecommendations(matches);
        setDashboardDataStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setDashboardDataStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [session, role]);

  // Admin dashboard data: load queue and activity when admin is signed in
  useEffect(() => {
    if (!isApiEnabled || !session || role !== "admin") {
      setAdminQueue([]);
      setActivity([]);
      return;
    }
    let cancelled = false;
    Promise.all([fetchAdminQueue(), fetchAdminActivity()])
      .then(([queueRes, activityRes]) => {
        if (cancelled) return;
        setAdminQueue(queueRes.items);
        setActivity(activityRes);
      })
      .catch(() => {
        if (!cancelled) {
          setAdminQueue([]);
          setActivity([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, role]);

  // Employer dashboard data: load organization placements when employer is signed in
  useEffect(() => {
    if (!isApiEnabled || !session || role !== "employer") {
      setOrganizationPlacements([]);
      return;
    }
    let cancelled = false;
    fetchOrganizationInternships()
      .then((items) => {
        if (cancelled) return;
        setOrganizationPlacements(items);
      })
      .catch(() => {
        if (!cancelled) setOrganizationPlacements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session, role]);

  useEffect(() => {
    if (
      !isApiEnabled ||
      !session ||
      role !== "student" ||
      dashboardDataStatus !== "ready"
    ) {
      return;
    }
    updateStudentProfile({
      course: student.course,
      year: student.year,
      cgpa: student.cgpa,
      university: student.uni,
      skills: student.skills,
      skills_confidence: student.skillsConfidence,
      skills_source: student.skillsSource,
    }).catch(() => {
      setDashboardDataStatus("error");
    });
  }, [
    dashboardDataStatus,
    isApiEnabled,
    role,
    session,
    student.course,
    student.cgpa,
    student.uni,
    student.skills,
    student.skillsConfidence,
    student.skillsSource,
    student.year,
  ]);

  useEffect(() => {
    if (isApiEnabled) return; // the database is the source of truth
    try {
      window.localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscription));
    } catch {
      /* storage may be unavailable (private mode) — plan still works in-session */
    }
  }, [subscription]);

  const toggleSave = useCallback(
    (id: string) => {
      if (!isApiEnabled) return;
      if (!session) {
        toast("Sign in to save placements.");
        go("signin");
        return;
      }
      // Optimistic flip, then reconcile with the server's authoritative list.
      setSaved((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      toggleSavedApi(id)
        .then(({ savedIds }) => setSaved(savedIds))
        .catch(() => {
          /* server unreachable — keep the optimistic local change */
        });
    },
    [session, toast, go]
  );

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  // The shortlist is per-account and comes only from the API. It re-hydrates
  // whenever the signed-in account changes (login, logout, switch).
  useEffect(() => {
    if (!isApiEnabled) return;
    if (!session) {
      setSaved([]);
      return;
    }
    fetchSaved()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [session]);

  const openNewPlacementForm = useCallback(() => {
    openModal(
      "New placement",
      <div className="form">
        <div className="row2">
          <div className="field">
            <label>Organisation type</label>
            <select id="npType" defaultValue="Company">
              <option>Company</option>
              <option>Government agency</option>
              <option>NGO</option>
              <option>University department</option>
            </select>
          </div>
          <div className="field">
            <label>Organisation</label>
            <select id="npOrg" defaultValue={session?.org_id || orgs[0]?.id || ""}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.type}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Placement title</label>
            <input id="npTitle" placeholder="Data Analyst Intern" />
          </div>
          <div className="field">
            <label>Location</label>
            <input id="npLoc" placeholder="Kampala" />
          </div>
        </div>
        <div className="row3">
          <div className="field">
            <label>Duration</label>
            <input id="npDuration" placeholder="6 months" />
          </div>
          <div className="field">
            <label>Stipend</label>
            <input id="npStipend" placeholder="UGX 1,200,000 / month" />
          </div>
          <div className="field">
            <label>Slots</label>
            <input id="npSlots" type="number" defaultValue={4} />
          </div>
        </div>
        <div className="field">
          <label>Eligible courses</label>
          <div className="checks" id="npCourses">
            {meta.courses.map((c) => (
              <label key={c}>
                <input type="checkbox" />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Minimum grade</label>
            <select id="npGrade">
              {Object.keys(meta.gradeRules).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Closing date</label>
            <input id="npDeadline" type="date" />
          </div>
        </div>
        <div className="field">
          <label>Required documents</label>
          <div className="checks" id="npDocs">
            {[
              "Transcript",
              "Student ID",
              "National ID",
              "Recommendation letter",
              "Portfolio",
              "CV",
              "Writing sample",
              "Testimonial",
            ].map((d) => (
              <label key={d}>
                <input type="checkbox" defaultChecked={d === "Transcript"} />
                {d}
              </label>
            ))}
          </div>
        </div>
      </div>,
      "Publish placement",
      () => {
        const val = (id: string) =>
          (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ||
          "";
        const checked = (containerId: string) => {
          const el = document.getElementById(containerId);
          if (!el) return [] as string[];
          return Array.from(
            el.querySelectorAll('input[type="checkbox"]:checked')
          ).map(
            (cb) =>
              (cb.closest("label")?.textContent || "").trim()
          );
        };

        const title = val("npTitle") || "Untitled placement";
        const orgId =
          (document.getElementById("npOrg") as HTMLSelectElement | null)?.value ||
          session?.org_id ||
          orgs[0]?.id ||
          "";
        const grade =
          (document.getElementById("npGrade") as HTMLSelectElement | null)
            ?.value || "B";

        const placement: Placement = {
          id: `p${Date.now()}`,
          title,
          orgId,
          courses: checked("npCourses"),
          grade,
          loc: val("npLoc") || "Kampala",
          mode: "On-site",
          duration: val("npDuration") || "6 months",
          stipend: val("npStipend") || "Unpaid",
          deadline: val("npDeadline") || "—",
          slots: Number(val("npSlots")) || 1,
          status: "Open",
          applicants: 0,
          docs: checked("npDocs"),
          testimonial: false,
          about: `Newly published ${title.toLowerCase()} listing.`,
          duties: [],
          reviewStatus: "approved",
          publishedAt: new Date().toISOString().slice(0, 10),
          closesAt: val("npDeadline") || "",
          startsAt: "",
          requirements: [],
          reviewReason: "",
          opportunityType: "internship",
          durationHours: null,
          budgetRange: null,
          milestones: null,
          remoteOk: null,
          salaryRange: null,
          probationPeriod: null,
          trainingIncluded: null,
          careerPath: null,
          skillsRequired: null,
        };

        setPlacements((prev) => [placement, ...prev]);
        toast(`${title} published · visible to eligible students`);
      }
    );
  }, [openModal, orgs, session, toast]);

  const newPlacement = useCallback(() => {
    // Placement fee gate: free hosts publish up to FREE_ALLOWANCE, then pay.
    if (!isPremium && employerLiveCount >= FREE_ALLOWANCE) {
      openModal(
        `Placement fee · ${FREE_ALLOWANCE} free listings used`,
        <div className="form">
          <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.6 }}>
            Your organisation has published its {FREE_ALLOWANCE} free placements.
            Additional listings require a placement fee. Students never pay —
            employers fund verification, search and reporting.
          </p>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.6 }}>
            Current plan: <b>{subscription.plan}</b>. Activating a plan unlocks
            unlimited postings and is billed per seat.
          </div>
        </div>,
        "Unlock unlimited postings",
        () => {
          activatePlan("Pro", "monthly", "stripe", 3);
          openNewPlacementForm();
        }
      );
      return;
    }
    openNewPlacementForm();
  }, [
    isPremium,
    employerLiveCount,
    subscription.plan,
    openModal,
    activatePlan,
    openNewPlacementForm,
  ]);


  const uploadDoc = useCallback(
    (name: string) => {
      setDocs((prev) => {
        const target = prev.find((x) => x.name === name) || prev[3];
        return prev.map((d) =>
          d === target
            ? {
                ...d,
                status: "pending",
                file: "recommendation-letter.pdf",
                size: "640 KB",
              }
            : d
        );
      });
      toast(`${name} uploaded · pending verification`);
    },
    [toast]
  );

  const setStatement = useCallback((statement: string) => {
    setPack((prev) => ({ ...prev, statement }));
  }, []);

  // Skills profile. Mutated on the student record so it persists across
  // dashboard views; the profile PUT effect above syncs it to the backend.
  const setSkills = useCallback((skills: string[]) => {
    setStudent((prev) => {
      const owned = new Set(skills);
      const keep = (record: Record<string, string | number>) =>
        Object.fromEntries(
          Object.entries(record).filter(([name]) => owned.has(name))
        );
      return {
        ...prev,
        skills,
        skillsConfidence: keep(prev.skillsConfidence) as Record<string, number>,
        skillsSource: keep(prev.skillsSource) as Record<string, string>,
      };
    });
  }, []);

  const addSkill = useCallback((name: string, source = "manual") => {
    setStudent((prev) =>
      prev.skills.includes(name)
        ? prev
        : {
            ...prev,
            skills: [...prev.skills, name],
            skillsSource: { ...prev.skillsSource, [name]: source },
          }
    );
  }, []);

  const removeSkill = useCallback((name: string) => {
    setStudent((prev) => {
      const skillsConfidence = { ...prev.skillsConfidence };
      const skillsSource = { ...prev.skillsSource };
      delete skillsConfidence[name];
      delete skillsSource[name];
      return {
        ...prev,
        skills: prev.skills.filter((s) => s !== name),
        skillsConfidence,
        skillsSource,
      };
    });
  }, []);

  const toggleSkill = useCallback((name: string) => {
    setStudent((prev) => {
      if (!prev.skills.includes(name)) {
        return {
          ...prev,
          skills: [...prev.skills, name],
          skillsSource: { ...prev.skillsSource, [name]: "manual" },
        };
      }
      const skillsConfidence = { ...prev.skillsConfidence };
      const skillsSource = { ...prev.skillsSource };
      delete skillsConfidence[name];
      delete skillsSource[name];
      return {
        ...prev,
        skills: prev.skills.filter((s) => s !== name),
        skillsConfidence,
        skillsSource,
      };
    });
  }, []);

  const setSkillConfidence = useCallback((name: string, level: number) => {
    setStudent((prev) => {
      if (!prev.skills.includes(name)) return prev;
      return {
        ...prev,
        skillsConfidence: { ...prev.skillsConfidence, [name]: level },
      };
    });
  }, []);

  const editPack = useCallback(() => {
    let currentVal = pack.statement;
    openModal(
      "Edit your statement",
      <div className="form">
        <div className="field">
          <label>Statement (max 600 characters)</label>
          <textarea
            id="packText"
            style={{ height: "140px" }}
            defaultValue={pack.statement}
            onChange={(e) => {
              currentVal = e.target.value;
            }}
          />
        </div>
        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
          Used for every application. The placement title and closing date are
          appended automatically.
        </div>
      </div>,
      "Save statement",
      () => {
        updateApplicationPack({ ...pack, statement: currentVal })
          .then((saved) => {
            setPack({ statement: saved.statement, targets: saved.targets });
            toast("Statement saved · pack updated");
          })
          .catch((error) => {
            toast(error instanceof Error ? error.message : "Pack update failed.");
          });
      }
    );
  }, [pack, openModal, toast]);

  const previewPack = useCallback(() => {
    const attached = docs.filter((d) => d.status !== "missing");
    const averageMatch = recommendations?.items.length
      ? Math.round(
          recommendations.items.reduce((sum, item) => sum + item.match.score, 0) /
            recommendations.items.length
        )
      : null;
    openModal(
      "What the employer receives",
      <div style={{ border: "1px solid var(--rule)", padding: "16px", background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <b style={{ fontSize: "14px" }}>{student.name}</b>
            <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
              {student.course || "Student"} · {student.uni || "University"} · {student.year || "Year not set"}
            </div>
          </div>
          <span className="tg green">
            {averageMatch === null ? "Match pending" : `${averageMatch}% match`}
          </span>
        </div>
        <p style={{ fontSize: "12.5px", lineHeight: 1.65, marginTop: "12px" }}>
          {pack.statement}
        </p>
        <div style={{ borderTop: "1px solid var(--rule)", marginTop: "12px", paddingTop: "10px" }}>
          {attached.map((d) => (
            <div key={d.name} style={{ fontSize: "11px", padding: "3px 0" }}>
              ✓ {d.name} — {d.status}
            </div>
          ))}
        </div>
        <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "10px" }}>
          Sent from BrighterWorks · placement reference appended automatically
        </div>
      </div>,
      null
    );
  }, [docs, pack.statement, openModal, recommendations, resume, student]);

  const showEmbed = useCallback(() => {
    openModal(
      "Career page embed",
      <div>
        <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.65, marginBottom: "12px" }}>
          Paste this where your careers page should show live BrighterWorks placements. It updates whenever you publish or close a placement.
        </p>
        <div className="embedpre">
          &lt;div id=&quot;intern-placements&quot;
          <br />
          &nbsp;&nbsp;data-org=<b>&quot;lumen-labs&quot;</b>
          <br />
          &nbsp;&nbsp;data-theme=<b>&quot;light&quot;</b>
          <br />
          &nbsp;&nbsp;data-limit=<b>&quot;6&quot;</b>&gt;&lt;/div&gt;
          <br />
          &lt;script src=<b>&quot;https://embed.intern.africa/v1.js&quot;</b>&gt;&lt;/script&gt;
          <button
            type="button"
            className="copybtn"
            onClick={() => toast("Snippet copied")}
          >
            Copy
          </button>
        </div>
        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "10px" }}>
          Included in Premium and Enterprise. The free widget carries BrighterWorks branding and caps at 10 roles.
        </div>
      </div>,
      "Done"
    );
  }, [openModal, toast]);

  const planAction = useCallback(
    (tier: string) => {
      if (tier === "Free" || tier === "Student") {
        cancelPlan();
        go("signin");
        return;
      }
      if (
        tier === "Enterprise" ||
        tier === "Ministry" ||
        tier === "Consortium" ||
        tier === "Network"
      ) {
        // High-touch sales tiers are quoted, not self-served.
        go("contact");
        return;
      }

      openModal(
        `Start the ${tier} plan`,
        <div className="form">
          <div className="row2">
            <div className="field">
              <label>Billing cycle</label>
              <select id="planBillingCycle" defaultValue="monthly">
                <option value="monthly">Monthly ($30/mo)</option>
                <option value="annual">Annual ($300/yr - save 17%)</option>
              </select>
            </div>
            <div className="field">
              <label>Payment method</label>
              <select id="planPaymentGateway" defaultValue="stripe">
                <option value="stripe">Stripe (Cards)</option>
                <option value="paypal">PayPal</option>
                <option value="flutterwave">Flutterwave (Africa)</option>
                <option value="mpesa">M-Pesa (Mobile Money)</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="crypto">Crypto (USDC/USDT)</option>
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Seats</label>
              <input id="planSeats" type="number" min={1} defaultValue={3} />
            </div>
            <div className="field">
              <label>Organisation</label>
              <input id="planOrg" placeholder="Lumen Labs" />
            </div>
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.6 }}>
            30-day trial. No charge until day 31, cancel from the dashboard at any time. Document verification is included in the trial.
          </div>
        </div>,
        "Start trial",
        () => {
          const seats = Number(
            (document.getElementById("planSeats") as HTMLInputElement | null)?.value
          );
          const billing_cycle = (
            document.getElementById("planBillingCycle") as HTMLSelectElement | null
          )?.value as "monthly" | "annual";
          const payment_gateway = (
            (document.getElementById("planPaymentGateway") as HTMLSelectElement | null)?.value
          ) ?? "stripe";
          activatePlan(tier, billing_cycle, payment_gateway, Number.isFinite(seats) ? seats : 1);
        }
      );
    },
    [toast, go, openModal, cancelPlan, activatePlan]
  );

  return (
    <AppContext.Provider
      value={{
        route,
        portal,
        catalogStatus,
        applications,
        recommendations,
        dashboardDataStatus,
        pid,
        typeFilter,
        sectorFilter,
        courseFilter,
        searchQuery,
        opportunityFilter,
        planSeg,
        role,
        dash,
        session,
        isAuthed: !!session,
        authReady,

        orgs,
        placements,
        meta,
        metaReady,
        student,
        docs,
        resume,
        adminQueue,
        activity,
        pack,
        organizationPlacements,

        isMenuOpen,
        isSideDrawerOpen,
        toastMessage,
        modal,
        isChatOpen,
        chatMessages,

        setTypeFilter,
        setSectorFilter,
        setCourseFilter,
        setSearchQuery,
        setOpportunityFilter,
        setPlanSeg,
        setStatement,

        addSkill,
        removeSkill,
        toggleSkill,
        setSkills,
        setSkillConfidence,

        go,
        enterPortal,
        openPlacement,
        setType,
        signIn,
        signUp,
        signOut,
        openDashboardFor,
        dashGo,

        openMenu,
        closeMenu,
        openSide,
        closeSide,
        toast,
        openModal,
        closeModal,
        modalConfirm,

        openChat,
        closeChat,
        sendChat,
        askChat,

        applyTo,
        reviewStudent,
        editRequirements,
        newPlacement,
        uploadDoc,
        uploadResumeFile,
        uploadDocumentFile,
        withdrawApplication,
        editPack,
        previewPack,
        showEmbed,
        planAction,

        subscription,
        isPremium,
        freeAllowance: FREE_ALLOWANCE,
        employerLiveCount,
        activatePlan,
        cancelPlan,

        saved,
        toggleSave,
        isSaved,

        getOrg,
        getPlacement,
        isEligible,
        gradeRank,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
