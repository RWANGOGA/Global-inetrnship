"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { enrichProfile, checkEnrichmentStatus } from "../../lib/api";
import { Icon, IconName } from "../icons/Icons";

type Stage = "input" | "processing" | "review" | "complete";

interface SkillCompetency {
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

interface SoftSkillProfile {
  leadership: number;
  communication: number;
  teamwork: number;
  adaptability: number;
  problem_solving: number;
  initiative: number;
  organization: number;
  cultural_awareness: number;
}

interface CareerTrajectory {
  current_stage: string;
  target_roles: string[];
  career_aspirations: string[];
  domain_interests: string[];
  learning_goals: string[];
  work_preferences: string;
  values_signals: string[];
}

interface CulturalValues {
  autonomy_preference: number;
  mission_alignment: number;
  collaboration_style: string;
  risk_tolerance: number;
  learning_appetite: number;
  work_life_integration: number;
  feedback_receptivity: number;
  diversity_value: number;
}

interface AdvancedStudentProfile {
  user_id: string;
  skills: Array<{
    skill_id: string;
    canonical_name: string;
    aliases: string[];
    category: string;
    proficiency: number;
    confidence_score: number;
    evidence: string[];
    years_experience: number;
    learning_velocity: number;
  }>;
  career_trajectory: CareerTrajectory;
  soft_skills: SoftSkillProfile;
  cultural_values: CulturalValues;
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

interface EnrichmentResponse {
  profile: AdvancedStudentProfile;
  message: string;
}

export function AIProfileBuilder({ onComplete }: { onComplete: (profile: AdvancedStudentProfile) => void }) {
  const { session, toast, student } = useApp();
  const [stage, setStage] = useState<"input" | "processing" | "review" | "complete">("input");
  const [statement, setStatement] = useState("");
  const [enrichedProfile, setEnrichedProfile] = useState<AdvancedStudentProfile | null>(null);
  const [error, setError] = useState("");
  const [processingStep, setProcessingStep] = useState(0);

  const steps = [
    { name: "Skill Extraction", key: "skills" },
    { name: "Soft Skills Analysis", key: "soft" },
    { name: "Career Trajectory", key: "trajectory" },
    { name: "Cultural Values", key: "culture" },
  ];

  const handleAnalyze = async () => {
    if (!statement.trim() || statement.length < 100) {
      setError("Please write at least 100 characters");
      return;
    }

    setStage("processing");
    setProcessingStep(0);
    setError("");

    let stepInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // Simulate step progression
      stepInterval = setInterval(() => {
        setProcessingStep(prev => Math.min(prev + 1, 3));
      }, 1500);

      const profile = await enrichProfile(statement, student.skills);

      clearInterval(stepInterval);

      setEnrichedProfile(profile as any);
      setStage("review");
      setProcessingStep(4);
      toast("Profile analyzed successfully!");
    } catch (err: any) {
      if (stepInterval) clearInterval(stepInterval);
      setError(err.message || "Failed to analyze profile");
      setStage("input");
    }
  };

  const handleAccept = () => {
    if (enrichedProfile) {
      onComplete(enrichedProfile);
      setStage("complete");
    }
  };

  const handleEdit = () => {
    setEnrichedProfile(null);
    setStage("input");
  };

  if (stage === "input") {
    return (
      <div className="ai-profile-builder" style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div className="card" style={{ padding: "32px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✨</div>
            <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px" }}>
              Build Your AI-Powered Profile
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "15px", lineHeight: 1.6 }}>
              Write a brief professional bio (100+ characters). Our AI will extract your 
              technical skills, soft skills, career goals, and work preferences to find 
              your best job and gig matches.
            </p>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "8px" }}>
              Your Professional Bio
            </label>
            <textarea
              value={statement}
              onChange={e => setStatement(e.target.value)}
              placeholder="I'm a Computer Science student passionate about building scalable web applications. I've built projects using React, Node.js, and PostgreSQL. During my internship at TechCorp, I led the migration of a legacy API to a microservices architecture using Docker and Kubernetes. I'm interested in full-stack roles at product-focused companies where I can grow into a technical lead."
              rows={8}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--rule)",
                fontSize: "14px",
                lineHeight: 1.6,
                fontFamily: "inherit",
                resize: "vertical",
                background: "var(--white)",
                color: "var(--ink)",
                boxSizing: "border-box",
              }}
              minLength={100}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
              <span>{statement.length} characters (minimum 100)</span>
              <span>{statement.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "var(--red-tint)", border: "1px solid var(--red)", borderRadius: "var(--r-md)", color: "var(--red)", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon name="alert-triangle" size={14} /> {error}
            </div>
          )}

          <button
            type="button"
            className="btn btn-blue"
            onClick={handleAnalyze}
            disabled={statement.length < 100}
            style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: 600 }}
          >
            <Icon name="search" size={16} className="icon-mr" />
            Analyze with AI
          </button>

          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "var(--muted)" }}>
            Your data is processed securely and never shared with third parties.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="ai-profile-builder" style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div className="card" style={{ padding: "48px", textAlign: "center" }}>
          <div style={{ marginBottom: "32px" }}>
            <div className="spinner-large" style={{
              width: "64px", height: "64px", border: "4px solid var(--rule-2)",
              borderTopColor: "var(--blue)", borderRadius: "50%",
              animation: "spin 1s linear infinite", margin: "0 auto 24px"
            }} />
          </div>
          <h3 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
            AI is analyzing your profile...
          </h3>
          <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "15px" }}>
            Extracting skills, soft skills, career trajectory, and work preferences
          </p>
          <div className="processing-steps" style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px", margin: "0 auto", textAlign: "left" }}>
            {steps.map((step, idx) => (
              <div key={step.key} className="step-item" style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 16px", borderRadius: "var(--r-md)",
                background: idx <= processingStep ? "var(--blue-tint)" : "var(--paper-2)",
                border: idx <= processingStep ? "1px solid var(--blue)" : "1px solid var(--rule)",
                transition: "all 0.3s ease"
              }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700",
                  background: idx < processingStep ? "var(--blue)" : idx === processingStep ? "var(--blue)" : "var(--rule)",
                  color: idx <= processingStep ? "white" : "var(--muted)"
                }}>
                  {idx < processingStep ? (
                    <Icon name="check" size={12} />
                  ) : idx === processingStep ? (
                    <div className="spinner-small" style={{
                      width: "14px", height: "14px", border: "2px solid transparent",
                      borderTopColor: "white", borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span style={{
                  fontWeight: idx <= processingStep ? "600" : "400",
                  color: idx <= processingStep ? "var(--blue)" : "var(--ink-2)"
                }}>
                  {step.name}
                </span>
                {idx === processingStep && (
                  <span style={{ fontSize: "11px", color: "var(--blue)", fontWeight: "600" }}>
                    Processing...
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    const profile = enrichedProfile!;
    const proficiencyLabels = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
    const stageLabels = {
      student: "Student", early_career: "Early Career", mid_career: "Mid Career",
      senior: "Senior", lead_principal: "Lead/Principal"
    };

    return (
      <div className="ai-profile-builder" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>Review Your AI-Generated Profile</h2>
              <p style={{ color: "var(--muted)" }}>Verify and edit the extracted information before saving</p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn btn-ghost" onClick={handleEdit} style={{ padding: "10px 20px" }}>
<Icon name="file-text" size={14} className="icon-mr" /> Rewrite
              </button>
              <button className="btn btn-blue" onClick={handleAccept} style={{ padding: "10px 20px", fontWeight: 600 }}>
<Icon name="check" size={14} className="icon-mr" /> Save Profile
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {/* Technical Skills */}
            <div className="panel" style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="brief" size={18} /> Technical Skills
                </h3>
                <span className="tg blue" style={{ fontSize: "11px" }}>{profile.skills.length} skills</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {profile.skills.slice(0, 15).map(skill => (
                  <span key={skill.skill_id} className="skill-tag" style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "var(--r-pill)",
                    background: "var(--blue-tint)", color: "var(--blue)",
                    border: "1px solid var(--blue)", fontSize: "12px",
                    fontWeight: 500
                  }}>
                    {skill.canonical_name}
                    <span style={{ fontSize: "10px", opacity: 0.7, textTransform: "capitalize" }}>
                      {proficiencyLabels[skill.proficiency as keyof typeof proficiencyLabels]}
                    </span>
                    <span style={{ fontSize: "10px", opacity: 0.6 }}>
                      {Math.round(skill.confidence_score * 100)}%
                    </span>
                  </span>
                ))}
                {profile.skills.length > 15 && (
                  <span className="tg" style={{ fontSize: "11px", marginTop: "8px", display: "inline-block" }}>
                    +{profile.skills.length - 15} more
                  </span>
                )}
              </div>
            </div>

            {/* Soft Skills */}
            <div className="panel" style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="user" size={18} /> Soft Skills
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                {[
                  { key: "leadership", label: "Leadership", icon: "shield-check" },
                  { key: "communication", label: "Communication", icon: "message-circle" },
                  { key: "teamwork", label: "Teamwork", icon: "users" },
                  { key: "adaptability", label: "Adaptability", icon: "refresh-cw" },
                  { key: "problem_solving", label: "Problem Solving", icon: "zap" },
                  { key: "initiative", label: "Initiative", icon: "arrow-right-circle" },
                  { key: "organization", label: "Organization", icon: "folder" },
                  { key: "cultural_awareness", label: "Cultural Awareness", icon: "globe" },
                ].map(({ key, label, icon }) => {
                  const value = profile.soft_skills[key as keyof typeof profile.soft_skills] as number;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Icon name={icon as IconName} size={16} className="icon-muted" />
                      <span style={{ fontSize: "13px", fontWeight: "500", minWidth: "130px" }}>{label}</span>
                      <div style={{ flex: 1, height: "8px", background: "var(--rule-2)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: `${value * 100}%`, height: "100%",
                          background: value >= 0.7 ? "var(--green)" : value >= 0.4 ? "var(--gold)" : "var(--red)",
                          borderRadius: "4px", transition: "width 0.5s ease"
                        }} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: value >= 0.7 ? "var(--green)" : value >= 0.4 ? "var(--gold)" : "var(--red)", minWidth: "40px" }}>
                        {Math.round(value * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Career Trajectory */}
            <div className="panel" style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="arrow" size={18} /> Career Trajectory
              </h3>
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>Current Stage</label>
                  <span className="tg purple" style={{ fontSize: "13px", fontWeight: "600", textTransform: "capitalize" }}>
                    {stageLabels[profile.career_trajectory.current_stage as keyof typeof stageLabels] || profile.career_trajectory.current_stage}
                  </span>
                </div>
                {profile.career_trajectory.target_roles.length > 0 && (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>Target Roles</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {profile.career_trajectory.target_roles.map((role, i) => (
                        <span key={i} className="tg gold" style={{ fontSize: "12px" }}>{role}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.career_trajectory.career_aspirations.length > 0 && (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>Aspirations</label>
                    <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                      {profile.career_trajectory.career_aspirations.join("; ")}
                    </p>
                  </div>
                )}
                {profile.career_trajectory.learning_goals.length > 0 && (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>Learning Goals</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {profile.career_trajectory.learning_goals.map((goal, i) => (
                        <span key={i} className="tg blue" style={{ fontSize: "11px" }}>{goal}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cultural Values */}
            <div className="panel" style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="user" size={18} /> Work Preferences
              </h3>
              <div style={{ display: "grid", gap: "14px" }}>
                {[
                  { key: "autonomy_preference", label: "Autonomy", icon: "user" },
                  { key: "mission_alignment", label: "Mission-Driven", icon: "target" },
                  { key: "risk_tolerance", label: "Risk Tolerance", icon: "activity" },
                  { key: "learning_appetite", label: "Learning Appetite", icon: "book-open" },
                  { key: "work_life_integration", label: "Work-Life Balance", icon: "scale" },
                ].map(({ key, label, icon }) => {
                  const value = profile.cultural_values[key as keyof typeof profile.cultural_values] as number;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Icon name={icon as IconName} size={16} className="icon-muted" />
                      <span style={{ fontSize: "13px", fontWeight: "500", minWidth: "140px" }}>{label}</span>
                      <div style={{ flex: 1, height: "8px", background: "var(--rule-2)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: `${value * 100}%`, height: "100%",
                          background: value >= 0.7 ? "var(--green)" : value >= 0.4 ? "var(--gold)" : "var(--red)",
                          borderRadius: "4px", transition: "width 0.5s ease"
                        }} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: value >= 0.7 ? "var(--green)" : value >= 0.4 ? "var(--gold)" : "var(--red)", minWidth: "40px" }}>
                        {Math.round(value * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--rule)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Icon name="user" size={16} className="icon-muted" />
                  <span style={{ fontSize: "13px", fontWeight: "500", minWidth: "140px" }}>Collaboration Style</span>
                  <span className={`tg ${profile.cultural_values.collaboration_style === "remote" ? "blue" : profile.cultural_values.collaboration_style === "onsite" ? "green" : "gold"}`} style={{ fontSize: "12px", textTransform: "capitalize" }}>
                    {profile.cultural_values.collaboration_style}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--rule)" }}>
            <button className="btn btn-ghost" onClick={handleEdit} style={{ padding: "12px 24px" }}>
              <Icon name="file-text" size={14} className="icon-mr" /> Rewrite Statement
            </button>
            <button className="btn btn-blue" onClick={handleAccept} style={{ padding: "12px 28px", fontWeight: 600, fontSize: "15px" }}>
              <Icon name="check" size={14} className="icon-mr" /> Save Profile & Find Matches
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "complete") {
    return (
      <div className="ai-profile-builder" style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div className="card" style={{ padding: "48px", textAlign: "center" }}>
          <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎉</div>
          <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px" }}>Profile Saved!</h2>
          <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
            Your AI-enriched profile is ready. We'll now find your best job and gig matches.
          </p>
          <button className="btn btn-blue" onClick={() => {}} style={{ padding: "14px 32px", fontSize: "15px" }}>
            Find My Matches
          </button>
        </div>
      </div>
    );
  }
}