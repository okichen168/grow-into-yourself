"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import WorldGlobe from "./world-globe";

type Reply = { id: number; content: string; language: string; createdAt: string };
type Post = { id: number; content: string; topic: string; language: string; countryCode: string | null; countryName: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null; hearts: number; createdAt: string; replies: Reply[] };

type CountryOption = { code: string; en: string; zh: string; lat: number; lng: number; flag: string };

export default function CommunityBoard({ initialLanguage = "zh" }: { initialLanguage?: "zh" | "en" }) {
  const [posts, setPosts] = useState<Post[]>([]); const [selectedId, setSelectedId] = useState<number | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [lang, setLang] = useState<"zh" | "en">(initialLanguage); const [message, setMessage] = useState("");
  const [topic, setTopic] = useState(initialLanguage === "en" ? "A note for someone" : "想对姐妹说"); const [countryCode, setCountryCode] = useState("");
  const [region, setRegion] = useState(""); const [city, setCity] = useState(""); const [confirmed, setConfirmed] = useState(false); const [notice, setNotice] = useState("");
  const [reply, setReply] = useState(""); const [replyNotice, setReplyNotice] = useState("");
  const [feedback, setFeedback] = useState(""); const [feedbackNotice, setFeedbackNotice] = useState("");
  const selected = posts.find((post) => post.id === selectedId) || null;
  const selectedCountry = countryOptions.find((country) => country.code === countryCode);

  async function loadPosts() { fetch("/api/community").then((r) => r.json()).then((d) => { setPosts(d.posts || []); if (!selectedId && d.posts?.[0]) setSelectedId(d.posts[0].id); }).catch(() => undefined); }
  useEffect(() => { const id = window.setTimeout(() => { void loadPosts(); fetch("/api/countries").then((r) => r.json()).then((data) => setCountryOptions(data.countries || [])).catch(() => undefined); }, 0); return () => window.clearTimeout(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = useMemo(() => lang === "en" ? {
    kicker:"A small world of support", title:"Someone, somewhere, gets it.", intro:"Chinese and English notes live together here. Every post and reply is checked before it goes public.", leave:"Leave a note", privacy:"No names, handles, phone numbers or exact addresses.", country:"Country / area (optional)", region:"State / province (optional)", city:"City (optional)", cityHint:"Share only what feels safe. Country alone is enough for a star.", confirm:"I’ve removed identifying details. I’m OK with this being shared anonymously after review.", submit:"Send for review", reply:"Send a little support", replyPlaceholder:"You’re not alone. Take your time.", heart:"Send a heart", feedback:"Help us make this better", feedbackText:"Tell us what felt off, too robotic, or missing. Your chat screenshots are never included.", feedbackPlaceholder:"E.g. This reply feels too formal…", feedbackSubmit:"Send feedback"
  } : {
    kicker:"世界匿名互助", title:"总有人在世界的某个角落，懂你的难过。", intro:"中文和英文留言会出现在同一个地球。每条公开留言和鼓励回复都会先经过安全审核。", leave:"在世界上留一颗星", privacy:"不要填写姓名、账号、电话、单位或精确住址。", country:"国家 / 地区（选填）", region:"省 / 州 / 地区（选填）", city:"城市（选填）", cityHint:"只分享到你觉得安全的范围。只选国家也可以点亮星星。", confirm:"我已删除可识别个人的信息，并同意审核后匿名公开。", submit:"提交审核", reply:"送一句鼓励", replyPlaceholder:"你不是一个人，慢慢来。", heart:"送一颗爱心", feedback:"帮我们把它做得更好", feedbackText:"告诉我们哪里像机器、判断不准或还缺什么。不会附带你的聊天截图。", feedbackPlaceholder:"例如：这句太正式，我更需要……", feedbackSubmit:"提交反馈"
  }, [lang]);

  async function submitPost(event: FormEvent) {
    event.preventDefault(); setNotice(lang === "en" ? "Sending…" : "正在提交…");
    const response = await fetch("/api/community", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ content:message, topic, language:lang, countryCode:selectedCountry?.code, countryName:selectedCountry?.en, latitude:selectedCountry?.lat, longitude:selectedCountry?.lng, region, city, privacyConfirmed:confirmed, website:"" }) });
    const data = await response.json(); setNotice(data.message || data.error || (lang === "en" ? "Couldn’t send it just now." : "暂时无法提交"));
    if (response.ok) { setMessage(""); setConfirmed(false); }
  }

  async function sendHeart(post: Post) {
    if (localStorage.getItem(`heart-${post.id}`)) return;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, hearts:item.hearts + 1 } : item)); localStorage.setItem(`heart-${post.id}`, "1");
    await fetch("/api/community", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ id:post.id }) });
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setReplyNotice(lang === "en" ? "Sending…" : "正在送出…");
    const response = await fetch("/api/community", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ parentId:selected.id, content:reply, language:lang, website:"" }) });
    const data = await response.json(); setReplyNotice(data.message || data.error); if (response.ok) setReply("");
  }

  async function submitFeedback(event: FormEvent) {
    event.preventDefault(); setFeedbackNotice(lang === "en" ? "Sending…" : "正在提交…");
    const response = await fetch("/api/feedback", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ category:"产品优化", rating:5, content:feedback, consentToImprove:true, website:"" }) });
    const data = await response.json(); setFeedbackNotice(data.message || data.error || "暂时无法提交"); if (response.ok) setFeedback("");
  }

  const stream = posts.length ? [...posts, ...posts] : [];
  const topics = lang === "en" ? ["A note for someone", "I finally saw it", "Life after leaving", "Friendship hurt", "I need a little support"] : ["想对姐妹说", "今天终于明白", "离开后的生活", "朋友的背叛", "我需要一点支持"];

  return <section className="community" id="community">
    <div className="community-head"><div className="section-heading"><p className="eyebrow">{copy.kicker}</p><h2>{copy.title}</h2><p>{copy.intro}</p></div><div className="language-pills"><button className={lang === "zh" ? "active" : ""} onClick={() => { setLang("zh"); setTopic("想对姐妹说"); }}>中文</button><button className={lang === "en" ? "active" : ""} onClick={() => { setLang("en"); setTopic("A note for someone"); }}>English</button></div></div>
    <div className="message-river" aria-label="审核通过的匿名留言">{stream.length ? <div className="message-track">{stream.map((post, index) => <button onClick={() => setSelectedId(post.id)} key={`${post.id}-${index}`}><b>{post.countryName || (post.language === "en" ? "Somewhere" : "某个角落")}</b>{post.content}</button>)}</div> : <div className="message-river-empty" aria-hidden="true" />}</div>
    <div className="globe-stage"><WorldGlobe posts={posts} /><div className="globe-note">{selected ? <><span>{[selected.city, selected.region, selected.countryName].filter(Boolean).join(" · ") || (selected.language === "en" ? "Somewhere in the world" : "世界的某个角落")}</span><blockquote>{selected.content}</blockquote><div className="note-actions"><button onClick={() => sendHeart(selected)}>♥ {copy.heart} · {selected.hearts}</button></div>{selected.replies?.length > 0 && <div className="encouragements">{selected.replies.map((item) => <p key={item.id}>✦ {item.content}</p>)}</div>}<form onSubmit={submitReply}><input value={reply} onChange={(e) => setReply(e.target.value.slice(0,120))} placeholder={copy.replyPlaceholder} /><button disabled={reply.trim().length < 2}>{copy.reply}</button>{replyNotice && <small>{replyNotice}</small>}</form></> : <p>{lang === "en" ? "Approved notes will light up the globe as little stars." : "审核通过的留言，会在地球上变成一颗小星星。"}</p>}</div></div>
    <div className="community-grid">
      <form className="soft-form" onSubmit={submitPost}><h3>{copy.leave}</h3><p>{copy.privacy}</p><select value={topic} onChange={(e) => setTopic(e.target.value)}>{topics.map((item) => <option key={item}>{item}</option>)}</select><div className="location-grid"><select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}><option value="">{copy.country}</option>{countryOptions.map((item) => <option value={item.code} key={item.code}>{item.flag} {lang === "en" ? item.en : item.zh}</option>)}</select><input value={region} onChange={(e) => setRegion(e.target.value.slice(0,60))} placeholder={copy.region} /><input value={city} onChange={(e) => setCity(e.target.value.slice(0,60))} placeholder={copy.city} /></div><small className="location-hint">{copy.cityHint}</small><textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0,180))} placeholder={lang === "en" ? "8–180 characters. Please don’t use this for an emergency." : "8—180字；不要提交正在发生的紧急求助"} /><label className="consent"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{copy.confirm}</label><button disabled={message.trim().length < 8 || !confirmed}>{copy.submit}</button>{notice && <small role="status">{notice}</small>}</form>
      <form className="soft-form feedback-form" onSubmit={submitFeedback}><h3>{copy.feedback}</h3><p>{copy.feedbackText}</p><textarea value={feedback} onChange={(e) => setFeedback(e.target.value.slice(0,800))} placeholder={copy.feedbackPlaceholder} /><button disabled={feedback.trim().length < 4}>{copy.feedbackSubmit}</button>{feedbackNotice && <small role="status">{feedbackNotice}</small>}</form>
    </div>
  </section>;
}
