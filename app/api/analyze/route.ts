import { conversationAnalysisGuidelines } from "../../lib/conversation-analysis-guidelines";
import { analyzeConversationLocally } from "../../lib/local-conversation-analysis";
import {
  dedupeAnalysis,
  hasExplicitUrgentSignal,
  normaliseInput,
  type AiAnalysis,
  type AnalysisContext,
  type AnalysisLanguage,
  type AnalysisStatusReason,
  type Confidence,
  type ConcernSeverity,
  type NextStepType,
} from "../../lib/analyze-shared";

export const runtime = "edge";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const confidenceValues: Confidence[] = ["高", "中", "低"];
const severityValues: ConcernSeverity[] = ["notice", "pressure", "high"];
const nextStepValues: NextStepType[] = ["no_reply", "observe", "clarify", "respond", "safety"];

const stringArray = (maxItems: number) => ({ type: "array", maxItems, items: { type: "string" } });
const analysisSchema = {
  type: "object", additionalProperties: false,
  required: ["mode", "statusReason", "overview", "evidenceBoundary", "interactionPattern", "whatTheyArePushing", "reasonableParts", "concerningParts", "keyAnnotations", "selfGrounding", "nextStepOptions", "risk"],
  properties: {
    mode: { type: "string", const: "ai" }, statusReason: { type: "string", const: "success" }, overview: { type: "string" },
    evidenceBoundary: { type: "object", additionalProperties: false, required: ["observed", "likely", "uncertain"], properties: { observed: stringArray(8), likely: stringArray(8), uncertain: stringArray(8) } },
    interactionPattern: { type: "object", additionalProperties: false, required: ["title", "steps", "explanation"], properties: {
      title: { type: "string" }, explanation: { type: "string" }, steps: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["action", "evidence"], properties: { action: { type: "string" }, evidence: stringArray(3) } } },
    } },
    whatTheyArePushing: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["point", "evidence", "confidence"], properties: { point: { type: "string" }, evidence: stringArray(3), confidence: { type: "string", enum: confidenceValues } } } },
    reasonableParts: stringArray(6),
    concerningParts: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["label", "explanation", "evidence", "severity", "confidence"], properties: { label: { type: "string" }, explanation: { type: "string" }, evidence: stringArray(4), severity: { type: "string", enum: severityValues }, confidence: { type: "string", enum: confidenceValues } } } },
    keyAnnotations: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["quotes", "tags", "keyPoint", "grounding", "uncertainty"], properties: { quotes: stringArray(4), tags: stringArray(3), keyPoint: { type: "string" }, grounding: { type: "string" }, uncertainty: { type: "string" } } } },
    selfGrounding: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    nextStepOptions: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["type", "title", "reason", "message"], properties: { type: { type: "string", enum: nextStepValues }, title: { type: "string" }, reason: { type: "string" }, message: { type: "string" } } } },
    risk: { type: "object", additionalProperties: false, required: ["level", "reasons", "urgentWarning"], properties: { level: { type: "string", enum: ["低", "中", "高", "紧急"] }, reasons: stringArray(6), urgentWarning: { type: "string" } } },
  },
} as const;

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: Request) {
  const now = Date.now(); const address = clientAddress(request); const current = rateBuckets.get(address);
  if (!current || current.resetAt <= now) { rateBuckets.set(address, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }); return false; }
  current.count += 1; return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function contextLabel(context: AnalysisContext, language: AnalysisLanguage) {
  const values = { relationship: ["伴侣或暧昧", "partner or dating"], family: ["家人", "family"], workplace: ["职场", "workplace"], friendship: ["朋友或同学", "friendship"] } as const;
  return values[context][language === "zh" ? 0 : 1];
}

function strings(value: unknown, max = 20) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean).slice(0, max);
}

function objects(value: unknown, max: number) { return Array.isArray(value) ? value.slice(0, max) : null; }

function parseAnalysis(value: unknown, urgent: boolean): AiAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.mode !== "ai" || row.statusReason !== "success" || typeof row.overview !== "string" || !row.overview.trim()) return null;
  const boundary = row.evidenceBoundary as Record<string, unknown> | null;
  const pattern = row.interactionPattern as Record<string, unknown> | null;
  if (!boundary || !pattern) return null;
  const observed = strings(boundary.observed, 8); const likely = strings(boundary.likely, 8); const uncertain = strings(boundary.uncertain, 8);
  const stepsRaw = objects(pattern.steps, 6);
  if (!observed || !likely || !uncertain || typeof pattern.title !== "string" || typeof pattern.explanation !== "string" || !stepsRaw) return null;
  const steps = stepsRaw.map((entry) => { const item = entry as Record<string, unknown>; const evidence = strings(item?.evidence, 3); return item && typeof item.action === "string" && evidence ? { action: item.action.trim(), evidence } : null; });
  const pushingRaw = objects(row.whatTheyArePushing, 6); const concernsRaw = objects(row.concerningParts, 6); const annotationsRaw = objects(row.keyAnnotations, 6); const nextRaw = objects(row.nextStepOptions, 3);
  const reasonableParts = strings(row.reasonableParts, 6); const selfGrounding = strings(row.selfGrounding, 4);
  if (!pushingRaw || !concernsRaw || !annotationsRaw || !nextRaw || !reasonableParts || !selfGrounding || steps.some((item) => !item)) return null;
  const whatTheyArePushing = pushingRaw.map((entry) => { const item = entry as Record<string, unknown>; const evidence = strings(item?.evidence, 3); return item && typeof item.point === "string" && evidence && confidenceValues.includes(item.confidence as Confidence) ? { point: item.point.trim(), evidence, confidence: item.confidence as Confidence } : null; });
  const concerningParts = concernsRaw.map((entry) => { const item = entry as Record<string, unknown>; const evidence = strings(item?.evidence, 4); return item && typeof item.label === "string" && typeof item.explanation === "string" && evidence && severityValues.includes(item.severity as ConcernSeverity) && confidenceValues.includes(item.confidence as Confidence) ? { label: item.label.trim(), explanation: item.explanation.trim(), evidence, severity: item.severity as ConcernSeverity, confidence: item.confidence as Confidence } : null; });
  const keyAnnotations = annotationsRaw.map((entry) => { const item = entry as Record<string, unknown>; const quotes = strings(item?.quotes, 4); const tags = strings(item?.tags, 3); return item && quotes?.length && tags && typeof item.keyPoint === "string" && typeof item.grounding === "string" && typeof item.uncertainty === "string" ? { quotes, tags, keyPoint: item.keyPoint.trim(), grounding: item.grounding.trim(), uncertainty: item.uncertainty.trim() } : null; });
  const nextStepOptions = nextRaw.map((entry) => { const item = entry as Record<string, unknown>; return item && nextStepValues.includes(item.type as NextStepType) && typeof item.title === "string" && typeof item.reason === "string" && typeof item.message === "string" ? { type: item.type as NextStepType, title: item.title.trim(), reason: item.reason.trim(), message: item.message.trim() } : null; });
  const risk = row.risk as Record<string, unknown> | null; const reasons = risk ? strings(risk.reasons, 6) : null;
  if (whatTheyArePushing.some((item) => !item) || concerningParts.some((item) => !item) || keyAnnotations.length < 2 || keyAnnotations.some((item) => !item) || nextStepOptions.some((item) => !item) || selfGrounding.length < 2 || !risk || !reasons || !["低", "中", "高", "紧急"].includes(String(risk.level)) || typeof risk.urgentWarning !== "string") return null;
  const riskLevel = urgent ? "紧急" : risk.level === "紧急" ? "高" : String(risk.level);
  return dedupeAnalysis({ mode: "ai", statusReason: "success", overview: row.overview.trim(), evidenceBoundary: { observed, likely, uncertain }, interactionPattern: { title: pattern.title.trim(), steps: steps as AiAnalysis["interactionPattern"]["steps"], explanation: pattern.explanation.trim() }, whatTheyArePushing: whatTheyArePushing as AiAnalysis["whatTheyArePushing"], reasonableParts, concerningParts: concerningParts as AiAnalysis["concerningParts"], keyAnnotations: keyAnnotations as AiAnalysis["keyAnnotations"], selfGrounding, nextStepOptions: nextStepOptions as AiAnalysis["nextStepOptions"], risk: { level: riskLevel, reasons, urgentWarning: urgent ? (risk.urgentWarning.trim() || "文字中出现明确的现实危险信号，请优先确认人身安全。") : "" } });
}

function localResponse(otherText: string, myText: string, language: AnalysisLanguage, context: AnalysisContext, statusReason: AnalysisStatusReason) {
  const analysis = analyzeConversationLocally({ otherText, myText, language, context, statusReason });
  return Response.json({ mode: "local", analysis, fallback: true });
}

async function callAnalysisApi(url: string, key: string, model: string, messages: Array<{ role: string; content: string }>, strictPrivacy: boolean, signal: AbortSignal) {
  const base = { model, temperature: 0.25, max_tokens: 3200, stream: false, messages, ...(strictPrivacy ? { data_collection: "deny", zdr: true, require_parameters: true } : {}) };
  const strict = await fetch(url, { method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ ...base, response_format: { type: "json_schema", json_schema: { name: "conversation_analysis", strict: true, schema: analysisSchema } } }) });
  if (strict.ok) return strict;
  if (![400, 415, 422].includes(strict.status)) return strict;
  return fetch(url, { method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ ...base, response_format: { type: "json_object" } }) });
}

export async function POST(request: Request) {
  let payload: { otherText?: string; myText?: string; language?: AnalysisLanguage; context?: AnalysisContext };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const language: AnalysisLanguage = payload.language === "en" ? "en" : "zh";
  const context: AnalysisContext = ["relationship", "family", "workplace", "friendship"].includes(payload.context || "") ? payload.context as AnalysisContext : "relationship";
  const { otherText, myText } = normaliseInput(payload.otherText || "", payload.myText || "");
  if (otherText.length < 2) return Response.json({ error: language === "zh" ? "请先粘贴对方发来的话。" : "Please paste the other person’s messages first." }, { status: 400 });
  if ((payload.otherText || "").length > 6000 || (payload.myText || "").length > 3000) return Response.json({ error: language === "zh" ? "文字太长了，请删短一点再分析。" : "This is too long. Please shorten it before analysis." }, { status: 413 });
  if (isRateLimited(request)) return localResponse(otherText, myText, language, context, "quota");

  const apiKey = process.env.ANALYSIS_API_KEY; const apiUrl = process.env.ANALYSIS_API_URL; const model = process.env.ANALYSIS_MODEL;
  if (!apiKey || !apiUrl || !model) return localResponse(otherText, myText, language, context, "config");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const messages = [
      { role: "system", content: conversationAnalysisGuidelines(language) },
      { role: "user", content: `Language: ${language}. Context: ${contextLabel(context, language)}.\nOther person's words:\n${otherText}\n\nUser's words or draft:\n${myText || "(none)"}\nReturn the exact structured analysis. Quotes must be verbatim from the supplied text.` },
    ];
    const response = await callAnalysisApi(apiUrl, apiKey, model, messages, process.env.ANALYSIS_STRICT_PRIVACY === "true", controller.signal);
    if (!response.ok) return localResponse(otherText, myText, language, context, response.status === 429 ? "quota" : response.status >= 500 ? "busy" : "invalid_output");
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = data.choices?.[0]?.message?.content;
    if (!content) return localResponse(otherText, myText, language, context, "invalid_output");
    let parsed: unknown; try { parsed = JSON.parse(content); } catch { return localResponse(otherText, myText, language, context, "invalid_output"); }
    const analysis = parseAnalysis(parsed, hasExplicitUrgentSignal(`${otherText}\n${myText}`));
    if (!analysis) return localResponse(otherText, myText, language, context, "invalid_output");
    return Response.json({ mode: "ai", analysis, fallback: false });
  } catch (error) {
    return localResponse(otherText, myText, language, context, error instanceof DOMException && error.name === "AbortError" ? "timeout" : "busy");
  } finally { clearTimeout(timeout); }
}
