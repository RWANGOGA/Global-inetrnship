# BrighterWorks Platform

A dual-portal career platform (Internships + Jobs) built with Next.js/React frontend and FastAPI backend.

## System Overview

BrighterWorks is a career platform with **two distinct opportunity portals** sharing authentication, organizations, profiles, notifications, and platform infrastructure.

| Portal | Users | Core Features |
|--------|-------|---------------|
| **Internship Portal** | Students, Universities, NGOs, Government, Companies, Platform Admins | Internship search, applications, document verification, matching, career advisor |
| **Jobs Portal** | Job Seekers, Employers, Companies, Platform Admins | Job search, applications, CV/cover letters, interviews, shortlisting |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BRIGHTERWORKS PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐  │
│  │   FRONTEND       │      │    BACKEND       │      │    DATABASE      │  │
│  │   (Next.js/React)│◄────►│    (FastAPI)     │◄────►│   (Neon/Postgres)│  │
│  │                  │      │                  │      │                  │  │
│  │  ┌────────────┐  │      │  ┌────────────┐  │      │  ┌────────────┐  │  │
│  │  │  Pages     │  │      │  │  Routers   │  │      │  │  Tables    │  │  │
│  │  │  - Home    │  │      │  │  - auth    │  │      │  │  - users   │  │  │
│  │  │  - SignIn  │  │      │  │  - placements│  │      │  │  - orgs    │  │  │
│  │  │  - Plans   │  │      │  │  - jobs    │  │      │  │  - places  │  │  │
│  │  │  - About   │  │      │  │  - org     │  │      │  │  - jobs    │  │  │
│  │  └────────────┘  │      │  │  - admin   │  │      │  │  - apps    │  │  │
│  │                  │      │  │  - billing │  │      │  │  - docs    │  │  │
│  │  ┌────────────┐  │      │  │  - advisor │  │      │  │  - subs    │  │  │
│  │  │ Components │  │      │  └────────────┘  │      │  │  - invoices│  │  │
│  │  │  - public  │  │      │                  │      │  │  - trans   │  │  │
│  │  │  - dashboard│  │      │  ┌────────────┐  │      │  │  - usage   │  │  │
│  │  └────────────┘  │      │  │  Services  │  │      │  └────────────┘  │  │
│  │                  │      │  │  - Auth    │  │      │                  │  │
│  │  ┌────────────┐  │      │  │  - Placement│  │      │  ┌────────────┐  │  │
│  │  │ Context    │  │      │  │  - Matching│  │      │  │  Migrations│  │  │
│  │  │  - session │  │      │  │  - Billing │  │      │  │  - schema  │  │  │
│  │  │  - portal  │  │      │  │  - Advisor │  │      │  └────────────┘  │  │
│  │  │  - state   │  │      │  └────────────┘  │      │                  │  │
│  │  └────────────┘  │      │                  │      │  ┌────────────┐  │  │
│  │                  │      │  ┌────────────┐  │      │  │  Seed Data │  │  │
│  │  ┌────────────┐  │      │  │  Repos     │  │      │  │  - dev     │  │  │
│  │  │ API Layer  │  │      │  │  - User    │  │      │  │  - test    │  │  │
│  │  │  - fetch   │  │      │  │  - Placement│  │      │  └────────────┘  │  │
│  │  │  - post    │  │      │  │  - Billing │  │      │                  │  │
│  │  │  - types   │  │      │  └────────────┘  │      │                  │  │
│  │  └────────────┘  │      │                  │      │                  │  │
│  └──────────────────┘      └──────────────────┘      └──────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Architecture (Next.js 14 + React 18 + TypeScript)

```
intern/
├── src/
│   ├── app/                    # App Router entry point
│   │   ├── layout.tsx         # Root layout, providers, metadata
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Design tokens (source of truth)
│   │
│   ├── components/
│   │   ├── public/            # Public-facing views
│   │   │   ├── HomeView.tsx
│   │   │   ├── AboutView.tsx
│   │   │   ├── EmployersView.tsx
│   │   │   ├── UniversitiesView.tsx
│   │   │   ├── PortalView.tsx
│   │   │   ├── SignInView.tsx
│   │   │   ├── PlansView.tsx
│   │   │   └── LegalView.tsx
│   │   │
│   │   ├── dashboard/         # Role-based dashboards
│   │   │   ├── DashboardShell.tsx
│   │   │   ├── student/       # StudentDashboard
│   │   │   ├── employer/      # EmployerDashboard
│   │   │   ├── admin/         # AdminDashboard
│   │   │   └── jobseeker/     # JobSeekerDashboard
│   │   │
│   │   ├── common/            # Shared components
│   │   │   ├── ChatDrawer.tsx
│   │   │   └── ...
│   │   │
│   │   └── icons/             # Icon system
│   │
│   ├── context/
│   │   └── AppContext.tsx     # Central state: routing, session, portal, catalog, dashboards
│   │
│   ├── lib/
│   │   ├── api.ts             # Typed browser↔backend boundary (snake_case ↔ camelCase)
│   │   └── skills.ts          # Client-side matching (mirrors backend)
│   │
│   ├── types/
│   │   └── index.ts           # Frontend domain types
│   │
│   └── data/
│       └── index.ts           # Presentation defaults & legacy demo data
│
└── public/
    └── img/                   # Static imagery
```

### Backend Architecture (FastAPI + SQLAlchemy + Neon/PostgreSQL)

```
backend/
├── app/
│   ├── presentation/
│   │   ├── main.py            # Composition root, CORS, health, mounts /api
│   │   ├── sub.py             # Registers feature routers
│   │   ├── deps.py            # Dependency injection (ports → adapters)
│   │   └── routers/
│   │       ├── auth.py        # register, login, me
│   │       ├── placements.py  # Public internship catalogue
│   │       ├── jobs.py        # Public jobs catalogue
│   │       ├── organization.py# Employer posting
│   │       ├── admin.py       # Admin review, metrics, queue, activity, docs
│   │       ├── user_state.py  # Student profile, resume, docs, applications
│   │       ├── matching.py    # POST /match
│   │       ├── advisor.py     # Career advisor
│   │       ├── billing.py     # Subscription, invoices, payments
│   │       └── webhooks.py    # Payment gateway callbacks
│   │
│   ├── application/
│   │   ├── services.py        # Use-case services (Billing, Placement, Matching, etc.)
│   │   ├── auth.py            # Auth use cases
│   │   ├── advisor.py         # Career advisor prompt composition
│   │   └── ports.py           # Repository & external service interfaces
│   │
│   ├── domain/
│   │   ├── entities.py        # Persistence-independent entities
│   │   └── matching.py        # Pure matching logic (skills, course, CGPA)
│   │
│   ├── infrastructure/
│   │   ├── orm.py             # SQLAlchemy models
│   │   ├── repositories.py    # ORM → domain mapping, repository implementations
│   │   ├── db.py              # Engine, session, ensure_schema (additive migrations)
│   │   ├── seed.py            # Development/test seed data
│   │   └── payment_gateways/
│   │       ├── mock_gateway.py    # 6 mock implementations
│   │       └── factory.py         # Gateway factory
│   │
│   ├── core/
│   │   ├── errors.py          # Domain exceptions
│   │   └── security.py        # JWT, password hashing
│   │
│   └── tests/
│       ├── unit/              # Service & matching tests
│       └── integration/       # HTTP tests (isolated SQLite)
│
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Data Flow

### Authentication Flow

```
┌─────────┐     POST /api/auth/login      ┌─────────┐     Bearer Token      ┌─────────┐
│ Browser │ ─────────────────────────────► │ Backend │ ───────────────────► │ Browser │
│         │ ◄──────────────────────────── │         │ ◄─────────────────── │         │
└─────────┘     {access_token, user}      └─────────┘                      └─────────┘
     │                                                                      │
     │                              GET /api/auth/me                        │
     │ ──────────────────────────────────────────────────────────────────► │
     │ ◄────────────────────────────────────────────────────────────────── │
     │        {id, email, name, role, org_id}                              │
     ▼                                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AppContext                                         │
│  - session: User | null                                                        │
│  - role: "student" | "jobseeker" | "employer" | "admin"                       │
│  - portal: "internships" | "jobs"                                              │
│  - dashboard view routing based on role                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Internship Matching Flow

```
┌─────────┐     POST /api/match      ┌─────────┐     RankedPlacement[]     ┌─────────┐
│ Browser │ ────────────────────────► │ Backend │ ───────────────────────► │ Browser │
│         │ {skills, course, cgpa}    │         │ {placement, match}       │         │
└─────────┘                           └─────────┘                          └─────────┘
                                               │
                                               ▼
                                    ┌─────────────────────────┐
                                    │ MatchingService         │
                                    │ - 60% skill coverage    │
                                    │ - 25% course fit        │
                                    │ - 15% CGPA fit          │
                                    └─────────────────────────┘
```

### Billing Flow (Company Subscription)

```
┌─────────┐     POST /api/billing/subscriptions     ┌─────────┐
│ Browser │ ──────────────────────────────────────► │ Backend │
│         │ {plan, billing_cycle, payment_gateway}  │         │
└─────────┘                                         └────┬────┘
                                                         │
                    ┌───────────────────────────────────┘
                    ▼
           ┌─────────────────────────────────────┐
           │ BillingService (ACID)               │
           │ 1. Lock organisation row            │
           │ 2. Validate plan + gateway          │
           │ 3. Create gateway customer          │
           │ 4. Create gateway subscription      │
           │ 5. Persist local Subscription       │
           │ 6. Create first Invoice             │
           │ 7. Create pending Transaction       │
           │ 8. Attempt payment (if method)      │
           └─────────────────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────────┐
           │ Webhook: payment_intent.succeeded   │
           │ - Update Invoice → "paid"           │
           │ - Update Transaction → "succeeded"  │
           │ - Extend Subscription period        │
           └─────────────────────────────────────┘
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (uses `username` field) |
| GET | `/api/auth/me` | Current user |

### Public Internships
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/placements` | List with filters |
| GET | `/api/placements/{id}` | Detail |
| GET | `/api/placements/meta` | Filter options |

### Authenticated Student
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/saved` | Saved internships |
| POST | `/api/saved/toggle` | Toggle save |
| GET/POST | `/api/applications` | Applications |
| POST | `/api/applications/{id}/withdraw` | Withdraw |
| GET/PUT | `/api/profile` | Profile |
| GET/PUT | `/api/resume` | Resume |
| GET | `/api/documents` | Documents |
| PUT | `/api/documents/{type}` | Upload document |

### Organization (Employer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organization/internships` | My internships |
| POST | `/api/organization/internships` | Create internship |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/metrics` | Dashboard KPIs |
| GET | `/api/admin/queue` | Review queue |
| GET | `/api/admin/activity` | Activity feed |
| GET | `/api/admin/documents` | Document verification |
| PATCH | `/api/admin/documents/{id}/verify` | Verify/reject |
| PATCH | `/api/admin/internships/{id}/review` | Approve/reject |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/subscriptions/current` | Current plan |
| POST | `/api/billing/subscriptions` | Create/upgrade |
| PATCH | `/api/billing/subscriptions/current` | Upgrade/downgrade |
| POST | `/api/billing/subscriptions/current/cancel` | Cancel |
| GET | `/api/billing/invoices` | List invoices |
| POST | `/api/billing/invoices/{id}/pay` | Pay invoice |
| GET | `/api/billing/gateways` | Available gateways |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe events |
| POST | `/api/webhooks/paypal` | PayPal events |
| POST | `/api/webhooks/flutterwave` | Flutterwave events |
| POST | `/api/webhooks/mpesa` | M-Pesa events |
| POST | `/api/webhooks/bank_transfer` | Bank transfer |
| POST | `/api/webhooks/crypto` | Crypto payments |

---

## Deployment

### Backend (Render/Railway/Fly.io)

```bash
cd backend
cp .env.example .env
# Set: DATABASE_URL=postgresql://..., SECRET_KEY=long-random-string
docker build -t brighterworks-api .
docker run --env-file .env -p 8000:8000 brighterworks-api
```

### Frontend (GitHub Pages)

```bash
cd intern
# Set NEXT_PUBLIC_API_BASE_URL in .env.local or CI secrets
npm run build
npm run export  # outputs to /out for GitHub Pages
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon/PostgreSQL connection string |
| `SECRET_KEY` | Yes | JWT signing key (32+ chars) |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Backend URL (e.g. `https://api.example.com/api`) |
| `ENVIRONMENT` | Optional | `production` / `test` / `development` |

### Current Deployed URLs
- **Backend**: `https://global-inetrnship.onrender.com`
- **Frontend**: GitHub Pages (configured to use backend above)

---

## Payment Gateways (Mock Implementations)

| Gateway | ID | Currencies | Region |
|---------|-----|------------|--------|
| Stripe | `stripe` | USD, EUR, GBP, UGX, KES | Global |
| PayPal | `paypal` | USD, EUR, GBP | Global |
| Flutterwave | `flutterwave` | USD, UGX, KES, NGN, GHS, ZAR | Africa |
| M-Pesa | `mpesa` | KES, USD | Kenya |
| Bank Transfer | `bank_transfer` | USD, UGX, EUR, KES | Global |
| Crypto | `crypto` | USDC, USDT, USD | Global |

All gateways implement the `PaymentGateway` port with mock implementations for development.

---

## Testing

```bash
# Backend tests
cd backend
python -m pytest tests/ -v

# Frontend type check
cd intern
npm run build
```

### Test Coverage
- **Backend**: 106 tests passing (unit + integration)
- **Frontend**: TypeScript compilation + production build

---

## Security

- **Authentication**: JWT Bearer tokens, 24h expiry
- **Passwords**: bcrypt hashing (never logged or exposed)
- **Authorization**: Role-based + organization-scoped
- **CORS**: Restricted to frontend origin in production
- **Secrets**: Never committed, loaded from `.env`
- **Database**: Neon/PostgreSQL with connection pooling

---

## License

Proprietary - BrighterWorks Platform

---

## Project Structure Summary

```
BrighterWorks/
├── IMPLEMENTATION.md        # Detailed implementation plan & progress
├── README.md                # This file
├── backend/                 # FastAPI application
│   ├── app/
│   ├── tests/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
└── intern/                  # Next.js 14 + React 18 frontend
    ├── src/
    │   ├── app/
    │   ├── components/
    │   ├── context/
    │   ├── lib/
    │   ├── types/
    │   └── data/
    ├── public/
    ├── package.json
    └── next.config.js
```