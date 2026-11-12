import { Placement } from "../types";
import type { CatalogMeta, CatalogSkill } from "./api";

/*
  Skills-to-opportunity matching.

  The deterministic engine lives here, but every table it reads — the skill
  taxonomy, the per-placement requirements and the grade thresholds — comes
  from the backend via GET /placements/meta (see AppContext, which calls
  setSkillTables once the catalog loads). The frontend ships no private copies,
  so scores can never drift from what the server's matcher produces.
*/

export type Skill = CatalogSkill;

// Empty until the API supplies the tables; scoring degrades to 0 rather than
// inventing numbers the backend never approved.
let tables: Required<Pick<CatalogMeta, "gradeRules" | "requiredSkills" | "skills">> = {
  gradeRules: {},
  requiredSkills: {},
  skills: [],
};

export function setSkillTables(meta: CatalogMeta): void {
  tables = {
    gradeRules: meta.gradeRules,
    requiredSkills: meta.requiredSkills,
    skills: meta.skills,
  };
}

export function skillList(): Skill[] {
  return tables.skills;
}

export function skillNames(): string[] {
  return tables.skills.map((s) => s.name);
}

export function requiredSkillsFor(p: Placement): string[] {
  return tables.requiredSkills[p.id] || [];
}

/*
  Deterministic skill extraction. Returns skills found in the text, in
  taxonomy order. Whole-word-ish matching on the lower-cased haystack avoids
  "js" firing inside "adjust".
*/
export function extractSkills(text: string): string[] {
  const hay = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const skill of tables.skills) {
    const hit = skill.keywords.some((kw) => {
      const needle = kw.toLowerCase();
      // Keyword already carries surrounding space where it matters (e.g. "r ").
      const idx = hay.indexOf(needle);
      if (idx === -1) return false;
      const before = hay[idx - 1];
      const after = hay[idx + needle.length];
      const leftOk = before === undefined || /[^a-z0-9]/.test(before);
      const rightOk = after === undefined || /[^a-z0-9]/.test(after) || needle.endsWith(" ");
      return leftOk && rightOk;
    });
    if (hit) found.push(skill.name);
  }
  return found;
}

export interface MatchResult {
  score: number; // 0-100
  matched: string[]; // required skills the student has
  missing: string[]; // required skills the student lacks
  courseFit: boolean;
  gradeFit: boolean;
}

/*
  Weighted match: skill coverage dominates, then the course and grade gates
  that already existed as a boolean. Deliberately explainable — every term the
  score is built from is returned so the UI can say "why".
*/
export function matchPlacement(
  p: Placement,
  studentSkills: string[],
  studentCourse: string,
  studentCgpa: number,
  skillsConfidence: Record<string, number> = {}
): MatchResult {
  const required = requiredSkillsFor(p);
  const have = new Set(studentSkills);
  const matched = required.filter((s) => have.has(s));
  const missing = required.filter((s) => !have.has(s));

  // Advanced counts in full, Intermediate 75%, Beginner 50%. Unrated skills
  // count in full so profiles saved before confidence levels keep their score.
  const confidenceWeight = (skill: string) => {
    switch (skillsConfidence[skill]) {
      case 1:
        return 0.5;
      case 2:
        return 0.75;
      default:
        return 1;
    }
  };
  const weighted = matched.reduce((sum, skill) => sum + confidenceWeight(skill), 0);
  const coverage = required.length ? Math.min(1, weighted / required.length) : 0;

  const courseFit = p.courses.includes(studentCourse);
  const threshold = tables.gradeRules[p.grade] ?? 0;
  const gradeFit = studentCgpa >= threshold;

  // Weights: skills 60%, course 25%, grade 15%.
  const raw = coverage * 0.6 + (courseFit ? 0.25 : 0) + (gradeFit ? 0.15 : 0);
  const score = Math.round(raw * 100);

  return { score, matched, missing, courseFit, gradeFit };
}
