import { conversationAnalysisGuidelines } from "../../lib/conversation-analysis-guidelines";
import {
  dedupeAnalysis,
  hasExplicitUrgentSignal,
  normaliseInput,
  type AiAnalysis,
  type AnalysisContext,
  type AnalysisLanguage,
  type Certainty,
  type ConcernSeverity,
  type NextStepType,
} from "../../lib/analyze-shared";

export const runtime = "edge";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "overview", "interactionPattern", "whatTheyArePushing", "reasonableParts", "concerningParts", "keyAnnotations", "selfGrounding", "nextStepOptions", "risk"],
  properties: {
    mode: { type: "string", const: "ai" },
    overview: { type: "string" },
    interactionPattern: {
      type: "object", additionalProperties: false, required: ["title", "steps", "explanation"],
      properties: { title: { type: "string" }, steps: { type: "array", maxItems: 5, items: { type: "string" } }, explanation: { type: "string" } },
    },
    whatTheyArePushing: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["point", "evidence", "certainty"],
        properties: {
          point: { type: "string" }, evidence: { type: "array", maxItems: 3, items: { type: "string" } },
          certainty: { type: "string", enum: ["明确", "较可能", "不确定", "clear", "likely", "uncertain"] },
        },
      },
    },
    reasonableParts: { type: "array", items: { type: "string" } },
    concerningParts: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["label", "explanation", "severity"],
        properties: { label: { type: "string" }, explanation: { type: "string" }, severity: { type: "string", enum: ["notice", "pressure", "high"] } },
      },
    },
    keyAnnotations: {
      type: "array", minItems: 2, maxItems: 6, items: {
        type: "object", additionalProperties: false, required: ["quotes", "tags", "keyPoint", "grounding", "uncertainty"],
        properties: {
          quotes: { type: "array", minItems: 1, items: { type: "string" } }, tags: { type: "array", maxItems: 3, items: { type: "string" } },
          keyPoint: { type: "string" }, grounding: { type: "string" }, uncertainty: { type: "string" },
        },
      },
    },
    selfGrounding: { type: "array", items: { type: "string" } },
    nextStepOptions: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["type", "title", "reason", "message"],
        properties: {
          type: { type: "string", enum: ["no_reply", "observe", "clarify", "respond", "safety"] }, title: { type: "string" },
          reason: { type: "string" }, message: { type: "string" },
        },
      },
    },
    risk: {
      type: "object", additionalProperties: false, required: ["level", "reasons", "urgentWarning"],
      properties: {
        level: { type: "string", enum: ["低", "中", "高", "紧急", "Low", "Medium", "High", "Urgent"] },
        reasons: { type: "array", items: { type: "string" } }, urgentWarning: { type: "string" },
      },
    },
  },
} as const;

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const address = clientAddress(request);
  const current = rateBuckets.get(address);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(address, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function unavailable(language: AnalysisLanguage, status = 200) {
  return Response.json({
    mode: "unavailable",
    fallback: true,
    label: language === "zh" ? "基础模式" : "Basic mode",
    message: language === "zh" ? "深度分析暂时不可用，请稍后再试。" : "Deep analysis is temporarily unavailable. Please try again later.",
  }, { status });
}

function contextLabel(context: AnalysisContext, language: AnalysisLanguage) {
  const labels = {
    relationship: language === "zh" ? "伴侣或暧昧" : "partner or dating",
    family: language === "zh" ? "家人" : "family",
    workplace: language === "zh" ? "职场" : "workplace",
    friendship: language === "zh" ? "朋友或同学" : "friendship",
  };
  return labels[context];
}

function strings(value: unknown, maximum = 20) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean).slice(0, maximum);
}

function parseAnalysis(value: unknown, language: AnalysisLanguage, urgent: boolean): AiAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.mode !== "ai" || typeof row.overview !== "string" || !row.overview.trim()) return null;
  if (!row.interactionPattern || typeof row.interactionPattern !== "object" || Array.isArray(row.interactionPattern)) return null;
  const pattern = row.interactionPattern as Record<string, unknown>;
  const steps = strings(pattern.steps, 5);
  if (typeof pattern.title !== "string" || typeof pattern.explanation !== "string" || !steps) return null;

  const pushing = Array.isArray(row.whatTheyArePushing) ? row.whatTheyArePushing.slice(0, 8).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>; const evidence = strings(item.evidence, 3);
    const certainty = item.certainty as Certainty;
    if (typeof item.point !== "string" || !evidence || !["明确", "较可能", "不确定", "clear", "likely", "uncertain"].includes(certainty)) return null;
    return { point: item.point.trim(), evidence, certainty };
  }) : null;
  const reasonableParts = strings(row.reasonableParts, 8);
  const concerning = Array.isArray(row.concerningParts) ? row.concerningParts.slice(0, 8).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>; const severity = item.severity as ConcernSeverity;
    if (typeof item.label !== "string" || typeof item.explanation !== "string" || !["notice", "pressure", "high"].includes(severity)) return null;
    return { label: item.label.trim(), explanation: item.explanation.trim(), severity };
  }) : null;
  const annotations = Array.isArray(row.keyAnnotations) ? row.keyAnnotations.slice(0, 6).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>; const quotes = strings(item.quotes, 4); const tags = strings(item.tags, 3);
    if (!quotes?.length || !tags || [item.keyPoint, item.grounding, item.uncertainty].some((entry) => typeof entry !== "string")) return null;
    return { quotes, tags, keyPoint: String(item.keyPoint).trim(), grounding: String(item.grounding).trim(), uncertainty: String(item.uncertainty).trim() };
  }) : null;
  const selfGrounding = strings(row.selfGrounding, 6);
  const nextSteps = Array.isArray(row.nextStepOptions) ? row.nextStepOptions.slice(0, 5).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>; const type = item.type as NextStepType;
    if (!["no_reply", "observe", "clarify", "respond", "safety"].includes(type) || [item.title, item.reason, item.message].some((entry) => typeof entry !== "string")) return null;
    return { type, title: String(item.title).trim(), reason: String(item.reason).trim(), message: String(item.message).trim() };
  }) : null;
  if (!pushing || pushing.some((item) => !item) || !reasonableParts || !concerning || concerning.some((item) => !item) || !annotations || annotations.some((item) => !item) || !selfGrounding || !nextSteps || nextSteps.some((item) => !item)) return null;
  if (!row.risk || typeof row.risk !== "object" || Array.isArray(row.risk)) return null;
  const risk = row.risk as Record<string, unknown>; const reasons = strings(risk.reasons, 8);
  const allowedRisk = language === "zh" ? ["低", "中", "高", "紧急"] : ["Low", "Medium", "High", "Urgent"];
  if (typeof risk.level !== "string" || !allowedRisk.includes(risk.level) || !reasons || typeof risk.urgentWarning !== "string") return null;
  const level = urgent ? (language === "zh" ? "紧急" : "Urgent") : (["紧急", "Urgent"].includes(risk.level) ? (language === "zh" ? "高" : "High") : risk.level);
  const urgentWarning = urgent
    ? (risk.urgentWarning.trim() || (language === "zh" ? "文字里出现了明确的现实危险信号，请优先确认人身安全。" : "The text includes an explicit real-world danger signal. Prioritise immediate safety."))
    : "";

  return dedupeAnalysis({
    mode: "ai", overview: row.overview.trim(),
    interactionPattern: { title: pattern.title.trim(), steps, explanation: pattern.explanation.trim() },
    whatTheyArePushing: pushing as AiAnalysis["whatTheyArePushing"], reasonableParts,
    concerningParts: concerning as AiAnalysis["concerningParts"], keyAnnotations: annotations as AiAnalysis["keyAnnotations"], selfGrounding,
    nextStepOptions: nextSteps as AiAnalysis["nextStepOptions"], risk: { level, reasons, urgentWarning },
  });
}

async function requestModel(apiKey: string, model: string, messages: Array<{ role: string; content: string }>, signal: AbortSignal) {
  const formats = [
    { type: "json_schema", json_schema: { name: "conversation_analysis", strict: true, schema: analysisSchema } },
    { type: "json_object" },
  ];
  for (const responseFormat of formats) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://clear-translate.creamy-scarf-2160.chatgpt.site", "X-Title": "Grow Into Yourself" },
      body: JSON.stringify({ model, temperature: 0.25, max_tokens: 3000, response_format: responseFormat, messages }),
    });
    if (response.ok) return response;
    if (responseFormat.type === "json_object") return null;
  }
  return null;
}

export async function POST(request: Request) {
  let payload: { otherText?: string; myText?: string; language?: AnalysisLanguage; context?: AnalysisContext };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const language: AnalysisLanguage = payload.language === "en" ? "en" : "zh";
  if (isRateLimited(request)) return Response.json({ error: language === "zh" ? "请求太频繁了，请一分钟后再试。" : "Too many requests. Please try again in one minute." }, { status: 429, headers: { "retry-after": "60" } });
  const context: AnalysisContext = ["relationship", "family", "workplace", "friendship"].includes(payload.context || "") ? payload.context as AnalysisContext : "relationship";
  const { otherText, myText } = normaliseInput(payload.otherText || "", payload.myText || "");
  if (otherText.length < 2) return Response.json({ error: language === "zh" ? "请先粘贴对方发来的话。" : "Please paste the other person’s messages first." }, { status: 400 });
  if ((payload.otherText || "").length > 6000 || (payload.myText || "").length > 3000) return Response.json({ error: language === "zh" ? "文字太长了，请删短一点再分析。" : "This is too long. Please shorten it before analysis." }, { status: 413 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return unavailable(language);
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const messages = [
      { role: "system", content: conversationAnalysisGuidelines(language) },
      { role: "user", content: `Language: ${language}. Relationship context: ${contextLabel(context, language)}.\n\nOther person's words:\n${otherText}\n\nUser's words or draft reply:\n${myText || "(none)"}\n\nReturn the specified structured analysis. Group related quotes; do not create one annotation per sentence. reasonableParts and nextStepOptions may be empty. A no_reply option is valid. Do not force a message.` },
    ];
    const response = await requestModel(apiKey, model, messages, controller.signal);
    if (!response) return unavailable(language);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return unavailable(language);
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { return unavailable(language); }
    const analysis = parseAnalysis(parsed, language, hasExplicitUrgentSignal(`${otherText}\n${myText}`));
    if (!analysis) return unavailable(language);
    return Response.json({ mode: "ai", analysis, fallback: false, model });
  } catch { return unavailable(language); } finally { clearTimeout(timeout); }
}
