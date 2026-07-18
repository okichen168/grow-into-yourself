export type AnalysisLanguage = "en" | "zh";
export type AnalysisContext = "relationship" | "family" | "workplace" | "friendship";

export type AiAnalysis = {
  summary: string;
  pressureSignals: string[];
  myPattern: string[];
  sentenceAnalysis: Array<{
    original: string;
    pressure: string;
    whyItHurts: string;
    clearerReading: string;
  }>;
  replyOptions: {
    soft: string;
    firm: string;
    exit: string;
  };
  suggestedReply: string;
  riskLevel: string;
  urgentWarning: string;
  source: "ai" | "local";
};

const patternWords = [
  { zh: "否定现实感或改写经过", en: "Denial or reality rewriting", words: ["你想多了", "太敏感", "我没说过", "你记错了", "根本没发生", "too sensitive", "never said that", "you imagined it", "overreacting"] },
  { zh: "羞辱或人身攻击", en: "Humiliation or personal attack", words: ["没用", "废物", "丢人", "白眼狼", "有病", "不要脸", "useless", "stupid", "pathetic", "crazy"] },
  { zh: "情绪勒索、道德绑架或内疚诱导", en: "Emotional blackmail or guilt pressure", words: ["为你好", "养你这么大", "不孝", "没良心", "都是为了你", "if you loved me", "after all i have done", "you owe me"] },
  { zh: "责任转嫁", en: "Responsibility shifting", words: ["都是因为你", "你逼我的", "谁让你", "还不是你", "your fault", "you made me", "look what you did"] },
  { zh: "威胁或恐吓", en: "Threat or intimidation", words: ["后果自负", "你敢", "走着瞧", "让你好看", "you will regret", "watch what happens", "you'll pay"] },
  { zh: "社交控制或孤立倾向", en: "Social control or isolation", words: ["别跟他们来往", "不准见朋友", "只能相信我", "退出那个群", "stop seeing them", "do not talk to them", "choose me or them"] },
  { zh: "亲密关系或数字控制", en: "Relationship or digital control", words: ["不许", "必须", "发位置", "查手机", "交出密码", "随时报备", "send your location", "give me your password", "not allowed", "prove where you are"] },
  { zh: "经济控制", en: "Financial control", words: ["钱都交给我", "不给你钱", "冻结账户", "没收工资", "不许工作", "hand over your salary", "freeze your account", "not allowed to work", "control all the money"] },
  { zh: "惩罚性冷处理", en: "Punitive silent treatment", words: ["别再联系我", "不回你", "晾着你", "消失几天", "silent treatment", "ignore you until", "not speaking to you"] },
  { zh: "职场霸凌", en: "Workplace bullying", words: ["开除你", "行业混不下去", "公开批评", "不给资料", "抢功", "背锅", "fire you", "ruin your reference", "take the credit", "set you up to fail"] },
  { zh: "朋友背叛或群体排斥", en: "Friendship betrayal or exclusion", words: ["把聊天发出去", "群里曝光", "所有人都不理你", "选边站", "spread your messages", "tell everyone", "kick you out of the group", "choose sides"] },
];

const urgentPhrases = [
  "杀了你", "弄死你", "打死你", "伤害你", "我要自杀", "我去跳楼", "跟踪你", "一直盯着你", "实时定位你",
  "锁门不让你走", "不让你离开", "把你关起来", "扣你身份证", "扣你护照", "抓你回去", "强制带你回去",
  "伤害孩子", "伤害未成年人", "没收全部工资", "冻结你的账户", "断掉你的生活费",
  "kill you", "hurt you", "kill myself", "hurt myself", "commit suicide", "stalk you", "track your location",
  "lock you in", "won't let you leave", "take your passport", "force you home", "harm the child", "harm a minor",
  "take your entire salary", "freeze your account",
];
const sentenceBreak = /[。！？!?；;\n]+/;

export function hasExplicitUrgentSignal(text: string) {
  const normalised = text.toLowerCase();
  return urgentPhrases.some((phrase) => normalised.includes(phrase.toLowerCase()));
}

export function normaliseInput(otherText: string, myText: string) {
  return {
    otherText: otherText.trim().slice(0, 6000),
    myText: myText.trim().slice(0, 3000),
  };
}

export function localAnalyze(otherText: string, myText: string, language: AnalysisLanguage): AiAnalysis {
  const other = otherText.toLowerCase();
  const hits = patternWords.filter((item) => item.words.some((word) => other.includes(word.toLowerCase())));
  const hasUrgent = hasExplicitUrgentSignal(`${otherText}\n${myText}`);
  const importantLines = otherText
    .split(sentenceBreak)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => {
      const score = (line: string) => patternWords.reduce((total, item) => total + item.words.filter((word) => line.toLowerCase().includes(word.toLowerCase())).length, 0);
      return score(b) - score(a);
    })
    .slice(0, 5);
  const pressureSignals = hits.length
    ? hits.map((item) => language === "zh" ? item.zh : item.en)
    : [language === "zh" ? "未命中明确高压词，但这不代表关系一定健康。" : "No clear pressure keyword matched, but this does not prove the conversation is healthy."];
  const replyText = myText.toLowerCase();
  const myPattern = !myText.trim()
    ? [language === "zh" ? "你还没有填写自己的回复。可以先暂停，只回应可核实的事实。" : "No reply was provided. Consider pausing and answering only the verifiable facts first."]
    : [
      /对不起|抱歉|sorry|apolog/i.test(replyText) ? (language === "zh" ? "回复里出现了道歉。可以确认：这份责任是否真的属于你。" : "Your reply includes an apology. Check whether this responsibility is actually yours.") : "",
      /我只是|我真的|你要相信|请你相信|i just|i really|believe me/i.test(replyText) ? (language === "zh" ? "回复可能在反复解释或证明自己。越解释不一定越容易被理解。" : "Your reply may be over-explaining or trying to prove your intentions.") : "",
      /都听你的|我改还不行|随便你|whatever you want|i'll do anything/i.test(replyText) ? (language === "zh" ? "回复里可能有为了结束压力而让步的迹象。" : "Your reply may be giving up a boundary mainly to stop the pressure.") : "",
    ].filter(Boolean) as string[];

  if (myText.trim() && myPattern.length === 0) {
    myPattern.push(language === "zh" ? "暂未发现明显的过度解释、道歉或让步模式。" : "No clear over-explaining, apologising, or boundary collapse was detected.");
  }

  return {
    summary: language === "zh"
      ? (hits.length ? "这段文字里出现了可能带来压力的表达。先把可核实的事实、评价、要求和后果分开看；本地兜底只能识别有限词语，不能确认动机或关系全貌。" : "这段文字暂时不足以做强判断。本地兜底没有命中明确模式，但这不代表关系一定健康。")
      : (hits.length ? "This is not just disagreement. It may be mixing facts with guilt, labels, control, or fear. Separate what happened from what you are being pressured to believe about yourself." : "There is not enough text for a strong judgment yet. Add more context if this is a repeated pattern."),
    pressureSignals,
    myPattern,
    sentenceAnalysis: importantLines.length ? importantLines.map((line) => ({
      original: line,
      pressure: language === "zh" ? "这句话可能在把具体问题扩大成对你人格、孝顺、判断力或服从程度的评价。" : "This may turn a concrete issue into a judgment about your character, judgment, or obedience.",
      whyItHurts: language === "zh" ? "它难受的地方在于：你还没来得及讨论事实，就先被推到“我要证明自己没错、不是坏人”的位置。" : "It hurts because before the facts are discussed, you are pushed into proving you are not wrong or bad.",
      clearerReading: language === "zh" ? "更清醒的读法是：对方可以表达担心，但不能用羞辱、威胁或道德债务来取消你的选择。" : "A clearer reading: concern can be expressed, but shame, threats, or moral debt should not cancel your choice.",
    })) : [],
    replyOptions: language === "zh" ? {
      soft: "我知道你有担心，但请先不要用评价和威胁的方式说我。我们可以只讨论具体事实和下一步怎么处理。",
      firm: "我不会在被羞辱、威胁或要求证明孝顺的情况下继续沟通。请把具体事情说清楚，不要攻击我的人格和选择。",
      exit: "我现在不继续争辩。等双方都能只谈事实、不互相伤害时，我再回复。",
    } : {
      soft: "I hear that you are worried, but please do not use labels or threats. We can talk about the concrete facts and next step.",
      firm: "I will not continue while I am being shamed, threatened, or asked to prove my worth. Please keep this to facts and specific requests.",
      exit: "I am not going to argue now. I will reply when we can discuss facts without hurting each other.",
    },
    suggestedReply: language === "zh"
      ? "我不会在被羞辱、威胁或要求证明孝顺的情况下继续沟通。请把具体事情说清楚，不要攻击我的人格和选择。"
      : "I will not continue while I am being shamed, threatened, or asked to prove my worth. Please keep this to facts and specific requests.",
    riskLevel: hasUrgent ? (language === "zh" ? "紧急" : "Urgent") : (hits.length >= 3 ? (language === "zh" ? "中" : "Medium") : (language === "zh" ? "低" : "Low")),
    urgentWarning: hasUrgent
      ? (language === "zh" ? "文字里出现了明确的威胁、跟踪、自伤、伤害他人、限制自由或强制控制信号。请优先确认现实安全，保存记录，并联系可信的人或当地紧急支持。" : "The text includes an explicit threat, stalking, self-harm, harm to others, confinement, or coercive-control signal. Prioritise real-world safety, save records, and contact trusted or local emergency support.")
      : "",
    source: "local",
  };
}
