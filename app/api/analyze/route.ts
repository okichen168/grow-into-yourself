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
  type NextStepType,
} from "../../lib/analyze-shared";

export const runtime = "edge";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const compactString = (maxLength: number) => ({ type: "string", maxLength });
const compactStringArray = (maxItems: number, maxLength = 90) => ({ type: "array", maxItems, items: compactString(maxLength) });
const compactAnalysisSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "coreShift", "interactionSteps", "pushes", "reasonableParts", "concerns", "annotations", "selfGrounding", "nextSteps", "risk"],
  properties: {
    summary: compactString(180), coreShift: compactString(120),
    interactionSteps: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "evidence"], properties: { title: compactString(18), evidence: compactString(80) } } },
    pushes: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "explanation", "evidence"], properties: { title: compactString(40), explanation: compactString(120), evidence: compactString(80) } } },
    reasonableParts: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "explanation"], properties: { title: compactString(40), explanation: compactString(120) } } },
    concerns: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "explanation", "evidence", "severity"], properties: { title: compactString(40), explanation: compactString(120), evidence: compactString(80), severity: { type: "string", enum: ["low", "medium", "high"] } } } },
    annotations: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["quotes", "insight", "tags", "grounding"], properties: { quotes: compactStringArray(2, 70), insight: compactString(150), tags: compactStringArray(2, 18), grounding: compactString(90) } } },
    selfGrounding: compactStringArray(3, 100),
    nextSteps: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "reason"], properties: { title: compactString(40), reason: compactString(120) } } },
    risk: { type: "object", additionalProperties: false, required: ["level", "reasons"], properties: { level: { type: "string", enum: ["低", "中", "高", "紧急"] }, reasons: compactStringArray(3, 100) } },
  },
} as const;

type CompactAnalysis = {
  summary: string; coreShift: string;
  interactionSteps: Array<{ title: string; evidence: string }>;
  pushes: Array<{ title: string; explanation: string; evidence: string }>;
  reasonableParts: Array<{ title: string; explanation: string }>;
  concerns: Array<{ title: string; explanation: string; evidence: string; severity: "low" | "medium" | "high" }>;
  annotations: Array<{ quotes: string[]; insight: string; tags: string[]; grounding: string }>;
  selfGrounding: string[]; nextSteps: Array<{ title: string; reason: string }>;
  risk: { level: "低" | "中" | "高" | "紧急"; reasons: string[] };
};

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

function cleanString(value: unknown, maxLength: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null; }
function cleanStrings(value: unknown, maxItems: number, maxLength: number, allowEmpty = true) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  const result = value.map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems);
  return allowEmpty || result.length ? result : null;
}
function cleanObjects(value: unknown, maxItems: number) { return Array.isArray(value) ? value.slice(0, maxItems) : null; }

function parseCompact(value: unknown): CompactAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const summary = cleanString(row.summary, 180); const coreShift = cleanString(row.coreShift, 120);
  const steps = cleanObjects(row.interactionSteps, 5); const pushes = cleanObjects(row.pushes, 3); const reasonable = cleanObjects(row.reasonableParts, 3);
  const concerns = cleanObjects(row.concerns, 4); const annotations = cleanObjects(row.annotations, 5); const next = cleanObjects(row.nextSteps, 3);
  const grounding = cleanStrings(row.selfGrounding, 3, 100); const risk = row.risk as Record<string, unknown> | null;
  if (!summary || !coreShift || !steps || !pushes || !reasonable || !concerns || !annotations || !next || !grounding || !risk) return null;
  const interactionSteps = steps.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const evidence = cleanString(item?.evidence, 80); return title && evidence ? { title, evidence } : null; });
  const parsedPushes = pushes.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 40); const explanation = cleanString(item?.explanation, 120); const evidence = cleanString(item?.evidence, 80); return title && explanation && evidence ? { title, explanation, evidence } : null; });
  const reasonableParts = reasonable.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 40); const explanation = cleanString(item?.explanation, 120); return title && explanation ? { title, explanation } : null; });
  const parsedConcerns = concerns.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 40); const explanation = cleanString(item?.explanation, 120); const evidence = cleanString(item?.evidence, 80); return title && explanation && evidence && ["low", "medium", "high"].includes(String(item.severity)) ? { title, explanation, evidence, severity: item.severity as "low" | "medium" | "high" } : null; });
  const parsedAnnotations = annotations.map((entry) => { const item = entry as Record<string, unknown>; const quotes = cleanStrings(item?.quotes, 2, 70, false); const tags = cleanStrings(item?.tags, 2, 18); const insight = cleanString(item?.insight, 150); const note = cleanString(item?.grounding, 90); return quotes && tags && insight && note ? { quotes, tags, insight, grounding: note } : null; });
  const nextSteps = next.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 40); const reason = cleanString(item?.reason, 120); return title && reason ? { title, reason } : null; });
  const reasons = cleanStrings(risk.reasons, 3, 100);
  if ([...interactionSteps, ...parsedPushes, ...reasonableParts, ...parsedConcerns, ...parsedAnnotations, ...nextSteps].some((item) => !item) || !reasons || !["低", "中", "高", "紧急"].includes(String(risk.level))) return null;
  return { summary, coreShift, interactionSteps: interactionSteps as CompactAnalysis["interactionSteps"], pushes: parsedPushes as CompactAnalysis["pushes"], reasonableParts: reasonableParts as CompactAnalysis["reasonableParts"], concerns: parsedConcerns as CompactAnalysis["concerns"], annotations: parsedAnnotations as CompactAnalysis["annotations"], selfGrounding: grounding, nextSteps: nextSteps as CompactAnalysis["nextSteps"], risk: { level: risk.level as CompactAnalysis["risk"]["level"], reasons } };
}

function nextStepType(title: string, reason: string): NextStepType {
  const text = `${title} ${reason}`;
  if (/不回复|暂停|沉默|pause|no reply/i.test(text)) return "no_reply";
  if (/核对|澄清|具体|check|clarif/i.test(text)) return "clarify";
  if (/安全|危险|safety|danger/i.test(text)) return "safety";
  return "observe";
}

function mapCompact(value: CompactAnalysis, urgent: boolean): AiAnalysis {
  const riskLevel = urgent ? "紧急" : value.risk.level === "紧急" ? "高" : value.risk.level;
  return dedupeAnalysis({
    mode: "ai", statusReason: "success", overview: value.summary,
    evidenceBoundary: { observed: [], likely: [value.coreShift], uncertain: [] },
    interactionPattern: { title: value.coreShift, steps: value.interactionSteps.map((item) => ({ action: item.title, evidence: [item.evidence] })), explanation: value.coreShift },
    whatTheyArePushing: value.pushes.map((item) => ({ point: `${item.title}：${item.explanation}`, evidence: [item.evidence], confidence: "中" })),
    reasonableParts: value.reasonableParts.map((item) => `${item.title}：${item.explanation}`),
    concerningParts: value.concerns.map((item) => ({ label: item.title, explanation: item.explanation, evidence: [item.evidence], severity: item.severity === "high" ? "high" : item.severity === "medium" ? "pressure" : "notice", confidence: item.severity === "low" ? "中" : "高" })),
    keyAnnotations: value.annotations.map((item) => ({ quotes: item.quotes, tags: item.tags, keyPoint: item.insight, grounding: item.grounding, uncertainty: "" })),
    selfGrounding: value.selfGrounding,
    nextStepOptions: value.nextSteps.map((item) => ({ type: nextStepType(item.title, item.reason), title: item.title, reason: item.reason, message: "" })),
    risk: { level: riskLevel, reasons: value.risk.reasons, urgentWarning: urgent ? "文字中出现明确的现实危险信号，请优先确认人身安全。" : "" },
  });
}

function extractContent(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
  }
  if (Array.isArray(value)) return value.map((part) => part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : "").join("").trim();
  return value && typeof value === "object" ? value : null;
}

function statusForHttp(status: number): AnalysisStatusReason {
  if (status === 400) return "upstream_400"; if (status === 401) return "upstream_401"; if (status === 402) return "upstream_402"; if (status === 403) return "upstream_403";
  if (status === 408) return "upstream_408"; if (status === 429) return "upstream_429"; if (status === 404 || status === 503) return "upstream_no_provider"; return "unknown";
}

function localResponse(otherText: string, myText: string, language: AnalysisLanguage, context: AnalysisContext, statusReason: AnalysisStatusReason) {
  const analysis = analyzeConversationLocally({ otherText, myText, language, context, statusReason });
  return Response.json({ mode: "local", analysis, fallback: true });
}

async function callAnalysisApi(url: string, key: string, model: string, messages: Array<{ role: string; content: string }>, signal: AbortSignal) {
  return fetch(url, {
    method: "POST", signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.2, max_tokens: 1400, stream: false, messages,
      provider: { require_parameters: true, data_collection: "deny", sort: "throughput" },
      response_format: { type: "json_schema", json_schema: { name: "conversation_analysis", strict: true, schema: compactAnalysisSchema } },
    }),
  });
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
  if (!apiKey || !apiUrl || !model || process.env.ANALYSIS_STRICT_PRIVACY !== "true") return localResponse(otherText, myText, language, context, "runtime_config_missing");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 40_000);
  try {
    const messages = [
      { role: "system", content: conversationAnalysisGuidelines(language) },
      { role: "user", content: `Language: ${language}. Context: ${contextLabel(context, language)}.\nOther person's words:\n${otherText}\n\nUser's words or draft:\n${myText || "(none)"}\nReturn the exact structured analysis. Quotes must be verbatim from the supplied text.` },
    ];
    const response = await callAnalysisApi(apiUrl, apiKey, model, messages, controller.signal);
    if (!response.ok) return localResponse(otherText, myText, language, context, statusForHttp(response.status));
    const data = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }> };
    const choice = data.choices?.[0];
    if (!choice) return localResponse(otherText, myText, language, context, "invalid_output_empty");
    if (choice.message?.refusal) return localResponse(otherText, myText, language, context, "invalid_output_refusal");
    if (choice.finish_reason === "length") return localResponse(otherText, myText, language, context, "invalid_output_truncated");
    const content = extractContent(choice.message?.content);
    if (!content || content === "") return localResponse(otherText, myText, language, context, "invalid_output_empty");
    let parsed: unknown = content;
    if (typeof content === "string") { try { parsed = JSON.parse(content); } catch { return localResponse(otherText, myText, language, context, "invalid_output_json_syntax"); } }
    const compact = parseCompact(parsed);
    if (!compact) return localResponse(otherText, myText, language, context, "invalid_output_schema");
    const analysis = mapCompact(compact, hasExplicitUrgentSignal(`${otherText}\n${myText}`));
    return Response.json({ mode: "ai", analysis, fallback: false });
  } catch (error) {
    return localResponse(otherText, myText, language, context, error instanceof DOMException && error.name === "AbortError" ? "upstream_timeout" : "unknown");
  } finally { clearTimeout(timeout); }
}
