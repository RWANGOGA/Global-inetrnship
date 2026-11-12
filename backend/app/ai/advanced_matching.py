"""Advanced matching engine with multi-layer scoring for AI-driven career matching.

This engine implements a 5-layer matching pipeline:
1. Semantic embedding similarity
2. Structured competency matching with proficiency weighting
3. Career trajectory alignment
4. Cultural & soft skill fit
5. Market intelligence context
"""
import numpy as np
import networkx as nx
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from app.domain.entities import (
    AdvancedStudentProfile,
    AdvancedPlacementProfile,
    SkillCompetency,
    ProficiencyLevel,
    CareerStage,
    CareerTrajectory,
    CulturalValues,
    SoftSkillProfile,
)


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


@dataclass
class MatchLayerScore:
    """Score breakdown for one matching layer."""
    layer_name: str
    score: float              # 0-100
    weight: float             # 0.0-1.0
    confidence: float         # 0.0-1.0
    evidence: dict            # Explainability data


@dataclass
class AdvancedMatchResult:
    """Complete match result with full explainability."""
    placement_id: str
    overall_score: float      # 0-100
    confidence: float         # 0-100
    layer_scores: list[MatchLayerScore]
    matched_skills: list[str]
    missing_skills: list[str]
    skill_gaps: list[dict]    # skill, importance, learning_path
    cultural_fit_breakdown: dict
    trajectory_alignment: dict
    market_context: dict
    explanation: str          # Human-readable summary
    recommendation_tier: str  # "highly_recommended", "recommended", "consider"


class SkillGraph:
    """Skill adjacency graph for adjacency-based matching."""
    
    def __init__(self):
        self.graph = nx.Graph()
        self._build_default_graph()
    
    def _build_default_graph(self):
        """Build default skill adjacency graph."""
        # Define skill relationships (skill -> [(related_skill, weight), ...])
        relationships = {
            "python": [("pandas", 0.9), ("numpy", 0.9), ("scikit-learn", 0.8), ("django", 0.7), ("fastapi", 0.8), ("tensorflow", 0.6), ("pytorch", 0.6)],
            "javascript": [("react", 0.9), ("typescript", 0.9), ("node.js", 0.8), ("vue", 0.7), ("next.js", 0.8)],
            "typescript": [("javascript", 0.9), ("react", 0.8), ("node.js", 0.7)],
            "react": [("javascript", 0.9), ("typescript", 0.8), ("redux", 0.7), ("next.js", 0.8)],
            "django": [("python", 0.9), ("postgresql", 0.7), ("redis", 0.6)],
            "fastapi": [("python", 0.9), ("pydantic", 0.8), ("sqlalchemy", 0.7)],
            "pandas": [("python", 0.9), ("numpy", 0.9), ("scikit-learn", 0.8), ("matplotlib", 0.7)],
            "numpy": [("python", 0.9), ("pandas", 0.9), ("scipy", 0.8)],
            "scikit-learn": [("python", 0.9), ("pandas", 0.8), ("numpy", 0.8), ("tensorflow", 0.6), ("pytorch", 0.6)],
            "tensorflow": [("python", 0.8), ("pytorch", 0.7), ("keras", 0.8)],
            "pytorch": [("python", 0.8), ("tensorflow", 0.7), ("torchvision", 0.7)],
            "docker": [("kubernetes", 0.8), ("ci/cd", 0.7), ("aws", 0.6)],
            "kubernetes": [("docker", 0.8), ("helm", 0.7), ("aws", 0.6)],
            "aws": [("docker", 0.6), ("kubernetes", 0.6), ("terraform", 0.7)],
            "postgresql": [("sql", 0.9), ("redis", 0.6), ("django", 0.7)],
            "sql": [("postgresql", 0.9), ("mysql", 0.8), ("sqlite", 0.6)],
        }
        
        for skill, relations in relationships.items():
            self.graph.add_node(skill)
            for related, weight in relations:
                self.graph.add_node(related)
                self.graph.add_edge(skill, related, weight=weight)
    
    def get_adjacency_bonus(self, target_skill: str, student_skills: Dict[str, Any]) -> float:
        """Calculate adjacency bonus for a target skill given student skills."""
        if target_skill not in self.graph:
            return 0.0
        
        max_bonus = 0.0
        for neighbor in self.graph.neighbors(target_skill):
            if neighbor in student_skills:
                edge_data = self.graph.get_edge_data(target_skill, neighbor)
                weight = edge_data.get("weight", 0.5) if edge_data else 0.5
                student_prof = student_skills[neighbor].proficiency.value / 3.0
                bonus = weight * student_prof
                max_bonus = max(max_bonus, bonus)
        
        return max_bonus


class MarketIntelligence:
    """Market intelligence service for contextual matching."""
    
    def __init__(self):
        # In production, this would query a database or external API
        self._skill_demand = self._load_default_demand()
        self._role_scarcity = self._load_default_scarcity()
    
    def _load_default_demand(self) -> Dict[str, float]:
        """Load default skill demand scores (0.0-1.0)."""
        return {
            "python": 0.95, "javascript": 0.93, "react": 0.92, "typescript": 0.88,
            "aws": 0.90, "kubernetes": 0.85, "docker": 0.88, "postgresql": 0.82,
            "react": 0.92, "django": 0.78, "fastapi": 0.75, "tensorflow": 0.80,
            "pytorch": 0.82, "sql": 0.95, "kubernetes": 0.85, "go": 0.78,
            "rust": 0.65, "java": 0.85, "c++": 0.72, "go": 0.78,
        }
    
    def _load_default_scarcity(self) -> Dict[str, float]:
        """Load default role scarcity scores (0.0-1.0)."""
        return {
            ("senior", "Company"): 0.85,
            ("mid_career", "Company"): 0.70,
            ("early_career", "Company"): 0.50,
            ("student", "Company"): 0.40,
            ("senior", "Government"): 0.60,
            ("mid_career", "Government"): 0.55,
            ("early_career", "Government"): 0.45,
            ("student", "Government"): 0.35,
            ("senior", "NGO"): 0.50,
            ("mid_career", "NGO"): 0.45,
            ("early_career", "NGO"): 0.40,
            ("student", "NGO"): 0.30,
        }
    
    def get_skill_demand(self, skill: str) -> float:
        """Get demand score for a skill (0.0-1.0)."""
        return self._skill_demand.get(skill.lower(), 0.5)
    
    def get_role_scarcity(self, experience_level: str, org_type: str) -> float:
        """Get role scarcity score (0.0-1.0)."""
        return self._role_scarcity.get((experience_level, org_type), 0.5)


# Global instances
_skill_graph = SkillGraph()
_market_intel = MarketIntelligence()


class AdvancedMatchingEngine:
    """Multi-layer ensemble matching engine."""
    
    def __init__(
        self,
        embedding_model=None,  # SentenceTransformer or None for testing
        skill_graph: SkillGraph = None,
        market_intel: MarketIntelligence = None,
    ):
        self.embedder = embedding_model
        self.skill_graph = skill_graph or _skill_graph
        self.market = market_intel or _market_intel
        
        # Default ensemble weights (configurable per org/type)
        self.layer_weights = {
            "semantic": 0.25,
            "competency": 0.30,
            "trajectory": 0.20,
            "cultural": 0.15,
            "market": 0.10,
        }
    
    def match(
        self,
        student: AdvancedStudentProfile,
        placement: AdvancedPlacementProfile,
        weights: Optional[Dict[str, float]] = None
    ) -> AdvancedMatchResult:
        """Execute full multi-layer matching pipeline."""
        
        w = weights or self.layer_weights
        
        # Layer 1: Semantic Embedding Similarity
        semantic_score, semantic_evidence = self._semantic_match(student, placement)
        
        # Layer 2: Structured Competency Matching
        competency_score, competency_evidence = self._competency_match(student, placement)
        
        # Layer 3: Career Trajectory Alignment
        trajectory_score, trajectory_evidence = self._trajectory_match(student, placement)
        
        # Layer 4: Cultural & Soft Skill Fit
        cultural_score, cultural_evidence = self._cultural_match(student, placement)
        
        # Layer 5: Market Intelligence Context
        market_score, market_evidence = self._market_match(student, placement)
        
        # Ensemble aggregation
        layers = [
            MatchLayerScore("semantic", semantic_score, w["semantic"], 0.9, semantic_evidence),
            MatchLayerScore("competency", competency_score, w["competency"], 0.95, competency_evidence),
            MatchLayerScore("trajectory", trajectory_score, w["trajectory"], 0.85, trajectory_evidence),
            MatchLayerScore("cultural", cultural_score, w["cultural"], 0.8, cultural_evidence),
            MatchLayerScore("market", market_score, w["market"], 0.7, market_evidence),
        ]
        
        overall_score = sum(l.score * l.weight for l in layers)
        overall_confidence = np.mean([l.confidence for l in layers])
        
        # Generate explainability
        matched, missing = self._skill_gap_analysis(student, placement)
        explanation = self._generate_explanation(layers, matched, missing)
        
        return AdvancedMatchResult(
            placement_id=placement.placement_id,
            overall_score=round(overall_score, 1),
            confidence=round(overall_confidence * 100, 1),
            layer_scores=layers,
            matched_skills=matched,
            missing_skills=missing,
            skill_gaps=self._generate_learning_paths(missing),
            cultural_fit_breakdown=cultural_evidence,
            trajectory_alignment=trajectory_evidence,
            market_context=market_evidence,
            explanation=explanation,
            recommendation_tier=self._tier_from_score(overall_score),
        )
    
    def _semantic_match(
        self, 
        student: AdvancedStudentProfile, 
        placement: AdvancedPlacementProfile
    ) -> tuple[float, dict]:
        """Cosine similarity on combined embeddings."""
        if not self.embedder:
            # Fallback for testing without embedder
            return 50.0, {"similarity": 0.5, "note": "No embedder available"}
        
        # Weighted combination of embeddings
        student_vec = (
            np.array(student.profile_embedding) * 0.5 + 
            np.array(student.skills_embedding) * 0.3 + 
            np.array(student.bio_embedding) * 0.2
        )
        placement_vec = (
            np.array(placement.description_embedding) * 0.5 + 
            np.array(placement.requirements_embedding) * 0.3 + 
            np.array(placement.culture_embedding) * 0.2
        )
        
        # Cosine similarity
        norm_student = np.linalg.norm(student_vec)
        norm_placement = np.linalg.norm(placement_vec)
        
        if norm_student == 0 or norm_placement == 0:
            return 0.0, {"similarity": 0.0, "error": "Zero norm vector"}
        
        similarity = np.dot(student_vec, placement_vec) / (norm_student * norm_placement)
        score = max(0, similarity * 100)
        
        evidence = {
            "similarity": round(similarity, 3),
            "student_embedding_norm": round(norm_student, 3),
            "placement_embedding_norm": round(norm_placement, 3),
        }
        
        return score, evidence
    
    def _competency_match(
        self,
        student: AdvancedStudentProfile,
        placement: AdvancedPlacementProfile
    ) -> tuple[float, dict]:
        """Proficiency-weighted skill matching with adjacency."""
        
        student_skills = {s.canonical_name.lower(): s for s in student.skills}
        required = placement.required_skills
        preferred = placement.preferred_skills
        
        matched_skills = []
        missing_skills = []
        total_weight = 0
        earned_weight = 0
        
        # Required skills (higher weight)
        for req in required:
            canonical = req.canonical_name.lower()
            weight = req.proficiency.value * 10
            total_weight += weight
            
            if canonical in student_skills:
                student_skill = student_skills[canonical]
                prof_ratio = min(student_skill.proficiency.value, req.proficiency.value) / req.proficiency.value
                confidence_factor = student_skill.confidence_score
                earned = weight * prof_ratio * confidence_factor
                earned_weight += earned
                matched_skills.append(canonical)
            else:
                # Check adjacency (related skills)
                adjacency_bonus = self.skill_graph.get_adjacency_bonus(canonical, student_skills)
                if adjacency_bonus > 0:
                    earned_weight += weight * adjacency_bonus * 0.5
                    matched_skills.append(f"{canonical} (via adjacency)")
                else:
                    missing_skills.append({
                        "skill": req.canonical_name,
                        "required_level": req.proficiency.name,
                        "importance": "required",
                        "market_demand": self.market.get_skill_demand(req.canonical_name)
                    })
        
        # Preferred skills (lower weight)
        for pref in preferred:
            canonical = pref.canonical_name.lower()
            weight = pref.proficiency.value * 5
            total_weight += weight
            
            if canonical in student_skills:
                student_skill = student_skills[canonical]
                prof_ratio = min(student_skill.proficiency.value, pref.proficiency.value) / pref.proficiency.value
                earned_weight += weight * prof_ratio * student_skill.confidence_score
        
        coverage = earned_weight / total_weight if total_weight > 0 else 0
        score = coverage * 100
        
        evidence = {
            "matched_count": len(matched_skills),
            "required_count": len(required),
            "preferred_count": len(preferred),
            "matched_skills": matched_skills,
            "coverage_ratio": round(coverage, 3),
        }
        
        return score, evidence
    
    def _trajectory_match(
        self,
        student: AdvancedStudentProfile,
        placement: AdvancedPlacementProfile
    ) -> tuple[float, dict]:
        """Career stage and growth alignment."""
        
        student_stage = student.career_trajectory.current_stage
        required_stage = placement.experience_level
        
        stage_order = ["student", "early_career", "mid_career", "senior", "lead_principal"]
        student_idx = stage_order.index(student_stage.value)
        required_idx = stage_order.index(required_stage.value)
        
        stage_diff = abs(student_idx - required_idx)
        stage_score = max(0, 100 - stage_diff * 25)
        
        # Growth potential alignment
        growth_alignment = 0
        if student.career_trajectory.target_roles:
            # Check if any target role aligns with or exceeds required stage
            target_stages = [stage_order.index(r) if r in stage_order else 0 for r in student.career_trajectory.target_roles]
            if target_stages and max(target_stages) >= required_idx:
                growth_alignment = 100
            else:
                growth_alignment = 50
        
        velocity_factor = min(1.0, student.career_trajectory.learning_velocity * 10) * 100
        
        combined = (stage_score * 0.5 + growth_alignment * 0.3 + velocity_factor * 0.2)
        
        evidence = {
            "student_stage": student_stage.value,
            "required_stage": required_stage.value,
            "stage_diff": stage_diff,
            "growth_alignment": growth_alignment,
            "learning_velocity": student.career_trajectory.learning_velocity,
        }
        
        return combined, evidence
    
    def _cultural_match(
        self,
        student: AdvancedStudentProfile,
        placement: AdvancedPlacementProfile
    ) -> tuple[float, dict]:
        """Soft skills and cultural values alignment."""
        
        # Soft skills match
        required_soft = placement.required_soft_skills
        student_soft = {
            "leadership": student.soft_skills.leadership,
            "communication": student.soft_skills.communication,
            "teamwork": student.soft_skills.teamwork,
            "adaptability": student.soft_skills.adaptability,
            "problem_solving": student.soft_skills.problem_solving,
            "initiative": student.soft_skills.initiative,
            "organization": student.soft_skills.organization,
            "cultural_awareness": student.soft_skills.cultural_awareness,
        }
        
        soft_score = 0
        soft_evidence = {}
        for skill, threshold in required_soft.items():
            student_val = student_soft.get(skill, 0)
            soft_evidence[skill] = {
                "student": student_val,
                "required": threshold,
                "met": student_val >= threshold
            }
            if student_val >= threshold:
                soft_score += 1
        
        soft_pct = (soft_score / len(required_soft) * 100) if required_soft else 100
        
        # Cultural values alignment
        cultural_dims = [
            "autonomy_preference", "mission_alignment", "collaboration_style",
            "risk_tolerance", "learning_appetite", "work_life_integration"
        ]
        
        cultural_score = 0
        cultural_evidence = {}
        student_vals = {
            "autonomy_preference": student.cultural_values.autonomy_preference,
            "mission_alignment": student.cultural_values.mission_alignment,
            "collaboration_style": student.cultural_values.collaboration_style,
            "risk_tolerance": student.cultural_values.risk_tolerance,
            "learning_appetite": student.cultural_values.learning_appetite,
            "work_life_integration": student.cultural_values.work_life_integration,
        }
        placement_vals = {
            "autonomy_preference": placement.cultural_values.autonomy_preference,
            "mission_alignment": placement.cultural_values.mission_alignment,
            "collaboration_style": placement.cultural_values.collaboration_style,
            "risk_tolerance": placement.cultural_values.risk_tolerance,
            "learning_appetite": placement.cultural_values.learning_appetite,
            "work_life_integration": placement.cultural_values.work_life_integration,
        }
        
        for dim in ["autonomy_preference", "mission_alignment", "risk_tolerance", "learning_appetite", "work_life_integration"]:
            student_val = student_vals.get(dim, 0.5)
            placement_val = placement_vals.get(dim, 0.5)
            diff = abs(student_val - placement_val)
            fit = max(0, 1 - diff)
            cultural_score += fit
            cultural_evidence[dim] = {
                "student": student_val,
                "placement": placement_val,
                "fit": round(fit, 2)
            }
        
        # Collaboration style (categorical)
        if student.cultural_values.collaboration_style == placement.cultural_values.collaboration_style:
            cultural_score += 1
            cultural_evidence["collaboration_style"] = {"match": True}
        else:
            cultural_evidence["collaboration_style"] = {"match": False}
        
        cultural_pct = (cultural_score / len(cultural_dims) * 100)
        
        combined = soft_pct * 0.6 + cultural_pct * 0.4
        
        evidence = {
            "soft_skills": soft_evidence,
            "cultural_values": cultural_evidence,
            "soft_pct": round(soft_pct, 1),
            "cultural_pct": round(cultural_pct, 1),
        }
        
        return combined, evidence
    
    def _market_match(
        self,
        student: AdvancedStudentProfile,
        placement: AdvancedPlacementProfile
    ) -> tuple[float, dict]:
        """Market intelligence contextualization."""
        
        # Skill demand alignment
        demand_scores = []
        for skill in student.skills:
            demand = self.market.get_skill_demand(skill.canonical_name)
            demand_scores.append(demand)
        
        avg_demand = np.mean(demand_scores) if demand_scores else 0.5
        
        # Role scarcity
        role_scarcity = self.market.get_role_scarcity(
            placement.experience_level.value,
            placement.org_type
        )
        
        # Geographic alignment
        geo_match = 1.0 if student.remote_ok or any(
            loc.lower() in placement.location.lower() 
            for loc in student.location_preferences
        ) else 0.5
        
        combined = (avg_demand * 0.4 + role_scarcity * 0.4 + geo_match * 0.2) * 100
        
        evidence = {
            "avg_skill_demand": round(np.mean(demand_scores), 2) if demand_scores else 0.5,
            "role_scarcity": round(role_scarcity, 2),
            "geo_match": geo_match,
            "top_demand_skills": sorted(
                [(s.canonical_name, self.market.get_skill_demand(s.canonical_name)) 
                 for s in student.skills],
                key=lambda x: x[1], reverse=True
            )[:5],
        }
        
        return combined, evidence
    
    def _skill_gap_analysis(
        self,
        student: AdvancedStudentProfile,
        placement: AdvancedPlacementProfile
    ) -> tuple[list[str], list[dict]]:
        """Analyze skill gaps between student and placement."""
        
        student_skills = {s.canonical_name.lower(): s for s in student.skills}
        
        matched = []
        missing = []
        
        for req in placement.required_skills:
            canonical = req.canonical_name.lower()
            if canonical in student_skills:
                matched.append(req.canonical_name)
            else:
                missing.append({
                    "skill": req.canonical_name,
                    "required_level": req.proficiency.name,
                    "importance": "required",
                    "market_demand": self.market.get_skill_demand(req.canonical_name)
                })
        
        for pref in placement.preferred_skills:
            canonical = pref.canonical_name.lower()
            if canonical in student_skills:
                if pref.canonical_name not in matched:
                    matched.append(pref.canonical_name)
            elif not any(m["skill"] == pref.canonical_name for m in missing):
                missing.append({
                    "skill": pref.canonical_name,
                    "required_level": pref.proficiency.name,
                    "importance": "preferred",
                    "market_demand": self.market.get_skill_demand(pref.canonical_name)
                })
        
        return matched, missing
    
    def _generate_learning_paths(self, missing_skills: list[dict]) -> list[dict]:
        """Generate learning path suggestions for missing skills."""
        
        learning_paths = []
        for gap in missing_skills:
            skill = gap["skill"]
            paths = {
                "python": ["Complete Python course on Coursera", "Build 3 projects on GitHub", "Contribute to open source"],
                "react": ["React official tutorial", "Build a portfolio project", "Learn hooks and context API"],
                "aws": ["AWS Cloud Practitioner cert", "Build a serverless project", "Practice with free tier"],
                "sql": ["SQL for Data Analysis course", "Practice on LeetCode/HackerRank", "Build analytics dashboard"],
            }
            
            learning_paths.append({
                "skill": skill,
                "priority": "high" if gap["importance"] == "required" else "medium",
                "market_demand": gap["market_demand"],
                "suggested_path": paths.get(skill.lower(), [
                    f"Complete {skill} certification",
                    f"Build portfolio project with {skill}",
                    f"Contribute to {skill} open source projects"
                ])
            })
        
        return learning_paths
    
    def _generate_explanation(
        self,
        layers: list[MatchLayerScore],
        matched: list[str],
        missing: list[dict]
    ) -> str:
        """Generate human-readable match explanation."""
        
        top_layers = sorted(layers, key=lambda x: x.score * x.weight, reverse=True)[:3]
        top_factors = [f"{l.layer_name} ({l.score:.0f}%)" for l in top_layers]
        
        explanation = f"Strong match driven by {', '.join(factor_factors[:2])}. "
        
        if matched:
            explanation += f"You have {len(matched)} of the required skills ({', '.join(matched[:5])}"
            if len(matched) > 5:
                explanation += f" and {len(matched) - 5} more"
            explanation += "). "
        
        if missing:
            required_missing = [m for m in missing if m["importance"] == "required"]
            if required_missing:
                explanation += f"Key gaps: {', '.join([m['skill'] for m in required_missing[:3]])}. "
        
        return explanation
    
    def _tier_from_score(self, score: float) -> str:
        """Determine recommendation tier from score."""
        if score >= 80:
            return "highly_recommended"
        elif score >= 60:
            return "recommended"
        else:
            return "consider"


# Convenience function for easy usage
def match_student_to_placement(
    student: AdvancedStudentProfile,
    placement: AdvancedPlacementProfile,
    weights: Optional[Dict[str, float]] = None,
    embedder=None,
) -> AdvancedMatchResult:
    """Convenience function for single match."""
    engine = AdvancedMatchingEngine(embedding_model=embedder)
    return engine.match(student, placement, weights)


# For batch matching
def rank_placements_for_student(
    student: AdvancedStudentProfile,
    placements: List[AdvancedPlacementProfile],
    weights: Optional[Dict[str, float]] = None,
    embedder=None,
    top_k: int = 10,
) -> List[AdvancedMatchResult]:
    """Rank multiple placements for a student."""
    engine = AdvancedMatchingEngine(embedding_model=embedder)
    results = []
    for placement in placements:
        result = engine.match(student, placement, weights)
        results.append(result)
    
    # Sort by score descending
    results.sort(key=lambda x: x.overall_score, reverse=True)
    return results[:top_k]