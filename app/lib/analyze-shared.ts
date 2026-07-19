export type AnalysisLanguage = "en" | "zh";
export type AnalysisContext = "relationship" | "family" | "workplace" | "friendship";
export type AnalysisMode = "ai" | "local";
export type AnalysisStatusReason = "success" | "quota" | "config" | "busy" | "timeout" | "invalid_output";
export type Confidence = "高" | "中" | "低";
export type ConcernSeverity = "notice" | "pressure" | "high";
export type NextStepType = "no_reply" | "observe" | "clarify" | "respond" | "safety";

export type AiAnalysis = {
  mode: AnalysisMode;
  statusReason: AnalysisStatusReason;
  overview: string;
  evidenceBoundary: { observed: string[]; likely: string[]; uncertain: string[] };
  interactionPattern: { title: string; steps: Array<{ action: string; evidence: string[] }>; explanation: string };
  whatTheyArePushing: Array<{ point: string; evidence: string[]; confidence: Confidence }>;
  reasonableParts: string[];
  concerningParts: Array<{ label: string; explanation: string; evidence: string[]; severity: ConcernSeverity; confidence: Confidence }>;
  keyAnnotations: Array<{ quotes: string[]; tags: string[]; keyPoint: string; grounding: string; uncertainty: string }>;
  selfGrounding: string[];
  nextStepOptions: Array<{ type: NextStepType; title: string; reason: string; message: string }>;
  risk: { level: string; reasons: string[]; urgentWarning: string };
};

const urgentPhrases = [
  "杀了你", "弄死你", "打死你", "我要自杀", "我去跳楼", "跟踪你", "实时定位你", "一直盯着你",
  "锁门不让你走", "不让你离开", "把你关起来", "扣你身份证", "扣你护照", "抓你回去", "强制带你回去",
  "伤害孩子", "伤害未成年人", "kill you", "murder you", "kill myself", "hurt myself", "commit suicide",
  "stalk you", "track your location", "lock you in", "won't let you leave", "take your passport", "force you home",
  "harm the child", "harm a minor",
];

export function hasExplicitUrgentSignal(text: string) {
  const normalised = text.toLowerCase();
  return urgentPhrases.some((phrase) => normalised.includes(phrase.toLowerCase()));
}

export function normaliseInput(otherText: string, myText: string) {
  return { otherText: otherText.trim().slice(0, 6000), myText: myText.trim().slice(0, 3000) };
}

function normaliseForComparison(value: string) {
  return value.toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "");
}

function trigrams(value: string) {
  const result = new Set<string>();
  if (value.length < 3) { if (value) result.add(value); return result; }
  for (let index = 0; index < value.length - 2; index += 1) result.add(value.slice(index, index + 3));
  return result;
}

export function textSimilarity(left: string, right: string) {
  const a = normaliseForComparison(left);
  const b = normaliseForComparison(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 12 && (a.includes(b) || b.includes(a))) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const aPairs = trigrams(a);
  const bPairs = trigrams(b);
  let overlap = 0;
  for (const pair of aPairs) if (bPairs.has(pair)) overlap += 1;
  return aPairs.size + bPairs.size ? (2 * overlap) / (aPairs.size + bPairs.size) : 0;
}

function uniqueStrings(values: string[], seen: string[], threshold = 0.72) {
  const result: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    if ([...seen, ...result].some((existing) => textSimilarity(existing, value) >= threshold)) continue;
    result.push(value);
  }
  seen.push(...result);
  return result;
}

export function dedupeAnalysis(analysis: AiAnalysis): AiAnalysis {
  const seen: string[] = [analysis.overview];
  const evidenceBoundary = {
    observed: uniqueStrings(analysis.evidenceBoundary.observed, [], 0.9),
    likely: uniqueStrings(analysis.evidenceBoundary.likely, seen),
    uncertain: uniqueStrings(analysis.evidenceBoundary.uncertain, seen),
  };
  const interactionSteps = analysis.interactionPattern.steps.filter((item, index, all) => (
    all.findIndex((prior) => textSimilarity(prior.action, item.action) >= 0.72) === index
  )).map((item) => ({ ...item, evidence: uniqueStrings(item.evidence, [], 0.9).slice(0, 3) })).slice(0, 6);
  const pushing = analysis.whatTheyArePushing.filter((item) => {
    if (seen.some((value) => textSimilarity(value, item.point) >= 0.72)) return false;
    seen.push(item.point);
    item.evidence = uniqueStrings(item.evidence, [], 0.9).slice(0, 3);
    return true;
  });
  const reasonableParts = uniqueStrings(analysis.reasonableParts, seen);
  const concerningParts = analysis.concerningParts.filter((item) => {
    const combined = `${item.label} ${item.explanation}`;
    if (seen.some((value) => textSimilarity(value, combined) >= 0.72 || textSimilarity(value, item.explanation) >= 0.72)) return false;
    seen.push(combined, item.explanation);
    item.evidence = uniqueStrings(item.evidence, [], 0.9).slice(0, 4);
    return true;
  });
  const keyAnnotations = analysis.keyAnnotations.filter((item, index, all) => {
    if (all.slice(0, index).some((prior) => textSimilarity(prior.keyPoint, item.keyPoint) >= 0.72)) return false;
    if (seen.some((value) => textSimilarity(value, item.keyPoint) >= 0.78)) return false;
    seen.push(item.keyPoint);
    item.quotes = uniqueStrings(item.quotes, [], 0.9).slice(0, 4);
    item.tags = uniqueStrings(item.tags, [], 0.9).slice(0, 3);
    return true;
  }).slice(0, analysis.mode === "local" ? 4 : 6);
  const selfGrounding = uniqueStrings(analysis.selfGrounding, seen);
  const nextStepOptions = analysis.nextStepOptions.filter((item, index, all) => (
    all.findIndex((prior) => textSimilarity(prior.reason, item.reason) >= 0.72) === index
  )).slice(0, 3);
  const riskReasons = uniqueStrings(analysis.risk.reasons, seen);

  return {
    ...analysis,
    evidenceBoundary,
    interactionPattern: { ...analysis.interactionPattern, steps: interactionSteps },
    whatTheyArePushing: pushing,
    reasonableParts,
    concerningParts,
    keyAnnotations,
    selfGrounding,
    nextStepOptions,
    risk: { ...analysis.risk, reasons: riskReasons },
  };
}
