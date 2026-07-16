"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Question = { text: string; group: "emotional" | "control" | "withdrawal" | "wellbeing"; urgent?: boolean };
type Kind = "partner" | "family" | "friend" | "workplace";

const partnerQuestions: Question[] = [
  { text: "对方会羞辱、讽刺或贬低我，之后又说只是开玩笑。", group: "emotional" },
  { text: "当我说自己受伤时，对方常否认、改写经过，或说我太敏感。", group: "emotional" },
  { text: "冲突最后经常变成我不断解释、道歉和证明自己。", group: "emotional" },
  { text: "对方会检查手机、要求定位、盘问行踪或限制我见谁。", group: "control" },
  { text: "对方控制我的钱、工作、证件、住处或就医选择。", group: "control" },
  { text: "对方曾推搡、打我、扼颈、强迫性行为，或用武器与伤害恐吓我。", group: "control", urgent: true },
  { text: "对方用伤害我、伤害别人或自伤来迫使我服从。", group: "control", urgent: true },
  { text: "我表达拒绝或想离开时，对方会堵门、跟踪、强制带走或限制自由。", group: "control", urgent: true },
  { text: "对方故意长时间失联、冷处理或撤回亲密，直到我妥协。", group: "withdrawal" },
  { text: "我越来越不敢说真实想法，总先预测对方会不会生气。", group: "wellbeing" },
  { text: "这段关系已经影响睡眠、食欲、学习、工作或日常社交。", group: "wellbeing" },
  { text: "我常怀疑自己是不是记错了、疯了，或不配被好好对待。", group: "wellbeing" },
  { text: "我想过逃走、消失、自伤，或觉得生活没有希望。", group: "wellbeing", urgent: true },
];

const familyQuestions: Question[] = [
  { text: "家人常用“不孝、白养你、都是为你好”让我放弃自己的选择。", group: "emotional" },
  { text: "我提出一件具体伤害时，家人会否认、改写经过，或说我记仇、太敏感。", group: "emotional" },
  { text: "我的外貌、能力、工作、婚恋或价值被反复比较和贬低。", group: "emotional" },
  { text: "家人要求定位、查手机、干预交友婚恋，或不允许我拥有隐私。", group: "control" },
  { text: "家人用生活费、学费、工资、房子、证件或照护作为服从条件。", group: "control" },
  { text: "家人阻止我工作、搬走、就医，或逼我回家、相亲、结婚、生育。", group: "control" },
  { text: "家里出现过殴打、限制自由、威胁伤害我或其他家人的情况。", group: "control", urgent: true },
  { text: "家人用断绝关系、赶出家门、自伤或生病来逼我妥协。", group: "control", urgent: true },
  { text: "当我不服从时，家人会集体不理我、让亲戚劝压，或把我孤立。", group: "withdrawal" },
  { text: "我一回家或看到家人消息就明显紧张、心慌、胃痛或失眠。", group: "wellbeing" },
  { text: "我总觉得必须照顾所有人的情绪，却很难知道自己想要什么。", group: "wellbeing" },
  { text: "我想过逃走、消失、自伤，或觉得生活没有希望。", group: "wellbeing", urgent: true },
];

const friendQuestions: Question[] = [
  { text: "朋友把我私下说的话、照片或秘密告诉别人，再说我开不起玩笑。", group: "emotional" },
  { text: "朋友反复讽刺、贬低或公开让我难堪，却要求我别太敏感。", group: "emotional" },
  { text: "发生矛盾后，对方只向别人截取最后一段，让我看起来是唯一有问题的人。", group: "emotional" },
  { text: "朋友要求我在“她/他”和其他朋友之间选边，或逼我一起排挤别人。", group: "control" },
  { text: "对方利用我的钱、资源、作业、工作成果或人脉，却很少尊重我的拒绝。", group: "control" },
  { text: "朋友用曝光隐私、散播流言、拉群围攻或毁掉名声来威胁我。", group: "control", urgent: true },
  { text: "我被反复踢出群聊、故意漏掉活动，或有人动员共同朋友不理我。", group: "withdrawal" },
  { text: "对方忽冷忽热：需要我时非常亲密，我设边界后就撤回关系。", group: "withdrawal" },
  { text: "我为了不被抛下，经常答应本来不愿意做的事。", group: "wellbeing" },
  { text: "这段友情已经影响睡眠、学习、工作、自信或与其他人的来往。", group: "wellbeing" },
  { text: "我想过伤害自己、报复对方，或觉得活着没有意义。", group: "wellbeing", urgent: true },
];

const workplaceQuestions: Question[] = [
  { text: "完成工作必需的信息、会议或资源被反复扣住，却又因此责怪我表现不好。", group: "control" },
  { text: "我被反复安排明显不合理的期限、工作量，或在缺少资源时被要求完成任务。", group: "control" },
  { text: "我的职责和标准被不断改变，让我无论怎么做都容易被判定为错。", group: "control" },
  { text: "我的成果被抢走、贡献被抹掉，或我被长期安排贬低能力的无意义任务。", group: "control" },
  { text: "有人反复公开嘲笑、羞辱、吼叫，或传播关于我的负面流言。", group: "emotional" },
  { text: "我被故意排除在会议、群聊、合作或正常同事交往之外。", group: "withdrawal" },
  { text: "正常的工作反馈被换成人格攻击，例如说我蠢、没用、不配做这份工作。", group: "emotional" },
  { text: "对方利用绩效、排班、转正、升职或行业声誉威胁我不要申诉。", group: "control" },
  { text: "我遭遇身体威吓、性骚扰、歧视性羞辱，或担心遭到现实伤害。", group: "control", urgent: true },
  { text: "上述行为不是单次冲突，而是反复出现，并且我很难靠自己制止。", group: "emotional" },
  { text: "这些经历已经影响我的睡眠、情绪、身体、工作能力或离职想法。", group: "wellbeing" },
];

const configs: Record<Kind, { label: string; questions: Question[]; intro: string }> = {
  partner: { label: "伴侣 / 暧昧", questions: partnerQuestions, intro: "看否认、羞辱、强制控制、冷处理、亲密与安全边界。" },
  family: { label: "家人", questions: familyQuestions, intro: "看孝顺施压、隐私与经济控制、集体孤立和身心影响。" },
  workplace: { label: "职场", questions: workplaceQuestions, intro: "看信息封锁、故意设败、人格攻击、排斥与权力报复。" },
  friend: { label: "朋友 / 同学", questions: friendQuestions, intro: "看泄密、拉帮结派、公开羞辱、利用、排挤和关系奖惩。" },
};
const options = ["从不", "偶尔", "经常", "几乎总是"];

export default function SelfCheck() {
  const [kind, setKind] = useState<Kind>("partner");
  const questions = configs[kind].questions;
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const complete = answers.length === questions.length && answers.every((value) => value >= 0);
  const scores = useMemo(() => questions.reduce<Record<string, number>>((acc, question, index) => ({ ...acc, [question.group]: (acc[question.group] || 0) + Math.max(0, answers[index] ?? -1) }), {}), [answers, questions]);
  const urgent = questions.some((question, index) => question.urgent && answers[index] >= 2);
  const pressureCount = questions.filter((question) => question.group !== "wellbeing").length;
  const wellbeingCount = questions.filter((question) => question.group === "wellbeing").length;
  const pressureScore = Math.round(((scores.emotional || 0) + (scores.control || 0) + (scores.withdrawal || 0)) / (pressureCount * 3) * 100);
  const wellbeingScore = Math.round((scores.wellbeing || 0) / (wellbeingCount * 3) * 100);

  function chooseKind(next: Kind) { setKind(next); setAnswers(Array(configs[next].questions.length).fill(-1)); setShowResult(false); setStarted(false); }
  function resultLabel() {
    if (urgent) return "先处理安全与危机信号";
    if (pressureScore >= 65 || wellbeingScore >= 65) return "反复负面行为与身心影响已经很明显";
    if (pressureScore >= 40 || wellbeingScore >= 40) return "出现多项需要重视的模式";
    if (pressureScore >= 18 || wellbeingScore >= 18) return "有一些让你不舒服的信号";
    return "当前回答未显示集中高风险";
  }
  function supportiveReading() {
    if (urgent) return "你不是在给别人添麻烦。长期面对威胁、围攻或限制，人可能顺从、麻木，也可能突然崩溃。先不要逼自己把故事讲得完美；让可信的人知道，保存完整时间线，先去更安全的地方。";
    if (pressureScore >= 65 || wellbeingScore >= 65) return "你可能已经解释、忍耐和自我检查了很久。现在的疲惫、愤怒或混乱，不代表你就是问题本身。别只看冲突最后谁声音大；把镜头往前拉，看看哪些行为反复出现、谁能自由退出、谁在为说“不”付出代价。";
    if (pressureScore >= 40 || wellbeingScore >= 40) return "你的不舒服不是凭空出现的。几种模式一起发生时，人会一边受伤，一边替对方找理由。先记录一次完整事件：之前发生什么、你说了什么、对方怎样回应、事后谁承担后果。";
    if (pressureScore >= 18 || wellbeingScore >= 18) return "你已经注意到一些让自己缩小或紧张的时刻。它们未必足以定义整段关系，但足以值得一条清楚边界。你的感受不是判决书，却是重要信息。";
    return "目前没有形成集中的控制模式，这是相对安心的信号。但分数低不代表某一次伤害不重要；你仍然可以要求对方针对具体行为解释、道歉和改变。";
  }
  const patternLabels = [scores.control >= 5 ? "控制、利用或安全风险" : "", scores.emotional >= 5 ? "否认、羞辱或叙事反转" : "", scores.withdrawal >= 2 ? "冷处理、排斥或撤回关系" : "", scores.wellbeing >= 4 ? "身心状态正在受影响" : ""].filter(Boolean);

  return <section className="self-check" id="self-check">
    <div className="section-heading"><p className="eyebrow">关系与身心状态自查</p><h2>不是给谁定罪，是帮你确认自己经历了什么</h2><p>{configs[kind].intro} 题目只帮助梳理，不是人格诊断或危险预测。</p></div>
    {!started ? <div className="check-start"><div><div className="check-kind">{(Object.keys(configs) as Kind[]).map((item) => <button className={kind === item ? "active" : ""} onClick={() => chooseKind(item)} key={item}>{configs[item].label}</button>)}</div><strong>{questions.length}道题 · 约2分钟</strong><p>只在当前页面计算，不上传答案、不保存分数。你可以随时退出。</p></div><button onClick={() => setStarted(true)}>开始自查</button></div> : !showResult ? <div className="question-list">
      {questions.map((question, index) => <div className="question-card" key={question.text}><p className="question-text"><span>{String(index + 1).padStart(2, "0")}</span>{question.text}</p><div>{options.map((option, score) => <label className={answers[index] === score ? "checked" : ""} key={option}><input type="radio" name={`q-${index}`} checked={answers[index] === score} onChange={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? score : value))} />{option}</label>)}</div></div>)}
      <button className="check-submit" disabled={!complete} onClick={() => setShowResult(true)}>{complete ? "查看自查结果" : `还有 ${answers.filter((value) => value < 0).length} 题未回答`}</button>
    </div> : <div className={`check-result ${urgent ? "urgent" : ""}`}><span>你的本次结果 · {configs[kind].label}</span><h3>{resultLabel()}</h3><div className="score-grid"><div><span>反复负面行为</span><strong>{pressureScore}</strong><i><b style={{ width: `${pressureScore}%` }} /></i></div><div><span>身心受影响程度</span><strong>{wellbeingScore}</strong><i><b style={{ width: `${wellbeingScore}%` }} /></i></div></div>{patternLabels.length ? <div className="pattern-tags">{patternLabels.map((label) => <b key={label}>{label}</b>)}</div> : <p>没有形成明显集中模式，但你的主观不舒服仍值得被认真对待。</p>}<div className="support-letter"><span>想认真对你说</span><p>{supportiveReading()}</p></div><div className="next-steps"><h4>现在可以先做的三件小事</h4><ol><li>记录一次完整事件，不只保留你崩溃或大声说话的最后一幕。</li><li>选一条最小边界，观察对方是否尊重，还是惩罚、围攻或继续施压。</li><li>{urgent ? "先告诉可信的人并准备安全去处；正在发生危险时联系现实支持。" : "保存重要原话和时间线，隔一周再答一次，看模式是在减少还是升级。"}</li></ol></div><p className="score-note">0—100只是本页内部换算，方便你观察变化，不是疾病概率或人格诊断。情绪大不等于一定有错，语气平静也不等于行为无害；要连同前因、权力差距、重复模式和后果一起看。</p><div className="check-actions">{urgent && <a href="#safety">查看现实安全支持</a>}<a href="#tool">拆解一段具体对话</a><button onClick={() => { setAnswers(Array(questions.length).fill(-1)); setShowResult(false); }}>重新填写</button><button onClick={() => { setStarted(false); setShowResult(false); }}>切换自查类型</button></div></div>}
    <details className="npd-explainer"><summary>题目依据，以及PUA、NPD、冷暴力与霸凌的边界</summary><div><p>我们把标签拆成可以观察的行为：否认、羞辱、控制、排斥、信息封锁、威胁与身心影响。一次争吵不能证明操控，重点看是否反复、升级，以及你说“不”后发生什么。</p><p><Link href="/learn">打开通俗心理科普中心 →</Link></p></div></details>
  </section>;
}
