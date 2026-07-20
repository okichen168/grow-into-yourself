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

export const SERVER_AI_TIMEOUT_MS = 45_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const compactString = (maxLength: number) => ({ type: "string", maxLength });
const compactStringArray = (maxItems: number, maxLength = 90) => ({ type: "array", maxItems, items: compactString(maxLength) });
const compactAnalysisSchema = {
  type: "object", additionalProperties: false,
  required: ["coreShift", "interaction", "findings", "nextSteps", "risk"],
  properties: {
    coreShift: compactString(100),
    interaction: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "insight", "evidenceIds"], properties: { title: compactString(18), insight: compactString(110), evidenceIds: compactStringArray(2, 8) } } },
    findings: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["kind", "title", "insight", "evidenceIds", "grounding"], properties: { kind: { type: "string", enum: ["reasonable", "concern", "contradiction", "power"] }, title: compactString(18), insight: compactString(110), evidenceIds: compactStringArray(2, 8), grounding: compactString(70) } } },
    nextSteps: { type: "array", maxItems: 2, items: { type: "object", additionalProperties: false, required: ["title", "reason"], properties: { title: compactString(18), reason: compactString(75) } } },
    risk: { type: "object", additionalProperties: false, required: ["level", "reasons"], properties: { level: { type: "string", enum: ["低", "中", "高", "紧急"] }, reasons: compactStringArray(2, 80) } },
  },
} as const;

type AiInsightOverlay = {
  coreShift: string;
  interaction: Array<{ title: string; insight: string; evidenceIds: string[] }>;
  findings: Array<{ kind: "reasonable" | "concern" | "contradiction" | "power"; title: string; insight: string; evidenceIds: string[]; grounding: string }>;
  nextSteps: Array<{ title: string; reason: string }>;
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

function parseCompact(value: unknown): AiInsightOverlay | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const coreShift = cleanString(row.coreShift, 100); const interactions = cleanObjects(row.interaction, 4); const findings = cleanObjects(row.findings, 5); const next = cleanObjects(row.nextSteps, 2);
  const risk = row.risk as Record<string, unknown> | null;
  if (!coreShift || !interactions || !findings || !next || !risk) return null;
  const interaction = interactions.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const insight = cleanString(item?.insight, 110); const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8, false); return title && insight && evidenceIds ? { title, insight, evidenceIds } : null; });
  const parsedFindings = findings.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const insight = cleanString(item?.insight, 110); const evidenceIds = cleanStrings(item?.evidenceIds, 2, 8, false); const grounding = cleanString(item?.grounding, 70); const kind = String(item.kind); return title && insight && evidenceIds && grounding && ["reasonable", "concern", "contradiction", "power"].includes(kind) ? { kind: kind as AiInsightOverlay["findings"][number]["kind"], title, insight, evidenceIds, grounding } : null; });
  const nextSteps = next.map((entry) => { const item = entry as Record<string, unknown>; const title = cleanString(item?.title, 18); const reason = cleanString(item?.reason, 75); return title && reason ? { title, reason } : null; });
  const reasons = cleanStrings(risk.reasons, 2, 80);
  if ([...interaction, ...parsedFindings, ...nextSteps].some((item) => !item) || !reasons || !["低", "中", "高", "紧急"].includes(String(risk.level))) return null;
  return { coreShift, interaction: interaction as AiInsightOverlay["interaction"], findings: parsedFindings as AiInsightOverlay["findings"], nextSteps: nextSteps as AiInsightOverlay["nextSteps"], risk: { level: risk.level as AiInsightOverlay["risk"]["level"], reasons } };
}

function nextStepType(title: string, reason: string): NextStepType {
  const text = `${title} ${reason}`;
  if (/不回复|暂停|沉默|pause|no reply/i.test(text)) return "no_reply";
  if (/核对|澄清|具体|check|clarif/i.test(text)) return "clarify";
  if (/安全|危险|safety|danger/i.test(text)) return "safety";
  return "observe";
}

function mergeOverlay(local: AiAnalysis, value: AiInsightOverlay, evidenceUnits: EvidenceUnit[], urgent: boolean, language: AnalysisLanguage): AiAnalysis {
  const evidence = new Map(evidenceUnits.map((item) => [item.id, item.text]));
  const interaction = value.interaction.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const findings = value.findings.map((item) => ({ item, quotes: evidenceText(item.evidenceIds, evidence) })).filter((entry) => entry.quotes.length);
  const reasonable = findings.filter(({ item }) => item.kind === "reasonable");
  const concerns = findings.filter(({ item }) => item.kind !== "reasonable");
  const grounding = [...new Set([...findings.map(({ item }) => item.grounding), ...local.selfGrounding])].slice(0, 3);
  const annotations = findings.filter(({ item }, index, all) => all.findIndex(({ item: prior }) => prior.insight === item.insight) === index).map(({ item, quotes }) => ({ quotes, tags: [item.kind], keyPoint: item.insight, grounding: item.grounding, uncertainty: "" })).slice(0, 5);
  const canOverrideRisk = findings.length > 0 && value.risk.reasons.length > 0;
  const riskLevel = urgent ? "紧急" : canOverrideRisk ? (value.risk.level === "紧急" ? "高" : value.risk.level) : local.risk.level;
  const separator = language === "zh" ? "。" : ". ";
  const overview = local.overview.includes(value.coreShift) ? local.overview : `${value.coreShift}${separator}${local.overview}`;
  const merged = dedupeAnalysis({
    ...local, mode: "ai", statusReason: "success", overview,
    evidenceBoundary: { ...local.evidenceBoundary, likely: [value.coreShift] },
    interactionPattern: interaction.length >= 3 ? { title: value.coreShift, steps: interaction.map(({ item, quotes }) => ({ action: `${item.title}：${item.insight}`, evidence: quotes })), explanation: value.coreShift } : local.interactionPattern,
    reasonableParts: reasonable.length ? reasonable.map(({ item }) => `${item.title}：${item.insight}`) : local.reasonableParts,
    concerningParts: concerns.length ? concerns.map(({ item, quotes }) => ({ label: item.title, explanation: item.insight, evidence: quotes, severity: item.kind === "power" && ["高", "紧急"].includes(riskLevel) ? "high" as const : item.kind === "contradiction" ? "notice" as const : "pressure" as const, confidence: item.kind === "contradiction" ? "中" as const : "高" as const })) : local.concerningParts,
    keyAnnotations: annotations.length ? annotations : local.keyAnnotations,
    selfGrounding: grounding,
    nextStepOptions: value.nextSteps.length ? value.nextSteps.map((item) => ({ type: nextStepType(item.title, item.reason), title: item.title, reason: item.reason, message: "" })) : local.nextStepOptions,
    risk: { level: riskLevel, reasons: canOverrideRisk ? value.risk.reasons : local.risk.reasons, urgentWarning: urgent ? (language === "zh" ? "文字中出现明确的现实危险信号，请优先确认人身安全。" : "The text contains an explicit real-world danger signal. Prioritise immediate safety.") : local.risk.urgentWarning },
  });
  return { ...merged, keyAnnotations: annotations.length ? annotations : merged.keyAnnotations };
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

function localResponse(base: AiAnalysis, statusReason: AnalysisStatusReason) {
  const analysis = { ...base, mode: "local" as const, statusReason };
  return Response.json({ mode: "local", analysis, fallback: true });
}

async function callAnalysisApi(url: string, key: string, model: string, messages: Array<{ role: string; content: string }>, signal: AbortSignal) {
  return fetch(url, {
    method: "POST", signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.2, max_tokens: 900, stream: false, messages,
      provider: { require_parameters: true, data_collection: "deny", sort: "throughput", allow_fallbacks: true },
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
  const local = analyzeConversationLocally({ otherText, myText, language, context, statusReason: "success" });
  if (isRateLimited(request)) return localResponse(local, "quota");

  const apiKey = process.env.ANALYSIS_API_KEY; const apiUrl = process.env.ANALYSIS_API_URL; const model = process.env.ANALYSIS_MODEL;
  if (!apiKey || !apiUrl || !model || process.env.ANALYSIS_STRICT_PRIVACY !== "true") return localResponse(local, "runtime_config_missing");
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const evidence = buildEvidenceUnits(otherText, myText);
    const formatEvidence = (items: EvidenceUnit[]) => items.map((item) => `${item.id}: ${item.text}`).join("\n") || "(none)";
    const messages = [
      { role: "system", content: conversationAnalysisGuidelines(language) },
      { role: "user", content: `Language: ${language}. Context: ${contextLabel(context, language)}.\nOther person's evidence:\n${formatEvidence(evidence.other)}\n\nUser's evidence:\n${formatEvidence(evidence.mine)}\n\nOnly return JSON matching the Schema. Evidence may cite only the supplied E identifiers. Do not repeat full source text. Do not output Markdown or explanations.` },
    ];
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new DOMException("Analysis deadline reached", "AbortError")); }, SERVER_AI_TIMEOUT_MS); });
    const response = await Promise.race([callAnalysisApi(apiUrl, apiKey, model, messages, controller.signal), deadline]);
    if (!response.ok) return localResponse(local, statusForHttp(response.status));
    const data = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }>; usage?: { completion_tokens?: number } };
    const choice = data.choices?.[0];
    if (!choice) return localResponse(local, "invalid_output_empty");
    if (choice.message?.refusal) return localResponse(local, "invalid_output_refusal");
    if (choice.finish_reason === "length") return localResponse(local, "invalid_output_truncated");
    const content = extractContent(choice.message?.content);
    if (!content || content === "") return localResponse(local, "invalid_output_empty");
    let parsed: unknown = content;
    if (typeof content === "string") { try { parsed = JSON.parse(content); } catch { return localResponse(local, "invalid_output_json_syntax"); } }
    const compact = parseCompact(parsed);
    if (!compact) return localResponse(local, "invalid_output_schema");
    const analysis = mergeOverlay(local, compact, evidence.all, hasExplicitUrgentSignal(`${otherText}\n${myText}`), language);
    return Response.json({ mode: "ai", analysis, fallback: false, completionTokens: Number.isFinite(data.usage?.completion_tokens) ? data.usage?.completion_tokens : null });
  } catch (error) {
    return localResponse(local, error instanceof DOMException && error.name === "AbortError" ? "timeout" : "unknown");
  } finally { if (timeout) clearTimeout(timeout); }
}
