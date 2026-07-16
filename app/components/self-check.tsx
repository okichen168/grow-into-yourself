"use client";

import { useMemo, useState } from "react";

type Question = { text: string; group: "emotional" | "control" | "withdrawal" | "wellbeing"; urgent?: boolean };

const questions: Question[] = [
  { text: "对方会羞辱、讽刺或贬低我，之后又说只是开玩笑。", group: "emotional" },
  { text: "当我说自己受伤时，对方常否认、改写经过，或说我太敏感。", group: "emotional" },
  { text: "冲突最后经常变成我不断解释、道歉和证明自己。", group: "emotional" },
  { text: "对方会检查手机、要求定位、盘问行踪或限制我见谁。", group: "control" },
  { text: "对方控制我的钱、工作、证件、住处或就医选择。", group: "control" },
  { text: "对方用伤害我、伤害别人或自伤来迫使我服从。", group: "control", urgent: true },
  { text: "我表达拒绝或想离开时，对方会堵门、跟踪、强制带走或限制自由。", group: "control", urgent: true },
  { text: "对方故意长时间失联、冷处理或撤回亲密，直到我妥协。", group: "withdrawal" },
  { text: "我越来越不敢说真实想法，总先预测对方会不会生气。", group: "wellbeing" },
  { text: "这段关系已经影响睡眠、食欲、学习、工作或日常社交。", group: "wellbeing" },
  { text: "我常怀疑自己是不是记错了、疯了，或不配被好好对待。", group: "wellbeing" },
  { text: "我想过逃走、消失、自伤，或觉得生活没有希望。", group: "wellbeing", urgent: true },
];

const options = ["从不", "偶尔", "经常", "几乎总是"];

export default function SelfCheck() {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const complete = answers.every((value) => value >= 0);
  const scores = useMemo(() => questions.reduce<Record<string, number>>((acc, question, index) => ({ ...acc, [question.group]: (acc[question.group] || 0) + Math.max(0, answers[index]) }), {}), [answers]);
  const urgent = questions.some((question, index) => question.urgent && answers[index] >= 2);
  const total = answers.reduce((sum, value) => sum + Math.max(0, value), 0);

  function resultLabel() {
    if (urgent) return "先处理安全与危机信号";
    if (total >= 24) return "关系与身心影响已经很明显";
    if (total >= 14) return "出现多项需要重视的模式";
    if (total >= 6) return "有一些让你不舒服的信号";
    return "当前回答未显示集中高风险";
  }

  const patternLabels = [
    scores.control >= 5 ? "强制控制或安全风险" : "",
    scores.emotional >= 5 ? "否认、羞辱与情感操控" : "",
    scores.withdrawal >= 2 ? "冷处理或撤回沟通" : "",
    scores.wellbeing >= 6 ? "你的身心状态正在受影响" : "",
  ].filter(Boolean);

  return (
    <section className="self-check" id="self-check">
      <div className="section-heading"><p className="eyebrow">关系与身心状态自查</p><h2>不是给对方定罪，是帮你确认自己经历了什么</h2><p>参考亲密关系暴力、强制控制和心理困扰筛查框架重新编写。它不是诊断，也不能证明对方患有NPD。</p></div>
      {!started ? <div className="check-start">
        <div><strong>12道题 · 约2分钟</strong><p>只在当前页面计算，不上传答案、不保存分数。你可以随时退出。</p></div>
        <button onClick={() => setStarted(true)}>开始自查</button>
      </div> : !showResult ? <div className="question-list">
        {questions.map((question, index) => <fieldset key={question.text}><legend><span>{String(index + 1).padStart(2, "0")}</span>{question.text}</legend><div>{options.map((option, score) => <label className={answers[index] === score ? "checked" : ""} key={option}><input type="radio" name={`q-${index}`} checked={answers[index] === score} onChange={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? score : value))} />{option}</label>)}</div></fieldset>)}
        <button className="check-submit" disabled={!complete} onClick={() => setShowResult(true)}>{complete ? "查看自查结果" : `还有 ${answers.filter((value) => value < 0).length} 题未回答`}</button>
      </div> : <div className={`check-result ${urgent ? "urgent" : ""}`}>
        <span>你的本次结果</span><h3>{resultLabel()}</h3>
        {patternLabels.length ? <div className="pattern-tags">{patternLabels.map((label) => <b key={label}>{label}</b>)}</div> : <p>没有形成明显集中模式，但你的主观不舒服仍值得被认真对待。</p>}
        <p>{urgent ? "你的回答中出现了伤害、自伤或限制自由相关信号。请优先联系可信的人并准备安全计划；正在发生危险请拨110/120，心理危机可拨12356。" : "分数不等于诊断。请观察这些行为是否反复、是否升级，以及你说“不”之后会发生什么。"}</p>
        <div className="check-actions"><a href="#safety">查看中国地区求助</a><button onClick={() => { setAnswers(Array(questions.length).fill(-1)); setShowResult(false); }}>重新填写</button></div>
      </div>}
      <details className="npd-explainer"><summary>那NPD、冷暴力和“危险人格”到底是什么？</summary><div><h3>NPD是临床诊断，不是关系里的骂人标签</h3><p>自恋特质并不等于自恋型人格障碍。正式诊断需要专业人员直接评估当事人，并判断这些模式是否长期、跨场景且造成明显功能损害。网页不能根据伴侣或家人的转述给第三方确诊。</p><h3>比标签更有用的是行为分类</h3><p>我们会提示否认与羞辱、情绪勒索、强制控制、经济控制、跟踪定位、冷处理、伤害或自伤威胁。无论对方有没有某个诊断，这些行为造成的影响都可以被认真对待。</p><h3>冷暴力不是所有“需要冷静”</h3><p>暂时暂停沟通并说明何时恢复，与用长期沉默惩罚、逼迫你妥协不同。重点看是否有说明、是否尊重边界、是否反复作为控制手段。</p></div></details>
    </section>
  );
}
