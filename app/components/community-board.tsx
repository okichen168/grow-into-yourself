"use client";

import { FormEvent, useEffect, useState } from "react";

type Post = { id: number; content: string; topic: string; createdAt: string };

export default function CommunityBoard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("想对姐妹说");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");

  useEffect(() => { fetch("/api/community").then((r) => r.json()).then((d) => setPosts(d.posts || [])).catch(() => undefined); }, []);

  async function submitPost(event: FormEvent) {
    event.preventDefault(); setNotice("正在提交…");
    const response = await fetch("/api/community", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: message, topic, privacyConfirmed: confirmed, website: "" }) });
    const data = await response.json(); setNotice(data.message || data.error || "暂时无法提交");
    if (response.ok) { setMessage(""); setConfirmed(false); }
  }

  async function submitFeedback(event: FormEvent) {
    event.preventDefault(); setFeedbackNotice("正在提交…");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: "产品优化", rating: 5, content: feedback, consentToImprove: true, website: "" }) });
    const data = await response.json(); setFeedbackNotice(data.message || data.error || "暂时无法提交");
    if (response.ok) setFeedback("");
  }

  const stream = posts.length ? [...posts, ...posts] : [];
  return <section className="community" id="community">
    <div className="section-heading"><p className="eyebrow">匿名互助留言</p><h2>“原来不止我一个人经历过。”</h2><p>留言不会立即公开。我们先去除身份线索、危机内容和可能伤害他人的信息，再分批更新互助墙。</p></div>
    <div className="message-river" aria-label="审核通过的匿名留言">
      {stream.length ? <div className="message-track">{stream.map((post, index) => <span key={`${post.id}-${index}`}><b>{post.topic}</b>{post.content}</span>)}</div> : <div className="message-river-empty" aria-hidden="true" />}
    </div>
    <div className="community-grid">
      <form className="soft-form" onSubmit={submitPost}>
        <h3>留下一句话</h3><p>请勿写姓名、微信号、电话、住址或可识别他人的细节。</p>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="留言主题"><option>想对姐妹说</option><option>今天终于明白</option><option>离开后的生活</option><option>我需要一点支持</option></select>
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 180))} placeholder="8—180字；不要提交正在发生的紧急求助" />
        <label className="consent"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />我确认已删除可识别个人的信息，并同意经人工审核后匿名公开。</label>
        <button disabled={message.trim().length < 8 || !confirmed}>提交审核</button>{notice && <small role="status">{notice}</small>}
      </form>
      <form className="soft-form feedback-form" onSubmit={submitFeedback}>
        <h3>帮我们把它做得更好</h3><p>告诉我们哪里说得像机器、哪里判断不准、还缺什么。反馈与聊天截图分开，不会自动训练模型。</p>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value.slice(0, 800))} placeholder="例如：这句断句不对；我更需要一个不激怒对方的回复…" />
        <label className="consent"><input type="checkbox" checked readOnly />我同意这条反馈进入人工整理的产品改进资料。</label>
        <button disabled={feedback.trim().length < 4}>提交反馈</button>{feedbackNotice && <small role="status">{feedbackNotice}</small>}
      </form>
    </div>
  </section>;
}
