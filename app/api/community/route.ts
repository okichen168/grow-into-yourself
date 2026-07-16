import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { communityPosts, communityReplies } from "../../../db/schema";

const urgentSignals = ["自杀", "跳楼", "割腕", "杀了", "弄死", "一起死", "打死", "砍死", "伤害孩子", "不想活"];
const highSignals = ["跟踪", "定位", "门口等你", "不让你走", "锁门", "扣身份证", "没收工资", "冻结银行卡"];
const contactPattern = /(1[3-9]\d{9})|微信|vx|v信|qq|https?:\/\/|@[\w.-]+/i;

function riskLevel(content: string) {
  if (urgentSignals.some((signal) => content.includes(signal))) return "urgent";
  if (highSignals.some((signal) => content.includes(signal))) return "high";
  return "none";
}

export async function GET() {
  try {
    const db = await getDb();
    const posts = await db
      .select({ id: communityPosts.id, content: communityPosts.content, topic: communityPosts.topic, language: communityPosts.language, countryCode: communityPosts.countryCode, countryName: communityPosts.countryName, region: communityPosts.region, city: communityPosts.city, latitude: communityPosts.latitude, longitude: communityPosts.longitude, hearts: communityPosts.hearts, createdAt: communityPosts.createdAt })
      .from(communityPosts)
      .where(eq(communityPosts.status, "approved"))
      .orderBy(desc(communityPosts.reviewedAt), desc(communityPosts.id))
      .limit(36);
    const replies = posts.length ? await db.select({ id: communityReplies.id, postId: communityReplies.postId, content: communityReplies.content, language: communityReplies.language, createdAt: communityReplies.createdAt }).from(communityReplies).where(and(eq(communityReplies.status, "approved"), inArray(communityReplies.postId, posts.map((post) => post.id)))).orderBy(communityReplies.createdAt).limit(180) : [];
    return Response.json({ posts: posts.map((post) => ({ ...post, replies: replies.filter((reply) => reply.postId === post.id) })) });
  } catch {
    return Response.json({ posts: [] });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { content?: string; topic?: string; privacyConfirmed?: boolean; website?: string; parentId?: number; language?: string; countryCode?: string; countryName?: string; region?: string; city?: string; latitude?: number; longitude?: number };
    if (payload.website) return Response.json({ ok: true }, { status: 201 });
    const content = payload.content?.replace(/\s+/g, " ").trim() ?? "";
    const language = payload.language === "en" ? "en" : "zh";
    if (Number.isInteger(payload.parentId)) {
      if (content.length < 2 || content.length > 120) return Response.json({ error: language === "en" ? "Keep it between 2 and 120 characters." : "鼓励留言请控制在2—120字" }, { status: 400 });
      if (contactPattern.test(content)) return Response.json({ error: language === "en" ? "Please remove contact details or links." : "请删除联系方式或链接" }, { status: 400 });
      const db = await getDb();
      await db.insert(communityReplies).values({ postId: Number(payload.parentId), content, language, status: "pending" });
      return Response.json({ ok: true, message: language === "en" ? "Sent. It’ll show after a quick safety check." : "已送出，安全审核后会显示。" }, { status: 201 });
    }
    const topic = payload.topic?.trim().slice(0, 24) || "想对姐妹说";
    if (!payload.privacyConfirmed) return Response.json({ error: language === "en" ? "Please confirm you’ve removed identifying details." : "请先确认已删除身份信息" }, { status: 400 });
    if (content.length < 8 || content.length > 180) return Response.json({ error: language === "en" ? "Keep your note between 8 and 180 characters." : "留言请控制在8—180字" }, { status: 400 });
    if (contactPattern.test(content)) return Response.json({ error: language === "en" ? "Please remove phone numbers, handles or links." : "请删除电话、微信、账号或链接后再提交" }, { status: 400 });
    const risk = riskLevel(content);
    const db = await getDb();
    const latitude = Number(payload.latitude); const longitude = Number(payload.longitude);
    await db.insert(communityPosts).values({ content, topic, riskLevel: risk, language, countryCode: payload.countryCode?.slice(0, 3), countryName: payload.countryName?.slice(0, 60), region: payload.region?.trim().slice(0, 60), city: payload.city?.trim().slice(0, 60), latitude: Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? latitude : null, longitude: Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? longitude : null, status: "pending" });
    return Response.json({
      ok: true,
      message: risk === "urgent"
        ? (language === "en" ? "Your note is in review. It may mention immediate danger — please contact local emergency help now rather than waiting here." : "留言已进入人工审核。文字中可能包含紧急危险信号；请不要等待审核，正在发生危险请联系110/120，心理危机可拨12356。")
        : (language === "en" ? "Sent anonymously. It’ll appear after a safety check." : "留言已匿名提交。审核通过后才会出现在互助墙。"),
      urgent: risk === "urgent",
    }, { status: 201 });
  } catch {
    return Response.json({ error: "暂时无法提交，请稍后再试" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid post" }, { status: 400 });
    const db = await getDb();
    await db.update(communityPosts).set({ hearts: sql`MIN(${communityPosts.hearts} + 1, 999999)` }).where(eq(communityPosts.id, id));
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Couldn’t send the heart. Try again." }, { status: 500 }); }
}
