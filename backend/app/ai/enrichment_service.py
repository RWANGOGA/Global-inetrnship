"""Groq-powered student profile enrichment from unstructured text.

This service takes a student's personal statement/bio and extracts:
- Technical skills with proficiency levels and evidence
- Soft skills with evidence
- Career trajectory and aspirations
- Cultural values and work preferences
- Embeddings for semantic matching
"""
import json
import asyncio
from typing import Optional, List
from dataclasses import asdict
from enum import Enum

import groq

from app.domain.entities import (
    SkillCompetency, SoftSkillProfile, CareerTrajectory,
    CulturalValues, AdvancedStudentProfile, ProficiencyLevel, CareerStage
)
from app.ai.enrichment_prompts import (
    SYSTEM_PROMPT, SKILL_EXTRACTION_PROMPT, SOFT_SKILL_EXTRACTION_PROMPT,
    CAREER_TRAJECTORY_PROMPT, CULTURAL_VALUES_PROMPT
)
from app.core.config import get_settings
from app.core.errors import LLMNotConfigured


class ProficiencyLevel(Enum):
    BEGINNER = 1
    INTERMEDIATE = 2
    ADVANCED = 3


class CareerStage(Enum):
    STUDENT = "student"
    EARLY_CAREER = "early_career"
    MID_CAREER = "mid_career"
    SENIOR = "senior"
    LEAD_PRINCIPAL = "lead_principal"


class GroqEnrichmentService:
    """Groq-powered student profile enrichment from unstructured text."""
    
    def __init__(self):
        settings = get_settings()
        self._api_key = settings.groq_api_key
        self._model = settings.groq_model or "llama-3.3-70b-versatile"
        self._client = None
        if self._api_key:
            self._client = groq.AsyncGroq(api_key=self._api_key)
        
        # Initialize embedder for semantic matching (lazy loading)
        self._embedder = None
        self._skill_taxonomy = self._load_skill_taxonomy()
    
    def _get_embedder(self):
        """Lazy load embedder to avoid import issues."""
        if self._embedder is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._embedder = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception:
                self._embedder = False  # Mark as unavailable
        return self._embedder if self._embedder is not False else None
    
    def _load_skill_taxonomy(self) -> dict:
        """Load skill taxonomy for validation."""
        return {
            "python": {"id": "skill_001", "category": "Programming Languages"},
            "javascript": {"id": "skill_002", "category": "Programming Languages"},
            "typescript": {"id": "skill_003", "category": "Programming Languages"},
            "java": {"id": "skill_004", "category": "Programming Languages"},
            "c++": {"id": "skill_005", "category": "Programming Languages"},
            "go": {"id": "skill_006", "category": "Programming Languages"},
            "rust": {"id": "skill_007", "category": "Programming Languages"},
            "sql": {"id": "skill_008", "category": "Programming Languages"},
            "r": {"id": "skill_009", "category": "Programming Languages"},
            "react": {"id": "skill_010", "category": "Web Frameworks"},
            "django": {"id": "skill_011", "category": "Web Frameworks"},
            "fastapi": {"id": "skill_012", "category": "Web Frameworks"},
            "next.js": {"id": "skill_013", "category": "Web Frameworks"},
            "vue": {"id": "skill_013", "category": "Web Frameworks"},
            "angular": {"id": "skill_014", "category": "Web Frameworks"},
            "spring": {"id": "skill_015", "category": "Web Frameworks"},
            "pandas": {"id": "skill_016", "category": "Data Science"},
            "numpy": {"id": "skill_017", "category": "Data Science"},
            "scikit-learn": {"id": "skill_018", "category": "Data Science"},
            "tensorflow": {"id": "skill_019", "category": "Data Science"},
            "pytorch": {"id": "skill_020", "category": "Data Science"},
            "mlflow": {"id": "skill_021", "category": "Data Science"},
            "aws": {"id": "skill_022", "category": "Cloud/DevOps"},
            "gcp": {"id": "skill_023", "category": "Cloud/DevOps"},
            "azure": {"id": "skill_024", "category": "Cloud/DevOps"},
            "docker": {"id": "skill_025", "category": "Cloud/DevOps"},
            "kubernetes": {"id": "skill_026", "category": "Cloud/DevOps"},
            "terraform": {"id": "skill_027", "category": "Cloud/DevOps"},
            "ci/cd": {"id": "skill_028", "category": "Cloud/DevOps"},
            "postgresql": {"id": "skill_029", "category": "Databases"},
            "mongodb": {"id": "skill_030", "category": "Databases"},
            "redis": {"id": "skill_031", "category": "Databases"},
            "elasticsearch": {"id": "skill_032", "category": "Databases"},
            "snowflake": {"id": "skill_033", "category": "Databases"},
            "leadership": {"id": "skill_034", "category": "Soft Skills"},
            "communication": {"id": "skill_035", "category": "Soft Skills"},
            "problem solving": {"id": "skill_036", "category": "Soft Skills"},
            "adaptability": {"id": "skill_037", "category": "Soft Skills"},
        }
    
    def is_configured(self) -> bool:
        return self._client is not None
    
    def _get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Get embeddings for a list of texts."""
        embedder = self._get_embedder()
        if embedder:
            return embedder.encode(texts).tolist()
        # Fallback: return zero vectors
        return [[0.0] * 384 for _ in texts]
    
    async def enrich_from_statement(
        self, 
        user_id: str,
        personal_statement: str,
        existing_skills: List[str] = None,
        course: str = "",
        university: str = "",
        cgpa: float = 0.0,
    ) -> AdvancedStudentProfile:
        """Full enrichment pipeline from personal statement."""
        
        if not self.is_configured():
            raise LLMNotConfigured("Groq is not configured. Set GROQ_API_KEY in settings.")
        
        # Run all extraction stages in parallel
        skills_task = self._extract_skills(personal_statement)
        soft_skills_task = self._extract_soft_skills(personal_statement)
        trajectory_task = self._extract_career_trajectory(personal_statement)
        cultural_task = self._extract_cultural_values(personal_statement)
        
        skills_data, soft_skills_data, trajectory_data, cultural_data = await asyncio.gather(
            skills_task, soft_skills_task, trajectory_task, cultural_task
        )
        
        # Build structured competencies
        skills = self._build_skill_competencies(skills_data, existing_skills or [])
        
        # Generate embeddings
        bio_embedding = self._get_embeddings([personal_statement])[0]
        skills_text = " ".join([s.canonical_name for s in skills])
        skills_embedding = self._get_embeddings([skills_text])[0]
        bio_vec = self._get_embeddings([personal_statement])[0]
        skills_vec = self._get_embeddings([skills_text])[0]
        profile_embedding = [(a + b) / 2 for a, b in zip(bio_vec, skills_vec)]
        
        # Parse career stage
        stage_str = trajectory_data.get("current_career_stage", "student")
        try:
            career_stage = CareerStage(stage_str)
        except ValueError:
            career_stage = CareerStage.STUDENT
        
        # Parse collaboration style
        collab_style = cultural_data.get("collaboration_style", "hybrid")
        
        return AdvancedStudentProfile(
            user_id=user_id,
            skills=skills,
            career_trajectory=CareerTrajectory(
                current_stage=career_stage,
                target_roles=trajectory_data.get("target_roles", []),
                career_aspirations=trajectory_data.get("career_aspirations", []),
                domain_interests=trajectory_data.get("domain_interests", []),
                learning_goals=trajectory_data.get("learning_goals", []),
                work_preferences=trajectory_data.get("work_preferences", ""),
                values_signals=trajectory_data.get("values_signals", []),
            ),
            soft_skills=SoftSkillProfile(
                leadership=soft_skills_data.get("soft_skills", {}).get("leadership", 0.0),
                communication=soft_skills_data.get("soft_skills", {}).get("communication", 0.0),
                teamwork=soft_skills_data.get("soft_skills", {}).get("teamwork", 0.0),
                adaptability=soft_skills_data.get("soft_skills", {}).get("adaptability", 0.0),
                problem_solving=soft_skills_data.get("soft_skills", {}).get("problem_solving", 0.0),
                initiative=soft_skills_data.get("soft_skills", {}).get("initiative", 0.0),
                organization=soft_skills_data.get("soft_skills", {}).get("organization", 0.0),
                cultural_awareness=soft_skills_data.get("soft_skills", {}).get("cultural_awareness", 0.0),
            ),
            cultural_values=CulturalValues(
                autonomy_preference=cultural_data.get("autonomy_preference", 0.5),
                mission_alignment=cultural_data.get("mission_alignment", 0.5),
                collaboration_style=collab_style,
                risk_tolerance=cultural_data.get("risk_tolerance", 0.5),
                learning_appetite=cultural_data.get("learning_appetite", 0.5),
                work_life_integration=cultural_data.get("work_life_integration", 0.5),
                feedback_receptivity=cultural_data.get("feedback_receptivity", 0.5),
                diversity_value=cultural_data.get("diversity_value", 0.5),
            ),
            profile_embedding=profile_embedding,
            skills_embedding=skills_embedding,
            bio_embedding=bio_embedding,
            course=course,
            university=university,
            cgpa=cgpa,
            graduation_year=self._estimate_graduation_year(),
            location_preferences=self._extract_locations(personal_statement),
            remote_ok=self._check_remote_openness(personal_statement),
            availability=self._extract_availability(personal_statement),
        )
    
    async def _extract_skills(self, text: str) -> dict:
        """Stage 2: Skill entity extraction with Groq."""
        prompt = SKILL_EXTRACTION_PROMPT.format(text=text)
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    async def _extract_soft_skills(self, text: str) -> dict:
        prompt = SOFT_SKILL_EXTRACTION_PROMPT.format(text=text)
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=3000,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    async def _extract_career_trajectory(self, text: str) -> dict:
        prompt = CAREER_TRAJECTORY_PROMPT.format(text=text)
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    async def _extract_cultural_values(self, text: str) -> dict:
        prompt = CULTURAL_VALUES_PROMPT.format(text=text)
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    def _build_skill_competencies(
        self, 
        skills_data: dict, 
        existing_skills: List[str]
    ) -> List[SkillCompetency]:
        """Map extracted skills to canonical taxonomy with confidence."""
        competencies = []
        existing_set = set(s.lower() for s in existing_skills)
        
        for skill_data in skills_data.get("skills", []):
            canonical = skill_data["canonical_name"].lower()
            
            # Validate against taxonomy
            if canonical not in self._skill_taxonomy:
                continue
                
            # Boost confidence if student already has this skill
            confidence = skill_data.get("confidence", 0.5)
            if canonical in existing_set:
                confidence = min(1.0, confidence + 0.2)
            
            try:
                proficiency = ProficiencyLevel(skill_data.get("proficiency_level", 1))
            except ValueError:
                proficiency = ProficiencyLevel.BEGINNER
            
            competencies.append(SkillCompetency(
                skill_id=self._skill_taxonomy[canonical]["id"],
                canonical_name=skill_data["canonical_name"],
                aliases=skill_data.get("aliases", []),
                category=skill_data.get("category", "Uncategorized"),
                proficiency=proficiency,
                confidence_score=confidence,
                evidence=skill_data.get("evidence_quotes", []),
                years_experience=skill_data.get("years_experience"),
                last_used=None,
                learning_velocity=skill_data.get("learning_velocity", 0.0),
            ))
        
        return competencies
    
    def _estimate_graduation_year(self) -> int:
        from datetime import datetime
        return datetime.now().year + 1
    
    def _extract_locations(self, text: str) -> List[str]:
        locations = []
        text_lower = text.lower()
        common_locations = [
            "kampala", "nairobi", "dar es salaam", "kigali", "addis ababa",
            "remote", "hybrid", "onsite", "berlin", "london", "new york",
            "san francisco", "toronto", "singapore", "dubai"
        ]
        for loc in common_locations:
            if loc in text_lower:
                locations.append(loc.title())
        return locations
    
    def _check_remote_openness(self, text: str) -> bool:
        text_lower = text.lower()
        remote_keywords = ["remote", "distributed", "work from home", "wfh", "anywhere"]
        return any(kw in text_lower for kw in remote_keywords)
    
    def _extract_availability(self, text: str) -> str:
        text_lower = text.lower()
        if "full-time" in text_lower or "fulltime" in text_lower:
            return "full-time"
        elif "part-time" in text_lower or "parttime" in text_lower:
            return "part-time"
        elif "contract" in text_lower or "freelance" in text_lower:
            return "project-based"
        return "full-time"