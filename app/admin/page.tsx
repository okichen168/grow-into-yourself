"use client";

import { useState } from "react";
import Link from "next/link";

type Row = Record<string, string | number | boolean | null>;

export default function AdminPage() {
  const [key, setKey] = useState(""); const [posts, setPosts] = useState<Row[]>([]); const [replies, setReplies] = useState<Row[]>([]); const [feedback, setFeedback] = useState<Row[]>([]); const [error, setError] = useState("");
  async function load() { const r = await fetch("/api/admin", { headers: { "x-admin-key": key } }); const d = await r.json(); if (!r.ok) return setError(d.error || "无法进入"); setPosts(d.posts); setReplies(d.replies || []); setFeedback(d.feedback); setError(""); sessionStorage.setItem("grow-admin", key); }
  async function update(kind: "post" | "reply" | "feedback", id: number, status: string) { await fetch("/api/admin", { method: "PATCH", headers: { "content-type": "application/json", "x-admin-key": key }, body: JSON.stringify({ kind, id, status }) }); await load(); }
  function download() { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), posts, replies, feedback }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `长成自己-后台导出-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  return <main className="admin-page"><Link href="/">← 返回网站</Link><h1>内容审核台</h1><p>后台只查看用户主动提交的匿名留言和产品反馈；不会看到本机识别的截图、自查答案或聊天分析。</p>
    <div className="admin-login"><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="输入管理密钥" /><button onClick={load}>进入 / 刷新</button>{error && <span>{error}</span>}</div>
    {(posts.length > 0 || feedback.length > 0) && <button className="export-button" onClick={download}>导出全部 JSON</button>}
    <section><h2>互助留言（{posts.length}）</h2>{posts.length ? posts.map((row) => <article className="admin-card" key={`p-${row.id}`}><b>{String(row.topic)} · {String(row.status)} · 风险 {String(row.riskLevel)}</b><p>{String(row.content)}</p><small>{String(row.createdAt)}</small><div><button onClick={() => update("post", Number(row.id), "approved")}>通过</button><button onClick={() => update("post", Number(row.id), "rejected")}>拒绝</button><button onClick={() => update("post", Number(row.id), "pending")}>待定</button></div></article>) : <p>登录后显示，或目前暂无内容。</p>}</section>
    <section><h2>鼓励回复（{replies.length}）</h2>{replies.map((row) => <article className="admin-card" key={`r-${row.id}`}><b>回复留言 #{String(row.postId)} · {String(row.status)}</b><p>{String(row.content)}</p><small>{String(row.createdAt)}</small><div><button onClick={() => update("reply", Number(row.id), "approved")}>通过</button><button onClick={() => update("reply", Number(row.id), "rejected")}>拒绝</button><button onClick={() => update("reply", Number(row.id), "pending")}>待定</button></div></article>)}</section>
    <section><h2>改进反馈（{feedback.length}）</h2>{feedback.map((row) => <article className="admin-card" key={`f-${row.id}`}><b>{String(row.category)} · {String(row.status)}</b><p>{String(row.content)}</p><small>同意改进：{row.consentToImprove ? "是" : "否"} · {String(row.createdAt)}</small><div><button onClick={() => update("feedback", Number(row.id), "reviewed")}>已阅</button><button onClick={() => update("feedback", Number(row.id), "archived")}>归档</button></div></article>)}</section>
  </main>;
}
