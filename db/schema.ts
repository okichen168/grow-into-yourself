import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const communityPosts = sqliteTable("community_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  topic: text("topic").notNull().default("想对姐妹说"),
  status: text("status").notNull().default("pending"),
  riskLevel: text("risk_level").notNull().default("none"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
});

export const feedbackItems = sqliteTable("feedback_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull().default("体验建议"),
  rating: integer("rating"),
  content: text("content").notNull(),
  consentToImprove: integer("consent_to_improve", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
