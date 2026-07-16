"use client";

import { useMemo, useState } from "react";

type Question = { text: string; group: "emotional" | "control" | "withdrawal" | "wellbeing"; urgent?: boolean };

const relationshipQuestions: Question[] = [
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

const options = ["从不", "偶尔", "经常", "几乎总是"];

export default function SelfCheck() {
  const [kind, setKind] = useState<"relationship" | "workplace">("relationship");
  const questions = kind === "relationship" ? relationshipQuestions : workplaceQuestions;
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(relationshipQuestions.length).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const complete = answers.every((value) => value >= 0);
  const scores = useMemo(() => questions.reduce<Record<string, number>>((acc, question, index) => ({ ...acc, [question.group]: (acc[question.group] || 0) + Math.max(0, answers[index]) }), {}), [answers, questions]);
  const urgent = questions.some((question, index) => question.urgent && answers[index] >= 2);
  const pressureQuestionCount = questions.filter((question) => question.group !== "wellbeing").length;
  const wellbeingQuestionCount = questions.filter((question) => question.group === "wellbeing").length;
  const pressureScore = Math.round(((scores.emotional || 0) + (scores.control || 0) + (scores.withdrawal || 0)) / (pressureQuestionCount * 3) * 100);
  const wellbeingScore = Math.round((scores.wellbeing || 0) / (wellbeingQuestionCount * 3) * 100);

  function resultLabel() {
    if (urgent) return "先处理安全与危机信号";
    if (pressureScore >= 65 || wellbeingScore >= 65) return kind === "workplace" ? "反复负面行为与身心影响已经很明显" : "关系与身心影响已经很明显";
    if (pressureScore >= 40 || wellbeingScore >= 40) return "出现多项需要重视的模式";
    if (pressureScore >= 18 || wellbeingScore >= 18) return "有一些让你不舒服的信号";
    return "当前回答未显示集中高风险";
  }

  const patternLabels = kind === "relationship" ? [
    scores.control >= 5 ? "强制控制或安全风险" : "",
    scores.emotional >= 5 ? "否认、羞辱与情感操控" : "",
    scores.withdrawal >= 2 ? "冷处理或撤回沟通" : "",
    scores.wellbeing >= 6 ? "你的身心状态正在受影响" : "",
  ].filter(Boolean) : [
    scores.control >= 7 ? "工作相关霸凌或权力压制" : "",
    scores.emotional >= 5 ? "针对个人的羞辱与攻击" : "",
    scores.withdrawal >= 2 ? "职场排斥与信息孤立" : "",
    scores.wellbeing >= 2 ? "你的身心和工作状态正在受影响" : "",
  ].filter(Boolean);

  function supportiveReading() {
    if (kind === "workplace") {
      if (urgent) return "你不需要为了保住工作而把威吓、骚扰或现实危险说成‘职场都这样’。先离开不安全的单独场景，让可信同事知道，并保存原始消息、时间和在场人员。你现在的紧张不是不专业，是身体在提醒你边界正在被侵犯。";
      if (pressureScore >= 65 || wellbeingScore >= 65) return "你可能已经花了很久证明自己能干、配合、不是玻璃心。但当信息被扣住、标准被反复改变、成果被抹掉时，再努力也可能仍被安排成失败。先把问题从‘是不是我不够好’改写成‘哪些负面行为在重复，谁拥有决定权，有什么记录可以核实’。";
      if (pressureScore >= 40 || wellbeingScore >= 40) return "这看起来不只是一次难听的反馈。职场霸凌常由一连串看似可以单独解释的小事组成，久了会让人失去判断。请按日期记录任务、标准变化、信息缺失和目击者；连续的事实比给谁贴标签更能保护你。";
      if (pressureScore >= 18 || wellbeingScore >= 18) return "你已经捕捉到一些不公平或让人缩小的信号。一次冲突未必是霸凌，但反复针对、权力不对等和难以制止值得认真观察。先要求明确书面标准，并把重要沟通留痕。";
      return "当前回答没有形成集中的职场霸凌模式，这是相对安心的信号。合理管理应说明任务、标准和改进方式，而不是羞辱人格；某一次越界仍然可以被记录和提出。";
    }
    if (urgent) return "我相信你能走到这里、把这些题答完，已经用掉了很多力气。你不是软弱，也不是在给别人添麻烦；长期面对威胁、限制或反复的情绪拉扯，人会本能地紧张、顺从、反复确认，这常常是身体在努力保护你。此刻不需要逼自己马上做出人生决定，先让一个可信的人知道，先把证件、手机、药物和可以去的地方准备好。";
    if (pressureScore >= 65 || wellbeingScore >= 65) return "你大概已经解释、忍耐和自我检查了很久。现在的疲惫、麻木、犹豫，并不说明你没有判断力，更可能说明你在一段长期消耗你的关系里撑了太久。你不必先证明对方“到底是不是NPD”，才有资格减少联系、保留证据、重新拿回时间和选择。";
    if (pressureScore >= 40 || wellbeingScore >= 40) return "你的不舒服不是凭空出现的。几项模式同时发生时，人很容易一边受伤，一边替对方找理由，最后反过来怀疑自己。先不要急着给关系下最终结论；从一次具体事件开始记录：发生了什么、你说了什么、你拒绝后对方做了什么。事实会慢慢帮你站稳。";
    if (pressureScore >= 18 || wellbeingScore >= 18) return "你已经注意到了一些让自己缩小、紧张或不敢表达的时刻。它们未必足以定义整段关系，但足以值得一次认真谈话和一条清楚边界。你的感受不是判决书，却是重要信息。";
    return "目前没有看到集中出现的控制模式，这是一个相对安心的信号。但分数低不等于你的某次受伤不重要。你仍然可以相信身体发出的不舒服，并要求对方就具体行为解释、道歉和改变。";
  }

  function chooseKind(next: "relationship" | "workplace") {
    setKind(next);
    const length = next === "relationship" ? relationshipQuestions.length : workplaceQuestions.length;
    setAnswers(Array(length).fill(-1)); setShowResult(false);
  }

  return (
    <section className="self-check" id="self-check">
      <div className="section-heading"><p className="eyebrow">关系与身心状态自查</p><h2>不是给谁定罪，是帮你确认自己经历了什么</h2><p>{kind === "relationship" ? "伴侣/家人版抓取反复否认、羞辱、恐惧、强制控制、孤立和身心影响。参考WAST、HARK、强制控制研究与创伤知情原则重新编写。" : "职场版抓取NAQ-R研究中的针对个人、针对工作、排斥与威吓，并加入成果侵占、报复和身心影响。"} 两套都是辅助梳理，不是经本项目独立验证的临床诊断量表。</p></div>
      {!started ? <div className="check-start">
        <div><div className="check-kind"><button className={kind === "relationship" ? "active" : ""} onClick={() => chooseKind("relationship")}>伴侣 / 家人</button><button className={kind === "workplace" ? "active" : ""} onClick={() => chooseKind("workplace")}>职场</button></div><strong>{questions.length}道题 · 约2分钟</strong><p>只在当前页面计算，不上传答案、不保存分数。你可以随时退出。</p></div>
        <button onClick={() => setStarted(true)}>开始自查</button>
      </div> : !showResult ? <div className="question-list">
        {questions.map((question, index) => <fieldset key={question.text}><legend><span>{String(index + 1).padStart(2, "0")}</span>{question.text}</legend><div>{options.map((option, score) => <label className={answers[index] === score ? "checked" : ""} key={option}><input type="radio" name={`q-${index}`} checked={answers[index] === score} onChange={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? score : value))} />{option}</label>)}</div></fieldset>)}
        <button className="check-submit" disabled={!complete} onClick={() => setShowResult(true)}>{complete ? "查看自查结果" : `还有 ${answers.filter((value) => value < 0).length} 题未回答`}</button>
      </div> : <div className={`check-result ${urgent ? "urgent" : ""}`}>
        <span>你的本次结果</span><h3>{resultLabel()}</h3>
        <div className="score-grid"><div><span>{kind === "workplace" ? "职场负面行为" : "关系压力信号"}</span><strong>{pressureScore}</strong><i><b style={{width:`${pressureScore}%`}} /></i></div><div><span>身心受影响程度</span><strong>{wellbeingScore}</strong><i><b style={{width:`${wellbeingScore}%`}} /></i></div></div>
        {patternLabels.length ? <div className="pattern-tags">{patternLabels.map((label) => <b key={label}>{label}</b>)}</div> : <p>没有形成明显集中模式，但你的主观不舒服仍值得被认真对待。</p>}
        <div className="support-letter"><span>想认真对你说</span><p>{supportiveReading()}</p></div>
        <div className="next-steps"><h4>现在可以先做的三件小事</h4>{kind === "workplace" ? <ol><li>按日期保存任务要求、标准变化、聊天、邮件和在场人员，不在公司设备里只留一份。</li><li>把口头任务确认成书面：“我理解的交付标准是……如有不同请指出。”</li><li>{urgent ? "避免单独处在不安全场景，告诉可信同事；涉及违法侵害时寻求劳动、警方或法律支持。" : "比较同岗位规则是否一致，再决定向上级、HR、工会或劳动监察反映。"}</li></ol> : <ol><li>写下一次最让你困惑的具体事件，不评价自己，只写时间、原话和行为。</li><li>选一条最小边界，例如“被辱骂时暂停沟通”，观察对方是否尊重。</li><li>{urgent ? "在安全时告诉一个可信的人，并准备证件、药物、充电器和可以去的地方。" : "把结果保存给自己，隔一周再答一次，看模式是在减少还是升级。"}</li></ol>}</div>
        <p className="score-note">0—100是本页内部的维度换算，帮助你比较自己的变化，不是疾病概率、人格诊断或专业危险预测。真正重要的是行为是否反复、升级，以及你说“不”之后会发生什么。</p>
        <div className="check-actions">{urgent && <a href="#safety">查看现实安全支持</a>}<a href="#tool">拆解一段具体对话</a><button onClick={() => { setAnswers(Array(questions.length).fill(-1)); setShowResult(false); }}>重新填写</button><button onClick={() => { setStarted(false); setShowResult(false); }}>切换自查类型</button></div>
      </div>}
      <details className="npd-explainer"><summary>题目依据、PUA、NPD、冷暴力和职场霸凌的边界</summary><div><h3>这些题目从哪里来？</h3><p>伴侣/家人维度来自亲密关系暴力筛查综述、WAST/HARK、强制控制和心理虐待研究；职场维度参考NAQ-R的个人相关、工作相关和威吓行为，以及职场排斥研究。为了适合中文网页语境，我们重新写了题目，所以不会冒充已经完成中文人群效度验证的原量表。</p><p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2688958/" target="_blank" rel="noreferrer">亲密关系暴力筛查综述</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10666508/" target="_blank" rel="noreferrer">强制控制与心理影响综述</a> · <a href="https://stacks.cdc.gov/view/cdc/213398" target="_blank" rel="noreferrer">NIOSH/NAQ-R心理测量研究</a></p><h3>“PUA”要拆成行为，不当成诊断</h3><p>网页识别理想化后贬低、忽冷忽热、性边界施压、经济与数字控制、社交孤立、羞耻和责任反转。单独一句甜言蜜语或一次争吵不能证明操控，要看是否形成重复、让你失去选择的模式。</p><h3>NPD是临床诊断，不是关系里的骂人标签</h3><p>自恋特质并不等于自恋型人格障碍。正式诊断需要专业人员直接评估当事人，并判断模式是否长期、跨场景且造成明显功能损害。网页只能提示特权感、利用、缺乏互惠和被质疑后贬低等可观察行为。</p><h3>冷暴力不是所有“需要冷静”</h3><p>暂时暂停并说明何时恢复，与用长期沉默惩罚、逼迫你妥协不同。重点看是否有说明、是否尊重边界、是否反复作为控制手段。</p><h3>职场冲突不自动等于霸凌</h3><p>研究通常强调负面行为反复发生，而且当事人因权力差距难以保护自己。清楚、针对任务、有标准和改进方式的反馈不等于霸凌；公开羞辱、信息封锁、故意设败、排斥和报复则需要留痕观察。</p></div></details>
    </section>
  );
}
