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
    summary: compactString(130), coreShift: compactString(90),
    interactionSteps: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "explanation", "evidenceIds"], properties: { title: compactString(18), explanation: compactString(95), evidenceIds: compactStringArray(2, 8) } } },
    pushes: { type: "array", maxItems: 2, items: { type: "object", additionalProperties: false, required: ["title", "explanation", "evidenceIds"], properties: { title: compactString(18), explanation: compactString(95), evidenceIds: compactStringArray(2, 8) } } },
    reasonableParts: { type: "array", maxItems: 2, items: { type: "object", additionalProperties: false, required: ["title", "explanation", "evidenceIds"], properties: { title: compactString(18), explanation: compactString(95), evidenceIds: compactStringArray(2, 8) } } },
    concerns: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "explanation", "evidenceIds", "severity"], properties: { title: compactString(18), explanation: compactString(95), evidenceIds: compactStringArray(2, 8), severity: { type: "string", enum: ["low", "medium", "high"] } } } },
    annotations: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["evidenceIds", "insight", "tags", "grounding"], properties: { evidenceIds: compactStringArray(2, 8), insight: compactString(120), tags: compactStringArray(2, 18), grounding: compactString(70) } } },
    selfGrounding: compactStringArray(2, 80),
    nextSteps: { type: "array", maxItems: 2, items: { type: "object", additionalProperties: false, required: ["title", "reason"], properties: { title: compactString(18), reason: compactString(80) } } },
    risk: { type: "object", additionalProperties: false, required: ["level", "reasons"], properties: { level: { type: "string", enum: ["低", "中", "高", "紧急"] }, reasons: compactStringArray(2, 80) } },
  },
} as const;

type CompactAnalysis = {
  summary: string; coreShift: string;
  interactionSteps: Array<{ title: string; explanation: string; evidenceIds: string[] }>;
  pushes: Array<{ title: string; explanation: string; evidenceIds: string[] }>;
  reasonableParts: Array<{ title: string; explanation: string; evidenceIds: string[] }>;
  concerns: Array<{ title: string; explanation: string; evidenceIds: string[]; severity: "low" | "medium" | "high" }>;
  annotations: Array<{ evidenceIds: string[]; insight: string; tags: string[]; grounding: string }>;
  selfGrounding: string[]; nextSteps: Array<{ title: string; reason: string }>;
  risk: { level: "低" | "中" | "高" | "紧急"; reasons: string[] };
};

type EvidenceUnit = { id: string; text: string };

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

function splitEvidenceText(text: string) {
  const normalised = text.replace(/\r\n?/g, "\n").trim();
  if (!normalised) return [];
  const numbered = normalised.replace(/([。.！？!?；;])\s*(?=\d+[.、)]\s*)/g, "$1\n");
  const blocks = numbered.split(/\n(?=\s*\d+[.、)]\s*)|\n+/).map((item) => item.trim()).filter(Boolean);
  const result: string[] = [];
  for (const block of blocks) {
    if (/^\d+[.、)]\s*/.test(block) && block.length <= 160) { result.push(block); continue; }
    const sentences = block.match(/[^。.！？!?；;]+[。.！？!?；;]?/g)?.map((item) => item.trim()).filter(Boolean) || [block];
    for (const sentence of sentences) {
      if (sentence.length <= 160) { result.push(sentence); continue; }
      for (let start = 0; start < sentence.length; start += 160) result.push(sentence.slice(start, start + 160));
    }
  }
  return result;
}

function buildEvidenceUnits(otherText: string, myText: string) {
  let index = 0;
  const make = (text: string) => splitEvidenceText(text).map((value) => ({ id: `E${index += 1}`, text: value }));
  const other = make(otherText); const mine = make(myText);
  return { other, mine, all: [...other, ...mine] };
}

function evidenceText(ids: string[], evidence: Map<string, string>) {
  return [...new Set(ids)].flatMap((id) => evidence.has(id) ? [evidence.get(id) as string] : []);
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
  const summary = cleanString(row.summary, 130); const coreShift = cleanString(row.coreShift, 90);
  const steps = cleanObjects(row.interactionSteps, 4); const pushes = cleanObjects(row.pushes, 2); const reasonable = cleanObjects(row.reasonableParts, 2);
  const concerns = cleanObjects(row.concerns, 3); const annotations = cleanObjects(row.annotations, 4); const next = cleanObjects(row.nextSteps, 2);
  const grounding = cleanStrings(row.selfGrounding, 2, 80); const risk = row.risk as Record<string, unknown> | null;
  if (!summary || !coreShift || !steps || !pushes || !reasonable || !concerns || !annotations || !next || !grounding || !risk) return null;
  const interactionSteps = steps.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const explanation = cleanString(item?.explanation, 95); const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8); return title && explanation && evidenceIds ? { title, explanation, evidenceIds } : null; });
  const parsedPushes = pushes.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const explanation = cleanString(item?.explanation, 95); const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8); return title && explanation && evidenceIds ? { title, explanation, evidenceIds } : null; });
  const reasonableParts = reasonable.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const explanation = cleanString(item?.explanation, 95); const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8); return title && explanation && evidenceIds ? { title, explanation, evidenceIds } : null; });
  const parsedConcerns = concerns.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const explanation = cleanString(item?.explanation, 95); const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8); return title && explanation && evidenceIds && ["low", "medium", "high"].includes(String(item.severity)) ? { title, explanation, evidenceIds, severity: item.severity as "low" | "medium" | "high" } : null; });
  const parsedAnnotations = annotations.map((entry) => { const item = entry as Record<string, unknown>; const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8, false); const tags = cleanStrings(item?.tags, 2, 18); const insight = cleanString(item?.insight, 120); const note = cleanString(item?.grounding, 70); return evidenceIds && tags && insight && note ? { evidenceIds, tags, insight, grounding: note } : null; });
  const nextSteps = next.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const reason = cleanString(item?.reason, 80); return title && reason ? { title, reason } : null; });
  const reasons = cleanStrings(risk.reasons, 2, 80);
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

function mapCompact(value: CompactAnalysis, evidenceUnits: EvidenceUnit[], urgent: boolean): AiAnalysis {
  const evidence = new Map(evidenceUnits.map((item) => [item.id, item.text]));
  const steps = value.interactionSteps.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const pushes = value.pushes.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const reasonable = value.reasonableParts.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const concerns = value.concerns.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const annotations = value.annotations.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const riskLevel = urgent ? "紧急" : value.risk.level === "紧急" ? "高" : value.risk.level;
  return dedupeAnalysis({
    mode: "ai", statusReason: "success", overview: value.summary,
    evidenceBoundary: { observed: [], likely: [value.coreShift], uncertain: [] },
    interactionPattern: { title: value.coreShift, steps: steps.map(({ item, quotes }) => ({ action: `${item.title}：${item.explanation}`, evidence: quotes })), explanation: value.coreShift },
    whatTheyArePushing: pushes.map(({ item, quotes }) => ({ point: `${item.title}：${item.explanation}`, evidence: quotes, confidence: "中" })),
    reasonableParts: reasonable.map(({ item }) => `${item.title}：${item.explanation}`),
    concerningParts: concerns.map(({ item, quotes }) => ({ label: item.title, explanation: item.explanation, evidence: quotes, severity: item.severity === "high" ? "high" : item.severity === "medium" ? "pressure" : "notice", confidence: item.severity === "low" ? "中" : "高" })),
    keyAnnotations: annotations.map(({ item, quotes }) => ({ quotes, tags: item.tags, keyPoint: item.insight, grounding: item.grounding, uncertainty: "" })),
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
      model, temperature: 0.2, max_tokens: 950, stream: false, messages,
      provider: { require_parameters: true, data_collection: "deny", sort: "throughput", allow_fallbacks: false },
      plugins: [{ id: "response-healing" }],
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
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const evidence = buildEvidenceUnits(otherText, myText);
    const formatEvidence = (items: EvidenceUnit[]) => items.map((item) => `${item.id}: ${item.text}`).join("\n") || "(none)";
    const messages = [
      { role: "system", content: conversationAnalysisGuidelines(language) },
      { role: "user", content: `Language: ${language}. Context: ${contextLabel(context, language)}.\nOther person's evidence:\n${formatEvidence(evidence.other)}\n\nUser's evidence:\n${formatEvidence(evidence.mine)}\n\nOnly return JSON matching the Schema. Evidence may cite only the supplied E identifiers. Do not repeat full source text. Do not output Markdown or explanations.` },
    ];
    const response = await callAnalysisApi(apiUrl, apiKey, model, messages, controller.signal);
    if (!response.ok) return localResponse(otherText, myText, language, context, statusForHttp(response.status));
    const data = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }>; usage?: { completion_tokens?: number } };
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
    const analysis = mapCompact(compact, evidence.all, hasExplicitUrgentSignal(`${otherText}\n${myText}`));
    return Response.json({ mode: "ai", analysis, fallback: false, completionTokens: Number.isFinite(data.usage?.completion_tokens) ? data.usage?.completion_tokens : null });
  } catch (error) {
    return localResponse(otherText, myText, language, context, error instanceof DOMException && error.name === "AbortError" ? "upstream_timeout" : "unknown");
  } finally { clearTimeout(timeout); }
}
