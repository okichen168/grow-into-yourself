"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type Context = "Partner / Dating" | "Family" | "Workplace" | "Friendship";

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

export default function EnglishChecker() {
  const [context, setContext] = useState<Context>("Partner / Dating"); const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState(""); const [files, setFiles] = useState<File[]>([]); const [status, setStatus] = useState(""); const [done, setDone] = useState(false); const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null); const lower = text.toLowerCase();
  const findings = useMemo(() => patterns.map((item) => ({ ...item, hits: item.words.filter((word) => lower.includes(word.toLowerCase())) })).filter((item) => item.hits.length), [lower]);
  const replies = context === "Workplace" ? ["Please confirm the task, deadline, resources and success criteria in writing.", "I am happy to discuss the work. Please keep the feedback to the task and standard.", "If the scope has changed, please update it in writing so I can re-prioritise."] : ["Let’s stick to what happened. I’m not discussing my character.", "I hear you, but I won’t keep talking while I’m being insulted, monitored or threatened.", "I’m taking some space. I’ll reply when I feel safe and clear."];
  function selectFiles(event: ChangeEvent<HTMLInputElement>) { const incoming = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024); setFiles(incoming.slice(0, 6)); setStatus(incoming.length ? `${incoming.length} screenshot${incoming.length === 1 ? "" : "s"} selected.` : "Choose image files up to 8 MB each."); setDone(false); }
  async function readScreenshots() { if (!files.length || reading) return; setReading(true); setStatus("Reading on this device…"); try { const { createWorker } = await import("tesseract.js"); const worker = await createWorker("chi_sim+eng", undefined, { langPath: "/tessdata" }); const parts: string[] = []; for (const file of files) { const result = await worker.recognize(await prepareImage(file)); const cleaned = cleanOcr(result.data.text); if (cleaned) parts.push(cleaned); } await worker.terminate(); const recognised = parts.join("\n\n— Next screenshot —\n\n"); if (!recognised) throw new Error("empty"); setText(recognised.slice(0, 12000)); setMode("text"); setStatus("Text has been rebuilt into sentences. Please check speakers, dates, money and words like ‘not’ before analysing."); } catch { setStatus("The text could not be read. You can still paste or correct it manually."); } finally { setReading(false); } }
  return <section className="english-tool" id="check"><div className="section-heading"><p className="eyebrow">Conversation clarity</p><h2>Bring the words. Keep your footing.</h2><p>Choose the relationship first. Then paste a chat or read screenshots locally and correct the text before you analyse it.</p></div><div className="english-context" aria-label="Relationship source">{(["Partner / Dating", "Family", "Workplace", "Friendship"] as Context[]).map((item) => <button type="button" className={context === item ? "active" : ""} onClick={() => { setContext(item); setDone(false); }} key={item}>{item}</button>)}</div><div className="mode-tabs"><button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>Paste text</button><button type="button" className={mode === "image" ? "active" : ""} onClick={() => setMode("image")}>Read screenshots</button></div>{mode === "image" ? <div className="upload-view"><button type="button" className="mobile-picker" onClick={() => inputRef.current?.click()}><span>+</span><strong>Choose screenshots from your phone</strong><small>Up to six images</small></button><button type="button" className="dropzone" onClick={() => inputRef.current?.click()}><span className="upload-icon">↑</span><strong>{files.length ? `${files.length} screenshot${files.length === 1 ? "" : "s"} selected` : "Choose chat screenshots"}</strong><small>They are read in this browser, not uploaded by this tool.</small></button><input ref={inputRef} className="sr-only" type="file" accept="image/*" multiple onChange={selectFiles} /><button type="button" className="primary" disabled={!files.length || reading} onClick={readScreenshots}>{reading ? "Reading screenshots…" : "Read and review text"}</button></div> : <div className="text-view"><label htmlFor="conversation">Chat text</label><textarea id="conversation" value={text} onChange={(event) => { setText(event.target.value.slice(0, 12000)); setDone(false); }} placeholder="Paste messages here. Chinese chat text is welcome too. Remove names, numbers and addresses first." /><div className="text-meta"><span>{status || "Please check speakers, dates, money and negatives before analysing."}</span><span>{text.length} / 12000</span></div><button type="button" className="primary" disabled={text.trim().length < 8} onClick={() => setDone(true)}>Analyse this conversation</button></div>}{done && <div className="english-result"><span>{context}</span><h3>{findings.length ? "A few patterns are worth looking at" : "Not enough here to call a clear pattern"}</h3><p>{findings.length ? "You do not need to prove you are ‘good enough’ before discussing facts and boundaries. Look at what keeps happening, what changes after you say no, and whether your freedom gets smaller." : "That does not make your feelings wrong. Add context about repeated behaviour, power and what happened after you asked for clarity or said no."}</p>{findings.map((item) => <article key={item.title}><b>{item.title}</b><small>Matched words: {item.hits.join(", ")}</small><p>{item.note}</p></article>)}<h4>If you want to reply</h4>{replies.map((reply) => <button type="button" className="copy-reply" onClick={() => navigator.clipboard?.writeText(reply)} key={reply}>{reply}<small>Copy</small></button>)}</div>}</section>;
}
