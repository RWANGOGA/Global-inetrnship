"""Seed data — the current catalogue, moved out of the frontend's hardcoded
module and into the database. Idempotent per table: orgs/placements are only
inserted when empty, and demo accounts only when the users table is empty, so
repeated startup (and the test harness) is safe.

SENSITIVE DATA (passwords, real emails) are loaded from environment variables.
This file only contains non-sensitive demo data for development.
"""
import os
from datetime import date
from uuid import uuid4
import os

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.infrastructure.orm import JobORM, OrganisationORM, PlacementORM, UserORM

# --- Non-sensitive demo data (safe for public repo) ---

ORGS: list[dict] = [
    {"id": "o1", "name": "Ministry of ICT and National Guidance", "type": "Government", "sector": "Public sector", "loc": "Kampala", "seal": "MIC", "about": "National ministry responsible for digital government services, ICT policy and public-sector innovation."},
    {"id": "o2", "name": "National Information Technology Authority", "type": "Government", "sector": "Public sector", "loc": "Kampala", "seal": "NITA", "about": "Statutory body delivering national ICT infrastructure, e-government systems and digital skills programmes."},
    {"id": "o3", "name": "Kampala Capital City Authority", "type": "Government", "sector": "Public services", "loc": "Kampala", "seal": "KCCA", "about": "City authority responsible for urban planning, transport, sanitation and municipal digital services."},
    {"id": "o4", "name": "Lumen Labs", "type": "Company", "sector": "Design & software", "loc": "Remote, Europe", "seal": "LL", "about": "Product studio building design tooling used by 40,000 teams. Small, senior team, ships weekly."},
    {"id": "o5", "name": "Northwind", "type": "Company", "sector": "Financial technology", "loc": "Berlin, hybrid", "seal": "NW", "about": "Payments infrastructure for small merchants across East Africa and Europe."},
    {"id": "o6", "name": "Atlas Health", "type": "Company", "sector": "Health", "loc": "Nairobi", "seal": "AH", "about": "Primary-care network digitising patient records across 120 clinics."},
    {"id": "o7", "name": "Kite Mobility", "type": "Company", "sector": "Transport", "loc": "Kampala", "seal": "KM", "about": "Route planning and fare payments for minibus operators."},
    {"id": "o8", "name": "Twaweza Foundation", "type": "NGO", "sector": "Civic research", "loc": "Dar es Salaam", "seal": "TW", "about": "Research and advocacy on public service delivery in East Africa."},
    {"id": "o9", "name": "Brac Uganda", "type": "NGO", "sector": "Development", "loc": "Kampala", "seal": "BU", "about": "Development organisation working on livelihoods, education and financial inclusion."},
    {"id": "o10", "name": "Makerere University — School of Computing", "type": "University", "sector": "Research", "loc": "Kampala", "seal": "MU", "about": "Research group on human-computer interaction and public-interest technology."},
]

PLACEMENTS: list[dict] = [
    {"id": "p1", "title": "Product Design Intern", "org_id": "o4", "courses": ["Design", "Computer Science"], "grade": "CGPA 3.0+", "loc": "Remote", "mode": "Remote", "duration": "12 weeks", "stipend": "$2,400 / month", "deadline": "12 Mar 2026", "slots": 4, "status": "Open", "applicants": 41, "docs": ["Transcript", "Student ID", "Portfolio"], "testimonial": True, "about": "You will own one workstream from brief to handover, review weekly with a named mentor and present at the end-of-term critique.", "duties": ["Own one end-to-end product workstream", "Join weekly critiques and ship to production", "Present at the end-of-term review"]},
    {"id": "p2", "title": "Data Analyst Intern", "org_id": "o2", "courses": ["Statistics", "Computer Science", "Economics"], "grade": "Second Class Upper", "loc": "Kampala", "mode": "On-site", "duration": "6 months", "stipend": "UGX 1,200,000 / month", "deadline": "28 Feb 2026", "slots": 6, "status": "Open", "applicants": 87, "docs": ["Transcript", "National ID", "Recommendation letter"], "testimonial": True, "about": "Placement within the national data office, supporting dashboards used by ministries and district offices.", "duties": ["Maintain national indicator dashboards", "Clean and reconcile district datasets", "Prepare monthly briefings"]},
    {"id": "p3", "title": "Software Engineering Intern", "org_id": "o5", "courses": ["Computer Science", "Information Technology", "Engineering"], "grade": "CGPA 3.4+", "loc": "Berlin", "mode": "Hybrid", "duration": "6 months", "stipend": "€1,900 / month", "deadline": "09 Mar 2026", "slots": 3, "status": "Open", "applicants": 120, "docs": ["Transcript", "CV", "Portfolio"], "testimonial": False, "about": "Payments engineering team. You will work on merchant onboarding flows and internal tooling.", "duties": ["Ship features in a two-week cycle", "Write tests for onboarding flows", "Join incident reviews"]},
    {"id": "p4", "title": "Health Records Intern", "org_id": "o6", "courses": ["Public Health", "Statistics", "Information Technology"], "grade": "Second Class Lower", "loc": "Nairobi", "mode": "On-site", "duration": "4 months", "stipend": "KSh 75,000 / month", "deadline": "21 Feb 2026", "slots": 8, "status": "Closing", "applicants": 64, "docs": ["Transcript", "Student ID", "Immunisation card"], "testimonial": True, "about": "Support the digitisation of patient records across a 120-clinic network.", "duties": ["Digitise and validate patient files", "Flag incomplete records", "Support clinic audits"]},
    {"id": "p5", "title": "Frontend Intern", "org_id": "o7", "courses": ["Computer Science", "Design", "Information Technology"], "grade": "CGPA 3.0+", "loc": "Kampala", "mode": "Hybrid", "duration": "6 months", "stipend": "UGX 900,000 / month", "deadline": "05 Mar 2026", "slots": 2, "status": "Open", "applicants": 33, "docs": ["Transcript", "Portfolio"], "testimonial": False, "about": "Build the passenger-facing experience for route planning and fare payment.", "duties": ["Build accessible booking flows", "Improve offline behaviour", "Test with conductors in the field"]},
    {"id": "p6", "title": "Policy Research Assistant", "org_id": "o1", "courses": ["Law", "Economics", "Mass Communication"], "grade": "Second Class Upper", "loc": "Kampala", "mode": "On-site", "duration": "5 months", "stipend": "UGX 1,000,000 / month", "deadline": "18 Mar 2026", "slots": 5, "status": "Open", "applicants": 52, "docs": ["Transcript", "Recommendation letter", "Writing sample"], "testimonial": True, "about": "Support the ICT policy unit with comparative research, briefings and stakeholder mapping.", "duties": ["Draft policy briefs", "Map stakeholder positions", "Support consultation workshops"]},
    {"id": "p7", "title": "Civic Data Intern", "org_id": "o8", "courses": ["Statistics", "Economics", "Public Health"], "grade": "CGPA 3.0+", "loc": "Dar es Salaam", "mode": "Hybrid", "duration": "3 months", "stipend": "TZS 700,000 / month", "deadline": "02 Apr 2026", "slots": 4, "status": "Open", "applicants": 29, "docs": ["Transcript", "Student ID", "Writing sample"], "testimonial": False, "about": "Work with the survey team on public service delivery data used in national advocacy.", "duties": ["Clean survey data", "Produce district summaries", "Support field enumerators"]},
    {"id": "p8", "title": "Urban Planning Intern", "org_id": "o3", "courses": ["Engineering", "Economics", "Design"], "grade": "Second Class Lower", "loc": "Kampala", "mode": "On-site", "duration": "6 months", "stipend": "UGX 850,000 / month", "deadline": "25 Feb 2026", "slots": 3, "status": "Closing", "applicants": 47, "docs": ["Transcript", "Student ID", "Recommendation letter"], "testimonial": True, "about": "Support the planning directorate on transport corridors and market redevelopment.", "duties": ["Survey corridor usage", "Draft planning notes", "Support community consultations"]},
    {"id": "p9", "title": "Development Programmes Intern", "org_id": "o9", "courses": ["Business", "Economics", "Public Health"], "grade": "Second Class Lower", "loc": "Kampala", "mode": "On-site", "duration": "4 months", "stipend": "UGX 750,000 / month", "deadline": "30 Mar 2026", "slots": 7, "status": "Open", "applicants": 71, "docs": ["Transcript", "National ID", "Recommendation letter"], "testimonial": True, "about": "Support field programme delivery and monitoring across three districts.", "duties": ["Support monitoring visits", "Maintain programme records", "Draft field notes"]},
    {"id": "p10", "title": "HCI Research Assistant", "org_id": "o10", "courses": ["Computer Science", "Design", "Statistics"], "grade": "CGPA 3.6+", "loc": "Kampala", "mode": "On-site", "duration": "10 weeks", "stipend": "UGX 700,000 / month", "deadline": "15 Mar 2026", "slots": 2, "status": "Open", "applicants": 18, "docs": ["Transcript", "Recommendation letter", "Writing sample"], "testimonial": True, "about": "Join a research group studying public-interest technology in Kampala.", "duties": ["Run interview studies", "Code and synthesise transcripts", "Co-author a short paper"]},
    {"id": "p11", "title": "Brand Design Intern", "org_id": "o4", "courses": ["Design", "Mass Communication"], "grade": "CGPA 3.0+", "loc": "Remote", "mode": "Remote", "duration": "8 weeks", "stipend": "$1,200 / month", "deadline": "20 Apr 2026", "slots": 2, "status": "Open", "applicants": 26, "docs": ["Portfolio", "CV"], "testimonial": False, "about": "Identity and campaign design for a studio launch.", "duties": ["Build identity variants", "Produce campaign assets", "Document the system"]},
    {"id": "p12", "title": "Monitoring & Evaluation Intern", "org_id": "o2", "courses": ["Statistics", "Economics", "Business"], "grade": "Second Class Upper", "loc": "Kampala", "mode": "On-site", "duration": "5 months", "stipend": "UGX 950,000 / month", "deadline": "08 Apr 2026", "slots": 4, "status": "Open", "applicants": 39, "docs": ["Transcript", "Student ID", "Writing sample"], "testimonial": True, "about": "Track outcomes across national digital skills programmes.", "duties": ["Maintain indicator frameworks", "Run quarterly reviews", "Produce analysis notes"]},
    # Gig example
    {"id": "p13", "title": "Website Redesign Gig", "org_id": "o4", "courses": ["Design", "Computer Science"], "grade": "CGPA 2.5+", "loc": "Remote", "mode": "Remote", "duration": "4 weeks", "stipend": "$1,500 flat", "deadline": "15 Mar 2026", "slots": 1, "status": "Open", "applicants": 12, "docs": ["Portfolio"], "testimonial": False, "about": "Redesign the marketing website for a product launch. Deliver Figma mockups and a style guide.", "duties": ["Audit current site", "Design new pages in Figma", "Deliver component library"], "opportunity_type": "gig", "duration_hours": 40, "budget_range": "$1,000-$2,000", "milestones": ["Discovery & audit", "Wireframes", "High-fidelity mockups", "Style guide & handoff"], "remote_ok": True, "skills_required": ["Figma", "UI Design", "Design Systems"]},
    # Entry-level example
    {"id": "p14", "title": "Junior Data Analyst", "org_id": "o2", "courses": ["Statistics", "Computer Science", "Economics"], "grade": "Second Class Lower", "loc": "Kampala", "mode": "On-site", "duration": "12 months", "stipend": "UGX 2,500,000 / month", "deadline": "30 Apr 2026", "slots": 3, "status": "Open", "applicants": 45, "docs": ["Transcript", "National ID", "Recommendation letter"], "testimonial": False, "about": "Full-time entry-level role analysing public sector data. Includes structured onboarding and mentorship.", "duties": ["Build and maintain dashboards", "Analyse district-level indicators", "Present findings to stakeholders"], "opportunity_type": "entry_level", "salary_range": "UGX 2,200,000 - 3,000,000 / month", "probation_period": "3 months", "training_included": True, "career_path": "Progress to Senior Data Analyst within 18 months", "skills_required": ["SQL", "Excel", "Data Cleaning", "Dashboards", "Statistics"]},
]

JOBS: list[dict] = [
    {"id": "j1", "title": "Junior Product Designer", "org_id": "o4", "loc": "Remote", "mode": "Remote", "employment_type": "Full time", "salary": "$1,800 / month", "closes_at": "2026-12-15", "summary": "Design clear product experiences with a small senior team.", "requirements": ["Figma", "UI Design", "Portfolio"], "status": "Open", "review_status": "approved"},
    {"id": "j2", "title": "Graduate Data Analyst", "org_id": "o2", "loc": "Kampala", "mode": "On-site", "employment_type": "Full time", "salary": "UGX 2,000,000 / month", "closes_at": "2026-12-10", "summary": "Turn public-sector datasets into useful decisions and reports.", "requirements": ["SQL", "Excel", "Statistics"], "status": "Open"},
    {"id": "j3", "title": "Software Engineer I", "org_id": "o5", "loc": "Berlin", "mode": "Hybrid", "employment_type": "Full time", "salary": "€3,200 / month", "closes_at": "2026-12-20", "summary": "Build reliable payment tools for merchants across East Africa.", "requirements": ["Python", "APIs", "Git"], "status": "Open"},
    {"id": "j4", "title": "Monitoring and Evaluation Officer", "org_id": "o9", "loc": "Kampala", "mode": "On-site", "employment_type": "Full time", "salary": "UGX 2,400,000 / month", "closes_at": "2026-12-08", "summary": "Support evidence-led programmes that improve livelihoods.", "requirements": ["Monitoring & Evaluation", "Report Writing"], "status": "Open"},
]

# --- Sensitive data loaded from environment variables ---

DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "password123")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")

DEMO_USERS: list[dict] = [
    {"email": "amina@makerere.ac.ug", "name": "Amina Nakato", "role": "student"},
    {"email": "brian@example.com", "name": "Brian Ssekandi", "role": "jobseeker"},
    {"email": "hiring@lumenlabs.example", "name": "Lumen Labs", "role": "employer", "org_id": "o4"},
    {"email": "office@makerere.ac.ug", "name": "Makerere University", "role": "admin"},
    {"email": ADMIN_EMAIL, "name": "Admin User", "role": "admin", "password": ADMIN_PASSWORD},
]


def seed_if_empty(session: Session) -> None:
    if session.query(OrganisationORM).count() == 0:
        session.add_all([OrganisationORM(**org) for org in ORGS])
        session.add_all([PlacementORM(**p) for p in PLACEMENTS])
        session.commit()
    if session.query(JobORM).count() == 0:
        session.add_all([JobORM(**job) for job in JOBS])
        session.commit()
    if session.query(UserORM).count() == 0:
        today = date.today().isoformat()
        session.add_all(
            [
                UserORM(
                    id=uuid4().hex,
                    email=u["email"],
                    name=u["name"],
                    role=u["role"],
                    password_hash=hash_password(u.get("password", DEMO_PASSWORD)),
                    created_at=today,
                    org_id=u.get("org_id"),
                )
                for u in DEMO_USERS
            ]
        )
        session.commit()
    else:
        # Ensure admin user exists with correct role (handles pre-existing student accounts)
        admin_email = "akandwanahojonanrwangoga@gmail.com"
        admin_user = session.query(UserORM).filter_by(email=admin_email).first()
        if admin_user and admin_user.role != "admin":
            admin_user.role = "admin"
            admin_user.password_hash = hash_password(ADMIN_PASSWORD)
            session.commit()
        elif not admin_user:
            today = date.today().isoformat()
            session.add(
                UserORM(
                    id=uuid4().hex,
                    email=admin_email,
                    name="Admin User",
                    role="admin",
                    password_hash=hash_password(ADMIN_PASSWORD),
                    created_at=today,
                )
            )
            session.commit()

    # Backfill the employer→org link on accounts that predate the org_id column
    # (the real Neon database was seeded before R1d, so its employer row still
    # has org_id NULL). Idempotent and scoped to rows that are still unlinked,
    # so it never overwrites a deliberate change.
    for u in DEMO_USERS:
        desired = u.get("org_id")
        if not desired:
            continue
        row = session.query(UserORM).filter_by(email=u["email"], org_id=None).first()
        if row is not None:
            row.org_id = desired
            session.commit()
