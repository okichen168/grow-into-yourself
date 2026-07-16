import { getDb } from "../../../db";
import { feedbackItems } from "../../../db/schema";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { category?: string; rating?: number; content?: string; consentToImprove?: boolean; website?: string };
    if (payload.website) return Response.json({ ok: true }, { status: 201 });
    const content = payload.content?.replace(/\s+/g, " ").trim() ?? "";
    if (content.length < 4 || content.length > 800) return Response.json({ error: "反馈请控制在4—800字" }, { status: 400 });
    const rating = Number.isFinite(payload.rating) ? Math.max(1, Math.min(5, Number(payload.rating))) : null;
    const db = await getDb();
    await db.insert(feedbackItems).values({
      category: payload.category?.trim().slice(0, 30) || "体验建议",
      rating,
      content,
      consentToImprove: Boolean(payload.consentToImprove),
    });
    return Response.json({ ok: true, message: "收到。只有你明确勾选的反馈才会进入改进样本。" }, { status: 201 });
  } catch {
    return Response.json({ error: "暂时无法提交，请稍后再试" }, { status: 500 });
  }
}
