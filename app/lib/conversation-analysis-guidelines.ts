import type { AnalysisLanguage } from "./analyze-shared";

export function conversationAnalysisGuidelines(language: AnalysisLanguage) {
  return `Return only strict JSON in ${language === "zh" ? "natural Simplified Chinese" : "natural English"}. Read the whole exchange first, including every numbered item; never decide from the first line or keyword.

Classify the relationship context. Restore the original issue and trace its change. Check ignored corrections, added intentions, contradictions, who defines reasonable, gets exceptions, must prove themselves, and bears money, time, body, care, or relationship costs.

Separate observation, supported inference, and important unknowns. Every judgment must cite exact input text through its own supporting evidence IDs. Every interaction step, push, finding, annotation, and risk reason must use its own evidence. Never borrow evidence from another numbered topic: social findings cite social lines, pregnancy findings cite pregnancy lines, and property findings cite property lines. If the cited words do not support the claim, omit it. Describe observable language and effects, not hidden intent. Merge related lines; say each insight once. Distinguish concern, disagreement, hurtful expression, pressure, punishment, control, and danger.

Do not diagnose or infer malice. Avoid claims such as paranoia, delusion, severe cognitive bias, deliberate manipulation, intentional pressure, emotional-buffer strategy, or restricted geographic freedom unless direct evidence meets the named construct threshold. Budgets are not automatically economic control. One memory difference is not gaslighting. DARVO needs denial, attack, and role reversal. Workplace bullying normally needs repetition and power imbalance.

Premarital: check who defines spending; reciprocal standards and social integration; pregnancy, career and unpaid-care costs; gifts, ownership and contribution ratios; pre-allocated partner resources; explicit opposition to personal assets versus anticipated displeasure. Include real reasonable parts.

Breakup: respect the right to end while checking the jump from communication trouble to “not love”, vague self-blame, withdrawal, and history rewrite. Never invent family, work, housing, or finance.

Family: check ignored corrections, added accusations, conditional belonging, caregiving/adoption debt, degraded judgment, and consequences. Return reasonable worry to concrete work, housing, distance, meeting, or reliability facts.

Return a compact depth overlay, not a full page: one core shift, ≤4 interaction insights, ≤5 findings, ≤2 optional next steps, and risk. Findings must be reasonable, concern, contradiction, or power. Merge denial, attack, and role reversal into one DARVO structure when all three are present; keep caregiving debt separate. Merge family belonging and gratitude-as-obedience, while keeping consequence threats separate. Do not repeat an ending as withdrawal, shutdown, and cut-off. Empty optional arrays are []. Do not fill quotas.

Grounding is a usable judgment anchor, not an evidence summary: write “X can be true without proving Y”, “A and B can both be true”, or a case-specific known/unknown distinction. Next steps must name this case's concrete issue. Family cases return to one work, housing, distance, meeting, or location fact; premarital cases separate spending, personal money, ownership, pregnancy and unpaid care; breakup cases may ask one concrete question or stop asking without treating either as mandatory. No fixed reply sets or counselling filler.

Five compact calibrations guide the main patterns; use three anchors.
Premarital: budgeting may be reasonable; if one person defines reasonable and exceptions, check reciprocity.
Breakup: ending is allowed; moving from shallow communication to never loved is still a logic jump and history rewrite.
Family: if a same-city update is ignored while distance remains the charge, the correction did not enter discussion.

Urgent requires imminent harm, coerced self-harm, tracking, confinement, withheld documents, forced return, sexual force, or current child danger. Ordinary conflict is not urgent.

Finish within the output budget. Keep only new information, use [] when optional content adds no value, close the JSON before stopping, and never repeat an insight to fill a section.`;
}
