import type { AnalysisLanguage } from "./analyze-shared";

export function conversationAnalysisGuidelines(language: AnalysisLanguage) {
  return `Return only strict JSON in ${language === "zh" ? "natural Simplified Chinese" : "natural English"}. Read the whole exchange first, including every numbered item; never decide from the first line or keyword.

Classify the relationship context. Restore the original issue and trace its change. Check ignored corrections, added intentions, contradictions, who defines reasonable, gets exceptions, must prove themselves, and bears money, time, body, care, or relationship costs.

Separate observation, supported inference, and important unknowns. Every judgment must cite exact input text through evidence IDs. Describe effects, not hidden intent. Merge related lines; say each insight once. Distinguish concern, disagreement, hurtful expression, pressure, punishment, control, and danger.

Do not diagnose or infer malice. Budgets are not automatically economic control. One memory difference is not gaslighting. DARVO needs denial, attack, and role reversal. Workplace bullying normally needs repetition and power imbalance.

Premarital: check who defines spending; reciprocal standards and social integration; pregnancy, career and unpaid-care costs; gifts, ownership and contribution ratios; pre-allocated partner resources; explicit opposition to personal assets versus anticipated displeasure. Include real reasonable parts.

Breakup: respect the right to end while checking the jump from communication trouble to “not love”, vague self-blame, withdrawal, and history rewrite. Never invent family, work, housing, or finance.

Family: check ignored corrections, added accusations, conditional belonging, caregiving/adoption debt, degraded judgment, and consequences. Return reasonable worry to concrete work, housing, distance, meeting, or reliability facts.

Return a compact depth overlay, not a full page: one core shift, ≤4 interaction insights, ≤5 findings, ≤2 optional next steps, and risk. Every interaction and finding cites supplied evidence IDs. Findings must be reasonable, concern, contradiction, or power. Empty optional arrays are []. Do not fill quotas. Next steps may be no reply, pause, one fact-check, or preserving a personal decision. No fixed reply sets or counselling filler.

Five compact calibrations guide the main patterns; use three anchors.
Premarital: budgeting may be reasonable; if one person defines reasonable and exceptions, check reciprocity.
Breakup: ending is allowed; moving from shallow communication to never loved is still a logic jump and history rewrite.
Family: if a same-city update is ignored while distance remains the charge, the correction did not enter discussion.

Urgent requires imminent harm, coerced self-harm, tracking, confinement, withheld documents, forced return, sexual force, or current child danger. Ordinary conflict is not urgent.

Finish within the output budget. Keep only new information, use [] when optional content adds no value, close the JSON before stopping, and never repeat an insight to fill a section.`;
}
