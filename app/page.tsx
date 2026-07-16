"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import CommunityBoard from "./components/community-board";
import SelfCheck from "./components/self-check";
import ThemeControls from "./components/theme-controls";

type Finding = { title: string; evidence: string[]; explanation: string };
type RiskLevel = "urgent" | "high" | "watch" | "none";
type RiskFinding = { title: string; evidence: string[]; guidance: string };
type RiskAssessment = { level: RiskLevel; label: string; summary: string; findings: RiskFinding[] };
type Analysis = { findings: Finding[]; facts: string[]; translation: string; replies: string[]; risk: RiskAssessment };

const languagePatterns = [
  {
    title: "否认你的感受或记忆",
    words: ["你想多了", "太敏感", "我没说过", "你记错了", "从来没有", "开不起玩笑", "小题大做"],
    explanation: "争议被悄悄从“发生了什么”变成“是不是你有问题”。你的感受不等于事实证据，但也不该被一句话抹掉。",
  },
  {
    title: "羞辱与人格贬低",
    words: ["没用", "废物", "丢人", "没人要", "公主病", "白眼狼", "不懂事", "恶心", "有病"],
    explanation: "这些是对人的攻击，不是对具体问题的说明。它们会制造羞耻，却没有提供真正需要解决的信息。",
  },
  {
    title: "用爱、孝顺或付出施压",
    words: ["都是为了你", "为你好", "白养你", "如果你爱我", "养你这么大", "没良心", "不孝"],
    explanation: "关系和付出可以讨论，但不能被用来取消你的边界，或要求你为对方的所有情绪负责。",
  },
  {
    title: "命令、威胁或压缩选择",
    words: ["不许", "必须", "马上回来", "发位置", "断绝关系", "后果自负", "别想", "你敢"],
    explanation: "这类表达不是在协商，而是在迫使你服从。先判断现实安全，再决定是否回复。",
  },
  {
    title: "把自己的行为全部归咎于你",
    words: ["都是因为你", "还不是因为你", "你逼我的", "谁让你", "你先惹我", "要不是你"],
    explanation: "冲突可能有双方因素，但每个人仍需为自己的辱骂、威胁和行为负责。",
  },
  {
    title: "孤立与切断支持",
    words: ["别跟他们来往", "不准见朋友", "你朋友都", "离他们远点", "只能相信我", "家丑不可外扬"],
    explanation: "让你远离朋友、家人或外部帮助，会增加依赖，也会让你更难核对现实。",
  },
];

const riskPatterns: Array<RiskFinding & { level: RiskLevel; words: string[] }> = [
  {
    level: "urgent",
    title: "可能涉及人身伤害威胁",
    words: ["杀了你", "弄死你", "打死你", "砍死", "捅死", "让你消失", "一起死", "伤害你", "伤害他"],
    evidence: [],
    guidance: "不要继续刺激或独自见面。尽量去有他人的安全地点，保存证据；正在发生或即将发生危险时拨打110，受伤或需要急救时拨打120。",
  },
  {
    level: "urgent",
    title: "可能涉及自伤或自杀威胁",
    words: ["死给你看", "不想活了", "我要自杀", "去跳楼", "割腕", "我死了都是你", "活不下去"],
    evidence: [],
    guidance: "不要独自承担“救下对方”的责任。明确告诉110、120或对方所在地可信成年人；心理危机支持可拨12356。",
  },
  {
    level: "high",
    title: "可能涉及跟踪、定位或监控",
    words: ["发位置", "实时位置", "我在你门口", "跟着你", "定位你", "查你手机", "看你聊天记录", "监控你"],
    evidence: [],
    guidance: "检查微信实时位置、设备登录、共享账号与定位权限；不要在不安全时直接对质。必要时联系110或12348咨询证据保存。",
  },
  {
    level: "high",
    title: "可能限制行动或强制回家",
    words: ["必须回家", "马上回来", "不许出门", "锁门", "关起来", "扣你身份证", "扣你护照", "不让你走"],
    evidence: [],
    guidance: "优先保管身份证件、手机、药物和紧急现金，告诉可信的人你的情况；被限制人身自由时联系110。",
  },
  {
    level: "high",
    title: "可能涉及经济控制",
    words: ["没收工资", "冻结你的卡", "断你生活费", "一分钱不给", "把钱交出来", "不准工作", "赶你出去"],
    evidence: [],
    guidance: "在安全前提下备份账户、工资、房产和转账证据，准备独立支付方式；可拨12348咨询法律援助。",
  },
  {
    level: "urgent",
    title: "对未成年人的风险需要优先处理",
    words: ["打孩子", "杀了孩子", "带走孩子", "不让孩子上学", "未成年", "小孩一起死"],
    evidence: [],
    guidance: "正在发生的伤害立即拨110/120；青少年心理与法律支持可联系12355，妇女儿童权益问题可联系12338。",
  },
];

const levelRank: Record<RiskLevel, number> = { none: 0, watch: 1, high: 2, urgent: 3 };
const factSignals = /\d|点|号|今天|明天|昨天|周|月|元|块|地址|位置|几点|工资|房租|见面|回家|电话|医院|报警|转账|学校/;

function cleanOCRText(raw: string) {
  const cjk = "\\u3400-\\u9fff";
  const compactLine = (line: string) => line
    .replace(new RegExp(`([${cjk}])\\s+(?=[${cjk}])`, "g"), "$1")
    .replace(/\s+([，。！？；：、）】》])/g, "$1")
    .replace(/([（【《])\s+/g, "$1")
    .replace(/([，。！？；：、])(?=[^\s\n])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  const paragraphs = raw
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.split("\n").map(compactLine).filter(Boolean))
    .filter((lines) => lines.length);

  const rebuilt = paragraphs.map((lines) => {
    let text = "";
    for (const line of lines) {
      if (!text) { text = line; continue; }
      const startsLikeMeta = /^(我|对方|妈妈|爸爸|男友|女友|家人|\d{1,2}:\d{2}|昨天|今天|未应答)[：:]/.test(line);
      const previousEnded = /[。！？!?…]$/.test(text);
      text += startsLikeMeta || previousEnded ? `\n${line}` : line;
    }
    return text;
  });

  return rebuilt
    .join("\n\n")
    .replace(/([。！？!?])(?=[^\n”’])/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function prepareImage(file: File): Promise<Blob | File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(2, Math.max(1, 1600 / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.filter = "grayscale(1) contrast(1.22)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/png", 0.96));
  } catch {
    return file;
  }
}

function assessRisk(input: string): RiskAssessment {
  const findings = riskPatterns
    .map((pattern) => ({ ...pattern, evidence: pattern.words.filter((word) => input.includes(word)) }))
    .filter((item) => item.evidence.length > 0);
  const level = findings.reduce<RiskLevel>((current, finding) => levelRank[finding.level] > levelRank[current] ? finding.level : current, "none");
  if (level === "urgent") return { level, label: "需要优先确认安全", summary: "文字中出现了可能涉及伤害、自伤或未成年人危险的信号。机器可能误判，但这类内容不应只当作情绪话忽略。", findings };
  if (level === "high") return { level, label: "出现高风险控制信号", summary: "文字中可能涉及跟踪、定位、限制行动或经济控制。先准备安全与证据，再考虑沟通技巧。", findings };
  if (level === "watch") return { level, label: "建议继续观察", summary: "暂未发现立即危险，但请结合线下行为和长期模式判断。", findings };
  return { level, label: "未识别到明确紧急信号", summary: "这不代表绝对安全。截图外的行为、环境和你的直觉仍然重要。", findings: [] };
}

function analyseText(input: string): Analysis {
  const compact = input.trim();
  const lines = compact.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const findings = languagePatterns
    .map((pattern) => ({ ...pattern, evidence: pattern.words.filter((word) => compact.includes(word)) }))
    .filter((item) => item.evidence.length > 0);
  const facts = lines.filter((line) => factSignals.test(line)).slice(0, 6);
  const featureText = findings.map((item) => item.title).join("、");
  const translation = findings.length
    ? `这段话里，真正需要处理的事实${facts.length ? `包括：“${facts[0].slice(0, 46)}${facts[0].length > 46 ? "…" : ""}”` : "并不清楚"}。与此同时，对方用了${featureText}等表达，让你从讨论事情转向证明自己“不坏、不自私、没记错”。你不需要先接受这些评价，才有资格讨论事实和边界。仅凭这段对话不能诊断NPD，但不需要等到一个诊断成立，你才可以重视自己的不舒服。`
    : "这段文字没有命中当前词库中的典型表达。它不代表关系一定健康，也不代表你的感受不重要；这里只能说，现有文字不足以支持更具体的判断。可以补充前后文、重复发生的行为，以及你拒绝后对方如何反应。";
  return {
    findings,
    facts,
    translation,
    risk: assessRisk(compact),
    replies: [
      "我只讨论具体发生的事情，不接受对我人格的评价。请把你的请求和时间说清楚。",
      "我听到了你的情绪，但我不会在被羞辱或威胁时继续沟通。我们之后再谈。",
      "我现在不回复。等我确认安全、想清楚边界后，再决定是否继续这段对话。",
    ],
  };
}

const helpLines = [
  { number: "110 / 120", name: "正在发生危险或需要急救", note: "危险、暴力、限制自由、受伤时优先" },
  { number: "12356", name: "全国统一心理援助热线", note: "心理疏导与危机干预" },
  { number: "12338", name: "妇女儿童维权服务", note: "婚姻家庭、家暴与权益咨询" },
  { number: "12348", name: "公共法律服务热线", note: "法律咨询、法援与证据保存" },
  { number: "12355", name: "青少年服务台", note: "青少年心理与法律支持" },
];

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
    if (accepted.length !== incoming.length) setError("仅支持图片，每张不超过8MB。被拒绝的文件没有读取。");
    const next = [...files, ...accepted].slice(0, 6);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles(next);
    setPreviews(next.map((file) => URL.createObjectURL(file)));
    setAnalysis(null);
  }

  function removeFile(index: number) {
    const next = files.filter((_, fileIndex) => fileIndex !== index);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles(next);
    setPreviews(next.map((file) => URL.createObjectURL(file)));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) { addFiles(Array.from(event.target.files ?? [])); }
  function handleDrop(event: DragEvent<HTMLButtonElement>) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }

  async function readScreenshots() {
    if (!files.length || isReading) return;
    setError(""); setIsReading(true); setProgress(2); setStatus("正在准备本地中文识别…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim+eng", undefined, {
        logger: (message) => {
          if (typeof message.progress === "number") setProgress(Math.max(2, Math.round(message.progress * 100)));
          if (message.status === "recognizing text") setStatus("正在读字和整理句子…");
        },
      });
      const chunks: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        setStatus(`正在识别第 ${index + 1} / ${files.length} 张截图…`);
        const prepared = await prepareImage(files[index]);
        const result = await worker.recognize(prepared);
        const cleaned = cleanOCRText(result.data.text);
        if (cleaned) chunks.push(cleaned);
      }
      await worker.terminate();
      const recognized = chunks.join("\n\n—— 下一张截图 ——\n\n");
      if (!recognized) throw new Error("empty");
      setText(recognized.slice(0, 12000)); setMode("text"); setProgress(100);
      setStatus("已自动去掉中文间空格并重新断句。请校对人物、金额和“不/没/别”等否定词。");
    } catch {
      setError("这次没有识别成功。可能是中文识别包未加载完成或图片太模糊；你仍可以切换到“粘贴文字”。");
      setStatus(""); setProgress(0);
    } finally { setIsReading(false); }
  }

  function runAnalysis() {
    if (!canAnalyse) return;
    setAnalysis(analyseText(text));
    requestAnimationFrame(() => document.querySelector("#result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function loadExample() {
    setText("对方：我什么时候骂你了？你就是太敏感，开不起玩笑。\n对方：我养你这么大都是为了你好，你现在必须马上发位置给我。\n我：我只是说刚才那句话让我很难受。\n对方：还不是因为你不听话，谁让你先惹我。\n对方：明天晚上八点回家。");
    setMode("text"); setAnalysis(null); setStatus("这是演示文字，你可以直接查看输出结构。");
  }

  return (
    <main>
      <div className="emergency-strip">如果你正处于人身危险：先离开现场，拨打 <a href="tel:110">110</a>；需要急救拨打 <a href="tel:120">120</a></div>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">长</span><span>长成自己</span></a>
        <nav><a href="#learn">认识情感操控</a><a href="#self-check">关系自查</a><a href="#tool">拆解聊天</a><a href="#safety">安全求助</a></nav>
        <ThemeControls />
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">长成自己 · 反情感暴力与关系安全工具</p>
          <h1>把自己领回来，<br />再按自己的方式长大一次。</h1>
          <p className="hero-subtitle">当一段对话让你反复内疚、怀疑自己、解释不清，我们陪你把真正的信息、情绪压力和危险信号一层层分开。</p>
          <div className="hero-actions"><a className="hero-primary" href="#tool">开始拆解聊天</a><a className="hero-secondary" href="#self-check">先做关系自查</a></div>
          <div className="trust-row"><span>匿名使用</span><span>截图本机识别</span><span>不用于训练AI</span><span>不会公开内容</span></div>
        </div>
        <div className="comfort-card" aria-label="写给正在怀疑自己的你">
          <span className="soft-orb orb-one" /><span className="soft-orb orb-two" />
          <p>“为什么每次说到最后，<br />都变成了我的错？”</p>
          <strong>先别急着证明自己。<br />我们从原话开始看。</strong>
          <div className="chat-line left">你是不是又想多了？</div>
          <div className="chat-line right">我只是说，我不舒服。</div>
          <div className="chat-line left">都是为了你好。</div>
        </div>
      </section>

      <section className="learn" id="learn">
        <div className="section-heading"><p className="eyebrow">先认识它</p><h2>情感操控不一定大喊大叫</h2><p>它也可能披着“爱你、为你好、你太敏感”的外衣。我们不隔着屏幕诊断谁是NPD，只辨认具体行为。</p></div>
        <div className="learn-grid">
          <article><span>01</span><h3>否认与改写</h3><p>反复否认说过的话，让你开始怀疑自己的记忆和判断。</p></article>
          <article><span>02</span><h3>羞辱与贬低</h3><p>不讨论事情，转而攻击你的能力、人格、外貌或价值。</p></article>
          <article><span>03</span><h3>孤立与控制</h3><p>切断朋友、工作、钱和出行，让你越来越难独立选择。</p></article>
          <article><span>04</span><h3>威胁与情绪勒索</h3><p>用分手、自伤、伤害、赶走或断供，逼你立刻服从。</p></article>
        </div>
        <p className="learn-note">一个句子不能定义一段关系。真正需要警惕的是：这些行为是否反复发生、是否升级，以及你说“不”之后会发生什么。</p>
      </section>

      <section className="tool-section" id="tool">
        <div className="tool-intro"><p className="eyebrow">把聊天交给我</p><h2>我们慢慢拆开看</h2><p>先识别文字，再由你校对。机器看错时，你永远有最后决定权。</p></div>
        <div className="privacy-promise">
          <strong>你的对话属于你</strong>
          <p>当前测试版不需要账号。截图只在你的设备中识别，不上传、不保存；刷新页面后清除。你的内容不会用于训练AI，也不会出现在公开案例或未来的匿名树洞中。</p>
        </div>
        <div className="workspace-card">
          <div className="mode-tabs" role="tablist" aria-label="输入方式">
            <button className={mode === "image" ? "active" : ""} onClick={() => setMode("image")} role="tab" aria-selected={mode === "image"}>上传微信截图</button>
            <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")} role="tab" aria-selected={mode === "text"}>粘贴聊天文字</button>
          </div>

          {mode === "image" ? (
            <div className="upload-view">
              <button className="mobile-picker" onClick={() => inputRef.current?.click()} type="button"><span>＋</span><strong>从手机相册选择截图</strong><small>可以一次多选，最多6张</small></button>
              <button className="dropzone" onClick={() => inputRef.current?.click()} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()} type="button"><span className="upload-icon">↑</span><strong>{files.length ? `已选择 ${files.length} 张截图` : "点击或拖入聊天截图"}</strong><small>手机会直接打开相册 · 每张不超过8MB</small></button>
              <input ref={inputRef} className="sr-only" type="file" accept="image/*" multiple onChange={handleFileChange} />
              {previews.length > 0 && (
                <div className="previews">
                  {previews.map((url, index) => (
                    <div className="preview" key={url}>
                      {/* Blob previews stay on-device and should bypass image optimization. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`第${index + 1}张截图`} />
                      <button onClick={() => removeFile(index)} aria-label={`移除第${index + 1}张截图`}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <button className="primary" disabled={!files.length || isReading} onClick={readScreenshots}>{isReading ? "正在本地识别…" : files.length ? `识别这 ${files.length} 张截图` : "先选择截图"}</button>
              {(isReading || progress > 0) && <div className="progress"><span style={{ width: `${progress}%` }} /></div>}
              <p className="upload-tip">识别后会自动合并中文字符、去掉错误空格并重新断句；左右聊天人物仍需你校对。</p>
            </div>
          ) : (
            <div className="text-view">
              <label htmlFor="conversation">识别结果 / 聊天文字</label>
              <textarea id="conversation" value={text} onChange={(event) => { setText(event.target.value.slice(0, 12000)); setAnalysis(null); }} placeholder={'建议在每段前标注“我：”“对方：”，并删除姓名、电话、地址等隐私信息。'} />
              <div className="text-meta"><span>{status || "请校对人物、金额，以及“不、没、别”等否定词。"}</span><span>{count} / 12000</span></div>
              <div className="action-row"><button className="ghost" onClick={loadExample}>先看演示</button><button className="primary" disabled={!canAnalyse} onClick={runAnalysis}>替我拆解这段话</button></div>
            </div>
          )}
          {error && <p className="inline-error" role="alert">{error}</p>}
          <p className="boundary">这不是医疗或人格诊断。分析依据来自你提供的原文；证据不足时，我们会明确说“不确定”。</p>
        </div>
      </section>

      <section className="pain-section">
        <div className="section-heading"><p className="eyebrow">你可能正在经历</p><h2>有些难受，很难向别人解释</h2></div>
        <div className="pain-grid">
          <a href="#self-check"><article><p>“是不是我真的太敏感？”</p><span>点进来做一次非诊断式关系与身心状态自查。</span></article></a>
          <a href="#self-check"><article><p>“我解释了很久，怎么又成了我的错？”</p><span>辨认否认、羞辱、冷处理、话题转移与强制控制。</span></article></a>
          <a href="#safety"><article><p>“我想离开，可钱、家人和威胁都卡着我。”</p><span>先看危险信号和中国地区现实求助，不把它只当沟通问题。</span></article></a>
        </div>
      </section>

      <SelfCheck />

      {analysis && <section className="result" id="result">
        <div className="result-heading"><p className="eyebrow">对话拆解结果</p><h2>先看安全，再看这段话</h2><p>以下提示不诊断任何人。它只告诉你：原文里出现了什么，以及你可以先保护什么。</p></div>
        <article className={`risk-card ${analysis.risk.level}`}>
          <div><span className="risk-dot" /><p className="card-label">风险分流</p><h3>{analysis.risk.label}</h3><p>{analysis.risk.summary}</p></div>
          {analysis.risk.findings.length > 0 && <div className="risk-findings">{analysis.risk.findings.map((finding) => <div key={finding.title}><strong>{finding.title}</strong><p>命中原话：{finding.evidence.map((item) => `“${item}”`).join("、")}</p><span>{finding.guidance}</span></div>)}</div>}
        </article>
        <div className="result-grid">
          <article className="result-card translation"><span className="card-label">过滤后的中译中</span><p>{analysis.translation}</p></article>
          <article className="result-card"><span className="card-label">真正可核实的信息</span>{analysis.facts.length ? <ul>{analysis.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : <p>没有提取到明确的时间、金额、地点或行动安排。</p>}</article>
          <article className="result-card wide"><span className="card-label">原话里出现的模式</span>{analysis.findings.length ? <div className="finding-list">{analysis.findings.map((finding) => <div className="finding" key={finding.title}><h3>{finding.title}</h3><p className="evidence">原文：{finding.evidence.map((word) => `“${word}”`).join("、")}</p><p>{finding.explanation}</p></div>)}</div> : <p>没有命中当前词库。这不等于关系健康，只代表这段文字不足以支持更强判断。</p>}</article>
          <article className="result-card wide"><span className="card-label">如果你想回复</span><div className="reply-list">{analysis.replies.map((reply, index) => <button key={reply} onClick={() => navigator.clipboard?.writeText(reply)}><span>{index + 1}</span><p>{reply}</p><small>点此复制</small></button>)}</div></article>
        </div>
      </section>}

      <section className="safety" id="safety">
        <div className="section-heading"><p className="eyebrow">中国地区求助</p><h2>沟通技巧不能代替现实安全</h2><p>热线接通与服务时间可能因地区而异。正在发生危险时，不要等待网页分析。</p></div>
        <div className="help-grid">{helpLines.map((line) => <a href={`tel:${line.number.split(" ")[0]}`} key={line.number}><strong>{line.number}</strong><div><h3>{line.name}</h3><p>{line.note}</p></div><span>拨打 ›</span></a>)}</div>
      </section>

      <CommunityBoard />

      <section className="credibility">
        <strong>公开证据，也公开边界</strong>
        <p>这是一个跨学科研究共建计划，正在邀请海外高校心理学、心理健康、社会工作与数理统计相关博士生参与方法审核与迭代。首版已核对五组共100+项论文、量表、专业规范与同类产品案例；后续目标是维护100—200篇核心证据库。正式参与者、资质与参与方式会在本人确认后公开，不把未来合作写成已经发生的专家背书。</p>
      </section>

      <footer><strong>长成自己</strong><span>反对情感暴力 · 不给任何人贴诊断标签 · 把选择还给你</span><a href="/admin">内容管理</a></footer>
    </main>
  );
}
