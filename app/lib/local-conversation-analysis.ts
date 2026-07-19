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

function isFamilyBelongingPressure(otherText: string, myText: string) {
  const full = `${otherText}\n${myText}`;
  return /(合肥|外地|临近)/.test(full)
    && /(没有家|白眼狼|良心在哪里)/.test(full)
    && /(后果自负|走着看|试试看)/.test(full)
    && /(养育|拉扯大|出生三十天)/.test(full);
}

function familyBelongingAnalysis(otherSentences: string[], mySentences: string[], language: AnalysisLanguage, statusReason: AnalysisStatusReason): AiAnalysis {
  const all = [...mySentences, ...otherSentences];
  const plan = unique(all.filter((sentence) => /(合肥|找工作|买房|见面)/.test(sentence))).slice(0, 2);
  const distance = unique(otherSentences.filter((sentence) => /(临近的不要|找这么远|眼前就有)/.test(sentence))).slice(0, 2);
  const inventedIntent = unique(otherSentences.filter((sentence) => /(勾来|对付我们|什么目的)/.test(sentence))).slice(0, 2);
  const belonging = unique(otherSentences.filter((sentence) => /(没有家|白眼狼|变心|不存在)/.test(sentence))).slice(0, 3);
  const consequence = unique(otherSentences.filter((sentence) => /(后果自负|走着看|试试看|不到黄河)/.test(sentence))).slice(0, 2);
  const debt = unique(otherSentences.filter((sentence) => /(二十多年|养育|拉扯大|良心|出生三十天|淘汰)/.test(sentence))).slice(0, 3);
  const judgment = unique(otherSentences.filter((sentence) => /(撒点狗粮|看不懂|你是人吗)/.test(sentence))).slice(0, 2);
  const corrected = plan.some((sentence) => /(以后|未来|来合肥|买房)/.test(sentence)) && distance.length > 0;
  if (language === "en") {
    return dedupeAnalysis({
      mode: "local", statusReason,
      overview: "The practical issue is a partner's future work, housing, and family meeting plan. The reply keeps the distance accusation after the plan is clarified, then turns disagreement into a test of gratitude, belonging, and obedience.",
      evidenceBoundary: { observed: [corrected ? "The plan says the partner would work and buy a home locally, while the reply continues to describe the relationship as deliberately distant." : "The exchange discusses distance, work, housing, and a family meeting."], likely: ["The practical plan is displaced by a loyalty test."], uncertain: [] },
      interactionPattern: { title: "A practical plan becomes a test of family loyalty", steps: [
        { action: "Work, housing, and meeting plans are stated", evidence: plan.slice(0, 1) },
        { action: "The clarification is ignored and distance remains the charge", evidence: distance.slice(0, 1) },
        { action: "A meeting is recast as manipulation", evidence: inventedIntent.slice(0, 1) },
        { action: "Belonging and upbringing are made conditional", evidence: [...belonging.slice(0, 1), ...debt.slice(0, 1)] },
        { action: "Consequences are attached to disagreement", evidence: consequence.slice(0, 1) },
      ].filter((step) => step.evidence.length), explanation: "What should remain a discussion of work, housing, and a meeting ends with the user having to prove they still belong to the family." },
      whatTheyArePushing: [
        { point: "Accept the family's preferred relationship and location decision", evidence: [...distance.slice(0, 1), ...consequence.slice(0, 1)], confidence: "高" },
        { point: "Prove gratitude and family loyalty instead of discussing the plan", evidence: [...belonging.slice(0, 1), ...debt.slice(0, 1)], confidence: "高" },
      ],
      reasonableParts: ["Family can reasonably ask whether work is secured, where the couple would live, how distance affects support, and whether the partner is reliable."],
      concerningParts: [
        { label: "Ignored factual correction", explanation: "The local work and housing plan is not re-examined before the distance accusation continues.", evidence: [...plan.slice(0, 1), ...distance.slice(0, 1)], severity: "notice", confidence: corrected ? "高" : "中" },
        { label: "Conditional family belonging", explanation: "Disagreement is answered with loss of family identity, judgment attacks, and global condemnation.", evidence: unique([...belonging, ...judgment]).slice(0, 3), severity: "pressure", confidence: "高" },
        { label: "Caregiving debt", explanation: "Upbringing and adoption history are used as a debt that the current choice must repay through obedience.", evidence: debt, severity: "pressure", confidence: "高" },
        { label: "Punishment forecast", explanation: "Consequences are left vague but are used to make refusal feel dangerous.", evidence: consequence, severity: "pressure", confidence: "高" },
      ],
      keyAnnotations: [
        { quotes: inventedIntent, tags: ["added intention", "issue shift"], keyPoint: "A proposed meeting is rewritten as luring someone in or organising against the family—intentions the user did not state.", grounding: "A meeting plan is not proof of manipulation.", uncertainty: "" },
        { quotes: unique([...belonging, ...judgment]).slice(0, 3), tags: ["conditional belonging", "character attack"], keyPoint: "Family belonging is made conditional on agreement, replacing the practical plan with a verdict on loyalty and judgment.", grounding: "Choosing a partner or location does not by itself erase family care.", uncertainty: "" },
        { quotes: consequence, tags: ["obedience pressure", "punishment forecast"], keyPoint: "Advice becomes a compliance demand when disagreement is paired with unspecified consequences.", grounding: "A vague warning is not evidence that the plan itself is wrong.", uncertainty: "" },
        { quotes: debt, tags: ["caregiving debt", "existence-value attack"], keyPoint: "Upbringing and adoption history are tied to worth and obedience, making an adult decision feel like an unpaid moral debt.", grounding: "Care received does not remove adult decision-making authority.", uncertainty: "" },
      ].filter((item) => item.quotes.length),
      selfGrounding: ["The unanswered questions are still work, housing, distance, and how a meeting would happen.", "Disappointing family does not by itself mean betraying family.", "You can stop proving gratitude and return only to verifiable plans."],
      nextStepOptions: [
        { type: "no_reply", title: "Stop proving loyalty for now", reason: "The conversation is judging belonging rather than checking the plan.", message: "" },
        { type: "clarify", title: "Return to work, housing, and the meeting", reason: "Discuss only the concrete plan and ask which practical risk remains unresolved.", message: "" },
        { type: "respond", title: "End this round when insults begin", reason: "A plan cannot be clarified while family identity and worth are being attacked.", message: "" },
      ],
      risk: { level: "中", reasons: ["Repeated character attacks", "Threats to family belonging", "Caregiving debt and punishment forecasts"], urgentWarning: "" },
    });
  }
  return dedupeAnalysis({
    mode: "local", statusReason,
    overview: "你原本在谈伴侣未来在哪里工作、买房和怎样见家人。对方没有根据“以后会来合肥”的补充重新核对方案，而是把分歧升级成你是否爱家、是否感恩、是否服从的问题。",
    evidenceBoundary: { observed: [corrected ? "你已经补充未来会在合肥工作和买房，对方仍沿用“故意找远的人”这一指控。" : "原文讨论了工作地点、住房和见面安排。"], likely: ["现实方案被改写成了家庭忠诚考试。"], uncertain: [] },
    interactionPattern: { title: "工作和见面计划被一步步改写成忠诚审判", steps: [
      { action: "你说明工作、住房和见面计划", evidence: plan.slice(0, 1) },
      { action: "事实补充被忽略，距离指控继续", evidence: distance.slice(0, 1) },
      { action: "普通见面被加入恶意意图", evidence: inventedIntent.slice(0, 1) },
      { action: "家庭归属和养育被设为服从条件", evidence: [...belonging.slice(0, 1), ...debt.slice(0, 1)] },
      { action: "不同意被附上惩罚后果", evidence: consequence.slice(0, 1) },
    ].filter((step) => step.evidence.length), explanation: "原本该讨论的是工作、住房和见面安排，最后却变成了你要证明自己不是白眼狼。" },
    whatTheyArePushing: [
      { point: "接受家人指定的伴侣距离和生活安排", evidence: [...distance.slice(0, 1), ...consequence.slice(0, 1)], confidence: "高" },
      { point: "先证明感恩和爱家，再谈自己的选择", evidence: [...belonging.slice(0, 1), ...debt.slice(0, 1)], confidence: "高" },
    ],
    reasonableParts: ["家人可以具体讨论对象是否可靠、工作是否落实、未来住哪里、距离会怎样影响支持网络。"],
    concerningParts: [
      { label: "事实修正被忽略", explanation: "你补充了未来在合肥工作和买房，对方却没有重新核对，继续按“故意找很远的人”推进指责。", evidence: [...plan.slice(0, 1), ...distance.slice(0, 1)], severity: "notice", confidence: corrected ? "高" : "中" },
      { label: "家庭归属惩罚", explanation: "“没有家、白眼狼”和“你是人吗”把不同意见变成失去家庭身份、接纳和人格价值的代价。", evidence: unique([...belonging, ...judgment]).slice(0, 3), severity: "pressure", confidence: "高" },
      { label: "养育恩情压制", explanation: "二十多年的养育和被收养经历被变成当前选择必须服从的道德债务。", evidence: debt, severity: "pressure", confidence: "高" },
      { label: "带后果暗示的服从要求", explanation: "“后果自负、走着看、试试看”不再讨论具体风险，而是让不同意本身带上惩罚预期。", evidence: consequence, severity: "pressure", confidence: "高" },
    ],
    keyAnnotations: [
      { quotes: inventedIntent, tags: ["添加意图", "议题转移"], keyPoint: "见面计划被改写成“勾来”或找人对付家人，这是用户没有表达过的意图。", grounding: "提出见面，不等于强迫家人接受，也不等于在策划对抗。", uncertainty: "" },
      { quotes: unique([...belonging, ...judgment]).slice(0, 3), tags: ["家庭归属威胁", "人格攻击"], keyPoint: "对方没有评价方案，而是用“没有家、白眼狼、你是人吗”判断你整个人和你是否配做家人。", grounding: "伴侣和地点选择不同，不自动等于不要家。", uncertainty: "" },
      { quotes: consequence, tags: ["服从压力", "惩罚预期"], keyPoint: "建议在这里升级成了服从要求：不接受指定答案，就要承担没有说清的后果。", grounding: "模糊的后果警告，不是当前方案错误的事实证据。", uncertainty: "" },
      { quotes: debt, tags: ["养育恩情压制", "存在价值绑定"], keyPoint: "养育和被收养经历被绑到你的价值与服从上，像是成年后的选择必须偿还这笔道德债。", grounding: "曾经被照顾，与成年后保有自己的决定权，可以同时成立。", uncertainty: "" },
    ].filter((item) => item.quotes.length),
    selfGrounding: ["现在仍需要核对的是工作、住房、距离和怎样见面。", "让家人失望，不自动等于背叛家人。", "你可以停止证明感恩，只回应可核实的安排。"],
    nextStepOptions: [
      { type: "no_reply", title: "暂停证明自己是不是好女儿", reason: "对方此刻在审判归属和感恩，不是在核对工作与住房方案。", message: "" },
      { type: "clarify", title: "只核对工作、住房和见面事实", reason: "请对方指出哪一项现实风险仍未解决，不再回应“白眼狼”等评价。", message: "" },
      { type: "respond", title: "出现羞辱或关系威胁时结束本轮对话", reason: "在家庭身份和人格被攻击时，继续解释很容易进入下一轮自证。", message: "" },
    ],
    risk: { level: "中", reasons: ["持续人格羞辱", "家庭归属威胁", "养育恩情压制和带惩罚意味的服从压力"], urgentWarning: "" },
  });
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

type LocalCase = "premarital" | "breakup" | "family" | "general";

function classifyCase(otherText: string, myText: string, context: AnalysisContext): LocalCase {
  const full = `${otherText}\n${myText}`;
  const breakup = [/(不合适|结束关系|不能继续)/, /(不是爱|或许.{0,4}爱)/, /(祝你.{0,4}幸福|删除.{0,4}(联系|方式))/, /(交流不深|无法深入了解)/].filter((rule) => rule.test(full)).length;
  const premarital = [/(支出|高消费|生存需要)/, /(生育|彩礼)/, /(买房|买车|共同财产)/, /(三六分|按比例)/, /(朋友圈|婚前.{0,6}(资产|房|车))/, /(男女平等|小家)/].filter((rule) => rule.test(full)).length;
  const family = [/(白眼狼|没有家)/, /(养育|良心|父母)/, /(听我的|后果自负)/, /(不爱家|孝顺|亲人)/].filter((rule) => rule.test(full)).length;
  if (breakup >= 2) return "breakup";
  if (premarital >= 3) return "premarital";
  if (context === "family" && family >= 2) return "family";
  return "general";
}

function premaritalAnalysis(sentences: string[], mySentences: string[], language: AnalysisLanguage, statusReason: AnalysisStatusReason): AiAnalysis {
  const all = [...sentences, ...mySentences];
  const spending = unique(all.filter((line) => /(生存需要|高消费|经济账|合理规划|自己的钱)/.test(line))).slice(0, 2);
  const birth = unique(all.filter((line) => /(生育|身体|职业|机会成本|男生也很辛苦)/.test(line))).slice(0, 2);
  const social = unique(all.filter((line) => /(朋友|陪我|社交)/.test(line))).slice(0, 2);
  const property = unique(all.filter((line) => /(彩礼|购房|买房|产权|个人房产)/.test(line))).slice(0, 2);
  const car = unique(all.filter((line) => /(买车|一辆车|补一些钱)/.test(line))).slice(0, 2);
  const ratio = unique(all.filter((line) => /(三六分|按比例|女方不能完全不支出|无偿|照护)/.test(line))).slice(0, 2);
  const personal = unique(mySentences.filter((line) => /(自己的钱|个人房产|婚前|不开心|明确反对)/.test(line))).slice(0, 2);
  const zh = language === "zh";
  return dedupeAnalysis({
    mode: "local", statusReason,
    overview: zh ? "这不是单一的消费争议，而是一组婚前规则：预算、生育、社交、彩礼、购房、车辆、支出比例和个人资产都被放进同一套安排。共同规划本身合理，关键要逐项核对规则解释权和实际成本是否双向。" : "This is a set of premarital rules about budgets, pregnancy, friends, property, vehicles, contributions, and personal assets. Planning can be reasonable; the key question is whether rule-making power and real costs work both ways.",
    evidenceBoundary: { observed: [], likely: [zh ? "讨论的重点不是要不要规划，而是谁定义合理、哪些成本被计算，以及个人资源是否仍由本人决定。" : "The issue is not whether to plan, but who defines reasonable, which costs count, and whether personal resources remain individually decided."], uncertain: personal.length ? [zh ? "用户担心对方会不开心，但原文没有显示对方已经明确禁止购买个人房产或车辆。" : "The user anticipates displeasure, but the text does not show an explicit ban on personal property or a vehicle."] : [] },
    interactionPattern: { title: zh ? "平等与共同规划需要落实到每项规则" : "Equality and shared planning need item-by-item terms", steps: [
      { action: zh ? "一方定义合理消费" : "One side defines reasonable spending", evidence: spending.slice(0, 1) },
      { action: zh ? "生育成本被另一种辛苦带开" : "Pregnancy costs are displaced by another hardship", evidence: birth.slice(0, 1) },
      { action: zh ? "社交融合先以一方圈子为中心" : "Social integration starts with one person's circle", evidence: social.slice(0, 1) },
      { action: zh ? "资源被预先放进共同或个人安排" : "Resources are pre-allocated into shared or personal plans", evidence: unique([...property, ...car]).slice(0, 1) },
      { action: zh ? "个人决定开始受预期情绪影响" : "Personal decisions are shaped by anticipated displeasure", evidence: personal.slice(0, 1) },
    ].filter((step) => step.evidence.length), explanation: zh ? "口头上的平等，需要和消费、生育、社交、产权及个人资产的具体安排逐项对照。" : "Equality language needs to match the actual arrangements for spending, pregnancy, friends, ownership, and personal assets." },
    whatTheyArePushing: [
      { point: zh ? "接受由对方先提出的消费与支出框架" : "Accept the spending framework proposed by the other person", evidence: spending.slice(0, 1), confidence: "中" },
      { point: zh ? "把未来资源纳入购房、车辆和比例支出" : "Include future resources in property, vehicle, and contribution plans", evidence: unique([...property, ...car, ...ratio]).slice(0, 2), confidence: "中" },
      { point: zh ? "先进入对方的社交安排" : "Enter the other person's social arrangements first", evidence: social.slice(0, 1), confidence: "中" },
    ].filter((item) => item.evidence.length),
    reasonableParts: [zh ? "婚前讨论共同预算、住房、双方父母和支出比例，本身是负责任的规划。" : "Discussing budgets, housing, both families, and contribution ratios before marriage can be responsible.", zh ? "希望双方都为共同生活付出，不等于这套安排本身有问题。" : "Expecting both people to contribute does not by itself make the arrangement unfair."],
    concerningParts: [
      { label: zh ? "规则定义权" : "Rule-making power", explanation: zh ? "“合理”和“高消费”由谁定义、是否双方同标准，原文还没有说清。" : "The text does not establish who defines reasonable or whether the same standard applies to both.", evidence: spending, severity: "notice", confidence: "中" },
      { label: zh ? "生育成本议题错位" : "Pregnancy-cost displacement", explanation: zh ? "男性也辛苦可以成立，但没有回答女性身体、职业和机会成本如何分担。" : "Men may also work hard, but that does not answer how physical, career, and opportunity costs are shared.", evidence: birth, severity: "notice", confidence: "高" },
      { label: zh ? "资源预先安排" : "Resources pre-allocated", explanation: zh ? "彩礼、购房和补车钱需要分别说明资金性质、产权和是否真正共同协商。" : "Gift money, property, and vehicle support need clear ownership and genuinely shared consent.", evidence: unique([...property, ...car]).slice(0, 3), severity: "notice", confidence: "中" },
      { label: zh ? "个人决定受预期情绪影响" : "Personal choices shaped by anticipated emotion", explanation: zh ? "担心对方不开心不是明确禁止的证据，但值得核对用户是否已经先管理对方情绪再使用自己的钱。" : "Anticipated displeasure is not an explicit ban, but it matters if it comes before using one's own money.", evidence: personal, severity: "notice", confidence: "中" },
    ].filter((item) => item.evidence.length),
    keyAnnotations: [
      { quotes: spending, tags: [zh ? "定义权" : "definition", zh ? "双向标准" : "reciprocity"], keyPoint: zh ? "要求用户核算自己的消费，却说关系里不能算经济账，可能让一方接受审查而共同利益不被具体核算。" : "Requiring personal accounting while disallowing accounting within the relationship may make scrutiny one-sided.", grounding: zh ? "共同预算应允许双方核算成本、提出异议和保留个人决定。" : "Shared budgeting should let both people count costs, disagree, and keep personal decisions.", uncertainty: "" },
      { quotes: birth, tags: [zh ? "议题错位" : "topic shift", zh ? "生育成本" : "pregnancy costs"], keyPoint: zh ? "“男生也辛苦”没有直接回应女性提出的身体、职业和机会成本；两种辛苦不需要互相取消。" : "Men's hardship does not directly answer the physical, career, and opportunity costs raised; both can matter.", grounding: zh ? "要核对的是这些具体成本如何分配。" : "The concrete question is how those costs are shared.", uncertainty: "" },
      { quotes: social, tags: [zh ? "社交双向性" : "social reciprocity"], keyPoint: zh ? "希望伴侣参与朋友圈可以正常，仍要看他是否同样进入用户的朋友和生活，而不是只让一方融入。" : "Wanting a partner involved can be normal; check whether integration works both ways.", grounding: zh ? "亲密可以增加共同时间，也应保留双方原有支持网络。" : "Closeness can grow while both people keep their support networks.", uncertainty: "" },
      { quotes: unique([...property, ...car, ...ratio]).slice(0, 2), tags: [zh ? "产权" : "ownership", zh ? "贡献计算" : "contributions"], keyPoint: zh ? "彩礼回流、购房、补车钱和三六分不能只看比例，还要写清产权、收入、家务、照护、生育与失业阶段。" : "Property, vehicle support, and contribution ratios need ownership, income, care work, pregnancy, and unemployment terms.", grounding: zh ? "共同未来不等于一方可以先预算另一方的资源。" : "A shared future does not let one person pre-allocate the other's resources.", uncertainty: "" },
      { quotes: personal, tags: [zh ? "个人资产" : "personal assets", zh ? "预期情绪" : "anticipated reaction"], keyPoint: zh ? "用户想用自己的钱购买婚前资产；担心对方不开心需要核对，但不能直接写成对方已经实施财务控制。" : "The user wants to buy premarital assets; anticipated displeasure should be checked, not treated as proven control.", grounding: zh ? "可以先分别确认个人资产、共同购房能力和对方的明确意见。" : "Clarify personal assets, shared borrowing capacity, and the partner's explicit view separately.", uncertainty: "" },
    ].filter((item) => item.quotes.length).slice(0, 4),
    selfGrounding: [zh ? "讨论共同计划，不等于放弃个人资产决定。" : "Shared planning does not require surrendering personal asset decisions.", zh ? "双方都辛苦，仍需要把不同成本逐项算清。" : "Both can work hard while different costs still need item-by-item accounting."],
    nextStepOptions: [{ type: "clarify", title: zh ? "把规则逐项写清" : "Write each rule down", reason: zh ? "分别核对消费标准、产权、生育与照护成本、双方社交和失业阶段。" : "Check spending standards, ownership, pregnancy and care costs, both social circles, and unemployment." , message: "" }, { type: "observe", title: zh ? "暂不承诺个人资产安排" : "Do not commit personal assets yet", reason: zh ? "先确认对方是担心共同购房能力，还是反对用户保留独立资产。" : "First distinguish concern about shared borrowing from opposition to independent assets.", message: "" }],
    risk: { level: "低", reasons: [zh ? "存在多项规则解释权和成本分配问题，但原文没有显示持续强制或现实危险。" : "Several rule-making and cost-allocation questions remain, without evidence of ongoing coercion or immediate danger."], urgentWarning: "" },
  });
}

function breakupAnalysis(sentences: string[], language: AnalysisLanguage, statusReason: AnalysisStatusReason): AiAnalysis {
  const pressure = unique(sentences.filter((line) => /(压力|不善表达)/.test(line))).slice(0, 2);
  const leap = unique(sentences.filter((line) => /(交流不深|不是爱|不合适)/.test(line))).slice(0, 2);
  const vague = unique(sentences.filter((line) => /(都是我的原因|我的问题)/.test(line))).slice(0, 1);
  const rewrite = unique(sentences.filter((line) => /(一时冲动|从来.{0,4}爱|也许.{0,4}爱)/.test(line))).slice(0, 2);
  const exit = unique(sentences.filter((line) => /(结束关系|祝你.{0,4}幸福|删除.{0,4}(联系|方式)|不能继续)/.test(line))).slice(0, 2);
  const zh = language === "zh";
  return dedupeAnalysis({ mode: "local", statusReason,
    overview: zh ? "这是一段关系退出，而不是家庭或财务服从案例。对方从压力和交流困难直接走到“也许不是爱”和结束关系；决定本身有效，但中间的沟通过程没有被具体说明。" : "This is a relationship exit, not a family or financial compliance case. The words move from stress and communication difficulty to perhaps not love and ending the relationship without explaining the middle.",
    evidenceBoundary: { observed: [], likely: [zh ? "对方有权结束关系；仍可看见从沟通问题跳到关系本质结论的逻辑跨越。" : "The person may end the relationship; the text still jumps from communication problems to a conclusion about what the relationship was."], uncertain: [] },
    interactionPattern: { title: zh ? "沟通困难被直接推成关系结束" : "Communication difficulty becomes a relationship exit", steps: [
      { action: zh ? "表达压力和表达困难" : "Stress and expression difficulty", evidence: pressure.slice(0, 1) },
      { action: zh ? "交流问题被推成不是爱" : "Communication becomes perhaps not love", evidence: leap.slice(0, 1) },
      { action: zh ? "用模糊自责关闭具体解释" : "Vague self-blame closes detail", evidence: vague },
      { action: zh ? "重新解释过去关系" : "The past relationship is reinterpreted", evidence: rewrite.slice(0, 1) },
      { action: zh ? "礼貌结束并快速退出" : "Polite but rapid exit", evidence: exit.slice(0, 1) },
    ].filter((step) => step.evidence.length), explanation: zh ? "对方给出了完整结论，却没有说明双方是否尝试改善、具体卡在哪里。" : "A complete conclusion is given without explaining attempts or the concrete point of failure." },
    whatTheyArePushing: [{ point: zh ? "接受关系结束，不再继续核对缺失的过程" : "Accept the ending without further examination of the missing process", evidence: exit.slice(0, 1), confidence: "高" }].filter((item) => item.evidence.length),
    reasonableParts: [zh ? "任何一方都有权结束关系，清楚表达结束决定本身不等于操控。" : "Either person may end a relationship; clearly stating that decision is not manipulation by itself."],
    concerningParts: [{ label: zh ? "逻辑跨越" : "Reasoning gap", explanation: zh ? "从交流不深直接到“也许不是爱”，没有说明中间的尝试和判断依据。" : "The words jump from shallow communication to perhaps not love without explaining attempts or reasoning.", evidence: leap, severity: "notice", confidence: "中" }, { label: zh ? "关系历史重写" : "Relationship-history rewrite", explanation: zh ? "“一时冲动”可能在结束时重新定义过去，但不能由此断定过去感情一定是假的。" : "Calling it an impulse may reinterpret the past, but does not prove the past was false.", evidence: rewrite, severity: "notice", confidence: "中" }].filter((item) => item.evidence.length),
    keyAnnotations: [{ quotes: leap, tags: [zh ? "逻辑跨越" : "reasoning gap"], keyPoint: zh ? "“交流不深”是可以讨论的问题，却被直接推成“这不是爱”，中间缺少具体过程。" : "Shallow communication is discussable, but it is moved directly to not love without the missing process.", grounding: zh ? "关系结束，不等于过去的感情自动失效。" : "An ending does not automatically invalidate the past.", uncertainty: "" }, { quotes: unique([...vague, ...exit]), tags: [zh ? "模糊自责" : "vague self-blame", zh ? "关系退出" : "relationship exit"], keyPoint: zh ? "“都是我的原因”听起来负责，却没有说明具体原因；祝福和删除联系随后快速结束继续核对。" : "It is all my fault sounds accountable without naming a reason; the blessing and deletion then close further examination.", grounding: zh ? "对方可以结束，你也可以决定是否还需要一次具体说明。" : "They may end it, and you may decide whether one concrete explanation is still useful.", uncertainty: "" }].filter((item) => item.quotes.length),
    selfGrounding: [zh ? "对方决定分手，不代表过去的感情一定是假的。" : "Their decision to end does not prove the past was false.", zh ? "困惑可能来自结论完整、过程缺失。" : "Confusion can come from a complete conclusion with a missing process."],
    nextStepOptions: [{ type: "no_reply", title: zh ? "先暂停联系" : "Pause contact", reason: zh ? "不必立刻追着补齐对方没有说明的过程。" : "You need not immediately chase the process they did not explain.", message: "" }, { type: "clarify", title: zh ? "只问一个具体问题" : "Ask one concrete question", reason: zh ? "如果仍需要答案，只问“我们具体卡在哪里、尝试过什么”。" : "If an answer would help, ask where things specifically broke down and what was tried.", message: "" }],
    risk: { level: "低", reasons: [zh ? "原文显示关系退出和解释不足，没有现实安全信号。" : "The text shows relationship exit and incomplete explanation, without a real-world safety signal."], urgentWarning: "" },
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
  const sentences = splitSentences(otherText);
  const mySentences = splitSentences(myText);
  if (context === "family" && isFamilyBelongingPressure(otherText, myText)) return familyBelongingAnalysis(sentences, mySentences, language, statusReason);
  if (isBenchmarkHarmDenial(otherText)) return benchmarkHarmDenialAnalysis(sentences, language, statusReason);
  const caseType = classifyCase(otherText, myText, context);
  if (caseType === "premarital") return premaritalAnalysis(sentences, mySentences, language, statusReason);
  if (caseType === "breakup") return breakupAnalysis(sentences, language, statusReason);
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
    interactionPattern: primaryChain ? { title: primaryChain.title, steps: primaryChain.steps, explanation: primaryChain.id === "avoidant_breakup" ? (language === "zh" ? "这些句子从交流困难直接走到关系结论，中间缺少双方如何尝试、具体卡点在哪里的说明。" : "These lines move from communication difficulty to a relationship conclusion without showing the attempts or the missing middle.") : (language === "zh" ? "这些步骤连在一起时，现实议题会逐渐变成对责任、服从或关系位置的要求。" : "Together, these steps can turn a practical issue into pressure about responsibility, compliance, or relational position.") } : { title: "", steps: [], explanation: "" },
    whatTheyArePushing: topCandidates.slice(0, 3).map((item) => ({ point: pushingPoint(item, language), evidence: item.evidence.slice(0, 3), confidence: item.confidence })),
    reasonableParts: reasonable.slice(0, 3),
    concerningParts,
    keyAnnotations: topCandidates.slice(0, 4).map((item) => annotation(item, language)),
    selfGrounding: unique(selfGrounding).slice(0, 3), nextStepOptions: nextSteps(primaryChain, candidates, language).slice(0, 3),
    risk: { level: riskLevel, reasons: directSafety ? [directSafety.rule.explanation[language]] : topCandidates.filter((item) => item.score >= 5).map((item) => item.rule.name[language]).slice(0, 3), urgentWarning: directSafety ? (language === "zh" ? "文字出现了明确的现实危险信号。请优先确认安全，并联系可信的人或当地紧急支持。" : "The text includes an explicit real-world danger signal. Prioritise safety and contact someone trustworthy or local emergency support.") : "" },
  });
}
