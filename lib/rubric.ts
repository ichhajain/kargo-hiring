// Kargo hiring rubric (rubric.txt). Weights sum to 100 per role.
// Past-hire performance ratings were used to DESIGN this rubric; they are never fed to the live model.

export type Role = "PM" | "SPM";

export type Criterion = {
  key: string;
  label: string;
  weight: number;
  inJD: "yes" | "no" | "partial";
  guidance: string;
};

export const RUBRICS: Record<Role, Criterion[]> = {
  PM: [
    {
      key: "ops_exposure",
      label: "Ground-level ops/logistics exposure",
      weight: 20,
      inJD: "no",
      guidance:
        "Actually worked inside operations or logistics (warehouse, freight, carrier, CHA, 3PL, supply chain, field ops) early or mid-career. Curiosity or selling TO logistics firms is weaker than doing the work.",
    },
    {
      key: "built_unprompted",
      label: "Built something unprompted, adopted without being asked",
      weight: 20,
      inJD: "no",
      guidance:
        "Created a tool, process, framework or feature nobody assigned, which others then adopted (became team standard, used by other teams). Killing features on their own data reading also counts.",
    },
    {
      key: "ambiguity",
      label: "Comfort in ambiguity (decided with no playbook)",
      weight: 20,
      inJD: "yes",
      guidance:
        "A specific example of making a call with no handbook, template or senior PM: first PM, sole PM, built the process from scratch.",
    },
    {
      key: "lifecycle",
      label: "Full-lifecycle ownership with measurable outcomes",
      weight: 15,
      inJD: "yes",
      guidance:
        "Shipped AND killed things, with named numbers (adoption %, time saved, revenue, tickets reduced) and learning from both.",
    },
    {
      key: "pressure_exposure",
      label: "Direct exposure to end-users/ops under real pressure",
      weight: 15,
      inJD: "partial",
      guidance:
        "A NAMED incident (outage, customs hold, port congestion, escalation) where they were directly with users/ops under pressure. General claims like 'worked closely with users' score low.",
    },
    {
      key: "band_fit",
      label: "Band fit: 2–4 yrs PM, first-time-building company",
      weight: 10,
      inJD: "yes",
      guidance:
        "5 = 2–4 years in PM roles at an early-stage/first-build company. 3 = PM years slightly outside band or mature company. 1 = well outside band or not a PM.",
    },
  ],
  SPM: [
    {
      key: "logistics_domain",
      label: "Logistics/ops-heavy domain exposure",
      weight: 25,
      inJD: "yes",
      guidance:
        "Depth of time in logistics, freight, supply chain or adjacent ops-heavy domains (the JD calls this a genuine advantage, not a nice-to-have).",
    },
    {
      key: "high_consequence",
      label: "Owned high-consequence decisions, no senior layer above",
      weight: 20,
      inJD: "yes",
      guidance:
        "Made big, hard-to-reverse product/architecture calls (build vs configure vs avoid, platform bets) without a senior PM or committee above them, and lived with the consequences.",
    },
    {
      key: "early_stage",
      label: "Early-stage / no-playbook environment",
      weight: 15,
      inJD: "yes",
      guidance: "Worked at an early-stage company or built the rules where none existed.",
    },
    {
      key: "built_unprompted",
      label: "Built something unprompted, adopted without being asked",
      weight: 15,
      inJD: "no",
      guidance:
        "Created a tool, process or framework nobody assigned that others then adopted as standard.",
    },
    {
      key: "crisis",
      label: "Owned a named crisis and institutionalized the fix",
      weight: 15,
      inJD: "no",
      guidance:
        "A NAMED crisis (outage, failed migration, audit, customs/port incident) they owned AND a lasting fix they put in place afterward (postmortem process, runbook, new standard).",
    },
    {
      key: "band_fit",
      label: "Band fit: 5–8 yrs PM, platform/integration ownership",
      weight: 10,
      inJD: "yes",
      guidance:
        "5 = 5–8 years PM with platform/integration/API ownership. 3 = in band without platform work, or platform work slightly outside band. 1 = well outside band.",
    },
  ],
};

export const SCORE_ANCHORS = `Score each criterion 0–5:
0 = no evidence in the CV
1 = vague or generic claim only ("passionate about ops", "worked with stakeholders")
2 = relevant but indirect or thin evidence
3 = one specific, concrete example
4 = specific example with named context AND a measurable outcome
5 = multiple strong, specific examples, or one exceptional one (adopted as standard / institutionalized)
Do NOT reward: brand-name schools or employers, number of certifications, tool lists, or raw years (these were tested against Kargo's past hires and did not predict performance).`;

export type CriterionScore = { key: string; score: number; evidence: string };

export function weightedTotal(role: Role, scores: CriterionScore[]): number {
  const total = RUBRICS[role].reduce((sum, c) => {
    const s = scores.find((x) => x.key === c.key)?.score ?? 0;
    return sum + (Math.max(0, Math.min(5, s)) / 5) * c.weight;
  }, 0);
  return Math.round(total * 10) / 10;
}

// Recommendation is a suggestion only. Arjun makes the call.
export function recommend(score: number): "interview" | "maybe" | "reject" {
  if (score >= 65) return "interview";
  if (score >= 45) return "maybe";
  return "reject";
}
