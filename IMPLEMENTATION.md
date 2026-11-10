# BrighterWorks Platform Implementation Plan

## 1. Purpose

BrighterWorks is one platform with two distinct opportunity portals:

- **Internship Portal** for university and college students, recent graduates, universities, NGOs, government agencies, companies, and placement offices.
- **Jobs Portal** for job seekers, employers, NGOs, government institutions, and companies.

The portals share authentication, organisations, profiles, notifications, applications, career support, and platform infrastructure. They do not share one mixed navigation or one oversized opportunity model.

The existing visual identity remains the product standard. No new visual language, Vibe-style components, unrelated design system, or replacement palette will be introduced.

## 2. Product principles

1. Internship and Jobs are first-class product contexts inside the same platform.
2. A user enters the relevant portal before seeing its features.
3. Live backend data is the source of truth.
4. Hardcoded listings, dashboard metrics, user records, and workflow state are removed feature by feature.
5. Access is derived from the authenticated account and organisation relationship.
6. Every completed feature is tested, committed, and pushed to `main` before the next feature begins.
7. Existing screens, colors, spacing, typography, imagery, and interaction patterns are preserved unless a change is required by the new portal structure.
8. Code remains clean and focused, with comments only where the behavior is not self-explanatory.

## 3. Existing design contract

The current frontend design in `intern/src/app/globals.css` is the source of truth.

Preserve:

- White page and card surfaces
- Zinc borders and neutral text scale
- Primary red `--blue: #BC2132`
- Dark near-black bands using `--blue-deep`
- Existing red, green, gold, and cream status treatments
- Plus Jakarta Sans headings
- Inter body text
- JetBrains Mono labels and metadata
- Existing rounded rectangle geometry
- Current spacing, card, button, table, drawer, modal, and dashboard patterns
- Existing local imagery and icon system
- Current responsive behavior and accessibility focus styles

Do not introduce:

- Purple gradients
- Glassmorphism
- Neon accents
- Decorative blobs
- Unrelated dashboard templates
- Generic Vibe-coded component libraries
- New typography systems
- New global color tokens without a demonstrated product need

## 4. Portal information architecture

### Global navigation

The global header should expose only platform-level destinations:

- BrighterWorks
- Internships
- Jobs
- Employers
- Resources
- About
- Sign in

Job-specific and internship-specific tools must not remain as unrelated global header items.

### Internship Portal

Primary navigation:

- Find Internships
- Saved Internships
- My Applications
- My Profile
- Skills Profile
- Documents
- Application Pack
- Career Advisor
- Internship Guidance

Supported users:

- Students
- Recent graduates
- University placement officers
- University administrators
- NGOs
- Government agencies
- Companies
- University departments
- Platform administrators

### Jobs Portal

Candidate navigation:

- Find Jobs
- Companies
- Saved Jobs
- My Applications
- Job Alerts
- Career Profile
- CV/Resume
- Cover Letters
- Learning
- Career Assistant

Employer navigation:

- Employer Overview
- Post a Job
- Manage Jobs
- Applicants
- Shortlisted Candidates
- Company Profile
- Interview Management
- Subscription and Billing

Supported users:

- Job seekers
- Employers
- NGOs
- Government institutions
- Companies
- Platform administrators

## 5. Dashboard model

Dashboards remain inside the existing dashboard shell and use the existing visual system. Portal context determines which navigation and data are shown.

### Student dashboard

- Overview
- Recommended Internships
- Saved Internships
- Applications
- Skills Profile
- Documents
- Application Pack
- Verification Status
- Career Advisor

### Recent graduate dashboard

- Overview
- Recommended Internships
- Recommended Jobs
- Saved Opportunities
- Applications
- Career Profile
- CV/Resume
- Job Alerts
- Career Assistant

### University dashboard

- Overview
- Students
- Internship Requirements
- Internship Listings
- Applications
- Document Verification
- Placement Outcomes
- Reports

### NGO dashboard

- Overview
- Internship Listings
- Job Listings
- Applicants
- Shortlisted Candidates
- Organisation Profile
- Reports
- Subscription and Billing

### Government dashboard

- Overview
- Internship and Attachment Programmes
- Job Listings
- Applicants
- Regional/District Reporting
- Cohort Reports
- Compliance Documents
- Organisation Profile

### Employer/company dashboard

- Overview
- Internship Listings
- Job Listings
- Applicants
- Shortlisted Candidates
- Talent Search
- Company Profile
- Subscription and Billing

### Job seeker dashboard

- Overview
- Find Jobs
- Saved Jobs
- Applications
- Job Alerts
- Career Profile
- CV/Resume
- Cover Letters
- Learning

### Platform administrator dashboard

- Overview
- Users
- Organisations
- Internship Listings
- Job Listings
- Applications
- Verification Queue
- Reports
- Plans and Billing
- Audit Activity

## 6. Backend domain direction

Shared entities:

- User
- Organisation
- Organisation membership
- Candidate profile
- Candidate documents
- Notifications
- Subscription

Internship entities:

- Internship
- Internship requirements
- Saved internship
- Internship application
- Internship verification
- University placement programme
- Internship outcome

Jobs entities:

- Job
- Job requirements
- Saved job
- Job application
- Job alert
- Candidate CV
- Cover letter
- Interview
- Shortlist

Jobs and internships should not be forced into one table. Their shared fields may use common value objects or services, but their business rules remain separate.

## 7. API direction

Existing APIs remain stable while the portal migration starts:

- `/api/auth/*`
- `/api/placements/*`
- `/api/match`
- `/api/skills/extract`
- `/api/advisor`
- `/api/saved`
- `/api/applications`
- `/api/subscription`

Internship APIs will gradually move toward explicit naming:

- `GET /api/internships`
- `GET /api/internships/{id}`
- `GET /api/internships/meta`
- `POST /api/internships/{id}/apply`
- `GET /api/internship-applications`
- `GET /api/saved-internships`

Compatibility routes may remain temporarily so existing clients do not break.

Jobs APIs will include:

- `GET /api/jobs`
- `GET /api/jobs/{id}`
- `POST /api/jobs`
- `PATCH /api/jobs/{id}`
- `POST /api/jobs/{id}/apply`
- `GET /api/job-applications`
- `GET /api/saved-jobs`
- `POST /api/saved-jobs/toggle`
- `GET /api/job-alerts`
- `POST /api/job-alerts`
- `GET /api/companies`
- `GET /api/companies/{id}`
- `GET /api/jobs/{id}/applicants`

All protected operations must derive identity and organisation scope from the authenticated token.

## 8. Live data rules

The Neon database, accessed only through the backend, is the source of truth.

Frontend requirements:

- No hardcoded opportunity catalogue
- No hardcoded user-specific dashboard metrics
- No fixed employer organisation IDs
- No local-only saved opportunities when the API is enabled
- No fake application status after a successful-looking action
- No silent fallback that looks like successful live data
- Explicit loading, empty, error, and unauthorized states

Temporary seed data is allowed only for backend development and test fixtures. It must not be used as production frontend state.

Environment requirements:

- The Neon connection string remains in backend environment configuration.
- Secrets are never committed.
- The frontend receives only the public API base URL.
- Database access is never performed directly from browser code.

## 9. Feature delivery sequence

Each feature is complete only when its backend, frontend, tests, documentation, commit, and push are complete.

### Feature 0: Implementation contract — complete

- Add this implementation document.
- Confirm portal boundaries, role dashboards, design rules, and delivery workflow.
- Commit and push this document.

### Feature 1: Portal foundation — complete

- Add portal-aware application state.
- Add Internship and Jobs entry points.
- Move job-related navigation under Jobs.
- Move internship-specific navigation under Internships.
- Add portal-aware routes and active navigation.
- Preserve existing screens and colors.
- Add route and navigation tests where practical.
- Commit and push. Completed in `cd8c8fe`.

### Feature 2: Live Internship Portal catalogue — complete

- Rename public-facing placement concepts to internships where appropriate.
- Add explicit internship API compatibility.
- Load internships and metadata from Neon through the backend.
- Add robust loading, empty, and error states.
- Remove the frontend catalogue fallback.
- Commit and push. Completed in `01a36e5`.

### Feature 3: Live internship candidate workflows — complete

- Persist saved internships. Complete in `cd8c8fe`/`01a36e5`.
- Persist internship applications. Complete in `cd8c8fe`/`01a36e5`.
- Load application history from the backend. Complete in `c730087`.
- Track applications and withdraw eligible submissions. Complete in the current student dashboard workflow.
- Connect eligibility and matching to live backend metadata. Complete for the dashboard overview in `c730087`.
- Remove related local-only state. All dashboard views migrated to live API data.
- Commit and push.

### Feature 4: Internship student profile and documents — complete

- Add persistent student/recent-graduate profile records. Complete in `4d28284`.
- Add skills persistence. Complete in `4d28284`.
- Add resume upload metadata and content storage. Complete in the current student dashboard workflow.
- Add live document upload metadata/content and student-owned status records. Complete in the current student dashboard workflow.
- Add administrator verification actions and rejection reasons. Complete — `GET /admin/documents`, `PATCH /admin/documents/{id}/verify` with `AdminDocuments` dashboard.
- Persist application pack data. Complete.
- Connect dashboard views to live records. Complete — all student dashboards use live API.
- Commit and push.

### Feature 5: Internship institution and host dashboards

- Build university dashboard.
- Build NGO dashboard.
- Build government dashboard.
- Build employer/company internship dashboard.
- Add role and organisation authorization.
- Replace hardcoded queues, counts, and activity with backend data.
- Commit and push.

Progress update:

- Employer/company internship posting now has a live backend workflow:
  - `GET /api/organization/internships`
  - `POST /api/organization/internships`
- Posting records now persist real lifecycle fields:
  - `published_at`
  - `closes_at`
  - `starts_at`
  - `requirements`
  - `review_status` (`pending_review` on submission)
- Public internship catalogue visibility now excludes records pending review.
- Employer dashboard now submits internships for admin review using live backend data.
- **Admin document verification workflow complete:**
  - `GET /admin/documents` — list all student documents with status filter
  - `PATCH /admin/documents/{id}/verify` — verify/reject with reasons
  - `AdminDocuments` dashboard component for review queue
- **All dashboard hardcoded data removed** — replaced with live API calls:
  - `AdminOverview` — `/admin/metrics`, `/admin/queue`, `/admin/activity`
  - `AdminStudents` — `/admin/queue`
  - `EmployerOverview` — `/organization/internships`, `/placements/{id}/applicants`
  - `EmployerApplicants` — live placement selector + `/placements/{id}/applicants`
  - `JobSeekerOverview` & `JobSeekerApps` — `/applications`
  - `StudentPlacements` — `/match` API for server-side ranked recommendations
  - `SkillProfile` — `/match` API for live recommendations
  - `StudentTestimonial` — submits via document upload API
- **Admin user provisioned** — `akandwanahojonanrwangoga@gmail.com` / `Yesu1@Lord` in seed data
- **Login page polished** — removed hardcoded demo accounts, added professional guidance text

### Feature 6: Jobs domain and database

- Add jobs, requirements, companies, saved jobs, applications, alerts, CVs, cover letters, interviews, and shortlist entities.
- Add migrations or a proper schema migration process.
- Add seed fixtures only for tests/development.
- Add repository and service tests.
- Commit and push.

### Feature 7: Jobs candidate portal

- Build jobs catalogue.
- Add search and filters.
- Add job detail and company detail views.
- Add saved jobs.
- Add applications and application tracking.
- Add candidate profile, CV, and cover-letter workflows.
- Commit and push.

### Feature 8: Jobs employer portal

- Add job creation and editing.
- Add publish/unpublish controls.
- Add applicant review.
- Add shortlist and status updates.
- Add company profile.
- Add employer billing and usage.
- Commit and push.

### Feature 9: Alerts, learning, and career assistance

- Add persistent job alerts.
- Add internship alerts where applicable.
- Add learning/resource records.
- Make the assistant portal-aware.
- Ground recommendations in live records.
- Commit and push.

### Feature 10: Hardcoded-state removal

- Audit frontend constants and local state.
- Remove production catalogue constants.
- Remove fake dashboard metrics.
- Remove demo-only workflow success paths.
- Keep only presentation defaults and test fixtures.
- Commit and push.

### Feature 11: Production readiness

- Restrict CORS.
- Verify Neon deployment configuration.
- Add migration deployment steps.
- Add logging and error visibility.
- Verify authorization for every role.
- Verify mobile behavior.
- Verify accessibility and loading states.
- Commit and push.

## 10. Definition of done for every feature

Before a feature is marked complete:

1. The affected backend and frontend code is implemented.
2. The feature uses the existing design tokens and components.
3. No unrelated design system or visual language is introduced.
4. Backend tests cover business rules and authorization.
5. Frontend type checking and production build pass.
6. Live API behavior is verified where applicable.
7. Hardcoded state related to the feature is removed or explicitly limited to test fixtures.
8. Errors are visible to the user and not silently converted into success.
9. The worktree is reviewed for unrelated changes.
10. Only the completed feature is committed.
11. The commit is pushed to `main`.
12. The next feature starts only after the push succeeds.

## 11. Working rules

- Preserve existing uncommitted work unless it is explicitly part of the current feature.
- Do not commit secrets, `.env.local` files, database credentials, or generated private data.
- Do not amend existing commits.
- Do not use broad destructive commands.
- Keep components focused and reuse existing helpers.
- Prefer backend contracts and typed DTOs over duplicated frontend models.
- Keep comments sparse and purposeful.
- Keep the implementation clean, readable, and consistent with the current codebase.

## 12. Current implementation status

The **Portal Foundation**, **Live Internship Catalogue**, **Live Internship Candidate Workflows**, and **Internship Student Profile & Documents** are complete.

The current delivery target is **Feature 5: Internship Institution and Host Dashboards** — building university, NGO, government, and employer-specific dashboards with role/organization authorization.

### Feature 5: Internship Institution and Host Dashboards
- Build university dashboard.
- Build NGO dashboard.
- Build government dashboard.
- Build employer/company internship dashboard.
- Add role and organisation authorization.
- Replace hardcoded queues, counts, and activity with backend data.
- Commit and push.

### Feature 12: Skills-to-Opportunity Matching Platform (Internship Portal Enhancement)

*Goal: Shift from eligibility/verification focus to skills-to-opportunity matching. Job Portal remains unchanged.*

#### 12.1 Student Skills Profiling from Projects & Assessments
- **Skills Quiz**: Add a short skills assessment quiz (10-15 questions) covering technical, soft, and domain skills
- **"Skills from my Projects" Input**: Free-text project description input with NLP extraction (extends existing `extractSkills` in `lib/skills.ts`)
- **Course-based Skills**: Auto-suggest skills from enrolled courses (map courses → typical skills)
- **Skill Confidence Levels**: Students rate proficiency (Beginner/Intermediate/Advanced) per skill
- **Backend**: Extend `StudentProfile` entity with `skills_confidence: Dict[str, int]` and `skills_source: Dict[str, str]` (quiz/project/course/quiz)
- **API**: `POST /api/profile/skills-assessment` to submit quiz results; `PUT /api/profile/skills` to update skills with confidence
- **Frontend**: New "Skills Assessment" tab in student dashboard with quiz UI and project text input

#### 12.2 Gigs & Entry-Level Tech Roles in Internship Portal
- **New Opportunity Type**: Add `opportunity_type` field to `Placement` entity: `internship` | `gig` | `entry_level`
- **Gig Fields**: `duration_hours`, `budget_range`, `milestones`, `remote_ok`, `skills_required[]`
- **Entry-Level Fields**: `salary_range`, `probation_period`, `training_included`, `career_path`
- **Catalogue Filters**: Add "Type" filter (Internship / Gig / Entry-Level) to public catalogue
- **Employer Posting**: Extended form with type selector; conditional fields per type
- **Matching**: Extend `match_placement` to weight skills differently per type (gigs: 80% skills, 20% availability; entry-level: 50% skills, 30% course, 20% CGPA)
- **Frontend**: Type tabs in catalogue; type badges on cards; dedicated gig/entry-level detail views

#### 12.3 Advisor Chatbot Skill Guidance
- **Enhanced Prompt**: Extend `compose_prompt` in `advisor.py` to include:
  - Student's current skills with confidence levels
  - Top 3 skill gaps blocking best matches
  - Recommended next skills to learn (with estimated match score improvement)
  - Suggested projects/courses to build those skills
- **Action Buttons**: Chat responses include "Add Skill", "Start Quiz", "View Course" actions
- **Proactive Nudges**: On dashboard load, show "Your top match needs Python — add it now?" banner
- **Frontend**: ChatDrawer enhancements with action buttons; skill suggestion chips in chat

#### 12.4 Placement-Fee Business Model (Employer Pays on Hire)
- **New Billing Event**: `placement_fee` charged when application status → `Accepted`
- **Fee Structure**: Configurable per org type (Company: 15% of first-month stipend/salary; Gov/NGO: 10%; University: 5%)
- **Subscription Changes**: 
  - Free tier: 3 free postings, then placement-fee only
  - Pro tier ($30/mo): Unlimited postings, reduced placement fee (50% off), priority review
  - Enterprise: Custom fee structure, dedicated manager
- **Backend**: New `PlacementFee` entity; webhook on application status change; invoice generation on hire
- **Employer Dashboard**: Show "Estimated placement fee: $X" when posting; fee summary in billing
- **Admin**: Fee collection report; org fee config

#### 12.5 Student Premium Tier
- **Free Tier**: Basic matching, 3 applications/month, basic skill gap summary
- **Premium Tier ($15/mo or $150/yr)**:
  - Priority matching (top of employer search results)
  - Unlimited applications
  - Detailed skill-gap report (per opportunity: missing skills, learning resources, time estimates)
  - CV review by career advisor (1/month)
  - Early access to new opportunities (24h head start)
  - Interview prep kit (common questions, STAR framework)
- **Backend**: `StudentSubscription` entity; feature flags in matching service
- **Frontend**: Upgrade banner in student dashboard; premium badges on opportunities

#### 12.6 Real Statistics & Revenue Model Documentation
- **Replace Mock Data**: Audit all dashboard stats (KPIs, testimonials, conversion rates)
- **Assumed Figures Label**: Add "Assumed (based on X)" badges where real data unavailable
- **Revenue Model Doc**: Create `REVENUE_MODEL.md` with:
  - TAM/SAM/SOM for Ugandan + East African market
  - Placement fee projections (conservative/base/aggressive)
  - Cost structure (infra, team, marketing, verification)
  - Break-even analysis
  - Unit economics (CAC, LTV, payback period)
- **Worked Example**: "100 employers × 2 hires/yr × $200 fee = $40k/yr revenue"
- **Cost Example**: "Verification: $5/application × 500 apps/mo = $2,500/mo"

#### 12.7 Student Testimonial Carousel (Home Page)

*Goal: Showcase verified student success stories on the home page with a vertical scrolling carousel.*

- **Student Submission** (already exists in `StudentTestimonial.tsx`):
  - Student writes testimonial with supervisor name, role, project, and testimonial text
  - Submitted as a document (`type: "testimonial"`) via `uploadDocumentFile`
  - Status: `pending` → admin reviews → `verified` or `rejected`

- **Admin Verification** (uses existing `AdminDocuments.tsx`):
  - Admin sees pending testimonials in document verification queue
  - Approve/reject with reason
  - Only `verified` testimonials appear on home page

- **Home Page Carousel** (new component `TestimonialCarousel.tsx`):
  - Vertical scrolling ticker (CSS animation, pauses on hover)
  - Shows: student name, course, university, placement org, role, testimonial text, verification badge
  - Auto-scroll: 5s per testimonial, pauses on hover/focus
  - Responsive: 1 column mobile, 2 column tablet, 3 column desktop (if space allows)
  - Fallback: If < 3 verified testimonials, show static grid instead of carousel
  - "Read more" link → placement detail page

- **Backend Changes**:
  - `GET /api/testimonials?status=verified&limit=10` — public endpoint for carousel
  - `StudentDocument` already stores testimonials; add `is_public` flag to control home page display
  - Admin can toggle `is_public` per testimonial

- **Frontend Changes**:
  - New `TestimonialCarousel.tsx` in `components/public/`
  - Integrate into `HomeView.tsx` (after "Students" section, before "Latest" section)
  - CSS keyframes for smooth vertical scroll
  - Accessibility: `prefers-reduced-motion` disables auto-scroll; keyboard navigable

- **API Endpoint**:
  - `GET /api/testimonials?status=verified&limit=10` → returns verified public testimonials
  - Response: `{ items: Testimonial[] }` with student name, course, university, org, role, text, date, verification status

#### 12.8 Multi-Role Testimonials (Students, Employers, Employees, Admins)

*Goal: Extend testimonials beyond students to all platform users — employers sharing hiring experiences, employees sharing workplace insights, admins sharing platform governance insights.*

- **Testimonial Types**: Extend `StudentDocument` → `Testimonial` entity with `author_role: "student" | "employer" | "employee" | "admin"` and `author_id`
- **Employer Testimonials**: "We hired 3 interns from BrighterWorks — verified skills, ready to contribute from day one"
- **Employee Testimonials**: "The platform matched me with a role that fits my skills perfectly — transparent requirements, no surprises"
- **Admin Testimonials**: "Platform integrity maintained — 99.2% verification accuracy, zero fraudulent placements this term"
- **Submission**: Each role has dedicated testimonial form in their dashboard (`EmployerTestimonial.tsx`, `EmployeeTestimonial.tsx`, `AdminTestimonial.tsx`)
- **Verification**: Same admin workflow — pending → verified/rejected
- **Display**: Home page carousel filters by role tabs (Students | Employers | Employees | Admins)

#### 12.9 Comprehensive Admin Dashboard (Amazon-Style System Operations)

*Goal: Give platform admins (system owners) complete visibility and control — not just university admins.*

- **System Overview KPIs**: Total users (by role), active placements, organizations, applications, revenue, verification rates
- **Organization Management**: List all orgs with type, status, active postings, hired candidates, revenue contribution, compliance score
- **User Management**: 
  - Students: enrollment, applications, placements, documents, skill profiles, premium status
  - Employers: postings, applicants, hires, billing, subscription tier, compliance history
  - Employees: profiles, work history, skill assessments, testimonials
  - Admins: activity logs, permissions, audit trail
- **Compliance & Safety**: Flag non-compliant users (fake documents, no-shows, policy violations), bulk actions
- **Revenue Analytics**: Placement fees collected, subscription revenue, overdue invoices, fee projections
- **Audit Logs**: Every admin action, user state change, document verification, payment, role change — immutable, searchable
- **System Health**: API latency, error rates, database size, verification queue depth, notification delivery rates

#### 12.10 Soft-Delete & Data Retention (Amazon-Style Account Management)

*Goal: Never truly delete user data — soft delete with full retention for compliance, fraud prevention, and smart re-registration.*

- **Soft Delete Pattern**: 
  - `User` entity adds `deleted_at: datetime | null`, `deletion_reason: str`, `deleted_by: str`
  - `is_active: bool` computed property (false when `deleted_at` is set)
  - All queries default to `WHERE deleted_at IS NULL`; admin queries can include deleted
- **Data Retention on Deletion**:
  - Preserve: email, phone, hashed password, card tokens (PCI-compliant vault), verification documents, activity logs, testimonials, applications, payments
  - Anonymize: name → "Deleted User", profile fields → null (but keep IDs for referential integrity)
  - Retain: card tokens, phone, email for fraud prevention & smart re-registration
- **Smart Re-Registration**: 
  - If user registers with same email/phone → detect soft-deleted account
  - Offer: "Welcome back! Restore your profile?" → one-click restore with all history
  - Pre-fill: card details (tokenized), verified documents, skill profile, application history
- **Admin Controls**:
  - Soft delete user (with reason, logged in audit)
  - Restore user (full history)
  - Permanent purge (GDPR/legal request only, requires super-admin + audit)
  - View deleted users list with filters

#### 12.11 Admin Enforcement & Compliance Actions

*Goal: Platform admins can enforce compliance, revoke access, and maintain platform integrity.*

- **Non-Compliance Triggers**: 
  - Document fraud (fake transcripts, IDs)
  - No-show for confirmed placements
  - Policy violations (spam, harassment, fake reviews)
  - Payment defaults (employers)
  - Repeated violations (3-strike system)
- **Enforcement Actions** (logged in audit, reversible by super-admin):
  - **Warning**: Email + in-app notification, logged
  - **Suspension**: Temporary account lock (1-30 days), preserve all data
  - **Revocation**: Permanent soft delete, preserve all data for audit
  - **Organization Sanction**: Suspend org's posting privileges, flag all org users
- **Appeal Process**: User can appeal → admin review → decision logged
- **Bulk Operations**: Select multiple users/orgs → apply action with single audit entry
- **Compliance Dashboard**: Real-time view of flagged accounts, pending appeals, action history

---

## 13. Implementation Sequence

| Phase | Features | Est. Effort | Dependencies |
|-------|----------|-------------|--------------|
| 1 | Skills Profiling (12.1) | 2 weeks | — |
| 2 | Gigs & Entry-Level Types (12.2) | 1.5 weeks | 12.1 (matching) |
| 3 | Advisor Enhancement (12.3) | 1 week | 12.1 |
| 4 | Placement-Fee Model (12.4) | 2 weeks | Billing service |
| 5 | Student Premium (12.5) | 1.5 weeks | 12.4, 12.1 |
| 6 | Statistics & Docs (12.6) | 1 week | All above |
| 7 | Testimonial Carousel (12.7) | 1 week | 12.1, Admin docs |
| 8 | Multi-Role Testimonials (12.8) | 1.5 weeks | 12.7 |
| 9 | Comprehensive Admin Dashboard (12.9) | 2 weeks | 12.1, 12.4 |
| 10 | Soft-Delete & Data Retention (12.10) | 2 weeks | 12.9 |
| 11 | Admin Enforcement & Compliance (12.11) | 1.5 weeks | 12.9, 12.10 |

---

## 14. Technical Notes

### Database Changes
- `StudentProfile`: add `skills_confidence`, `skills_source`
- `Placement`: add `opportunity_type`, gig/entry-level fields
- `StudentDocument`: add `is_public` flag for testimonials
- `User`: add `deleted_at`, `deletion_reason`, `deleted_by`, `is_active` (soft delete)
- New: `PlacementFee`, `StudentSubscription`, `SkillsAssessment`, `Testimonial` (author_role, author_id), `AuditLog`
- `BillingService`: add placement fee invoicing

### API Additions
- `POST /api/profile/skills-assessment`
- `GET /api/placements?type=gig|entry_level`
- `POST /api/advisor/skill-guidance`
- `POST /api/billing/student/subscribe`
- `GET /api/testimonials?status=verified&limit=10`
- `GET /api/admin/stats` — system KPIs
- `GET /api/admin/organizations` — org management
- `GET /api/admin/users` — user management with filters
- `GET /api/admin/audit-logs` — immutable audit trail
- `POST /api/admin/users/{id}/suspend` — suspend user
- `POST /api/admin/users/{id}/revoke` — soft delete user
- `POST /api/admin/users/{id}/restore` — restore soft-deleted user
- `POST /api/admin/organizations/{id}/sanction` — sanction organization
- `POST /api/admin/compliance/bulk-action` — bulk enforcement actions
- Webhook: `application.accepted` → placement fee invoice

### Frontend Components
- `SkillsQuiz.tsx` - assessment component
- `ProjectSkillsExtractor.tsx` - project text input
- `OpportunityTypeTabs.tsx` - catalogue filters
- `PremiumUpgradeBanner.tsx` - student dashboard
- `TestimonialCarousel.tsx` - home page vertical ticker
- `EmployerTestimonial.tsx` - employer testimonial submission
- `EmployeeTestimonial.tsx` - employee testimonial submission
- `AdminTestimonial.tsx` - admin testimonial submission
- `AdminDashboard.tsx` - comprehensive admin dashboard with KPIs, org management, user management
- `ComplianceDashboard.tsx` - flagged accounts, appeals, enforcement actions
- `DeletedUsersView.tsx` - soft-deleted users list with restore/purge
- `AuditLogViewer.tsx` - searchable audit trail
- Enhanced `ChatDrawer.tsx` with action buttons

---

## 15. Jobs Portal — No Changes

The Jobs Portal (Features 6-8) remains on its current delivery track:
- Separate domain entities, tables, and workflows
- No shared opportunity model with internships
- Own employer portal, candidate workflows, and billing

This ensures clear separation of concerns and allows parallel development.

- The global header shows Internship and Jobs as the two main opportunity portals.
- Job-specific links are removed from the global header.
- Internship-specific links are grouped under the Internship Portal.
- Jobs-specific links are grouped under the Jobs Portal.
- Existing public pages still work.
- Existing authentication still works.
- Existing dashboard styles and colors remain unchanged.
- All dashboard data comes from live backend APIs (no hardcoded metrics/queues).
- Admin document verification workflow is live.
- Login page is polished with professional guidance (no demo credentials exposed).
- Tests/build pass.
- Each feature is committed and pushed before the next feature begins.

## 13. Current system documentation

This section documents the implemented system as it exists today. It is
updated alongside each feature so the implementation contract remains useful
for development, testing, onboarding, and deployment.

### Frontend architecture

The frontend is a Next.js 14 and React 18 TypeScript application in
`intern/`. It uses one App Router page with hash-based navigation so the
public website, portal catalogue, sign-in flow, and role dashboards can be
served as a static GitHub Pages export.

- `src/app/` contains the root layout, metadata, global styles, and page entry.
- `src/components/public/` contains the public home, about, employers,
  universities, portal, catalogue, detail, sign-in, plans, and legal views.
- `src/components/dashboard/` contains the shared dashboard shell and
  student, employer, admin, and job-seeker views.
- `src/context/AppContext.tsx` owns routing, session state, portal state,
  catalogue state, dashboard state, application actions, document actions,
  saved items, subscriptions, and existing modal/toast behavior.
- `src/lib/api.ts` is the typed browser-to-backend boundary. It translates
  backend snake_case DTOs to frontend camelCase models and attaches the
  authenticated bearer token.
- `src/types/` contains frontend domain types.
- `src/data/` contains presentation defaults and legacy demo-only dashboard
  data that is still being migrated; it is not the source of truth for live
  catalogue, student profile, application, resume, or document data.
- `public/img/` contains local static imagery. Public image references are
  relative so they work under the GitHub Pages project path.

The visual system is defined in `src/app/globals.css` and remains the source
of truth: BrighterMonday-inspired red `#BC2132`, near-black bands, white and
zinc surfaces, existing status colors, Plus Jakarta Sans headings, Inter body
text, current cards/tables/buttons, and existing responsive behavior.

### Backend architecture

The backend is a FastAPI application in `backend/`, mounted under `/api` in
production and exposed at the root in the test harness.

- `app/presentation/main.py` is the composition root and mounts the feature
  sub-application.
- `app/presentation/sub.py` registers feature routers and maps authentication
  failures to HTTP 401 responses.
- `app/presentation/routers/` contains thin HTTP handlers for authentication,
  placements, matching, advisor, authenticated user state, organization
  posting, and administrator review.
- `app/application/` contains use-case services and ports.
- `app/domain/` contains persistence-independent entities and matching rules.
- `app/infrastructure/orm.py` contains SQLAlchemy models.
- `app/infrastructure/repositories.py` maps ORM records to domain entities and
  implements repository ports.
- `app/infrastructure/db.py` creates the Neon/Postgres or SQLite engine,
  creates missing tables, and applies additive compatibility columns.
- `app/infrastructure/seed.py` contains development/test seed records only.
- `backend/tests/` contains unit tests and HTTP integration tests using an
  isolated SQLite database.

The backend derives the acting user and organization from the bearer token.
Employer internship writes require an employer account linked to an
organization. Administrator review requires the `admin` role. Browser code
never connects directly to Neon.

### Implemented live workflows

- Authentication: register, login, current-user lookup, role-aware dashboard
  selection, and sign-out.
- Internship catalogue: live organization and internship reads, search/filter
  metadata, detail views, and backend matching.
- Student profile: persisted course, year, CGPA, university, and skills.
- Student documents: live resume and student document uploads, replacement,
  metadata, size/type validation, and student ownership.
- Student applications: live application history, idempotent application
  submission, status tracking, and eligible withdrawal.
- Organization internship posting: organization-scoped posting creation with
  eligible courses, requirements, required documents, publication date,
  closing date, start date, duration, location, slots, stipend, duties, and
  `pending_review` status.
- Administrator internship review: protected review queue, approve/reject
  decisions, required rejection reasons, and public-catalogue visibility only
  after approval.
- GitHub Pages export: relative public asset paths and static frontend build.

### APIs currently used by the frontend

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Public internship and matching:

- `GET /api/placements`
- `GET /api/placements/{placement_id}`
- `GET /api/placements/meta`
- `POST /api/match`
- `POST /api/skills/extract`
- `POST /api/advisor`

Authenticated student state:

- `GET/POST /api/saved`
- `POST /api/saved/toggle`
- `GET/POST /api/applications`
- `POST /api/applications/{application_id}/withdraw`
- `GET/PUT /api/profile`
- `GET/PUT /api/resume`
- `GET /api/resume/download`
- `GET /api/documents`
- `PUT /api/documents/{document_type}`
- `GET/POST /api/subscription`

Organization internship posting:

- `GET /api/organization/internships`
- `POST /api/organization/internships`

Administrator internship review:

- `GET /api/admin/internships/review`
- `PATCH /api/admin/internships/{internship_id}/review`

### Completion status

Complete and pushed:

- Implementation contract and portal foundation
- Live internship catalogue
- Live student dashboard overview and matching
- Persistent student profile and skills
- BrighterWorks rebrand
- Resume upload
- Application tracking and withdrawal
- Live student documents
- Organization internship submission
- Administrator internship approval/rejection workflow
- **Admin document verification workflow** (`/admin/documents`, `AdminDocuments` dashboard)
- **All dashboard hardcoded data replaced with live API** (admin, employer, jobseeker, student)
- **Admin user provisioned** in seed data
- **Login page polished** — no hardcoded demo credentials
- **Rich application workflow** (CV, cover letter, GitHub/LinkedIn, references, academic papers, documents) for both internships and jobs
- **CSV exports** for admin and employer dashboards (placements, jobs, applicants)
- **Saved Jobs (bookmarks)** feature - `GET/POST /api/jobs/saved`, `POST /api/jobs/saved/{id}/toggle`
- **JobSeekerRoles** polished UI with SaveButton component, saved jobs integration
- **JobSeekerApps** new "Saved" tab with full job details display
- **EmployerPlacements** completely redesigned with professional form, section cards, dynamic fields
- **StudentDocuments** professional UI with progress bar, document cards, upload zones
- **AdminApplications** unified view of all applications (internships + jobs) with filters, pagination, CSV export
- **Invoice/Transaction metadata bugs fixed** - repository uses correct field names
- **All backend tests passing** (105+ tests)

In progress:

- Administrator overview metrics, user/organization management, audit activity, reports
- University, NGO, government, and company-specific organization dashboards
- Jobs domain enhancements: Job detail view, Company detail view, Saved Jobs page, Job Alerts, Candidate Profile/CV/Cover Letter management, Interview/Shortlist workflows
- Notifications, alerts, learning, and career assistance persistence
- Production hardening: restricted CORS, formal migrations, observability, deployment verification, accessibility/mobile review
- Feature 12: Skills-to-Opportunity Matching Platform (Skills Quiz, Gigs/Entry-level, Advisor guidance, Placement-fee model, Student Premium tier)

### Authentication entry-point contract

All protected work begins at the sign-in/sign-up screen:

1. The frontend calls `POST /api/auth/login` or `POST /api/auth/register`.
2. The backend returns a signed bearer token and safe account record.
3. The frontend stores the token, calls `/api/auth/me` on reload, and derives
   the dashboard role from the authenticated account.
4. Successful authentication routes to the matching dashboard overview.
5. Unauthenticated dashboard deep links return to sign-in.
6. A dashboard URL cannot switch an authenticated user into another role's
   workspace; the frontend redirects to the account's own role dashboard and
   backend authorization remains authoritative.
7. Admin accounts are provisioned by the platform and cannot be created through
   public sign-up.

The backend container is defined by `backend/Dockerfile` and
`backend/docker-compose.yml`. It runs the FastAPI service on port `8000`,
includes a health check, runs as a non-root user, and supports either local
Postgres through Compose or Neon through `DATABASE_URL`. Secrets belong in a
local/deployment `.env`, never in the image or repository.

Container deployment:

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL to Neon and SECRET_KEY to a long production secret.
docker build -t brighterworks-api .
docker run --env-file .env -p 8000:8000 brighterworks-api
```

For local Postgres development:

```bash
cd backend
docker compose up --build
```

The frontend remains a separate static deployment. Set
`NEXT_PUBLIC_API_BASE_URL` to the reachable backend URL before building the
frontend; GitHub Pages cannot host the authenticated FastAPI API.

The current deployed backend is:

```text
https://global-inetrnship.onrender.com
```

The frontend is configured to use:

```text
https://global-inetrnship.onrender.com/api
```

This value is configured for local frontend development and the GitHub Pages
workflow. It is a public API URL, not a secret. The backend remains responsible
for authentication, authorization, Neon access, and all protected data.

### Jobs Portal status

The Jobs Portal core is **complete and live**. The implementation includes:

**Completed:**
- Job domain entities, ORM tables, migrations, repositories, and organization/admin authorization
- Organization job drafts, requirements, publication dates, closing dates, and admin approval
- Live Jobs catalogue (`GET /api/jobs`, `GET /api/jobs/{id}`, search/location/mode filters)
- Job detail view with full job information
- **Company/Employer detail view** (`GET /api/organization/public/{org_id}`, `CompanyDetailView` component)
- Job-seeker profile, saved jobs (bookmarks), applications, and status tracking
- Employer applicants view with accept/reject/review actions
- Employer job posting and management
- Rich application workflow (CV, cover letter, GitHub/LinkedIn, references, academic papers, documents)
- CSV exports for admin and employer dashboards (placements, jobs, applicants)
- Saved Jobs (bookmarks) feature with toggle UI
- JobSeekerRoles polished UI with SaveButton component
- JobSeekerApps with "Saved" tab showing full job details
- **Employer Shortlist Feature**: Dedicated "Shortlisted" tab in EmployerApplicants, shortlist/unsortlist toggle for both internship and job applications, shortlisted count badge, persistence across refreshes, employer-only authorization
- All backend tests passing (108+ tests)

**In Progress / Remaining:**
- Saved Jobs Page - Dedicated page showing saved jobs with details
- Job Alerts (email notifications for new matching jobs)
- Candidate Profile/CV/Cover Letter management UI
- Interview/Shortlist workflows for employers (beyond basic shortlist)
- Notifications and alerts system
- Learning and career assistance persistence

Jobs Portal progress:

- The first Jobs sub-feature is complete: a separate live Jobs catalogue now
  has `Job` domain/ORM records, development seed fixtures, repository mapping,
  `GET /api/jobs`, `GET /api/jobs/{id}`, search/location/mode filters, and
  authenticated job-seeker dashboard loading with explicit loading, empty, and
  error states.
- Job applications and employer job posting are complete with rich application data.
- Saved jobs/bookmarks feature complete with API and UI.
- Employer applicant management with accept/reject/review complete.

Learner dashboard progress:

- The application pack is now persisted per authenticated student through
  `GET /api/application-pack` and `PUT /api/application-pack`.
- Student pack statements are limited to 600 characters and target roles are
  normalized and deduplicated by the backend.
- The pack preview uses the student's live profile, documents, and
  recommendation scores.
- The sent-application panel uses live application and placement records rather
  than bundled demo applications.
- Remaining learner workflow work includes persisted testimonials and any
  remaining dashboard actions that currently only display local confirmation.

The next implementation slice begins only after the current feature has
passed backend tests, frontend build/type checking, staged-diff review, commit,
and push.
