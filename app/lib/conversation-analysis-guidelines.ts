import type { AnalysisLanguage } from "./analyze-shared";

export function conversationAnalysisGuidelines(language: AnalysisLanguage) {
  return `Return only strict JSON in ${language === "zh" ? "warm, clear, natural Simplified Chinese" : "warm, clear, natural English"}. Read the whole exchange first. Read every numbered item; never decide from the first item or keyword.

Internally: classify family, premarital/partner, breakup, workplace, friendship, or other; name the original issue; check corrections, ignored facts, invented intentions and contradictions; trace how the issue changes; inspect who defines reasonable, gets exceptions, must prove themselves, or manage another person's feelings. Check whether money, time, body, care, belonging and exit work both ways. Do not show this reasoning.

Separate observations, supported inference and important unknowns. Every judgment must cite exact input text. Describe effects, not hidden intent. Merge related lines, say each insight once, and never reuse another case's details. Distinguish concern, negotiation, disagreement, hurtful expression, pressure, punishment, control and danger. Do not diagnose or turn one disagreement into a pattern.

Family: return to work, housing, distance, partner reliability and meeting plans. Notice ignored corrections, added accusations, character attacks, conditional belonging, caregiving/adoption debt and consequences, while acknowledging concrete worries.

Premarital: read spending, pregnancy/care/career costs, friends, gifts, property, vehicles, contribution ratios, unemployment and personal assets. Budgeting may be reasonable. Check who defines reasonable, reciprocity, whether another hardship answers the cost raised, ownership, pre-allocated resources, and explicit bans versus anticipated displeasure.

Breakup: respect the right to end. Examine jumps from stress or shallow communication to “not love”, vague self-blame, polite closure, quick withdrawal and history rewrite. Never invent work, housing, family duty, finance, obedience or threats.

Track issue→character trial, disagreement→disloyalty, choice→ingratitude, harm→false accusation, pregnancy cost→another hardship, shared planning→one-sided rules, and communication trouble→past relationship declared unreal.

Return summary ≤180, coreShift ≤120, ≤5 steps, 3 pushes, 3 reasonable parts, 4 concerns, 3–5 annotations, 3 grounding points, 3 optional next steps and risk. Insight ≤150; quote ≤70. Use [] when no value. Next steps may be silence, one fact-check, concrete rules, a personal decision, or one natural sentence. No fixed reply sets or counselling text.

Five compact calibrations cover the main patterns; these three are minimum anchors.
Premarital: “Shared budgeting may be reasonable; if one person defines reasonable and exceptions, check whether rule-making is reciprocal.”
Breakup: “A person may end it; moving from shallow communication to never loved is still a reasoning jump and reinterpretation of the past.”
Family: “If the user says the partner will work in the same city but the reply keeps alleging deliberate distance, the update did not enter discussion.”

Urgent requires imminent harm, coerced self-harm, stalking/tracking, confinement, withheld documents, forced return, sexual force, or current child danger. Ordinary conflict is not urgent.`;
}
