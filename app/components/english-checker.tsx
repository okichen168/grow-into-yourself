"use client";

import { useEffect, useRef, useState } from "react";
import ConversationAnalysisResult from "./conversation-analysis-result";
import { normaliseInput, type AiAnalysis, type AnalysisContext, type AnalysisLanguage } from "../lib/analyze-shared";
import { createLoadingSequence, type LoadingMessage } from "../lib/analysis-loading-messages";

const contextOptions: Array<{ value: AnalysisContext; en: string; zh: string; tone: string }> = [
  { value: "relationship", en: "Partner / Dating", zh: "伴侣 / 暧昧", tone: "partner" },
  { value: "family", en: "Family", zh: "家人", tone: "family" },
  { value: "workplace", en: "Workplace", zh: "职场", tone: "workplace" },
  { value: "friendship", en: "Friendship", zh: "朋友 / 同学", tone: "friendship" },
];

const copy = {
  en: {
    id: "check", eyebrow: "Conversation clarity", title: "Paste the words. Let AI help you read the pressure.", source: "Relationship",
    other: "Other person’s messages", otherPlaceholder: "Paste what the other person sent. One sentence or a whole conversation is fine.",
    mine: "My messages / draft reply (optional)", minePlaceholder: "Paste what you already replied, or what you are planning to send. Leave blank if unsure.",
    privacy: "Your content is not saved or published by this site, and is not used to train this project’s models.",
    analyse: "Analyze with AI", analysing: "AI is reading this…", tooLong: "This is too long. Please shorten it before analysis.",
    unavailable: "Basic analysis", quota: "Deep analysis is currently unavailable.", retry: "Retry deep analysis",
    clear: "Clear this conversation", confirm: "Clear this conversation and its analysis?", cancel: "Cancel", confirmClear: "Clear",
    working: "Analysis is running — the page is not stuck.", elapsed: "Analysing for", seconds: "seconds",
    stages: ["Reading the whole exchange", "Finding the original issue", "Checking for contradictions", "Separating facts, advice, and pressure", "Merging repeated signals", "Deep analysis is taking longer than usual. A basic analysis will appear automatically if it times out."],
  },
  zh: {
    id: "tool", eyebrow: "对话拆解", title: "把对方的话和你的回复分开看。", source: "这段对话来自",
    other: "对方发来的话", otherPlaceholder: "粘贴对方发来的消息，可以是一句，也可以是一整段。",
    mine: "我说过的话 / 我准备回复的话（可选）", minePlaceholder: "粘贴你已经回复过的话，或你准备发出去的话。不确定可以留空。",
    privacy: "你的内容不会被本站保存、公开，也不会用于训练本项目模型。",
    analyse: "让 AI 帮我分析", analysing: "AI 正在分析…", tooLong: "文字太长了，请删短一点再分析。",
    unavailable: "基础分析", quota: "深度分析当前不可用", retry: "重新尝试深度分析",
    clear: "清空本次内容", confirm: "清空这次输入和分析结果？", cancel: "取消", confirmClear: "清空",
    working: "正在分析，不是页面卡住了。", elapsed: "已分析", seconds: "秒",
    stages: ["小侦探正在读完整段", "正在找出原本讨论的事情", "正在核对前后有没有矛盾", "正在分清事实、建议和压力", "正在合并重复线索", "深度分析比平时慢一些；如果超时，会自动给出基础分析。"],
  },
} as const;

function loadingStage(elapsed: number) {
  return elapsed < 8 ? 0 : elapsed < 16 ? 1 : elapsed < 24 ? 2 : elapsed < 32 ? 3 : elapsed < 40 ? 4 : 5;
}

function DetectiveMark() {
  return <svg className="analysis-detective" viewBox="0 0 180 118" role="img" aria-label="Conversation detective reading notes">
    <path className="detective-paper" d="M15 72h48v32H15zM68 65h46v37H68zM119 73h43v30h-43z" />
    <path className="detective-lines" d="M23 81h30M23 89h22M77 75h27M77 83h23M127 82h25M127 90h18" />
    <path className="detective-person" d="M74 36c0-12 8-21 19-21s19 9 19 21c0 9-5 16-12 19v10H84V55c-6-3-10-10-10-19Z" />
    <path className="detective-hat" d="M68 31h50M77 29l5-16h23l6 16" />
    <g className="detective-glass"><circle cx="117" cy="50" r="18" /><path d="m130 63 17 18" /></g>
  </svg>;
}

export default function EnglishChecker({ language = "en" }: { language?: AnalysisLanguage }) {
  const ui = copy[language];
  const [context, setContext] = useState<AnalysisContext>("relationship");
  const [otherText, setOtherText] = useState("");
  const [myText, setMyText] = useState("");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loadingSequence, setLoadingSequence] = useState<LoadingMessage[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastStoredLoadingIndex = useRef(-1);
  const canAnalyze = otherText.trim().length >= 2 && !loading && otherText.length <= 6000 && myText.length <= 3000;

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const loadingIndex = loadingSequence.length ? Math.min(Math.floor(elapsed / 4), loadingSequence.length - 1) : 0;
  useEffect(() => {
    if (!loading || !loadingSequence[loadingIndex] || lastStoredLoadingIndex.current === loadingIndex) return;
    lastStoredLoadingIndex.current = loadingIndex;
    const key = "analysis-loading-recent";
    const previous = JSON.parse(sessionStorage.getItem(key) || "[]") as number[];
    sessionStorage.setItem(key, JSON.stringify([...previous, loadingSequence[loadingIndex].id].slice(-6)));
  }, [loading, loadingIndex, loadingSequence]);

  async function runAnalysis() {
    if (!canAnalyze) { setStatus(ui.tooLong); return; }
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    const recent = JSON.parse(sessionStorage.getItem("analysis-loading-recent") || "[]") as number[];
    setLoadingSequence(createLoadingSequence(language, recent));
    lastStoredLoadingIndex.current = -1;
    setElapsed(0); setLoading(true); setStatus(ui.analysing); setAnalysis(null);
    const input = normaliseInput(otherText, myText);
    const controller = new AbortController(); abortRef.current = controller;
    const clientTimeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, language, context }), signal: controller.signal });
      const data = await response.json();
      if (requestId.current !== currentRequest) return;
      if (!response.ok || !data.analysis) { setStatus(data.error || ui.unavailable); return; }
      setAnalysis(data.analysis); setStatus("");
    } catch {
      if (requestId.current === currentRequest) { setAnalysis(null); setStatus(ui.unavailable); }
    } finally {
      window.clearTimeout(clientTimeout);
      if (abortRef.current === controller) abortRef.current = null;
      if (requestId.current === currentRequest) {
        setLoading(false);
        requestAnimationFrame(() => document.querySelector(`#${ui.id}-result`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    }
  }

  function clearConversation() {
    abortRef.current?.abort(); abortRef.current = null;
    requestId.current += 1;
    setOtherText(""); setMyText(""); setAnalysis(null); setStatus(""); setLoading(false); setElapsed(0); setLoadingSequence([]); setConfirmClear(false);
  }

  function requestClear() {
    if (!otherText && !myText && !analysis && !status && !loading) { clearConversation(); return; }
    setConfirmClear(true);
  }

  function updateContext(next: AnalysisContext) {
    setContext(next); setAnalysis(null); setStatus("");
  }

  return <section className="english-tool text-analyzer" id={ui.id}>
    <div className="section-heading"><p className="eyebrow">{ui.eyebrow}</p><h2>{ui.title}</h2></div>
    <p className="privacy-inline">{ui.privacy}</p>
    <span className="context-title">{ui.source}</span>
    <div className="english-context" aria-label={ui.source}>{contextOptions.map((item) => <button type="button" data-context={item.tone} className={context === item.value ? "active" : ""} onClick={() => updateContext(item.value)} key={item.value}>{context === item.value && <span aria-hidden="true">✓ </span>}{item[language]}</button>)}</div>
    <div className="textarea-grid">
      <label><span>{ui.other}</span><textarea value={otherText} maxLength={6000} onChange={(event) => { setOtherText(event.target.value); setAnalysis(null); setStatus(""); }} placeholder={ui.otherPlaceholder} /></label>
      <label><span>{ui.mine}</span><textarea value={myText} maxLength={3000} onChange={(event) => { setMyText(event.target.value); setAnalysis(null); setStatus(""); }} placeholder={ui.minePlaceholder} /></label>
    </div>
    <div className="text-meta"><span>{status}</span><span>{otherText.length} / 6000 · {myText.length} / 3000</span></div>
    <div className="analysis-actions"><button type="button" className="primary" disabled={!canAnalyze} onClick={runAnalysis}>{loading ? ui.analysing : ui.analyse}</button><button type="button" className="clear-conversation" onClick={requestClear}>{ui.clear}</button></div>
    {loading && <div className="analysis-loading" aria-live="polite">
      <DetectiveMark />
      <div className="analysis-loading-copy"><strong>{ui.stages[loadingStage(elapsed)]}</strong><p>{loadingSequence[loadingIndex]?.text}</p><small>{ui.elapsed} {elapsed} {ui.seconds}</small><b>{ui.working}</b></div>
      <div className="analysis-loading-bar" aria-hidden="true"><span /></div>
    </div>}
    {confirmClear && <div className="clear-confirm" role="alertdialog" aria-label={ui.confirm}><p>{ui.confirm}</p><div><button type="button" onClick={() => setConfirmClear(false)}>{ui.cancel}</button><button type="button" className="confirm-clear" onClick={clearConversation}>{ui.confirmClear}</button></div></div>}
    <div id={`${ui.id}-result`}>
      {analysis && <><ConversationAnalysisResult analysis={analysis} language={language} />{analysis.mode === "local" && <div className="analysis-retry"><button type="button" onClick={runAnalysis} disabled={!canAnalyze}>{ui.retry}</button></div>}</>}
    </div>
  </section>;
}
