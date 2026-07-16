"use client";

import { useMemo, useState } from "react";

type Question = { text: string; group: "emotional" | "control" | "withdrawal" | "wellbeing"; urgent?: boolean };

const questions: Question[] = [
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

const options = ["从不", "偶尔", "经常", "几乎总是"];

export default function SelfCheck() {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const complete = answers.every((value) => value >= 0);
  const scores = useMemo(() => questions.reduce<Record<string, number>>((acc, question, index) => ({ ...acc, [question.group]: (acc[question.group] || 0) + Math.max(0, answers[index]) }), {}), [answers]);
  const urgent = questions.some((question, index) => question.urgent && answers[index] >= 2);
  const total = answers.reduce((sum, value) => sum + Math.max(0, value), 0);
  const pressureScore = Math.round(((scores.emotional || 0) + (scores.control || 0) + (scores.withdrawal || 0)) / 27 * 100);
  const wellbeingScore = Math.round((scores.wellbeing || 0) / 12 * 100);

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

  function supportiveReading() {
    if (urgent) return "我相信你能走到这里、把这些题答完，已经用掉了很多力气。你不是软弱，也不是在给别人添麻烦；长期面对威胁、限制或反复的情绪拉扯，人会本能地紧张、顺从、反复确认，这常常是身体在努力保护你。此刻不需要逼自己马上做出人生决定，先让一个可信的人知道，先把证件、手机、药物和可以去的地方准备好。";
    if (total >= 24) return "你大概已经解释、忍耐和自我检查了很久。现在的疲惫、麻木、犹豫，并不说明你没有判断力，更可能说明你在一段长期消耗你的关系里撑了太久。你不必先证明对方“到底是不是NPD”，才有资格减少联系、保留证据、重新拿回时间和选择。";
    if (total >= 14) return "你的不舒服不是凭空出现的。几项模式同时发生时，人很容易一边受伤，一边替对方找理由，最后反过来怀疑自己。先不要急着给关系下最终结论；从一次具体事件开始记录：发生了什么、你说了什么、你拒绝后对方做了什么。事实会慢慢帮你站稳。";
    if (total >= 6) return "你已经注意到了一些让自己缩小、紧张或不敢表达的时刻。它们未必足以定义整段关系，但足以值得一次认真谈话和一条清楚边界。你的感受不是判决书，却是重要信息。";
    return "目前没有看到集中出现的控制模式，这是一个相对安心的信号。但分数低不等于你的某次受伤不重要。你仍然可以相信身体发出的不舒服，并要求对方就具体行为解释、道歉和改变。";
  }

  return (
    <section className="self-check" id="self-check">
      <div className="section-heading"><p className="eyebrow">关系与身心状态自查</p><h2>不是给对方定罪，是帮你确认自己经历了什么</h2><p>题目抓取反复否认、羞辱、恐惧、强制控制、孤立和身心影响等关键维度。它参考WAST、HARK、亲密关系暴力筛查与创伤知情原则重新编写，不是经本项目独立验证的临床量表，也不能证明对方患有NPD。</p></div>
      {!started ? <div className="check-start">
        <div><strong>13道题 · 约2分钟</strong><p>只在当前页面计算，不上传答案、不保存分数。你可以随时退出。</p></div>
        <button onClick={() => setStarted(true)}>开始自查</button>
      </div> : !showResult ? <div className="question-list">
        {questions.map((question, index) => <fieldset key={question.text}><legend><span>{String(index + 1).padStart(2, "0")}</span>{question.text}</legend><div>{options.map((option, score) => <label className={answers[index] === score ? "checked" : ""} key={option}><input type="radio" name={`q-${index}`} checked={answers[index] === score} onChange={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? score : value))} />{option}</label>)}</div></fieldset>)}
        <button className="check-submit" disabled={!complete} onClick={() => setShowResult(true)}>{complete ? "查看自查结果" : `还有 ${answers.filter((value) => value < 0).length} 题未回答`}</button>
      </div> : <div className={`check-result ${urgent ? "urgent" : ""}`}>
        <span>你的本次结果</span><h3>{resultLabel()}</h3>
        <div className="score-grid"><div><span>关系压力信号</span><strong>{pressureScore}</strong><i><b style={{width:`${pressureScore}%`}} /></i></div><div><span>身心受影响程度</span><strong>{wellbeingScore}</strong><i><b style={{width:`${wellbeingScore}%`}} /></i></div></div>
        {patternLabels.length ? <div className="pattern-tags">{patternLabels.map((label) => <b key={label}>{label}</b>)}</div> : <p>没有形成明显集中模式，但你的主观不舒服仍值得被认真对待。</p>}
        <div className="support-letter"><span>想认真对你说</span><p>{supportiveReading()}</p></div>
        <div className="next-steps"><h4>现在可以先做的三件小事</h4><ol><li>写下一次最让你困惑的具体事件，不评价自己，只写时间、原话和行为。</li><li>选一条最小边界，例如“被辱骂时暂停沟通”，观察对方是否尊重。</li><li>{urgent ? "在安全时告诉一个可信的人，并准备证件、药物、充电器和可以去的地方。" : "把结果保存给自己，隔一周再答一次，看模式是在减少还是升级。"}</li></ol></div>
        <p className="score-note">0—100是本页内部的维度换算，帮助你比较自己的变化，不是疾病概率、人格诊断或专业危险预测。真正重要的是行为是否反复、升级，以及你说“不”之后会发生什么。</p>
        <div className="check-actions">{urgent && <a href="#safety">查看现实安全支持</a>}<a href="#tool">拆解一段具体对话</a><button onClick={() => { setAnswers(Array(questions.length).fill(-1)); setShowResult(false); }}>重新填写</button></div>
      </div>}
      <details className="npd-explainer"><summary>题目依据、NPD与“危险人格”的边界</summary><div><h3>这些题目从哪里来？</h3><p>它们不是随意编出的“网红测试”。维度来自亲密关系暴力筛查综述中反复出现的恐惧、羞辱、身体与性暴力、强制控制，以及WAST/HARK等简短筛查工具覆盖的核心领域；同时加入经济控制、跟踪定位和身心功能影响。为了适合中文网页语境，我们重新写了题目，所以不会冒充已经完成中文人群效度验证的原量表。</p><p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2688958/" target="_blank" rel="noreferrer">查看亲密关系暴力筛查工具综述</a> · <a href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/intimate-partner-violence-and-abuse-of-elderly-and-vulnerable-adults-screening" target="_blank" rel="noreferrer">查看USPSTF 2025建议</a></p><h3>NPD是临床诊断，不是关系里的骂人标签</h3><p>自恋特质并不等于自恋型人格障碍。正式诊断需要专业人员直接评估当事人，并判断这些模式是否长期、跨场景且造成明显功能损害。网页不能根据伴侣或家人的转述给第三方确诊。</p><h3>比标签更有用的是行为分类</h3><p>我们会提示否认与羞辱、情绪勒索、强制控制、经济控制、跟踪定位、冷处理、伤害或自伤威胁。无论对方有没有某个诊断，这些行为造成的影响都可以被认真对待。</p><h3>冷暴力不是所有“需要冷静”</h3><p>暂时暂停沟通并说明何时恢复，与用长期沉默惩罚、逼迫你妥协不同。重点看是否有说明、是否尊重边界、是否反复作为控制手段。</p></div></details>
    </section>
  );
}
