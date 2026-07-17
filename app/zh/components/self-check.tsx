"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Group = "emotional" | "control" | "withdrawal" | "wellbeing";
type Question = { text: string; group: Group; urgent?: boolean };
type Kind = "partner" | "family" | "workplace" | "friend";

const partnerQuestions: Question[] = [
  { text:"对方会羞辱、讽刺或贬低我，事后又说只是开玩笑。", group:"emotional" },
  { text:"我说自己受伤时，对方常否认、改写经过，或说我太敏感。", group:"emotional" },
  { text:"对方会检查手机、要求定位、盘问行踪，或限制我见谁。", group:"control" },
  { text:"对方干预我的钱、工作、证件、住处、就医或性边界。", group:"control" },
  { text:"我表达拒绝或想离开时，对方会堵门、跟踪、强行带走或威胁我。", group:"control", urgent:true },
  { text:"对方用分手、自伤、伤害别人或毁掉名声来迫使我服从。", group:"control", urgent:true },
  { text:"对方故意失联、撤回亲密或冷处理，直到我先认错或妥协。", group:"withdrawal" },
  { text:"对方逐渐让我远离朋友、家人或其他能支持我的人。", group:"withdrawal" },
  { text:"我越来越不敢说真实想法，总先预测对方会不会生气。", group:"wellbeing" },
  { text:"这段关系已经影响我的睡眠、食欲、工作学习、自信或求生意愿。", group:"wellbeing", urgent:true },
];

const familyQuestions: Question[] = [
  { text:"家人常用“不孝、白养你、都是为你好”让我放弃自己的选择。", group:"emotional" },
  { text:"我提出具体伤害时，家人会否认、改写经过，或说我记仇、太敏感。", group:"emotional" },
  { text:"我的外貌、能力、工作、婚恋或价值被反复比较和贬低。", group:"emotional" },
  { text:"家人要求定位、查手机、干预交友婚恋，或不允许我拥有隐私。", group:"control" },
  { text:"家人用生活费、工资、房子、证件或照护作为我服从的条件。", group:"control" },
  { text:"家人阻止我工作、搬走或就医，或逼我回家、结婚、生育。", group:"control" },
  { text:"我不服从时，家人会让亲戚共同施压、集体不理我或把我孤立。", group:"withdrawal" },
  { text:"家里出现过殴打、限制自由、威胁伤害或逼迫我立刻回家的情况。", group:"control", urgent:true },
  { text:"我看到家人消息或想到回家时，会明显紧张、心慌、胃痛或失眠。", group:"wellbeing" },
  { text:"我很难知道自己想要什么，常觉得只能负责全家人的情绪。", group:"wellbeing" },
];

const workplaceQuestions: Question[] = [
  { text:"完成工作必需的信息、会议或资源被反复扣住，却又因此责怪我表现不好。", group:"control" },
  { text:"我被反复安排明显不合理的期限或工作量，同时不给必要资源。", group:"control" },
  { text:"职责、标准或目标不断改变，让我无论怎么做都容易被判定为错。", group:"control" },
  { text:"我的成果被抢走、贡献被抹掉，或被长期安排贬低能力的任务。", group:"emotional" },
  { text:"有人反复公开羞辱、吼叫、嘲笑，或传播关于我的负面流言。", group:"emotional" },
  { text:"我被故意排除在会议、群聊、合作或正常同事交往之外。", group:"withdrawal" },
  { text:"对方用绩效、排班、转正、升职或行业声誉威胁我不要申诉。", group:"control" },
  { text:"我遭遇身体威吓、性骚扰、歧视羞辱，或担心遭到现实伤害。", group:"control", urgent:true },
  { text:"这些不是单次工作矛盾，而是反复发生，并且我很难靠自己制止。", group:"withdrawal" },
  { text:"这些经历已影响睡眠、身体、情绪、工作能力或让我害怕上班。", group:"wellbeing" },
];

const friendQuestions: Question[] = [
  { text:"朋友把我私下说的话、照片或秘密告诉别人，再说我开不起玩笑。", group:"emotional" },
  { text:"朋友反复讽刺、贬低或公开让我难堪，却要求我别太敏感。", group:"emotional" },
  { text:"发生矛盾后，对方只向别人展示最后一段，让我看起来是唯一有问题的人。", group:"emotional" },
  { text:"朋友要求我在不同朋友之间选边，或逼我一起排挤别人。", group:"control" },
  { text:"对方利用我的钱、资源、作业、成果或人脉，却不尊重我的拒绝。", group:"control" },
  { text:"朋友用曝光隐私、散播流言、拉群围攻或毁掉名声威胁我。", group:"control", urgent:true },
  { text:"我被反复踢出群聊、故意漏掉活动，或有人动员共同朋友不理我。", group:"withdrawal" },
  { text:"对方需要我时很亲密，我设边界后就撤回关系或让大家孤立我。", group:"withdrawal" },
  { text:"我为了不被抛下，经常答应本来不愿意做的事。", group:"wellbeing" },
  { text:"这段友情已影响睡眠、学习工作、自信或我与其他人的来往。", group:"wellbeing" },
];

const configs: Record<Kind,{ label:string; intro:string; questions:Question[] }> = {
  partner:{ label:"伴侣 / 暧昧", intro:"只看亲密关系中的否认、监控、亲密边界、威胁与身心影响。", questions:partnerQuestions },
  family:{ label:"家人", intro:"只看家庭中的孝顺施压、隐私经济控制、亲属围压与回家反应。", questions:familyQuestions },
  workplace:{ label:"职场", intro:"只看工作中的信息封锁、故意设败、排斥、羞辱与权力报复。", questions:workplaceQuestions },
  friend:{ label:"朋友 / 同学", intro:"只看友情中的泄密、利用、选边、集体排斥与关系奖惩。", questions:friendQuestions },
};

const options = ["从不","偶尔","经常","几乎总是"];
const groupNames: Record<Group,string> = { emotional:"否认与贬低", control:"控制与权力", withdrawal:"孤立与撤回", wellbeing:"身心影响" };

export default function SelfCheck(){
  const [kind,setKind]=useState<Kind|null>(null);
  const config=kind?configs[kind]:null;
  const questions=useMemo(()=>config?.questions??[],[config]);
  const [started,setStarted]=useState(false);
  const [answers,setAnswers]=useState<number[]>(Array(10).fill(-1));
  const [showResult,setShowResult]=useState(false);
  const complete=answers.length===10&&answers.every(v=>v>=0);
  const scores=useMemo(()=>questions.reduce<Record<Group,number>>((acc,q,i)=>({...acc,[q.group]:(acc[q.group]||0)+Math.max(0,answers[i]??-1)}),{emotional:0,control:0,withdrawal:0,wellbeing:0}),[answers,questions]);
  const counts=useMemo(()=>questions.reduce<Record<Group,number>>((acc,q)=>({...acc,[q.group]:acc[q.group]+1}),{emotional:0,control:0,withdrawal:0,wellbeing:0}),[questions]);
  const dimensions=(Object.keys(groupNames) as Group[]).map(group=>({group,label:groupNames[group],score:counts[group]?Math.round(scores[group]/(counts[group]*3)*100):0}));
  const scoreOf=(group:Group)=>dimensions.find(item=>item.group===group)?.score||0;
  const harmScore=Math.round((scoreOf("emotional")+scoreOf("control")+scoreOf("withdrawal"))/3);
  const wellbeingScore=scoreOf("wellbeing");
  const urgent=questions.some((q,i)=>q.urgent&&answers[i]>=2);
  const strongest=dimensions.filter(item=>item.group!=="wellbeing").sort((a,b)=>b.score-a.score)[0];
  const questionsRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ if(started) questionsRef.current?.scrollIntoView({behavior:"smooth",block:"start"}); },[started]);

  function chooseKind(next:Kind){ setKind(next); setAnswers(Array(10).fill(-1)); setStarted(false); setShowResult(false); }
  function level(){ if(urgent)return"先处理现实安全信号"; if(harmScore>=65||wellbeingScore>=65)return"伤害模式和身心影响已经很明显"; if(harmScore>=40||wellbeingScore>=40)return"多项模式正在累积"; if(harmScore>=18||wellbeingScore>=18)return"出现一些值得重视的信号"; return"目前没有形成集中的高风险模式"; }
  function relationAssessment(){
    if(!config)return"请先选择一种关系。";
    if(harmScore<18)return`本次回答没有显示明显、集中的${config.label}伤害模式。一次具体伤害仍可以被认真处理。`;
    const repeated=harmScore>=40?"已经多次出现":"已经出现";
    return`${config.label}中${repeated}${strongest.label}信号。这是行为评估，不等于给对方诊断人格。`;
  }
  function harmAssessment(){
    if(urgent)return"回答中出现威胁、限制自由、现实报复或其他安全信号。是否语气平静并不改变这些行为的风险。";
    if(harmScore>=65)return"这些行为很可能正在造成持续伤害：它们反复出现，并影响你说“不”、退出或保持独立的能力。";
    if(harmScore>=40)return"伤害不只来自一句难听的话，而来自几种行为同时出现。建议继续看频率、升级和边界后的反应。";
    return"现有回答不足以确认持续控制，但你的不舒服仍是真实信息，可以针对具体行为设边界并观察变化。";
  }
  function stateAssessment(){
    if(wellbeingScore>=67)return"你的睡眠、身体、情绪或日常功能可能已明显受影响。这不是证明你“有问题”，而是压力可能已经超过目前的承受范围。";
    if(wellbeingScore>=34)return"你可能正处在警觉、内耗或自我怀疑中。长期压力下，大哭、发怒、麻木或反复复盘都可能出现。";
    return"目前身心影响分数不高。仍建议留意睡眠、食欲、害怕程度和是否越来越不敢表达自己。";
  }
  function nextNeed(){
    if(urgent)return"先让一个可信的人知道，并准备安全去处、证件与联系方式；正在发生危险时使用现实求助。";
    if(kind==="workplace")return"先把一次口头要求变成书面：交付物、截止时间、资源和验收标准；同时保存标准变化与排斥记录。";
    if(kind==="family")return"先保护一个独立支点：证件副本、自己的支付方式、可信联系人，或必要时能暂住的地方。";
    if(kind==="friend")return"先保存原始记录、收紧隐私权限；只向一位关键人物说明完整经过，不在多个群里反复自证。";
    return"选一条最小边界并说清后果，例如停止查手机或结束辱骂中的对话；观察对方是尊重，还是惩罚和升级。";
  }
  function supportiveReading(){
    const base=kind?{partner:"亲密不该靠害怕、监控或不断自证来维持。",family:"是家人，不等于你必须交出隐私、钱和人生选择。",workplace:"职位更高，不等于有权羞辱、孤立或故意让你失败。",friend:"友情里的泄密、排斥和背叛也会造成真正的失落。"}[kind]:"你可以慢慢确认发生了什么。";
    if(urgent)return`${base} 你不必先把故事讲得完美才值得获得保护；先让自己离危险远一点。`;
    if(harmScore>=40||wellbeingScore>=40)return`${base} 你现在的混乱、愤怒或疲惫，不等于你就是问题本身。先把选择拿回一小步。`;
    return`${base} 你的感受不是判决书，但它值得被听见，也值得用事实慢慢核对。`;
  }

  return <section className="self-check" id="self-check">
    <div className="section-heading"><p className="eyebrow">关系与身心状态自查</p><h2>不是给谁定罪，是帮你确认自己经历了什么</h2><p>{config?config.intro:"先选择你想了解的关系。"} 每种关系各有10道专门题目，结果是辅助评估，不是医疗或人格诊断。</p></div>
    <div className="check-start"><div><div className="check-kind">{(Object.keys(configs) as Kind[]).map(item=><button type="button" data-context={item === "friend" ? "friendship" : item} aria-pressed={kind===item} className={kind===item?"active":""} onClick={()=>chooseKind(item)} key={item}>{kind===item&&<span aria-hidden="true">✓ </span>}{configs[item].label}</button>)}</div><strong>10道题 · 约2分钟</strong><p>{config?config.intro:"选择关系后会显示简短说明；点击开始后才展开题目。"} 只在当前页面计算，不上传答案、不保存分数。</p></div><button type="button" disabled={!kind||started} onClick={()=>setStarted(true)}>{started?"自查已开始":"开始自查"}</button></div>{started&&!showResult?<div className="question-list" id="zh-relationship-questions" ref={questionsRef}>
      {questions.map((question,index)=><div className="question-card" key={question.text}><p className="question-text"><span>{String(index+1).padStart(2,"0")}</span>{question.text}</p><div>{options.map((option,score)=><label className={answers[index]===score?"checked":""} key={option}><input type="radio" name={`q-${index}`} checked={answers[index]===score} onChange={()=>setAnswers(current=>current.map((value,i)=>i===index?score:value))}/>{option}</label>)}</div></div>)}
      <button className="check-submit" disabled={!complete} onClick={()=>setShowResult(true)}>{complete?"查看完整评估":`还有 ${answers.filter(v=>v<0).length} 题未回答`}</button>
    </div>:started&&kind&&config?<div className={`check-result ${urgent?"urgent":""}`}><span>本次辅助评估 · {config.label}</span><h3>{level()}</h3><div className="score-grid four">{dimensions.map(item=><div key={item.group}><span>{item.label}</span><strong>{item.score}</strong><i><b style={{width:`${item.score}%`}}/></i></div>)}</div><div className="assessment-grid"><article><span>关系里发生了什么</span><p>{relationAssessment()}</p></article><article><span>伤害是否在累积</span><p>{harmAssessment()}</p></article><article><span>你现在的状态</span><p>{stateAssessment()}</p></article><article><span>现在最需要什么</span><p>{nextNeed()}</p></article></div><div className="support-letter"><span>想认真对你说</span><p>{supportiveReading()}</p></div><p className="score-note">0—100只是本页内部换算，不是疾病概率。情绪大不等于一定有错，语气平静也不等于行为无害；要连同前因、重复、权力差距和后果一起看。</p><div className="check-actions">{urgent&&<a href="#safety">查看现实安全支持</a>}<a href="#tool">拆解一段具体对话</a><button onClick={()=>{setAnswers(Array(10).fill(-1));setShowResult(false)}}>重新填写</button><button onClick={()=>{setStarted(false);setShowResult(false)}}>切换关系</button></div></div>:null}
    <details className="npd-explainer"><summary>题目依据，以及PUA、NPD、冷暴力与霸凌的边界</summary><div><p>题目把标签拆成可观察行为：否认、羞辱、控制、排斥、信息封锁、威胁与身心影响。重点看是否反复、升级，以及你说“不”后会发生什么。</p><p><Link href="/zh/learn">打开通俗心理科普中心 →</Link></p></div></details>
  </section>;
}
