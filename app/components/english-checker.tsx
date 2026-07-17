"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { extractLocalOcrText } from "../lib/local-ocr";

type Context = "Partner / Dating" | "Family" | "Workplace" | "Friendship";
type Language = "en" | "zh";

const contextOptions: Array<{ value: Context; en: string; zh: string; tone: string }> = [
  { value: "Partner / Dating", en: "Partner / Dating", zh: "伴侣 / 暧昧", tone: "partner" },
  { value: "Family", en: "Family", zh: "家人", tone: "family" },
  { value: "Workplace", en: "Workplace", zh: "职场", tone: "workplace" },
  { value: "Friendship", en: "Friendship", zh: "朋友 / 同学", tone: "friendship" },
];

const ui = {
  en: {
    eyebrow: "Conversation clarity", title: "Bring the words. Keep your footing.", intro: "Choose the relationship, then upload screenshots or paste a conversation.",
    upload: "Upload chat screenshots", paste: "Paste conversation", source: "Relationship", choose: "Choose chat screenshots", limit: "Up to 10 images at a time, 8MB each",
    privacy: "Processed on this device. Not stored, shared or used to train AI. Cleared when you refresh.", selected: (count: number) => `${count} image${count === 1 ? "" : "s"} selected`, process: "Process screenshots", processing: "Processing on this device…", ready: "Screenshots processed on this device.", failed: "These screenshots could not be read. You can try different images or paste the conversation.",
    chatText: "Conversation", placeholder: "Paste a conversation here.", analyse: "Analyse this conversation",
  },
  zh: {
    eyebrow: "对话拆解", title: "把真正的信息，从压力里分开。", intro: "先选择关系，再上传截图或粘贴聊天内容。",
    upload: "上传聊天截图", paste: "粘贴聊天内容", source: "这段对话来自", choose: "选择聊天截图", limit: "一次最多10张，每张不超过8MB",
    privacy: "截图仅在当前设备处理，不保存、不公开、不用于训练AI；刷新页面后清除。", selected: (count: number) => `已选择 ${count} 张图片`, process: "处理聊天截图", processing: "正在当前设备处理…", ready: "截图已在当前设备完成处理。", failed: "这组截图暂时无法识别，可以更换图片或粘贴聊天内容。",
    chatText: "聊天内容", placeholder: "在这里粘贴聊天内容。", analyse: "分析这段对话",
  },
} as const;

const patterns = [
  { title: "Denial and rewriting", words: ["too sensitive", "imagining things", "never said that", "remember it wrong", "overreacting", "crazy", "你想多了", "太敏感", "我没说过", "你记错了"], note: "The focus shifts from what happened to whether there is something wrong with you." },
  { title: "Humiliation and devaluation", words: ["useless", "stupid", "no one wants you", "pathetic", "embarrassing", "not good enough", "没用", "废物", "丢人", "白眼狼"], note: "This is a personal attack, not a clear request or useful feedback." },
  { title: "Pressure dressed up as care", words: ["if you loved me", "doing this for you", "after all i've done", "you owe me", "prove you love me", "为你好", "都是为了你", "不孝"], note: "Care does not cancel consent, privacy or your right to say no." },
  { title: "Control and isolation", words: ["send your location", "stop seeing them", "don't talk to", "check your phone", "give me your password", "not allowed to leave", "发位置", "不准", "查你手机"], note: "Pressure around people, money, movement or privacy can make free choice harder." },
  { title: "Blame reversal", words: ["you made me do it", "this is your fault", "i'm the real victim", "you're abusing me", "look what you did", "都是因为你", "你逼我的"], note: "The original concern may be sidestepped by denying it, attacking you, then reversing responsibility." },
  { title: "Punishing silence", words: ["don't contact me", "i'll ignore you", "talk when you admit", "until you apologise", "you need to reflect", "别再找我", "你自己反省"], note: "A healthy pause has a reason and a return point. Silence used to force surrender is different." },
  { title: "Workplace pressure", words: ["do it tonight", "never pass probation", "not invited to the meeting", "take the credit", "quit if you can't", "转正", "开除", "不通知"], note: "One difficult day is not proof. Repeated blocked information, impossible work or retaliation matter." },
  { title: "Friendship betrayal or exclusion", words: ["everyone knows", "we didn't invite you", "no one likes you", "choose me or them", "踢出群", "大家都讨厌你", "选我还是选她"], note: "Conflict happens. Repeated gossip, exposure, exclusion or turning a group against someone is different." },
];

function cleanOcr(raw: string) {
  const cjk = "\\u3400-\\u9fff";
  return raw.replace(/\r/g, "").split("\n").map((line) => line
    .replace(new RegExp(`([${cjk}])\\s+(?=[${cjk}])`, "g"), "$1")
    .replace(/\s+([，。！？；：、】【）》])/g, "$1")
    .replace(/([（【《])\s+/g, "$1").trim())
    .filter(Boolean).reduce<string[]>((lines, line) => {
      const prior = lines.at(-1) ?? "";
      const startsSpeaker = /^(Me|Them|Partner|Family|Manager|Friend|我|对方|妈妈|爸爸|老板|同事)[：:]/i.test(line);
      if (!prior || startsSpeaker || /[。！？!?…]$/.test(prior)) lines.push(line);
      else lines[lines.length - 1] += line;
      return lines;
    }, []).join("\n").replace(/([。！？!?])(?=[^\n”’])/g, "$1\n").trim();
}

async function prepareImage(file: File): Promise<Blob | File> {
  try {
    const bitmap = await createImageBitmap(file); const scale = Math.min(2, Math.max(1, 1600 / bitmap.width));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d"); if (!context) return file;
    context.filter = "grayscale(1) contrast(1.2)"; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/png", .96));
  } catch { return file; }
}

export default function EnglishChecker({ language = "en" }: { language?: Language }) {
  const copy = ui[language];
  const [context, setContext] = useState<Context>("Partner / Dating"); const [mode, setMode] = useState<"text" | "image">("image");
  const [text, setText] = useState(""); const [files, setFiles] = useState<File[]>([]); const [status, setStatus] = useState(""); const [done, setDone] = useState(false); const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null); const lower = text.toLowerCase();
  const findings = useMemo(() => patterns.map((item) => ({ ...item, hits: item.words.filter((word) => lower.includes(word.toLowerCase())) })).filter((item) => item.hits.length), [lower]);
  const facts = useMemo(() => text.split(/\n+/).map((line) => line.trim()).filter((line) => line && /(\d|today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|money|rent|salary|location|address|meet|return|call|transfer|今天|明天|昨天|元|块|位置|地址|回家|转账)/i.test(line)).slice(0, 6), [text]);
  const safetyHits = useMemo(() => ["kill", "hurt you", "hurt myself", "suicide", "follow you", "track your location", "outside your home", "lock you", "take your passport", "freeze your money", "杀了", "弄死", "自杀", "跟踪", "定位", "锁门", "扣身份证", "冻结银行卡"].filter((word) => lower.includes(word)), [lower]);
  const replies = context === "Workplace" ? ["Please confirm the task, deadline, resources and success criteria in writing.", "I am happy to discuss the work. Please keep the feedback to the task and standard.", "If the scope has changed, please update it in writing so I can re-prioritise."] : ["Let’s stick to what happened. I’m not discussing my character.", "I hear you, but I won’t keep talking while I’m being insulted, monitored or threatened.", "I’m taking some space. I’ll reply when I feel safe and clear."];
  const oneStep = safetyHits.length ? "Tell one trusted person exactly what was said and save one dated copy somewhere the other person cannot access." : context === "Workplace" ? "Write down one instruction, deadline and success criterion, then ask for written confirmation." : "Wait 20 minutes before replying. Write one line for facts and one line for accusations, then answer only the facts.";
  function selectFiles(event: ChangeEvent<HTMLInputElement>) { const incoming = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024); const next = incoming.slice(0, 10); setFiles(next); setStatus(next.length ? copy.selected(next.length) : copy.limit); setDone(false); }
  async function readScreenshots() { if (!files.length || reading) return; setReading(true); setStatus(copy.processing); try { const { createWorker } = await import("tesseract.js"); const worker = await createWorker("chi_sim+eng", undefined, { langPath: "/tessdata" }); const parts: string[] = []; for (const file of files) { const result = await worker.recognize(await prepareImage(file), {}, { blocks: true }); const cleaned = extractLocalOcrText(result.data, language) || cleanOcr(result.data.text); if (cleaned) parts.push(cleaned); } await worker.terminate(); const recognised = parts.join("\n\n— Next screenshot —\n\n"); if (!recognised) throw new Error("empty"); setText(recognised.slice(0, 12000)); setMode("text"); setStatus(copy.ready); } catch { setStatus(copy.failed); } finally { setReading(false); } }
  return <section className="english-tool" id="check"><div className="section-heading"><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.intro}</p></div><p className="privacy-inline">{copy.privacy}</p><span className="context-title">{copy.source}</span><div className="english-context" aria-label={copy.source}>{contextOptions.map((item) => <button type="button" data-context={item.tone} className={context === item.value ? "active" : ""} onClick={() => { setContext(item.value); setDone(false); }} key={item.value}>{context === item.value && <span aria-hidden="true">✓ </span>}{item[language]}</button>)}</div><div className="mode-tabs"><button type="button" className={mode === "image" ? "active" : ""} onClick={() => setMode("image")}>{copy.upload}</button><button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>{copy.paste}</button></div>{mode === "image" ? <div className="upload-view"><button type="button" className="mobile-picker" onClick={() => inputRef.current?.click()}><span>+</span><strong>{copy.choose}</strong><small>{copy.limit}</small></button><button type="button" className="dropzone" onClick={() => inputRef.current?.click()}><span className="upload-icon">↑</span><strong>{files.length ? copy.selected(files.length) : copy.choose}</strong><small>{copy.limit}</small></button><input ref={inputRef} className="sr-only" type="file" accept="image/*" multiple onChange={selectFiles} /><p className="local-privacy">{copy.privacy}</p><button type="button" className="primary" disabled={!files.length || reading} onClick={readScreenshots}>{reading ? copy.processing : copy.process}</button>{status && <p className="upload-status" role="status">{status}</p>}</div> : <div className="text-view"><label htmlFor={`conversation-${language}`}>{copy.chatText}</label><textarea id={`conversation-${language}`} value={text} onChange={(event) => { setText(event.target.value.slice(0, 12000)); setDone(false); }} placeholder={copy.placeholder} /><div className="text-meta"><span>{status}</span><span>{text.length} / 12000</span></div><button type="button" className="primary" disabled={text.trim().length < 8} onClick={() => setDone(true)}>{copy.analyse}</button></div>}{done && <div className="english-result"><span>{context}</span><h3>{findings.length ? "A few patterns are worth looking at" : "Not enough here to call a clear pattern"}</h3><div className="conversation-result-sections">
    <article><h4>What I can see</h4><p>{findings.length ? `This text contains ${findings.length} pattern${findings.length === 1 ? "" : "s"} worth checking. The page is matching words and rules, not reading anyone’s mind.` : "The current local rules did not find a clear repeated pattern in this excerpt."}</p></article>
    <article><h4>Verifiable words and facts</h4>{facts.length ? <ul>{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : <p>No clear date, amount, place or concrete request was extracted from this text.</p>}</article>
    <article><h4>Possible pressure or control</h4>{findings.length ? findings.map((item) => <div className="local-finding" key={item.title}><b>{item.title}</b><small>Matched: {item.hits.join(", ")}</small><p>{item.note}</p></div>) : <p>There is not enough evidence here for a specific claim. Repetition and what happens after you say no still matter.</p>}</article>
    <article><h4>How this conversation may affect you</h4><p>{findings.length ? "Repeated denial, blame or control can leave you explaining more, doubting yourself or planning every word around the other person’s reaction. A strong reaction does not by itself show who created the pattern." : "This excerpt alone cannot show the impact. Notice sleep, fear, self-doubt and whether you feel less free to speak or choose."}</p></article>
    <article><h4>Safety signals</h4><p>{safetyHits.length ? `Possible safety language was found: ${safetyHits.join(", ")}. Automated matching can be wrong, so check the full context and use real-world help if danger is immediate.` : "No direct threat, stalking or restriction signal was matched here. That is not a guarantee of safety outside this text."}</p></article>
    <article><h4>A short reply you can copy</h4><button type="button" className="copy-reply" onClick={() => navigator.clipboard?.writeText(replies[0])}>{replies[0]}<small>Copy</small></button></article>
    <article><h4>One concrete step for now</h4><p>{oneStep}</p></article>
    <article><h4>What remains uncertain</h4><p>This local tool cannot verify events, infer intent or diagnose abuse, trauma, NPD or any personality disorder. OCR can also misread names, negations, amounts and message order.</p></article>
  </div></div>}</section>;
}
