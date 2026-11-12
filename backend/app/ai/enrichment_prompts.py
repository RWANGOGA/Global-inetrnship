"""Groq enrichment prompts for student profile analysis.

These prompts are designed to extract structured competency data from 
unstructured professional text using Groq's LLM capabilities.
"""

SYSTEM_PROMPT = """You are an expert career analyst and skills taxonomist. 
Your task is to analyze unstructured professional text and extract structured 
competency data aligned with the ESCO/ONET skill taxonomy.

OUTPUT FORMAT: Strict JSON matching the provided schema.
CONFIDENCE SCORING: 0.0-1.0 for each extracted element.
EVIDENCE REQUIREMENT: Every extracted skill/competency MUST include 
supporting quotes from the source text.
NO HALLUCINATION: Only extract what is explicitly supported by the text."""

SKILL_EXTRACTION_PROMPT = """Extract all technical and professional skills from the text.

For each skill, provide:
1. canonical_name: Standard skill name (use ESCO/ONET preferred terms)
2. aliases: Alternative names/abbreviations found in text
3. category: Skill category (Programming Languages, Frameworks, Data Science, etc.)
4. proficiency_level: 1=Beginner, 2=Intermediate, 3=Advanced
5. confidence: 0.0-1.0 based on evidence strength
6. evidence_quotes: Exact quotes from text supporting this skill
7. years_experience: Estimated from context (null if not stated)
8. learning_context: How skill was acquired (course, project, work, self-taught)

SKILL TAXONOMY REFERENCE (partial):
- Programming Languages: Python, JavaScript, Java, C++, Go, Rust, SQL, R
- Web Frameworks: React, Django, FastAPI, Next.js, Vue, Angular, Spring
- Data Science: pandas, numpy, scikit-learn, TensorFlow, PyTorch, MLflow
- Cloud/DevOps: AWS, GCP, Azure, Docker, Kubernetes, Terraform, CI/CD
- Databases: PostgreSQL, MongoDB, Redis, Elasticsearch, Snowflake
- Soft Skills: Leadership, Communication, Problem Solving, Adaptability
- Domains: FinTech, HealthTech, EdTech, E-commerce, SaaS, AI/ML

TEXT TO ANALYZE:
{text}

OUTPUT SCHEMA:
{
  "skills": [
    {
      "canonical_name": "string",
      "aliases": ["string"],
      "category": "string",
      "proficiency_level": 1,
      "confidence": 0.0,
      "evidence_quotes": ["string"],
      "years_experience": 0.0,
      "learning_context": "string"
    }
  ]
}"""

SOFT_SKILL_EXTRACTION_PROMPT = """Extract soft skills and behavioral competencies from the text.

For each competency, provide:
1. competency: Standard name (Leadership, Communication, etc.)
2. score: 0.0-1.0 proficiency
3. evidence_quotes: Direct quotes demonstrating this competency
4. context: Situation where competency was demonstrated (STAR format if possible)

COMPETENCY FRAMEWORK (based on ESCO transversal competencies):
- Leadership & Management: Leading teams, mentoring, decision-making
- Communication: Written, verbal, presentation, cross-cultural
- Collaboration: Teamwork, conflict resolution, stakeholder management
- Problem Solving: Analytical thinking, creativity, innovation
- Adaptability: Learning agility, resilience, change management
- Initiative: Self-direction, entrepreneurship, ownership
- Organization: Time management, planning, prioritization
- Cultural Awareness: Diversity, inclusion, global mindset

TEXT TO ANALYZE:
{text}

OUTPUT SCHEMA:
{
  "soft_skills": {
    "leadership": 0.0,
    "communication": 0.0,
    "teamwork": 0.0,
    "adaptability": 0.0,
    "problem_solving": 0.0,
    "initiative": 0.0,
    "organization": 0.0,
    "cultural_awareness": 0.0
  },
  "evidence": {
    "leadership": ["quote"],
    "communication": ["quote"]
  }
}"""

CAREER_TRAJECTORY_PROMPT = """Analyze the text to infer career trajectory and aspirations.

Extract:
1. current_career_stage: "student" | "early_career" | "mid_career" | "senior" | "lead_principal"
2. target_roles: Aspired job titles/roles mentioned
3. career_aspirations: Long-term goals, growth directions
4. domain_interests: Industries/domains of interest
5. learning_goals: Skills actively learning or planning to learn
6. work_preferences: Remote/hybrid/onsite, team size, company stage
7. values_signals: Mission-driven, autonomy, stability, growth, impact

TEXT TO ANALYZE:
{text}

OUTPUT SCHEMA:
{
  "current_career_stage": "student",
  "target_roles": ["string"],
  "career_aspirations": ["string"],
  "domain_interests": ["string"],
  "learning_goals": ["string"],
  "work_preferences": "string",
  "values_signals": ["string"]
}"""

CULTURAL_VALUES_PROMPT = """Extract cultural values and work style preferences.

Score each dimension 0.0-1.0 with evidence:
1. autonomy_preference: Independent work vs structured guidance
2. mission_alignment: Purpose-driven vs compensation-driven
3. collaboration_style: async/sync/hybrid preference
4. risk_tolerance: Startup chaos vs enterprise stability
5. learning_appetite: Growth mindset, continuous learning
5. work_life_integration: Balance vs integration preference
7. feedback_receptivity: Growth mindset indicator
8. diversity_value: Inclusion and global mindset

TEXT TO ANALYZE:
{text}

OUTPUT SCHEMA:
{
  "autonomy_preference": 0.0,
  "mission_alignment": 0.0,
  "collaboration_style": "hybrid",
  "risk_tolerance": 0.0,
  "learning_appetite": 0.0,
  "work_life_integration": 0.0,
  "feedback_receptivity": 0.0,
  "diversity_value": 0.0,
  "evidence": {
    "autonomy_preference": ["quote"],
    "mission_alignment": ["quote"]
  }
}"""