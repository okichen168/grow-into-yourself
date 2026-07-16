"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type Finding = {
  title: string;
  evidence: string[];
  explanation: string;
};

type Analysis = {
  findings: Finding[];
  facts: string[];
  translation: string;
  replies: string[];
};

const patterns = [
  {
    title: "否定感受或记忆",
    words: ["你想多了", "太敏感", "我没说过", "你记错了", "从来没有", "开不起玩笑"],
    explanation: "这些说法把争议从具体事实转向“你的感受或记忆有问题”。它们不能自动证明你的理解是错的。",
  },
  {
    title: "人身贬低",
    words: ["没用", "废物", "丢人", "没人要", "公主病", "白眼狼", "不懂事", "恶心"],
    explanation: "这是对人的评价，不是对具体事情的说明。可以从需要处理的信息里暂时剔除。",
  },
  {
    title: "内疚或道德压力",
    words: ["都是为了你", "为你好", "白养你", "如果你爱我", "父母才", "养你这么大", "良心"],
    explanation: "付出和关系可以讨论，但不能代替对当下边界、请求和事实的说明。",
  },
  {
    title: "命令、威胁或控制",
    words: ["不许", "必须", "马上回来", "发位置", "敢不", "断绝关系", "后果", "别想"],
    explanation: "这类表达会压缩你的选择空间。先判断是否存在现实安全风险，再决定是否回应。",
  },
  {
    title: "转移责任",
    words: ["都是因为你", "还不是因为你", "你逼我的", "谁让你", "你先", "要不是你"],
    explanation: "它把说话者的选择全部归因于你。每个人仍需为自己的表达和行为负责。",
  },
];

const factSignals = /\d|点|号|今天|明天|昨天|周|月|元|块|地址|位置|几点|工资|房租|见面|回家|电话|医院|报警/;

function analyseText(input: string): Analysis {
  const compact = input.trim();
  const lines = compact
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const findings = patterns
    .map((pattern) => {
      const evidence = pattern.words.filter((word) => compact.includes(word));
      return { ...pattern, evidence };
    })
    .filter((item) => item.evidence.length > 0);

  const facts = lines.filter((line) => factSignals.test(line)).slice(0, 5);
  const hasFindings = findings.length > 0;
  const translation = hasFindings
    ? `这段话里，能直接核实的信息${facts.length ? `主要是“${facts[0].slice(0, 42)}${facts[0].length > 42 ? "…" : ""}”` : "并不多"}。其余部分出现了${findings.map((item) => item.title).join("、")}等语言特征。它们可能让你内疚、怀疑自己或急着服从，但不能仅凭这些话证明责任都在你。仅凭一段对话，也不能判断对方是否患有NPD。`
    : "没有命中当前词库中的明显操控表达。这不等于对话一定健康，也不等于对方没有恶意；这里只能说，现有文字不足以支持更强的判断。请结合前后文和实际行为核对。";

  return {
    findings,
    facts,
    translation,
    replies: [
      "我只讨论具体事实和安排。请把你希望我做的事情、时间和原因说清楚。",
      "我愿意沟通，但不会回应人身评价。如果继续谈，请回到具体事情。",
      "这段对话让我不舒服，我先暂停回复，等双方平静后再谈。",
    ],
  };
}

function fileLabel(count: number) {
  return count > 0 ? `已选择 ${count} 张截图` : "点击或拖拽截图到这里";
}

export default function Home() {
  const [mode, setMode] = useState<"image" | "text">("image");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canAnalyse = text.trim().length >= 8 && !isReading;
  const count = useMemo(() => text.trim().length, [text]);

  function addFiles(incoming: File[]) {
    setError("");
    const accepted = incoming.filter((file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024);
    if (accepted.length !== incoming.length) {
      setError("仅支持图片，每张不超过 8MB。被拒绝的文件没有上传。");
    }
    const next = [...files, ...accepted].slice(0, 6);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles(next);
    setPreviews(next.map((file) => URL.createObjectURL(file)));
    setAnalysis(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function readScreenshots() {
    if (!files.length || isReading) return;
    setError("");
    setIsReading(true);
    setProgress(2);
    setStatus("正在准备本地中文识别…");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim+eng", undefined, {
        logger: (message) => {
          if (typeof message.progress === "number") {
            setProgress(Math.max(2, Math.round(message.progress * 100)));
          }
          if (message.status === "recognizing text") setStatus("正在读取截图文字…");
        },
      });

      const chunks: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        setStatus(`正在识别第 ${index + 1} / ${files.length} 张截图…`);
        const result = await worker.recognize(files[index]);
        if (result.data.text.trim()) chunks.push(result.data.text.trim());
      }
      await worker.terminate();
      const recognized = chunks.join("\n\n—— 下一张截图 ——\n\n");
      if (!recognized) throw new Error("empty");
      setText(recognized.slice(0, 12000));
      setMode("text");
      setStatus("识别完成。请先校对人物、金额和否定词，再开始梳理。");
      setProgress(100);
    } catch {
      setError("这次没有识别成功。可能是网络未能加载中文识别包，或图片过于模糊。你仍可以切换到“粘贴文字”。");
      setStatus("");
      setProgress(0);
    } finally {
      setIsReading(false);
    }
  }

  function runAnalysis() {
    if (!canAnalyse) return;
    setAnalysis(analyseText(text));
    requestAnimationFrame(() => document.querySelector("#result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function loadExample() {
    setText("对方：我什么时候骂你了？你就是太敏感，开不起玩笑。\n对方：我养你这么大都是为了你好，你现在必须马上发位置给我。\n我：我只是说刚才那句话让我很难受。\n对方：还不是因为你不听话，谁让你先惹我。\n对方：明天晚上八点回家。");
    setMode("text");
    setAnalysis(null);
    setStatus("已放入一段演示文字，你可以直接体验输出结构。");
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="回到首页">
          <span className="brand-mark" aria-hidden="true">清</span>
          <span>清醒中译中</span>
        </a>
        <span className="privacy-top"><span aria-hidden="true">▢</span> 默认本地识别 · 不保存截图</span>
      </header>

      <section className="hero" id="top">
        <div className="intro">
          <p className="eyebrow">CHAT CLARITY · 对话澄清</p>
          <h1>清醒<br />中译中</h1>
          <p className="subtitle">看清话里的有效信息，<br className="desktop-break" />也看清不属于你的情绪。</p>
          <div className="privacy-pill">✓ 默认本地识别 · 刷新后清除</div>
          <div className="paper-art" aria-hidden="true">
            <span className="sun" />
            <span className="paper paper-one"><i /><i /><i /></span>
            <span className="paper paper-two"><i /><i /></span>
            <span className="paper paper-three"><i /><i /><i /></span>
          </div>
        </div>

        <div className="workspace-card">
          <div className="mode-tabs" role="tablist" aria-label="输入方式">
            <button className={mode === "image" ? "active" : ""} onClick={() => setMode("image")} role="tab" aria-selected={mode === "image"}>▧ 上传聊天截图</button>
            <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")} role="tab" aria-selected={mode === "text"}>▤ 粘贴聊天文字</button>
          </div>

          {mode === "image" ? (
            <div className="upload-view">
              <button className="dropzone" onClick={() => inputRef.current?.click()} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()} type="button">
                <span className="upload-icon" aria-hidden="true">↑</span>
                <strong>{fileLabel(files.length)}</strong>
                <small>支持微信长截图，最多6张 · 每张不超过8MB</small>
              </button>
              <input ref={inputRef} className="sr-only" type="file" accept="image/*" multiple onChange={handleFileChange} />
              {previews.length > 0 && (
                <div className="previews" aria-label="已选截图预览">
                  {/* Blob previews are local-only and should not pass through an image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {previews.map((url, index) => <img key={url} src={url} alt={`第 ${index + 1} 张截图`} />)}
                </div>
              )}
              <button className="primary" disabled={!files.length || isReading} onClick={readScreenshots}>
                {isReading ? "正在本地识别…" : "识别截图文字"}
              </button>
              {(isReading || progress > 0) && <div className="progress" aria-label={`识别进度 ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
            </div>
          ) : (
            <div className="text-view">
              <label htmlFor="conversation">识别结果 / 聊天文字</label>
              <textarea id="conversation" value={text} onChange={(event) => { setText(event.target.value.slice(0, 12000)); setAnalysis(null); }} placeholder={'建议保留“我：”“对方：”，并删除姓名、头像、电话、地址等隐私信息。'} />
              <div className="text-meta"><span>{status || "识别后请先校对，尤其是“不、没、别”等否定词。"}</span><span>{count} / 12000</span></div>
              <div className="action-row">
                <button className="ghost" onClick={loadExample}>先看演示</button>
                <button className="primary" disabled={!canAnalyse} onClick={runAnalysis}>开始梳理</button>
              </div>
            </div>
          )}

          {error && <p className="inline-error" role="alert">{error}</p>}
          <p className="boundary">仅分析你提供的内容，不替任何人下诊断；如有人身危险，请优先联系可信的人或当地紧急服务。</p>
        </div>
      </section>

      <section className="principles" aria-label="分析原则">
        <article><span>01</span><h2>先找事实</h2><p>把时间、金额、请求和已经发生的行为，从情绪评价中分开。</p></article>
        <article><span>02</span><h2>只说证据</h2><p>标出原句，不猜动机；证据不足时明确说“不确定”。</p></article>
        <article><span>03</span><h2>把选择还给你</h2><p>提供可复制的边界回复，也允许你暂时不回应。</p></article>
      </section>

      {analysis && (
        <section className="result" id="result">
          <div className="result-heading">
            <p className="eyebrow">本地初筛结果</p>
            <h2>先把这段话拆开看</h2>
            <p>以下是语言特征提示，不是人格诊断。请结合上下文和对方长期行为判断。</p>
          </div>

          <div className="result-grid">
            <article className="result-card translation">
              <span className="card-label">中译中</span>
              <p>{analysis.translation}</p>
            </article>

            <article className="result-card">
              <span className="card-label">可核实的信息</span>
              {analysis.facts.length ? <ul>{analysis.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : <p>当前文字里没有提取到明确的时间、金额、地点或行动安排。</p>}
            </article>

            <article className="result-card wide">
              <span className="card-label">命中的语言特征</span>
              {analysis.findings.length ? (
                <div className="finding-list">
                  {analysis.findings.map((finding) => (
                    <div className="finding" key={finding.title}>
                      <h3>{finding.title}</h3>
                      <p className="evidence">原文命中：{finding.evidence.map((word) => `“${word}”`).join("、")}</p>
                      <p>{finding.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : <p>没有命中明显词语。词库不可能覆盖所有情况，因此不能据此断定对话健康。</p>}
            </article>

            <article className="result-card wide">
              <span className="card-label">可以怎么回</span>
              <div className="reply-list">
                {analysis.replies.map((reply, index) => (
                  <button key={reply} onClick={() => navigator.clipboard?.writeText(reply)} title="点击复制">
                    <span>{index + 1}</span><p>{reply}</p><small>复制</small>
                  </button>
                ))}
              </div>
            </article>
          </div>
          <p className="result-note">如果截图里出现持续威胁、跟踪、限制人身自由、暴力或自伤内容，本工具不足以处理现实风险，请优先保存证据并寻求线下帮助。</p>
        </section>
      )}

      <footer>
        <strong>清醒中译中</strong>
        <span>不保存截图 · 不训练个人资料 · 不给任何人贴诊断标签</span>
      </footer>
    </main>
  );
}
