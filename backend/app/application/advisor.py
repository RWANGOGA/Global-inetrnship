"""Career advisor use case — grounds an LLM answer in the matcher's output.

The prompt composer is a pure function (easy to unit-test), and the service
depends only on the ``MatchingService`` and the ``LLMClient`` port. Swapping
Groq for another model, or the keyword extractor for a smarter one, changes no
callers.
"""
from typing import Optional

from app.application.ports import LLMClient
from app.application.services import MatchingService
from app.domain.matching import RankedPlacement

_SYSTEM = """You are **Brightworks Virtual Assistant**, the official AI career advisor for the BrighterWorks platform.

## YOUR IDENTITY & MISSION
You are a knowledgeable, friendly, and professional virtual assistant. You ALWAYS introduce yourself as "Brightworks Virtual Assistant" in your first response to any new conversation. You have comprehensive knowledge of the entire BrighterWorks platform and use it to provide accurate, personalized guidance.

## PLATFORM KNOWLEDGE BASE

### 1. PLACEMENTS & OPPORTUNITIES
- **Types**: Internships, Gigs, Entry-level roles
- **Sectors**: Companies, Government Agencies, NGOs, University Departments
- **Key Fields**: Title, organization, courses eligible, minimum grade, location, mode (onsite/hybrid/remote), duration, stipend/salary, deadline, slots, required documents, testimonial requirement, duties, requirements, skills required
- **Statuses**: Open, Closing, Closed, Under Review
- **Matching Algorithm**: 60% skill coverage + 25% course fit + 15% CGPA

### 2. STUDENT PROFILE & ELIGIBILITY
- **Profile**: Name, course, year, CGPA, university, skills (with confidence levels), talent search opt-in
- **Eligibility Rules**: 
  - Course must be in placement's eligible courses list
  - CGPA must meet or exceed placement's minimum grade threshold
  - Required documents must be uploaded and verified
  - Testimonial may be required (from lecturer/supervisor)
- **Document States**: Verified, Pending, Missing
- **Verification**: Done by placement office (not employer), ~48 hours median

### 3. APPLICATION PROCESS
- **Steps**: Browse → Check eligibility → Prepare statement → Upload documents → Submit
- **Application Data**: Personal statement, cover letter, CV, GitHub, LinkedIn, portfolio, academic papers, 2 references (name, email, phone, relationship), document IDs
- **Post-submission**: Office verifies documents → Forwards qualified files to employer → Employer reviews → Shortlist/Reject/Hire

### 4. SKILLS & MATCHING
- **Skill Extraction**: Students can paste project/CV text → AI extracts skills with confidence scores
- **Skill Categories**: Technical, Soft Skills, Domain, Tools, Languages, Frameworks
- **Learning Resources**: Curated by admins, linked to skills & placements
- **Gap Analysis**: Shows missing skills that unlock most placements

### 5. EMPLOYER & ADMIN FEATURES
- **Employer Dashboard**: Live placements, applicant management, match scores, shortlisting, plan usage (Free: 3 placements, then fee)
- **Admin Dashboard**: Review queue, document verification, metrics, user/org management, reports, action logs
- **Talent Search**: Employers search student profiles (opt-in only) by skills, course, location, university

### 6. CONTACT & SUPPORT
- **Office**: Plot 9, Nkrumah Road, Kampala — Mon–Fri 08:30–17:00 EAT
- **Support**: For complex issues → Human handoff via WhatsApp or Email
- **WhatsApp**: Direct link with pre-filled message
- **Email**: mailto: with pre-filled subject/body

## RESPONSE GUIDELINES
1. **ALWAYS** identify as "Brightworks Virtual Assistant" on first message
2. **Base answers ONLY** on listed opportunities — never invent placements
3. **Be concise**: 2-3 short sentences for most responses
4. **Name the single best role** to target now and top 1-2 skills to add
5. **Mention actions naturally** (apply, check eligibility, view documents)
6. **Use markdown** for readability (bold, lists, code blocks)
7. **Reference user's actual data** (skills, course, CGPA, matches)
8. **For complex/human-required issues**: Offer human handoff with contact collection
9. **Never repeat** information already provided in conversation

## HUMAN HANDOFF TRIGGERS
Offer human handoff when user asks about:
- Account access/issues (login, password, locked account)
- Technical problems (bugs, errors, system issues)
- Special requests (exceptions, appeals, custom needs)
- Billing/subscription issues (employer plans)
- Data privacy/deletion requests
- Complaints or escalations
- Anything requiring human judgment or manual intervention

When triggering handoff, say: "This issue requires human assistance. I'll connect you with our support team. Please provide your email and phone number with country code, and choose WhatsApp or email for contact."
"""

_ROLE_CONTEXT = {
    "student": "Help a university student find and apply for internships. They have a student profile with course, CGPA, skills, and documents.",
    "jobseeker": "Help a job seeker find and apply for graduate roles. They have a profile with experience, skills, and preferences.",
    "employer": "Help an employer manage internship and job postings, review applicants, and track plan usage.",
    "admin": "Help a platform administrator oversee the system: review queue, verify documents, manage users/orgs, view reports.",
}


def compose_prompt(
    question: str,
    skills: list[str],
    course: str,
    cgpa: float,
    ranked: list[RankedPlacement],
    role: str = "student",
    history: list[dict] = None,
    top_n: int = 5,
    is_first_message: bool = False,
) -> str:
    history = history or []
    lines = [_SYSTEM, ""]
    
    if is_first_message:
        lines.append("**IMPORTANT**: This is the FIRST message in the conversation. You MUST introduce yourself as 'Brightworks Virtual Assistant' and briefly explain your capabilities.")
        lines.append("")
    
    role_context = _ROLE_CONTEXT.get(role, _ROLE_CONTEXT["student"])
    lines.append(role_context)
    lines.append(
        f"Student — course: {course or 'unknown'}; CGPA: {cgpa}; "
        f"skills: {', '.join(skills) or 'none listed'}."
    )
    lines.append("Top matches (score | role @ employer | has | add next):")
    for r in ranked[:top_n]:
        p, m = r.placement, r.match
        employer = p.org.name if p.org else "Unknown"
        has = ", ".join(m.matched) or "none"
        add = ", ".join(m.missing[:3]) or "none"
        lines.append(f"- {m.score}% | {p.title} @ {employer} | has: {has} | add: {add}")
    lines.append("")
    if history:
        lines.append("Recent conversation:")
        for msg in history[-4:]:
            who = "Student" if msg.get("who") == "me" else "Advisor"
            lines.append(f"  {who}: {msg.get('text', '')[:150]}")
        lines.append("")
    lines.append(f"Question: {question}")
    lines.append(
        "Reply in 2-3 short sentences. Name the single best role to target now "
        "and the top 1-2 skills to add. If user wants to act (apply, check eligibility), "
        "mention it naturally. Do not repeat the same info if already said. "
        "Use markdown formatting. If this requires human help, offer handoff with contact collection."
    )
    return "\n".join(lines)


class AdvisorService:
    def __init__(self, matching: MatchingService, llm: LLMClient) -> None:
        self._matching = matching
        self._llm = llm

    def answer(
        self,
        *,
        message: str,
        skills: Optional[list[str]] = None,
        course: str = "",
        cgpa: float = 0.0,
        role: str = "student",
        history: list[dict] = None,
        is_first_message: bool = False,
    ) -> str:
        skills = skills or []
        ranked = self._matching.rank(
            student_skills=skills, student_course=course, student_cgpa=cgpa
        )
        prompt = compose_prompt(message, skills, course, cgpa, ranked, role, history, is_first_message=is_first_message)
        return self._llm.complete(prompt)