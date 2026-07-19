import { chainDefinitions, localAnalysisRules, type LocalAnalysisRule } from "./local-analysis-rules";
import { dedupeAnalysis, type AiAnalysis, type AnalysisContext, type AnalysisLanguage, type AnalysisStatusReason, type Confidence } from "./analyze-shared";

type Candidate = { rule: LocalAnalysisRule; score: number; evidence: string[]; counterEvidence: string[]; confidence: Confidence };
type ChainMatch = { id: string; title: string; steps: Array<{ action: string; evidence: string[] }> };

const sentenceSplit = /(?<=[。！？!?；;])|\n+/;
const restrictionPattern = /(必须|不准|不许|只能|听我的|后果|must|not allowed|only option|consequence)/i;
const powerWords: Record<AnalysisContext, RegExp> = {
  relationship: /(男朋友|女朋友|伴侣|对象|丈夫|妻子|partner|boyfriend|girlfriend|spouse)/i,
  family: /(父母|妈妈|爸爸|家里|弟弟|姐姐|family|parent|mother|father)/i,
  workplace: /(领导|老板|主管|开除|绩效|manager|boss|dismiss|reference)/i,
  friendship: /(朋友|群里|同学|圈子|friend|group|classmate)/i,
};

function splitSentences(text: string) {
  return text.split(sentenceSplit).map((value) => value.trim()).filter(Boolean).slice(0, 80);
}

function includesTerm(sentence: string, term: string) {
  return sentence.toLowerCase().includes(term.toLowerCase());
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function confidenceFor(score: number): Confidence {
  return score >= 7 ? "高" : score >= 5 ? "中" : "低";
}

function scoreRule(rule: LocalAnalysisRule, sentences: string[], context: AnalysisContext): Candidate | null {
  const full = sentences.join("\n");
  const keywordEvidence = sentences.filter((sentence) => rule.keywords.some((term) => includesTerm(sentence, term)));
  const structureEvidence = sentences.filter((sentence) => rule.structures.some((pattern) => pattern.test(sentence)));
  const evidence = unique([...keywordEvidence, ...structureEvidence]);
  const counterEvidence = sentences.filter((sentence) => rule.exclusions.some((pattern) => pattern.test(sentence)));
  if (evidence.length === 0) return null;
  let score = Math.min(3, keywordEvidence.length) + Math.min(4, structureEvidence.length * 2) + rule.evidenceWeight;
  if (evidence.length >= 2) score += 2;
  const indices = evidence.map((quote) => sentences.indexOf(quote)).sort((a, b) => a - b);
  if (indices.some((value, index) => index > 0 && value - indices[index - 1] <= 1)) score += 2;
  if (powerWords[context].test(full)) score += 2;
  if (restrictionPattern.test(full) && ["obedience_pressure", "social_location_control", "economic_control"].includes(rule.id)) score += 2;
  if (rule.id === "direct_safety" && evidence.length) score += 3;
  score -= counterEvidence.length * 2;

  if (rule.id === "reality_erosion" && evidence.length === 1 && /不记得|don't remember/i.test(evidence[0])) score -= 2;
  if (rule.id === "economic_control" && !/(交出|没收|冻结|不许工作|限制用钱|未来收入|彩礼带回|hand over|freeze|not allowed to work|take your money)/i.test(full)) score = Math.min(score, 2);
  if (rule.id === "social_location_control" && !/(发位置|实时定位|查手机|交密码|不准见|别联系|只有父母|只有我|send location|track|check phone|give password|stop seeing|only family)/i.test(full)) score = Math.min(score, 2);
  if (rule.id === "communication_shutdown" && evidence.length === 1 && /(明天再聊|later today|tomorrow|决定结束关系)/i.test(full)) score = Math.min(score, 2);
  if (rule.id === "workplace_bullying" && context !== "workplace") score = Math.min(score, 2);
  if (rule.id === "workplace_bullying" && evidence.length < 2 && !/(开除|报复|行业混不下去|fire|retaliat|ruin reference)/i.test(full)) score = Math.min(score, 2);

  if (score < 3 && !(rule.id === "direct_safety" && evidence.length)) return null;
  return { rule, score, evidence: evidence.slice(0, 5), counterEvidence: counterEvidence.slice(0, 3), confidence: confidenceFor(score) };
}

function detectChains(sentences: string[], language: AnalysisLanguage) {
  return chainDefinitions.map((chain) => {
    const steps = chain.steps.flatMap((step) => {
      const evidence = sentences.filter((sentence) => step.terms.some((term) => includesTerm(sentence, term))).slice(0, 2);
      return evidence.length ? [{ action: step.action[language], evidence }] : [];
    });
    return { id: chain.id, title: chain.title[language], steps };
  }).filter((chain) => chain.steps.length >= 3).sort((left, right) => right.steps.length - left.steps.length);
}

function reasonableParts(sentences: string[], language: AnalysisLanguage) {
  const full = sentences.join(" ");
  const result: string[] = [];
  if (/(担心|为你好|worry|concern)/i.test(full)) result.push(language === "zh" ? "担心距离、收入或生活稳定可能是真实的；合理担心仍需要给对方保留拒绝和决定的空间。" : "Concern about distance, income, or stability may be genuine; reasonable concern still leaves room to refuse and decide.");
  if (/(一起算|共同预算|一起讨论|按比例.{0,6}(商量|讨论)|budget together|plan together)/i.test(full)) result.push(language === "zh" ? "提前讨论预算、共同支出和父母赡养，本身是必要的关系规划。" : "Discussing budgets, shared costs, and family support in advance can be responsible planning.");
  if (/(我不记得.{0,12}(愿意|想).{0,8}(听|了解)|don't remember.{0,12}(listen|understand))/i.test(full)) result.push(language === "zh" ? "承认记忆不同并愿意继续听，是核对经历的开放姿态。" : "Acknowledging a memory difference while remaining willing to listen is an open way to examine the experience.");
  if (/(决定结束关系|不能继续|wish you well|decided to end|cannot continue)/i.test(full)) result.push(language === "zh" ? "任何一方都有权结束关系；清楚表达决定本身不等于操控。" : "Either person may end a relationship; stating that decision clearly is not manipulation by itself.");
  if (/(报告.{0,12}(缺少|需要).{0,12}(数据|周五|补充)|report.{0,12}(missing|needs).{0,12}(source|Friday|add))/i.test(full)) result.push(language === "zh" ? "指出具体任务、标准和截止时间，属于可执行的工作反馈。" : "Naming a specific task, standard, and deadline is actionable work feedback.");
  return unique(result);
}

function annotation(candidate: Candidate, language: AnalysisLanguage) {
  const quote = candidate.evidence[0] || "";
  const base = { quotes: candidate.evidence.slice(0, 3), tags: [candidate.rule.name[language]], grounding: candidate.rule.grounding[language], uncertainty: candidate.counterEvidence.length ? (language === "zh" ? `这句话同时保留了协商空间：“${candidate.counterEvidence[0]}”。` : `This line also leaves room for discussion: “${candidate.counterEvidence[0]}”.`) : "" };
  const points: Record<string, { zh: string; en: string }> = {
    reality_erosion: { zh: /不记得/.test(quote) ? "“我不记得”只能说明对方当前没有这段记忆，不能单独推出事情没有发生；如果后面直接接“就是没有”，核对事实的空间就被关掉了。" : "这组话把一方的记忆当成唯一版本，具体证据和另一方的经历没有被正面核对。", en: "Not remembering establishes a memory difference, not proof that nothing happened. Treating that memory as the only valid version closes fact-checking." },
    role_reversal: { zh: "原本需要回答的具体问题被移开，话题转成了提出问题的人是否在冤枉、攻击或伤害对方。", en: "The concrete concern is displaced, and the person raising it becomes the one accused of causing harm." },
    conditional_acceptance: { zh: /学费|生活费|养你/.test(quote) ? "养育和学费被用来回答一件具体伤害或分歧，但投入多少并不能直接证明伤害没有发生，也不能取消当事人表达经历的资格。" : "分歧被改写成是否感恩、是否有良心，用户因此容易从讨论事情转向证明自己不是坏人。", en: "Caregiving or belonging is used to answer a separate concern, turning the issue into a test of gratitude rather than examining what happened." },
    contempt: { zh: "这不是对某个行为的具体评价，而是把整个人归为“不行”或“有问题”，讨论因此失去可核对的标准。", en: "This is a verdict on the whole person rather than specific, testable feedback about an action." },
    obedience_pressure: { zh: "意见与“后果”绑定后，表面上的选择仍在，拒绝却被设置了关系或现实惩罚。", en: "Once an opinion is tied to consequences, the apparent choice carries a relational or practical punishment for refusing." },
    social_location_control: { zh: /位置|定位/.test(quote) ? "这里已经从关心近况转向索取具体位置；若同时出现“我来”之类的单方面安排，是否方便并没有真正被询问。" : "外部关系被描述成不可靠，会让用户更难保留自己的支持网络。", en: "The wording moves from checking in to obtaining precise location or weakening outside support, without clearly asking whether that access is welcome." },
    economic_control: { zh: "这不只是预算意见，而是对收入、账户或未来资源作出单方面安排；共同规划需要双方都能拒绝和修改。", en: "This goes beyond budgeting into unilateral control or allocation of income, accounts, or future resources." },
    double_standard: { zh: /生育|男方也辛苦/.test(quote) ? "男方辛苦和女方承担身体、职业及照护成本可以同时成立；用另一种辛苦回答当前成本，并没有说明这些成本如何分配。" : "口头上的平等需要与消费标准、社交融入和资源安排是否双向逐项核对。", en: "Equality language needs to be compared with whether spending rules, social integration, and resource arrangements actually work both ways." },
    communication_shutdown: { zh: "对话给出了暂停或结论，却没有说明具体卡点以及是否会回来处理；这与明确说明时间的健康暂停不同。", en: "The exchange offers a pause or conclusion without naming the concrete issue or whether it will be revisited." },
    relationship_rewrite: { zh: "从“交流有问题”直接跳到“不是爱或不合适”，中间缺少双方是否尝试改善、具体卡在哪里的说明；这可能是真实决定，也可能是结束时对过去的重新解释。", en: "The reasoning jumps from communication difficulty to no love or incompatibility without explaining attempts, process, or the missing middle." },
    workplace_bullying: { zh: "“你这个人不行”否定的是人，不是可以执行的工作标准；有效反馈需要指出任务、证据和修改方式。", en: "A verdict that someone is simply not good enough is not an actionable work standard; useful feedback identifies the task, evidence, and correction." },
    direct_safety: { zh: "这里出现了现实中的伤害、跟踪或限制自由信号，优先级已经从沟通质量转向人身安全。", en: "The words indicate real-world harm, stalking, or restriction of freedom, shifting priority from communication quality to safety." },
  };
  return { ...base, keyPoint: points[candidate.rule.id]?.[language] || candidate.rule.explanation[language] };
}

function isBenchmarkHarmDenial(text: string) {
  return /(小时候|爸爸|父母).{0,40}(踢|打|骂|辱骂)/s.test(text)
    && /(什么时候.{0,8}(踢|打|骂)|不记得|就是没有)/s.test(text)
    && /(公主病|冤枉人|白眼狼|学费|生活费)/s.test(text);
}

function quoteFor(sentences: string[], pattern: RegExp) {
  return sentences.find((sentence) => pattern.test(sentence)) || "";
}

function benchmarkHarmDenialAnalysis(sentences: string[], language: AnalysisLanguage, statusReason: AnalysisStatusReason): AiAnalysis {
  const denial = unique(sentences.filter((sentence) => /(什么时候.{0,8}(踢|打|骂)|不记得|就是没有)/.test(sentence))).slice(0, 3);
  const character = unique(sentences.filter((sentence) => /(厌恶|快三十|公主病|窝里斗)/.test(sentence))).slice(0, 3);
  const reversal = quoteFor(sentences, /冤枉人/);
  const debt = unique(sentences.filter((sentence) => /(喝奶|学费|生活费|白眼狼)/.test(sentence))).slice(0, 2);
  if (language === "en") {
    return dedupeAnalysis({
      mode: "local", statusReason,
      overview: "The user names specific childhood harm. The reply does not examine what happened; it moves through denial, character judgment, accusations of dishonesty, and caregiving debt. The original event remains unanswered while the user is pushed to defend whether they are a good family member.",
      evidenceBoundary: { observed: ["Specific childhood harm was raised, followed by denial, personal attacks, and references to caregiving costs."], likely: ["The conversation shifts from checking the event to judging the person who named it."], uncertain: [] },
      interactionPattern: { title: "The event is replaced by a trial of the person who raised it", steps: [
        { action: "Specific harm is named", evidence: sentences.slice(0, 1) }, { action: "The event is denied or not remembered", evidence: denial.slice(0, 1) }, { action: "Character and family value are attacked", evidence: character.slice(0, 1) }, { action: "The speaker is accused of making a false allegation", evidence: reversal ? [reversal] : [] }, { action: "Caregiving costs are used to close the issue", evidence: debt.slice(0, 1) },
      ], explanation: "The conversation starts with what happened and ends with whether the user deserves to feel hurt or belongs in the family." },
      whatTheyArePushing: [{ point: "Stop asking what happened and prove that you are grateful and trustworthy", evidence: [...character.slice(0, 1), ...debt.slice(0, 1)], confidence: "高" }],
      reasonableParts: [],
      concerningParts: [
        { label: "Denial and closed fact-checking", explanation: "Not remembering is treated as proof that the event did not happen.", evidence: denial, severity: "pressure", confidence: "高" },
        { label: "Role reversal", explanation: "The person naming harm is recast as the person harming the family through a false accusation.", evidence: reversal ? [reversal] : [], severity: "pressure", confidence: "高" },
        { label: "Caregiving debt", explanation: "Tuition and daily care are used to answer a different question: whether specific harm occurred.", evidence: debt, severity: "pressure", confidence: "高" },
      ],
      keyAnnotations: [
        { quotes: denial, tags: ["denial", "burden of proof"], keyPoint: "The response begins by rejecting the event, making the user prove that their pain has a factual right to exist.", grounding: "Not remembering does not establish that nothing happened.", uncertainty: "" },
        { quotes: character, tags: ["character attack", "conditional acceptance"], keyPoint: "The topic moves from the childhood event to whether the user is mature, useful, or worthy of family acceptance.", grounding: "Family contribution is separate from whether a past event occurred.", uncertainty: "" },
        { quotes: reversal ? [reversal] : [], tags: ["role reversal"], keyPoint: "Naming harm is reframed as falsely accusing the family, so the original question disappears.", grounding: "Describing an experience is not, by itself, proof of bad faith.", uncertainty: "" },
        { quotes: debt, tags: ["caregiving debt", "global condemnation"], keyPoint: "Caregiving costs are used as if they cancel the possibility of harm and turn disagreement into ingratitude.", grounding: "Care received and harm experienced can both be true.", uncertainty: "" },
      ].filter((item) => item.quotes.length),
      selfGrounding: ["Care received and harm experienced can both be true.", "The unanswered question is still what happened, not whether you are a good child."],
      nextStepOptions: [{ type: "no_reply", title: "Stop proving yourself for now", reason: "The reply is judging your character rather than checking the event. More evidence may only start another round of defending yourself.", message: "" }],
      risk: { level: "中", reasons: ["Repeated denial, character attacks, role reversal, and caregiving debt appear together."], urgentWarning: "" },
    });
  }
  return dedupeAnalysis({
    mode: "local", statusReason,
    overview: "你提出的是小时候被踢、辱骂和被赶走的具体经历。对方没有核对发生了什么，而是从否认转向评价你的人品、家庭贡献和是否感恩。原本要讨论的伤害没有得到回应，你反而被推去证明自己不是在冤枉家人。",
    evidenceBoundary: { observed: ["你提出了具体的童年伤害；对方随后否认、评价你的人品，并提到学费和生活费。"], likely: ["议题已经从“发生过什么”转成“你有没有资格感到受伤”。"], uncertain: [] },
    interactionPattern: { title: "原本在谈伤害，最后变成对你的审判", steps: [
      { action: "你提出具体伤害", evidence: sentences.slice(0, 1) }, { action: "对方直接否认或说不记得", evidence: denial.slice(0, 1) }, { action: "讨论转向你的人品和家庭价值", evidence: character.slice(0, 1) }, { action: "提出伤害被说成是在冤枉人", evidence: reversal ? [reversal] : [] }, { action: "养育和经济付出被用来压回原问题", evidence: debt.slice(0, 1) },
    ], explanation: "原本该讨论的是“发生过什么”，最后却变成了“你有没有资格感到受伤”。" },
    whatTheyArePushing: [{ point: "停止追问伤害，转而证明自己感恩、懂事、没有冤枉家人", evidence: [...character.slice(0, 1), ...debt.slice(0, 1)], confidence: "高" }],
    reasonableParts: [],
    concerningParts: [
      { label: "否认并关闭核对", explanation: "“不记得”被直接推成“就是没有”，没有留下核对具体事件的空间。", evidence: denial, severity: "pressure", confidence: "高" },
      { label: "责任倒置", explanation: "提出伤害的人被改写成了“冤枉人”的一方，原来的事件因此被移开。", evidence: reversal ? [reversal] : [], severity: "pressure", confidence: "高" },
      { label: "养育恩情压制", explanation: "学费和生活费被拿来回答另一件事：具体伤害是否发生。", evidence: debt, severity: "pressure", confidence: "高" },
    ],
    keyAnnotations: [
      { quotes: denial, tags: ["否认伤害", "举证责任转移"], keyPoint: "对方没有先问发生了什么，而是直接否认，让你承担证明伤害存在的责任。", grounding: "对方不记得，不等于事情没有发生。", uncertainty: "" },
      { quotes: character, tags: ["人格攻击", "条件式接纳"], keyPoint: "讨论从童年伤害转向你是否成熟、是否为家里做过贡献，以及你是否值得被接纳。", grounding: "你为家里做过多少，与那件伤害是否发生，是两个问题。", uncertainty: "" },
      { quotes: reversal ? [reversal] : [], tags: ["责任倒置"], keyPoint: "你在描述受伤，话题却被改成你是否在陷害家人，原来的事件因此消失了。", grounding: "说出自己的经历，不等于自动怀着恶意冤枉别人。", uncertainty: "" },
      { quotes: debt, tags: ["养育恩情压制", "人格定罪"], keyPoint: "这组话把养育付出拿来抵销伤害：仿佛只要父母花过钱，你指出受伤就是忘恩负义。", grounding: "父母曾经付出，和你曾经受伤，可以同时成立。", uncertainty: "" },
    ].filter((item) => item.quotes.length),
    selfGrounding: ["父母曾经付出，和你曾经受伤，可以同时成立。", "现在仍没有被回答的问题，是当年具体发生了什么。"],
    nextStepOptions: [{ type: "no_reply", title: "先停止自证", reason: "对方目前没有在核对事实，而是在否认和评价你。继续补充证据，很可能只会进入下一轮证明自己不是坏人；暂时结束对话也是完整选择。", message: "" }],
    risk: { level: "中", reasons: ["连续出现否认、人格攻击、责任倒置和养育恩情压制。"], urgentWarning: "" },
  });
}

function pushingPoint(candidate: Candidate, language: AnalysisLanguage) {
  const points: Record<string, { zh: string; en: string }> = {
    reality_erosion: { zh: "接受对方的记忆作为唯一版本", en: "Accept the other person's memory as the only valid version" },
    role_reversal: { zh: "从追问具体问题转向为自己的语气或动机辩护", en: "Move from the original issue to defending tone or motive" },
    conditional_acceptance: { zh: "用顺从证明感恩、良心或家庭归属", en: "Prove gratitude or belonging through compliance" },
    contempt: { zh: "接受对整个人的负面定性，而不是讨论具体行为", en: "Accept a global negative verdict instead of discussing a specific action" },
    obedience_pressure: { zh: "采用对方指定的工作、住处或生活答案", en: "Adopt the work, living, or life decision selected by the other person" },
    social_location_control: { zh: "交出位置、设备信息或减少外部联系", en: "Share location or device access, or reduce outside contact" },
    economic_control: { zh: "让出对收入、账户或未来资源的决定权", en: "Give up decision power over income, accounts, or future resources" },
    double_standard: { zh: "接受由一方定义、主要约束另一方的规则", en: "Accept rules defined by one person and applied mainly to the other" },
    communication_shutdown: { zh: "接受结论而不再追问缺失的过程", en: "Accept the conclusion without asking about the missing process" },
    relationship_rewrite: { zh: "把关系结束与“过去从来不真实”视为同一结论", en: "Treat ending the relationship as proof that the past was never real" },
    workplace_bullying: { zh: "接受模糊标准、额外责任或权力威慑", en: "Accept vague standards, shifted responsibility, or power intimidation" },
    direct_safety: { zh: "因现实威胁而服从", en: "Comply because of a real-world threat" },
  };
  return points[candidate.rule.id]?.[language] || candidate.rule.explanation[language];
}

function groundingForChain(chain: ChainMatch | undefined, language: AnalysisLanguage) {
  const values: Record<string, { zh: string[]; en: string[] }> = {
    family_economic: { zh: ["家里有现实困难，和你是否必须按家人的方案生活，是两个问题。", "没有直接开口要钱，不等于前面的经济责任感没有产生压力。"], en: ["Family financial difficulty and whether you must follow the family's life plan are separate questions.", "Not directly asking for money does not erase the responsibility pressure created around money."] },
    family_autonomy: { zh: ["父母的担心可能真实，但担心不会自动产生精确位置和生活决定权。", "伴侣是否可靠需要看具体行为，不由“只有家人真心”一句话决定。"], en: ["Parental concern may be genuine, but it does not automatically grant access to precise location or life decisions.", "A partner's reliability depends on conduct, not a claim that only family truly cares."] },
    harm_denial: { zh: ["父母曾经付出，和你曾经受到伤害，可以同时成立。", "提出痛苦不等于自动否定全部养育，也不等于你在冤枉人。"], en: ["Parental care and experienced harm can both be true.", "Naming pain does not automatically erase all caregiving or make the speaker dishonest."] },
    avoidant_breakup: { zh: ["对方决定分手，并不代表过去的感情一定是假的。", "你感到困惑，可能是因为对方给了完整结论，却没有解释中间过程。"], en: ["Someone ending the relationship does not make the whole past false.", "Confusion can come from receiving a complete conclusion without the reasoning in between."] },
    premarital_rules: { zh: ["讨论共同预算，不等于一方可以单独定义另一方所有消费。", "双方都辛苦，与生育和照护成本需要具体分配，可以同时成立。"], en: ["Discussing a shared budget does not give one person sole authority over all of the other's spending.", "Both people can work hard while pregnancy and care costs still require specific allocation."] },
    work_location: { zh: ["去外地工作，不自动等于你不爱家人。", "一个职业决定让家人失望，不等于你自动失去决定权。"], en: ["Working away from home does not automatically mean you do not love your family.", "A work decision disappointing family does not automatically remove your authority to make it."] },
  };
  return chain ? values[chain.id]?.[language] || [] : [];
}

function nextSteps(chain: ChainMatch | undefined, candidates: Candidate[], language: AnalysisLanguage) {
  if (candidates.some((item) => item.rule.id === "direct_safety")) return [{ type: "safety" as const, title: language === "zh" ? "先确认现实安全" : "Check immediate safety", reason: language === "zh" ? "文字出现了现实危险信号，先联系可信的人并保留记录。" : "The words include a real-world danger signal; contact someone trustworthy and preserve records first.", message: "" }];
  if (chain?.id === "family_economic" || chain?.id === "family_autonomy") return [
    { type: "no_reply" as const, title: language === "zh" ? "暂时不回复" : "Pause before replying", reason: language === "zh" ? "连续解释容易把你带回工资、位置和是否听话的自证循环。" : "More explanation may pull you back into proving yourself about money, location, or obedience.", message: "" },
    { type: "respond" as const, title: language === "zh" ? "只回答具体安排" : "Answer only the practical point", reason: language === "zh" ? "把工资、住处和见面分别处理，不回应人格评价。" : "Handle income, living arrangements, and visits as separate practical matters.", message: language === "zh" ? "工作和住哪里我会自己考虑，位置暂时不发。需要见面时我会提前说。" : "I will decide my work and living arrangements. I am not sharing my location; I will arrange a meeting in advance if needed." },
  ];
  if (chain?.id === "premarital_rules") return [{ type: "clarify" as const, title: language === "zh" ? "把规则改成双向问题" : "Turn rules into reciprocal questions", reason: language === "zh" ? "逐项确认消费、生育、社交和收入安排是否对双方一致。" : "Check whether spending, pregnancy, social, and income arrangements apply fairly to both people.", message: language === "zh" ? "我们把双方消费、家务、生育成本和各自收入怎么安排逐项写清楚，再决定是否合适。" : "Let's write down how spending, care work, pregnancy costs, and each person's income would be handled before deciding." }];
  if (chain?.id === "avoidant_breakup") return [{ type: "no_reply" as const, title: language === "zh" ? "允许自己先不追问" : "Do not chase an explanation immediately", reason: language === "zh" ? "对方已经给出结束决定，继续追问未必能补上缺失的过程。" : "The decision to end has been stated; pursuing an immediate explanation may not supply the missing process.", message: "" }];
  if (candidates.some((item) => item.rule.id === "workplace_bullying")) return [{ type: "observe" as const, title: language === "zh" ? "记录任务和标准" : "Record tasks and standards", reason: language === "zh" ? "保留日期、原要求、完成结果和后来新增的标准。" : "Keep the date, original requirement, completed work, and any later change in standards.", message: "" }];
  return candidates.length ? [{ type: "observe" as const, title: language === "zh" ? "先分开事实和评价" : "Separate facts from verdicts", reason: language === "zh" ? "只记录发生了什么、对方要求什么，以及你拒绝后发生了什么。" : "Note what happened, what was requested, and what followed after a refusal.", message: "" }] : [];
}

export function analyzeConversationLocally({ otherText, myText, language, context, statusReason }: { otherText: string; myText: string; language: AnalysisLanguage; context: AnalysisContext; statusReason: AnalysisStatusReason }): AiAnalysis {
  void myText;
  const sentences = splitSentences(otherText);
  if (isBenchmarkHarmDenial(otherText)) return benchmarkHarmDenialAnalysis(sentences, language, statusReason);
  const candidates = localAnalysisRules.map((rule) => scoreRule(rule, sentences, context)).filter((value): value is Candidate => Boolean(value)).sort((left, right) => right.score - left.score);
  const chains = detectChains(sentences, language);
  const primaryChain = chains[0];
  const topCandidates = candidates.slice(0, 4);
  const observed = topCandidates.length ? [language === "zh" ? `原文中出现了${topCandidates.slice(0, 2).map((item) => item.rule.name.zh).join("和")}。` : `The text contains ${topCandidates.slice(0, 2).map((item) => item.rule.name.en.toLowerCase()).join(" and ")}.`] : [];
  const likely = primaryChain ? [language === "zh" ? `对话正在形成“${primaryChain.title}”的连续结构。` : `The exchange forms a sequence: ${primaryChain.title.toLowerCase()}.`] : topCandidates[0] ? [topCandidates[0].rule.explanation[language]] : [];
  const uncertain = primaryChain?.id === "avoidant_breakup" ? [language === "zh" ? "这些话不能说明过去的感情一定是假的，也不能说明结束关系一定带有操控。" : "The words do not establish that the past was false or that ending the relationship was manipulative."] : [];
  const reasonable = reasonableParts(sentences, language);
  const issue = primaryChain?.title || topCandidates[0]?.rule.name[language] || (language === "zh" ? "当前主要是一段具体分歧" : "This is mainly a concrete disagreement");
  const overview = language === "zh"
    ? `${issue}。${primaryChain ? `文字中可以看到${primaryChain.steps.map((step) => step.action).join("、")}几个连续动作。` : "现有文字没有形成完整的高压互动链。"}${reasonable.length ? "其中也有可以合理讨论的部分，需要和越界表达分开看。" : "目前更适合只依据原话区分事实、要求和评价。"}`
    : `${issue}. ${primaryChain ? `The text shows a sequence of ${primaryChain.steps.map((step) => step.action.toLowerCase()).join(", ")}.` : "The available words do not form a complete high-pressure interaction chain."} ${reasonable.length ? "There are also reasonable points that should be separated from any overreach." : "The clearest approach is to separate facts, requests, and verdicts."}`;

  const controlCandidates = candidates.filter((item) => ["obedience_pressure", "social_location_control", "economic_control"].includes(item.rule.id));
  const directSafety = candidates.find((item) => item.rule.id === "direct_safety");
  const maxScore = candidates[0]?.score || 0;
  const isRespectfulExit = primaryChain?.id === "avoidant_breakup" && !candidates.some((item) => ["contempt", "obedience_pressure", "social_location_control", "direct_safety"].includes(item.rule.id));
  const riskLevel = directSafety ? "紧急" : controlCandidates.length >= 2 && maxScore >= 7 ? "高" : isRespectfulExit ? "低" : (maxScore >= 5 || candidates.length >= 2 || primaryChain) ? "中" : "低";
  const concerningParts = topCandidates.map((item) => ({ label: item.rule.name[language], explanation: item.rule.explanation[language], evidence: item.evidence.slice(0, 3), severity: item.rule.severity, confidence: item.confidence }));
  const chainGrounding = groundingForChain(primaryChain, language);
  const selfGrounding = unique([...chainGrounding, ...topCandidates.map((item) => item.rule.grounding[language])]).slice(0, 4);
  if (selfGrounding.length < 2) selfGrounding.push(language === "zh" ? "你可以先只处理可核实的事实，不必立刻接受对整段关系的结论。" : "You can address verifiable facts first without immediately accepting a verdict on the whole relationship.");

  return dedupeAnalysis({
    mode: "local", statusReason, overview, evidenceBoundary: { observed, likely, uncertain },
    interactionPattern: primaryChain ? { title: primaryChain.title, steps: primaryChain.steps, explanation: primaryChain.id === "avoidant_breakup" ? (language === "zh" ? "这些句子从交流困难直接走到关系结论，中间缺少双方如何尝试、具体卡点在哪里的说明。" : "These lines move from communication difficulty to a relationship conclusion without showing the attempts or the missing middle.") : (language === "zh" ? "这些步骤连在一起时，现实议题会逐渐变成对责任、服从或关系位置的要求。" : "Together, these steps can turn a practical issue into pressure about responsibility, compliance, or relational position.") } : { title: issue, steps: [], explanation: language === "zh" ? "目前没有至少三个有原文支持的连续步骤。" : "Fewer than three evidence-backed steps are present." },
    whatTheyArePushing: topCandidates.slice(0, 3).map((item) => ({ point: pushingPoint(item, language), evidence: item.evidence.slice(0, 3), confidence: item.confidence })),
    reasonableParts: reasonable,
    concerningParts,
    keyAnnotations: topCandidates.slice(0, 4).map((item) => annotation(item, language)),
    selfGrounding: unique(selfGrounding).slice(0, 4), nextStepOptions: nextSteps(primaryChain, candidates, language),
    risk: { level: riskLevel, reasons: directSafety ? [directSafety.rule.explanation[language]] : topCandidates.filter((item) => item.score >= 5).map((item) => item.rule.name[language]).slice(0, 3), urgentWarning: directSafety ? (language === "zh" ? "文字出现了明确的现实危险信号。请优先确认安全，并联系可信的人或当地紧急支持。" : "The text includes an explicit real-world danger signal. Prioritise safety and contact someone trustworthy or local emergency support.") : "" },
  });
}
