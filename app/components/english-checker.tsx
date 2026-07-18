"use client";

import { useState } from "react";
import { localAnalyze, normaliseInput, type AiAnalysis, type AnalysisContext, type AnalysisLanguage } from "../lib/analyze-shared";

const contextOptions: Array<{ value: AnalysisContext; en: string; zh: string; tone: string }> = [
  { value: "relationship", en: "Partner / Dating", zh: "伴侣 / 暧昧", tone: "partner" },
  { value: "family", en: "Family", zh: "家人", tone: "family" },
  { value: "workplace", en: "Workplace", zh: "职场", tone: "workplace" },
  { value: "friendship", en: "Friendship", zh: "朋友 / 同学", tone: "friendship" },
];

const copy = {
  en: {
    id: "check",
    eyebrow: "Conversation clarity",
    title: "Paste the words. Let AI help you read the pressure.",
    source: "Relationship",
    other: "Other person’s messages",
    otherPlaceholder: "Paste what the other person sent. One sentence or a whole conversation is fine.",
    mine: "My messages / draft reply (optional)",
    minePlaceholder: "Paste what you already replied, or what you are planning to send. Leave blank if unsure.",
    privacy: "Text may be sent to the configured AI model to generate this analysis. This site does not save the conversation.",
    analyse: "Analyze with AI",
    analysing: "AI is reading this…",
    tooLong: "This is too long. Please shorten it before analysis.",
    failed: "Local basic fallback — not a true AI deep analysis.",
    local: "Local basic fallback — not AI deep analysis",
    ai: "AI analysis",
    sections: ["What is happening", "Pressure or risk signals", "My reply pattern", "Sentence-by-sentence reading", "Reply options", "Risk level", "Safety note"],
  },
  zh: {
    id: "tool",
    eyebrow: "对话拆解",
    title: "把对方的话和你的回复分开看。",
    source: "这段对话来自",
    other: "对方发来的话",
    otherPlaceholder: "粘贴对方发来的消息，可以是一句，也可以是一整段。",
    mine: "我说过的话 / 我准备回复的话（可选）",
    minePlaceholder: "粘贴你已经回复过的话，或你准备发出去的话。不确定可以留空。",
    privacy: "为了生成本次分析，文本可能发送给配置的 AI 模型；本站不保存聊天内容。",
    analyse: "让 AI 帮我分析",
    analysing: "AI 正在分析…",
    tooLong: "文字太长了，请删短一点再分析。",
    failed: "本地基础兜底，不是真正 AI 深度分析。",
    local: "本地基础兜底，不是真正 AI 深度分析",
    ai: "AI 分析",
    sections: ["发生了什么", "压力 / 操控 / 风险信号", "我的回复模式", "逐句温和解读", "可复制回复", "风险等级", "安全提醒"],
  },
} as const;

export default function EnglishChecker({ language = "en" }: { language?: AnalysisLanguage }) {
  const ui = copy[language];
  const [context, setContext] = useState<AnalysisContext>("relationship");
  const [otherText, setOtherText] = useState("");
  const [myText, setMyText] = useState("");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const canAnalyze = otherText.trim().length >= 2 && !loading && otherText.length <= 6000 && myText.length <= 3000;

  async function runAnalysis() {
    if (!canAnalyze) {
      setStatus(ui.tooLong);
      return;
    }
    setLoading(true);
    setStatus(ui.analysing);
    const input = normaliseInput(otherText, myText);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, language, context }),
      });
      const data = await response.json();
      if (response.status === 429) {
        setAnalysis(null);
        setStatus(data.error || (language === "zh" ? "请求太频繁了，请一分钟后再试。" : "Too many requests. Please try again in one minute."));
        return;
      }
      if (!response.ok || !data.analysis) throw new Error("unavailable");
      setAnalysis(data.analysis);
      setStatus(data.fallback ? ui.failed : "");
    } catch {
      setAnalysis(localAnalyze(input.otherText, input.myText, language));
      setStatus(ui.failed);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => document.querySelector(`#${ui.id}-result`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  return <section className="english-tool text-analyzer" id={ui.id}>
    <div className="section-heading"><p className="eyebrow">{ui.eyebrow}</p><h2>{ui.title}</h2></div>
    <p className="privacy-inline">{ui.privacy}</p>
    <span className="context-title">{ui.source}</span>
    <div className="english-context" aria-label={ui.source}>{contextOptions.map((item) => <button type="button" data-context={item.tone} className={context === item.value ? "active" : ""} onClick={() => setContext(item.value)} key={item.value}>{context === item.value && <span aria-hidden="true">✓ </span>}{item[language]}</button>)}</div>
    <div className="textarea-grid">
      <label><span>{ui.other}</span><textarea value={otherText} maxLength={6000} onChange={(event) => { setOtherText(event.target.value); setAnalysis(null); }} placeholder={ui.otherPlaceholder} /></label>
      <label><span>{ui.mine}</span><textarea value={myText} maxLength={3000} onChange={(event) => { setMyText(event.target.value); setAnalysis(null); }} placeholder={ui.minePlaceholder} /></label>
    </div>
    <div className="text-meta"><span>{status}</span><span>{otherText.length} / 6000 · {myText.length} / 3000</span></div>
    <button type="button" className="primary" disabled={!canAnalyze} onClick={runAnalysis}>{loading ? ui.analysing : ui.analyse}</button>
    {analysis && <div className="english-result" id={`${ui.id}-result`}><span>{analysis.source === "ai" ? ui.ai : ui.local}</span><h3>{analysis.summary}</h3><div className="conversation-result-sections">
      <article><h4>{ui.sections[1]}</h4>{analysis.pressureSignals.length ? <ul>{analysis.pressureSignals.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{language === "zh" ? "没有明显信号。" : "No clear signal."}</p>}</article>
      <article><h4>{ui.sections[2]}</h4>{analysis.myPattern.length ? <ul>{analysis.myPattern.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{language === "zh" ? "没有填写你的回复。" : "No reply provided."}</p>}</article>
      <article className="sentence-reading"><h4>{ui.sections[3]}</h4>{analysis.sentenceAnalysis?.length ? analysis.sentenceAnalysis.map((item, index) => <div className="sentence-card" key={`${item.original}-${index}`}>
        <b>{language === "zh" ? "原话" : "Original"}</b><p>{item.original}</p>
        <b>{language === "zh" ? "这句话里的压力" : "Pressure inside it"}</b><p>{item.pressure}</p>
        <b>{language === "zh" ? "为什么会让人难受" : "Why it can hurt"}</b><p>{item.whyItHurts}</p>
        <b>{language === "zh" ? "更清醒的读法" : "Clearer reading"}</b><p>{item.clearerReading}</p>
      </div>) : <p>{language === "zh" ? "没有足够内容做逐句拆解。" : "Not enough text for sentence-level reading."}</p>}</article>
      <article><h4>{ui.sections[4]}</h4><div className="recommended-reply"><strong>{language === "zh" ? "最推荐的回复" : "Recommended reply"}</strong><button type="button" className="copy-reply" onClick={() => navigator.clipboard?.writeText(analysis.suggestedReply)}><span>{analysis.suggestedReply}</span><small>Copy</small></button></div><div className="reply-options">
        {(["soft", "firm", "exit"] as const).map((key) => analysis.replyOptions?.[key] ? <button type="button" className="copy-reply" onClick={() => navigator.clipboard?.writeText(analysis.replyOptions[key])} key={key}><span>{key === "soft" ? (language === "zh" ? "温和边界" : "Soft boundary") : key === "firm" ? (language === "zh" ? "坚定边界" : "Firm boundary") : (language === "zh" ? "不争辩退出" : "Exit without arguing")}</span>{analysis.replyOptions[key]}<small>Copy</small></button> : null)}
      </div></article>
      <article><h4>{ui.sections[5]}</h4><p>{analysis.riskLevel}</p></article>
      {analysis.urgentWarning && <article><h4>{ui.sections[6]}</h4><p>{analysis.urgentWarning}</p></article>}
    </div></div>}
  </section>;
}
