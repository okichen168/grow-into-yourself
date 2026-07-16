import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { communityPosts } from "../../../db/schema";

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
      .select({ id: communityPosts.id, content: communityPosts.content, topic: communityPosts.topic, createdAt: communityPosts.createdAt })
      .from(communityPosts)
      .where(eq(communityPosts.status, "approved"))
      .orderBy(desc(communityPosts.reviewedAt), desc(communityPosts.id))
      .limit(36);
    return Response.json({ posts });
  } catch {
    return Response.json({ posts: [] });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { content?: string; topic?: string; privacyConfirmed?: boolean; website?: string };
    if (payload.website) return Response.json({ ok: true }, { status: 201 });
    const content = payload.content?.replace(/\s+/g, " ").trim() ?? "";
    const topic = payload.topic?.trim().slice(0, 24) || "想对姐妹说";
    if (!payload.privacyConfirmed) return Response.json({ error: "请先确认已删除身份信息" }, { status: 400 });
    if (content.length < 8 || content.length > 180) return Response.json({ error: "留言请控制在8—180字" }, { status: 400 });
    if (contactPattern.test(content)) return Response.json({ error: "请删除电话、微信、账号或链接后再提交" }, { status: 400 });
    const risk = riskLevel(content);
    const db = await getDb();
    await db.insert(communityPosts).values({ content, topic, riskLevel: risk, status: "pending" });
    return Response.json({
      ok: true,
      message: risk === "urgent"
        ? "留言已进入人工审核。文字中可能包含紧急危险信号；请不要等待审核，正在发生危险请联系110/120，心理危机可拨12356。"
        : "留言已匿名提交。审核通过后才会出现在互助墙。",
      urgent: risk === "urgent",
    }, { status: 201 });
  } catch {
    return Response.json({ error: "暂时无法提交，请稍后再试" }, { status: 500 });
  }
}
