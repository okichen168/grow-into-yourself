"use client";

import { useState } from "react";
import Link from "next/link";

type Row = Record<string, string | number | boolean | null>;

export default function AdminPage() {
  const [key, setKey] = useState(""); const [posts, setPosts] = useState<Row[]>([]); const [replies, setReplies] = useState<Row[]>([]); const [feedback, setFeedback] = useState<Row[]>([]); const [error, setError] = useState("");
  async function load() { const r = await fetch("/api/admin", { headers: { "x-admin-key": key } }); const d = await r.json(); if (!r.ok) return setError(d.error || "Access unavailable"); setPosts(d.posts); setReplies(d.replies || []); setFeedback(d.feedback); setError(""); sessionStorage.setItem("grow-admin", key); }
  async function update(kind: "post" | "reply" | "feedback", id: number, status: string) { await fetch("/api/admin", { method: "PATCH", headers: { "content-type": "application/json", "x-admin-key": key }, body: JSON.stringify({ kind, id, status }) }); await load(); }
  function download() { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), posts, replies, feedback }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `grow-into-yourself-export-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  return <main className="admin-page"><Link href="/">← Back to site</Link><h1>Content admin</h1><p>This area only shows community notes and product feedback that people actively submitted. It does not receive self-check answers or private chat analysis.</p>
    <div className="admin-login"><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter admin key" /><button onClick={load}>Open / refresh</button>{error && <span>{error}</span>}</div>
    {(posts.length > 0 || feedback.length > 0) && <button className="export-button" onClick={download}>Export JSON</button>}
    <section><h2>Community notes ({posts.length})</h2>{posts.length ? posts.map((row) => <article className="admin-card" key={`p-${row.id}`}><b>{String(row.topic)} · {String(row.status)} · risk {String(row.riskLevel)}</b><p>{String(row.content)}</p><small>{String(row.createdAt)}</small><div><button onClick={() => update("post", Number(row.id), "approved")}>Approve</button><button onClick={() => update("post", Number(row.id), "rejected")}>Reject</button><button onClick={() => update("post", Number(row.id), "pending")}>Hold</button></div></article>) : <p>Sign in to view submitted notes.</p>}</section>
    <section><h2>Supportive replies ({replies.length})</h2>{replies.map((row) => <article className="admin-card" key={`r-${row.id}`}><b>Reply to note #{String(row.postId)} · {String(row.status)}</b><p>{String(row.content)}</p><small>{String(row.createdAt)}</small><div><button onClick={() => update("reply", Number(row.id), "approved")}>Approve</button><button onClick={() => update("reply", Number(row.id), "rejected")}>Reject</button><button onClick={() => update("reply", Number(row.id), "pending")}>Hold</button></div></article>)}</section>
    <section><h2>Product feedback ({feedback.length})</h2>{feedback.map((row) => <article className="admin-card" key={`f-${row.id}`}><b>{String(row.category)} · {String(row.status)}</b><p>{String(row.content)}</p><small>Permission to improve: {row.consentToImprove ? "yes" : "no"} · {String(row.createdAt)}</small><div><button onClick={() => update("feedback", Number(row.id), "reviewed")}>Reviewed</button><button onClick={() => update("feedback", Number(row.id), "archived")}>Archive</button></div></article>)}</section>
  </main>;
}
