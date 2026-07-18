import { hasExplicitUrgentSignal, localAnalyze, normaliseInput, type AiAnalysis, type AnalysisContext, type AnalysisLanguage } from "../../lib/analyze-shared";

export const runtime = "edge";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-chat-v3-0324:free";

function contextLabel(context: AnalysisContext, language: AnalysisLanguage) {
  const labels = {
    relationship: language === "zh" ? "伴侣/暧昧关系" : "partner or dating",
    family: language === "zh" ? "家人/原生家庭" : "family",
    workplace: language === "zh" ? "职场" : "workplace",
    friendship: language === "zh" ? "朋友/同学" : "friendship",
  };
  return labels[context] ?? labels.relationship;
}

function fallbackResponse(otherText: string, myText: string, language: AnalysisLanguage, status = 200) {
  return Response.json({ analysis: localAnalyze(otherText, myText, language), fallback: true }, { status });
}

function stringArray(value: unknown, maximum: number) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean).slice(0, maximum);
}

function parseAiAnalysis(value: unknown, language: AnalysisLanguage, hasUrgentSignal: boolean): AiAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const pressureSignals = stringArray(row.pressureSignals, 8);
  const myPattern = stringArray(row.myPattern, 6);
  if (!pressureSignals || !myPattern || !Array.isArray(row.sentenceAnalysis)) return null;
  if (!row.replyOptions || typeof row.replyOptions !== "object" || Array.isArray(row.replyOptions)) return null;

  const replies = row.replyOptions as Record<string, unknown>;
  if ([replies.soft, replies.firm, replies.exit].some((item) => typeof item !== "string" || !item.trim())) return null;
  const sentenceAnalysis = row.sentenceAnalysis.slice(0, 8).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const sentence = item as Record<string, unknown>;
    if ([sentence.original, sentence.pressure, sentence.whyItHurts, sentence.clearerReading].some((part) => typeof part !== "string" || !part.trim())) return null;
    return {
      original: String(sentence.original).trim(),
      pressure: String(sentence.pressure).trim(),
      whyItHurts: String(sentence.whyItHurts).trim(),
      clearerReading: String(sentence.clearerReading).trim(),
    };
  });
  if (sentenceAnalysis.some((item) => item === null)) return null;

  const allowedRisk = language === "zh" ? ["低", "中", "高", "紧急"] : ["Low", "Medium", "High", "Urgent"];
  if (typeof row.summary !== "string" || !row.summary.trim() || typeof row.suggestedReply !== "string" || !row.suggestedReply.trim() || typeof row.riskLevel !== "string" || !allowedRisk.includes(row.riskLevel)) return null;
  if (typeof row.urgentWarning !== "string") return null;
  const riskLevel = !hasUrgentSignal && (row.riskLevel === "紧急" || row.riskLevel === "Urgent")
    ? (language === "zh" ? "高" : "High")
    : row.riskLevel;

  return {
    summary: row.summary.trim(),
    pressureSignals,
    myPattern,
    sentenceAnalysis: sentenceAnalysis as AiAnalysis["sentenceAnalysis"],
    replyOptions: {
      soft: String(replies.soft).trim(),
      firm: String(replies.firm).trim(),
      exit: String(replies.exit).trim(),
    },
    suggestedReply: row.suggestedReply.trim(),
    riskLevel,
    urgentWarning: hasUrgentSignal
      ? row.urgentWarning.trim() || (language === "zh" ? "文字里出现了明确的现实安全信号。请优先确认安全，并联系可信的人或当地紧急支持。" : "The text includes an explicit real-world safety signal. Prioritise safety and contact trusted or local emergency support.")
      : "",
    source: "ai",
  };
}

export async function POST(request: Request) {
  let payload: { otherText?: string; myText?: string; language?: AnalysisLanguage; context?: AnalysisContext };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const language = payload.language === "en" ? "en" : "zh";
  const context: AnalysisContext = ["relationship", "family", "workplace", "friendship"].includes(payload.context || "") ? payload.context as AnalysisContext : "relationship";
  const { otherText, myText } = normaliseInput(payload.otherText || "", payload.myText || "");
  if (otherText.length < 2) return Response.json({ error: language === "zh" ? "请先粘贴对方发来的话。" : "Please paste the other person’s messages first." }, { status: 400 });
  if ((payload.otherText || "").length > 6000 || (payload.myText || "").length > 3000) {
    return Response.json({ error: language === "zh" ? "文字太长了，请删短一点再分析。" : "This is too long. Please shorten it before analysis." }, { status: 413 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallbackResponse(otherText, myText, language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://clear-translate.creamy-scarf-2160.chatgpt.site",
        "X-Title": "Grow Into Yourself",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 2200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a trauma-informed relationship clarity assistant for Chinese/English difficult chats.
Your output must feel like a careful annotated relationship reading, not a generic summary.
Do not diagnose NPD or any disorder. Do not call anyone evil. Do not invent facts. Do not say generic advice like "communicate well".
Look for guilt-tripping, moral kidnapping, emotional blackmail, shaming, threat, intimidation, responsibility shifting, invalidation, control over money/location/relationship/social circle, isolation, silent treatment, workplace bullying, friend-group exclusion.
Output strict JSON only with keys:
summary: a detailed but plain-language overview.
pressureSignals: 4-8 strings, each with a tactic name and evidence from the text.
myPattern: 2-5 strings about over-explaining, apologising, proving, boundary collapse, or blank if not applicable.
sentenceAnalysis: 4-8 objects with original, pressure, whyItHurts, clearerReading.
replyOptions: object with soft, firm, exit.
suggestedReply: the best one reply to copy.
riskLevel: Low/Medium/High/Urgent or 低/中/高/紧急.
urgentWarning: empty unless explicit threats, stalking, self-harm, harm to others, minors, confinement, forced return, financial control, or coercive control appear.`,
          },
          {
            role: "user",
            content: `Language: ${language}. Context: ${contextLabel(context, language)}.

Other person's messages:
${otherText}

My messages or draft reply:
${myText || "(empty)"}

Return warm, detailed, practical ${language === "zh" ? "Chinese" : "English"} JSON.
The reading should be specific enough to resemble red-pen annotation posts: quote important words, explain hidden pressure, explain why it hurts, and give a calmer boundary sentence.
riskLevel must be one of ${language === "zh" ? "低/中/高/紧急" : "Low/Medium/High/Urgent"}.
urgentWarning must be empty unless there are threats, stalking, self-harm, harm to others, minors, confinement, forced return, financial control, or coercive control.`,
          },
        ],
      }),
    });

    if (!response.ok) return fallbackResponse(otherText, myText, language);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    const analysis = parseAiAnalysis(JSON.parse(content), language, hasExplicitUrgentSignal(`${otherText}\n${myText}`));
    if (!analysis) return fallbackResponse(otherText, myText, language);
    return Response.json({ analysis, fallback: false });
  } catch {
    return fallbackResponse(otherText, myText, language);
  } finally {
    clearTimeout(timeout);
  }
}
