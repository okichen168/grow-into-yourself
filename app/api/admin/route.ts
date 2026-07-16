import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { communityPosts, communityReplies, feedbackItems } from "../../../db/schema";

async function authorized(request: Request) {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as { ADMIN_KEY?: string };
  const expected = runtime.ADMIN_KEY;
  return Boolean(expected && request.headers.get("x-admin-key") === expected);
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const db = await getDb();
    const [posts, replies, feedback] = await Promise.all([
      db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt), desc(communityPosts.id)).limit(300),
      db.select().from(communityReplies).orderBy(desc(communityReplies.createdAt), desc(communityReplies.id)).limit(500),
      db.select().from(feedbackItems).orderBy(desc(feedbackItems.createdAt), desc(feedbackItems.id)).limit(300),
    ]);
    return Response.json({ posts, replies, feedback });
  } catch {
    return Response.json({ error: "Admin data is unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const payload = (await request.json()) as { kind?: "post" | "reply" | "feedback"; id?: number; status?: string };
    const id = Number(payload.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid record" }, { status: 400 });
    const db = await getDb();
    if (payload.kind === "post") {
      if (!['approved', 'rejected', 'pending'].includes(payload.status ?? "")) return Response.json({ error: "Invalid status" }, { status: 400 });
      await db.update(communityPosts).set({ status: payload.status, reviewedAt: new Date().toISOString() }).where(eq(communityPosts.id, id));
    } else if (payload.kind === "reply") {
      if (!["approved", "rejected", "pending"].includes(payload.status ?? "")) return Response.json({ error: "Invalid status" }, { status: 400 });
      await db.update(communityReplies).set({ status: payload.status, reviewedAt: new Date().toISOString() }).where(eq(communityReplies.id, id));
    } else {
      if (!['new', 'reviewed', 'archived'].includes(payload.status ?? "")) return Response.json({ error: "Invalid status" }, { status: 400 });
      await db.update(feedbackItems).set({ status: payload.status }).where(eq(feedbackItems.id, id));
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}
