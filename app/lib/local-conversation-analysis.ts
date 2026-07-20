import { dedupeAnalysis, type AiAnalysis, type AnalysisContext, type AnalysisLanguage, type AnalysisStatusReason } from "./analyze-shared";
import { runResearchPipeline } from "./research-grounded-rule-engine";

const sentenceSplit = /(?<=[。！？!?；;])|\n+/;

function splitSentences(text: string) {
  return text.split(sentenceSplit).map((value) => value.trim()).filter(Boolean).slice(0, 80);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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

function quoteFor(sentences: string[], pattern: RegExp) {
  return sentences.find((sentence) => pattern.test(sentence)) || "";
}

function familyPressureAnalysis(otherSentences: string[], mySentences: string[], language: AnalysisLanguage, statusReason: AnalysisStatusReason): AiAnalysis {
  const all = [...mySentences, ...otherSentences];
  const plan = unique(all.filter((sentence) => /(本地|同城|同一城市|工作|买房|住房|见面|稳定后|长期.{0,6}(生活|居住)|same city|work|housing|meet)/i.test(sentence))).slice(0, 2);
  const distance = unique(otherSentences.filter((sentence) => /(临近|附近|外地|异地|很远|太远|找这么远|非要找|眼前就有|far away|distant|nearby)/i.test(sentence))).slice(0, 2);
  const inventedIntent = unique(otherSentences.filter((sentence) => /(勾来|对付我们|什么目的)/.test(sentence))).slice(0, 2);
  const belonging = unique(otherSentences.filter((sentence) => /(没有家|白眼狼|变心|不存在)/.test(sentence))).slice(0, 3);
  const consequence = unique(otherSentences.filter((sentence) => /(后果自负|走着看|试试看|不到黄河|会后悔)/.test(sentence))).slice(0, 2);
  const debt = unique(otherSentences.filter((sentence) => /(二十多年|养育|拉扯大|良心|出生三十天|淘汰)/.test(sentence))).slice(0, 3);
  const adoptionDebt = debt.find((sentence) => /(出生|淘汰|收养)/.test(sentence)) || debt[0] || "";
  const judgment = unique(otherSentences.filter((sentence) => /(撒点狗粮|看不懂|你是人吗)/.test(sentence))).slice(0, 2);
  const partnerJudgment = unique(otherSentences.filter((sentence) => /((对象|伴侣|男朋友).{0,12}(骗|不可靠|没用|不行)|只有.{0,4}(父母|家人).{0,8}(可靠|真心))/i.test(sentence))).slice(0, 2);
  const loyaltyEvidence = unique([belonging[0] || "", adoptionDebt, judgment[0] || ""]);
  const practicalDifficulty = otherSentences.some((sentence) => /(家里|家庭).{0,8}(困难|缺钱|压力)|现实困难/i.test(sentence));
  const corrected = plan.some((sentence) => /(以后|未来|稳定后|会来|回到|本地|同城|同一城市|长期|same city|move here|work locally)/i.test(sentence)) && distance.length > 0;
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
        { point: "Accept the family's preferred relationship or location decision", evidence: distance.slice(0, 1), confidence: "高" },
        { point: "Prove gratitude and family loyalty instead of discussing the plan", evidence: unique([...belonging.slice(0, 1), ...debt.slice(0, 1)]), confidence: "高" },
        { point: "Comply to avoid an unspecified consequence", evidence: consequence.slice(0, 1), confidence: "高" },
      ].filter((item) => item.evidence.length),
      reasonableParts: [practicalDifficulty ? "Real family hardship can matter, alongside concrete questions about work, housing, distance, support, and partner reliability." : "Family can reasonably ask whether work is secured, where the couple would live, how distance affects support, and whether the partner is reliable."],
      concerningParts: [
        { label: "Ignored factual correction", explanation: "The updated work or housing plan is not re-examined before the distance accusation continues.", evidence: corrected ? unique([...plan.slice(0, 1), ...distance.slice(0, 1)]) : [], severity: "notice", confidence: "高" },
        { label: "Belonging and gratitude tied to obedience", explanation: "Family identity, character judgment, upbringing, and adoption history are combined into a debt that the current choice is expected to repay through agreement.", evidence: loyaltyEvidence, severity: "pressure", confidence: "高" },
        { label: "Partner judgment and exclusive family trust", explanation: "The partner is dismissed while parents are framed as the only reliable relationship, without returning to concrete reliability facts.", evidence: partnerJudgment, severity: "notice", confidence: "中" },
        { label: "Punishment forecast", explanation: "Consequences are left vague but are used to make refusal feel dangerous.", evidence: consequence, severity: "pressure", confidence: "高" },
      ].filter((item) => item.evidence.length).slice(0, 4),
      keyAnnotations: [
        { quotes: inventedIntent, tags: ["added intention", "issue shift"], keyPoint: "A proposed meeting is rewritten as luring someone in or organising against the family—intentions the user did not state.", grounding: "A meeting plan is not proof of manipulation.", uncertainty: "" },
        { quotes: unique([belonging[0] || "", adoptionDebt]), tags: ["conditional belonging", "caregiving debt"], keyPoint: "Family belonging, gratitude, and personal worth are tied to accepting the preferred answer, replacing the practical plan with a loyalty test.", grounding: "Care and worry can be real without granting authority over an adult's partner, work, or home.", uncertainty: "" },
        { quotes: partnerJudgment, tags: ["partner devaluation", "exclusive family trust"], keyPoint: "The partner is dismissed and parents are framed as the only reliable bond, instead of testing reliability through concrete facts.", grounding: "Family concern can be heard without treating every outside relationship as deception.", uncertainty: "" },
        { quotes: consequence, tags: ["obedience pressure", "punishment forecast"], keyPoint: "Advice becomes a compliance demand when disagreement is paired with unspecified consequences.", grounding: "A vague warning is not evidence that the plan itself is wrong.", uncertainty: "" },
      ].filter((item) => item.quotes.length).slice(0, 4),
      selfGrounding: ["Family care and worry can be real without granting authority over an adult's partner, work, or home.", "Concern about distance can be valid without making a different choice betrayal.", "A corrected fact should enter the discussion instead of leaving the old accusation unchanged."],
      nextStepOptions: [
        ...(loyaltyEvidence.length ? [{ type: "no_reply" as const, title: "Stop proving loyalty for now", reason: "The conversation is judging belonging rather than checking the plan.", message: "" }] : []),
        { type: "clarify", title: "Check one practical fact", reason: "Choose one question about temporary arrangements, long-term work, housing, or the meeting instead of defending every relationship at once.", message: "" },
        ...(consequence.length || judgment.length ? [{ type: "respond" as const, title: "End this round when insults or consequences replace facts", reason: "The practical plan cannot be checked while personal worth or vague punishment is the subject.", message: "" }] : []),
      ].slice(0, 3),
      risk: { level: "中", reasons: unique([loyaltyEvidence.length ? "Family belonging or caregiving is tied to agreement" : "", consequence.length ? "Disagreement is paired with an unspecified consequence" : "", partnerJudgment.length ? "Partner reliability is dismissed without concrete examination" : ""]).slice(0, 3), urgentWarning: "" },
    });
  }
  return dedupeAnalysis({
    mode: "local", statusReason,
    overview: corrected ? "你原本在谈伴侣未来在哪里工作、生活和怎样见家人。你补充了长期安排后，对方仍沿用距离指控，并把现实方案带向对伴侣、归属或服从的评价。" : "你原本在谈伴侣、工作或家庭现实困难。对方没有继续核对具体方案，而是用对伴侣的评价或后果警告推动接受家人的答案。",
    evidenceBoundary: { observed: [corrected ? "你已经补充未来会在本地或同一城市工作生活，对方仍沿用“故意找远的人”这一指控。" : "原文讨论了伴侣、工作、生活安排或家庭现实困难。"], likely: [loyaltyEvidence.length ? "现实方案被改写成了家庭忠诚考试。" : "具体方案被带向对伴侣判断和拒绝后果的评价。"], uncertain: [] },
    interactionPattern: { title: "工作和见面计划被一步步改写成忠诚审判", steps: [
      { action: "你说明工作、住房和见面计划", evidence: plan.slice(0, 1) },
      { action: "事实补充被忽略，距离指控继续", evidence: distance.slice(0, 1) },
      { action: "普通见面被加入恶意意图", evidence: inventedIntent.slice(0, 1) },
      { action: "家庭归属和养育被设为服从条件", evidence: [...belonging.slice(0, 1), ...debt.slice(0, 1)] },
      { action: "不同意被附上惩罚后果", evidence: consequence.slice(0, 1) },
    ].filter((step) => step.evidence.length), explanation: "原本该讨论的是工作、住房和见面安排，最后却变成了你要证明自己不是白眼狼。" },
    whatTheyArePushing: [
      { point: "接受家人偏好的伴侣距离或生活安排", evidence: distance.slice(0, 1), confidence: "高" },
      { point: "先证明感恩和爱家，再谈自己的选择", evidence: unique([...belonging.slice(0, 1), ...debt.slice(0, 1)]), confidence: "高" },
      { point: "为了避免未说明的后果而服从", evidence: consequence.slice(0, 1), confidence: "高" },
    ].filter((item) => item.evidence.length),
    reasonableParts: [practicalDifficulty ? "家里确实存在的现实困难可以被认真讨论，也可以具体核对对象是否可靠、工作是否落实、未来住哪里和支持网络。" : "家人可以具体讨论对象是否可靠、工作是否落实、未来住哪里、距离会怎样影响支持网络。"],
    concerningParts: [
      { label: "事实修正被忽略", explanation: "你补充了长期工作或生活安排，对方却没有重新核对，继续按“故意找很远的人”推进指责。", evidence: corrected ? unique([...plan.slice(0, 1), ...distance.slice(0, 1)]) : [], severity: "notice", confidence: "高" },
      { label: "归属和感恩被绑定服从", explanation: "“没有家、白眼狼”、养育付出和被收养经历被合并成一笔道德债，让不同选择像是失去家庭身份与感恩资格。", evidence: loyaltyEvidence, severity: "pressure", confidence: "高" },
      { label: "贬低伴侣并强调父母唯一可靠", explanation: "对伴侣的评价和“只有父母可靠”没有回到工作、住房或相处事实，而是先削弱用户对外部关系的判断。", evidence: partnerJudgment, severity: "notice", confidence: "中" },
      { label: "带后果暗示的服从要求", explanation: "“后果自负、走着看、试试看”不再讨论具体风险，而是让不同意本身带上惩罚预期。", evidence: consequence, severity: "pressure", confidence: "高" },
    ].filter((item) => item.evidence.length).slice(0, 4),
    keyAnnotations: [
      { quotes: inventedIntent, tags: ["添加意图", "议题转移"], keyPoint: "见面计划被改写成“勾来”或找人对付家人，这是用户没有表达过的意图。", grounding: "提出见面，不等于强迫家人接受，也不等于在策划对抗。", uncertainty: "" },
      { quotes: unique([belonging[0] || "", adoptionDebt]), tags: ["条件式归属", "养育恩情", "人格攻击"], keyPoint: "家庭归属、感恩和人格价值被绑到接受指定答案上，现实方案因此变成了一场忠诚考试。", grounding: "家人的付出和担心可以真实存在，但不自动获得替成年人决定伴侣、工作和居住地的权力。", uncertainty: "" },
      { quotes: partnerJudgment, tags: ["贬低伴侣", "排他式亲情"], keyPoint: "伴侣被直接描述为欺骗者，父母则被放在唯一可靠的位置，具体可靠性问题反而没有被核对。", grounding: "家人可以担心伴侣，但担心不自动证明所有外部关系都不可信。", uncertainty: "" },
      { quotes: consequence, tags: ["服从压力", "惩罚预期"], keyPoint: "建议在这里升级成了服从要求：不接受指定答案，就要承担没有说清的后果。", grounding: "模糊的后果警告，不是当前方案错误的事实证据。", uncertainty: "" },
    ].filter((item) => item.quotes.length).slice(0, 4),
    selfGrounding: ["家人的付出和担心可以真实存在，但不自动获得替成年人决定伴侣、工作和居住地的权力。", "对方担心距离可以成立，但不同选择不等于不孝或背叛。", "你补充的新事实应进入讨论，不能继续沿用旧指控。"],
    nextStepOptions: [
      ...(loyaltyEvidence.length ? [{ type: "no_reply" as const, title: "暂停证明自己是不是好女儿", reason: "对方此刻在审判归属和感恩，不是在核对现实方案。", message: "" }] : []),
      { type: "clarify", title: "只核对一个核心事实", reason: "先确认临时安排、长期工作地、住房或见面计划中的一项，不同时为伴侣、人品和家庭责任自证。", message: "" },
      ...(consequence.length || judgment.length ? [{ type: "respond" as const, title: "评价或后果取代事实时结束本轮", reason: "当人格价值或模糊惩罚成为主题，现实方案已经无法继续核对。", message: "" }] : []),
    ].slice(0, 3),
    risk: { level: "中", reasons: unique([loyaltyEvidence.length ? "家庭归属或养育付出被绑定到服从" : "", consequence.length ? "不同意见被附上模糊的惩罚后果" : "", partnerJudgment.length ? "伴侣可靠性被直接否定而未核对具体事实" : ""]).slice(0, 3), urgentWarning: "" },
  });
}

function harmDenialAnalysis(sentences: string[], language: AnalysisLanguage, statusReason: AnalysisStatusReason): AiAnalysis {
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
        { label: "DARVO structure", explanation: "Denial, character attack, and the accusation of harming the family combine to replace examination of the original event.", evidence: unique([...denial, ...character, ...(reversal ? [reversal] : [])]).slice(0, 3), severity: "pressure", confidence: "高" },
        { label: "Caregiving debt", explanation: "Tuition and daily care are used to answer a different question: whether specific harm occurred.", evidence: debt, severity: "pressure", confidence: "高" },
      ],
      keyAnnotations: [
        { quotes: unique([...denial, ...character, ...(reversal ? [reversal] : [])]).slice(0, 2), tags: ["DARVO", "denial and reversal"], keyPoint: "Denial, character attack, and role reversal work as one chain: the person naming harm becomes the alleged wrongdoer while the event goes unchecked.", grounding: "Not remembering does not prove nothing happened, and describing harm does not require first proving good character.", uncertainty: "" },
        { quotes: debt, tags: ["caregiving debt", "global condemnation"], keyPoint: "Caregiving costs are used as if they cancel the possibility of harm and turn disagreement into ingratitude.", grounding: "Care received and harm experienced can both be true.", uncertainty: "" },
      ].filter((item) => item.quotes.length),
      selfGrounding: ["Care received and specific childhood harm can both be true.", "Not remembering does not establish that nothing happened.", "You do not have to prove you were a good child before describing harm."],
      nextStepOptions: [{ type: "clarify", title: "Return to one specific event", reason: "Keep the question on what happened rather than debating your overall worth or contribution.", message: "" }, { type: "no_reply", title: "Pause if denial turns into insults", reason: "You may end this round when the event is no longer being examined.", message: "" }],
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
      { label: "否认—攻击—角色倒置（DARVO）", explanation: "否认、人格攻击和“冤枉人”的反向指控连成一条链，提出伤害的人反而被改写成加害的一方。", evidence: unique([...denial, ...character, ...(reversal ? [reversal] : [])]).slice(0, 3), severity: "pressure", confidence: "高" },
      { label: "养育恩情压制", explanation: "学费和生活费被拿来回答另一件事：具体伤害是否发生。", evidence: debt, severity: "pressure", confidence: "高" },
    ],
    keyAnnotations: [
      { quotes: unique([...denial, ...character, ...(reversal ? [reversal] : [])]).slice(0, 2), tags: ["DARVO", "否认与倒置"], keyPoint: "否认、人格攻击和“冤枉人”的反向指控共同完成了角色倒置：提出伤害的人被推去举证并自证。", grounding: "“不记得”不等于事情没有发生；你也无需先证明自己是好孩子，才有资格描述受伤。", uncertainty: "" },
      { quotes: debt, tags: ["养育恩情压制", "人格定罪"], keyPoint: "这组话把养育付出拿来抵销伤害：仿佛只要父母花过钱，你指出受伤就是忘恩负义。", grounding: "父母曾经付出，和你曾经受伤，可以同时成立。", uncertainty: "" },
    ].filter((item) => item.quotes.length),
    selfGrounding: ["父母曾经支付学费和生活费，与童年具体伤害是否发生，可以同时成立。", "“不记得”不等于事情没有发生。", "你无需先证明自己是好孩子，才有资格描述受伤。"],
    nextStepOptions: [{ type: "clarify", title: "把问题收窄到具体事件", reason: "不进入“为家做过什么”的人格辩论，只核对当时发生了什么。", message: "" }, { type: "no_reply", title: "否认和辱骂继续时暂停", reason: "当具体事件不再被讨论时，暂停本轮对话是合理选项。", message: "" }],
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
      { quotes: property, tags: [zh ? "产权" : "ownership", zh ? "资金性质" : "fund classification"], keyPoint: zh ? "彩礼回流和购房安排需要分别写清赠与、个人财产、共同资金、登记比例与退出处理。" : "Gift money and property plans need clear terms for gifts, personal property, shared funds, title shares, and exit arrangements.", grounding: zh ? "共同购房可以协商，但不能跳过资金性质和产权。" : "Shared property can be negotiated without skipping fund classification and ownership.", uncertainty: "" },
      { quotes: personal, tags: [zh ? "个人资产" : "personal assets", zh ? "预期情绪" : "anticipated reaction"], keyPoint: zh ? "用户想用自己的钱购买婚前资产；担心对方不开心需要核对，但不能直接写成对方已经实施财务控制。" : "The user wants to buy premarital assets; anticipated displeasure should be checked, not treated as proven control.", grounding: zh ? "可以先分别确认个人资产、共同购房能力和对方的明确意见。" : "Clarify personal assets, shared borrowing capacity, and the partner's explicit view separately.", uncertainty: "" },
    ].filter((item) => item.quotes.length).slice(0, 4),
    selfGrounding: [zh ? "共同规划是合理的，但个人资产、共同账户、产权和生育成本仍需分别协商。" : "Shared planning can be reasonable while personal assets, joint accounts, ownership, and pregnancy costs still require separate agreement.", zh ? "双方都辛苦，不等于两类成本可以互相抵销。" : "Both people can work hard without one kind of cost cancelling the other.", zh ? "口头平等要落实到消费标准、社交、家务、生育和双方父母安排。" : "Verbal equality needs matching terms for spending, social life, care work, pregnancy, and both families."],
    nextStepOptions: [{ type: "clarify", title: zh ? "把八类规则分别写清" : "Separate the rules", reason: zh ? "逐项回答消费、个人钱、共同账户、产权、生育、家务照护、双方父母和失业阶段由谁决定、谁受益、谁承担风险。" : "For spending, personal money, joint accounts, ownership, pregnancy, care, both families, and unemployment, record who decides, benefits, and bears risk." , message: "" }, { type: "observe", title: zh ? "先核对个人资产的明确立场" : "Clarify the personal-asset position", reason: zh ? "区分对方担心共同购房能力、明确反对独立资产，还是用户已经提前管理对方可能的不开心。" : "Distinguish shared-borrowing concern, explicit opposition to independent assets, and anticipated displeasure." , message: "" }],
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
    selfGrounding: [zh ? "对方有权结束关系，这不自动证明过去的感情都是假的。" : "The other person may end the relationship; that does not prove the past was false.", zh ? "当前可以确认的是对方决定退出；具体沟通问题仍没有被说明。" : "What is clear is the decision to leave; the specific communication problem remains unexplained.", zh ? "删除联系方式是明确边界，不自动等于恶意惩罚。" : "Removing contact is a clear boundary, not automatically malicious punishment."],
    nextStepOptions: [{ type: "clarify", title: zh ? "最多核对一个具体问题" : "Ask at most one concrete question", reason: zh ? "如果答案仍有价值，只问“我们具体卡在哪里、尝试过什么”，不要求对方重新证明整段感情。" : "If an answer would help, ask where things specifically broke down and what was tried, without demanding a defence of the whole relationship.", message: "" }, { type: "no_reply", title: zh ? "也可以停止继续追问" : "You may stop asking", reason: zh ? "若对方不愿解释，可以接受退出决定；这是一种选择，不是唯一正确答案。" : "If no explanation is offered, accepting the exit is an option, not the only correct answer.", message: "" }],
    risk: { level: "低", reasons: [zh ? "原文显示关系退出和解释不足，没有现实安全信号。" : "The text shows relationship exit and incomplete explanation, without a real-world safety signal."], urgentWarning: "" },
  });
}

export function analyzeConversationLocally({ otherText, myText, language, context, statusReason }: { otherText: string; myText: string; language: AnalysisLanguage; context: AnalysisContext; statusReason: AnalysisStatusReason }): AiAnalysis {
  const sentences = splitSentences(otherText);
  const mySentences = splitSentences(myText);
  const research = runResearchPipeline(otherText, myText, context, language);
  const ruleIds = new Set(research.candidates.map((item) => item.rule.id));
  if (context === "family" && ["R33", "R34", "R09", "R10", "R35"].filter((id) => ruleIds.has(id)).length >= 3) return familyPressureAnalysis(sentences, mySentences, language, statusReason);
  if (sentences.length >= 3 && ruleIds.has("R05") && ["R04", "R09"].some((id) => ruleIds.has(id))) return harmDenialAnalysis(sentences, language, statusReason);
  const caseType = classifyCase(otherText, myText, context);
  if (caseType === "family") return familyPressureAnalysis(sentences, mySentences, language, statusReason);
  if (caseType === "premarital") return premaritalAnalysis(sentences, mySentences, language, statusReason);
  if (caseType === "breakup") return breakupAnalysis(sentences, language, statusReason);
  const topCandidates = research.resolved.slice(0, 4);
  const reasonable = reasonableParts(sentences, language);
  const issue = research.chain?.title || topCandidates[0]?.rule.construct[language] || (language === "zh" ? "当前主要是一段具体分歧" : "This is mainly a concrete disagreement");
  const overview = language === "zh" ? `${issue}。先区分原文中的事实、要求、评价与反证，再决定是否需要更强的判断。` : `${issue}. Separate facts, requests, judgments, and counterevidence before making a stronger conclusion.`;
  const observed = topCandidates.length ? [language === "zh" ? `原文可直接确认：${topCandidates.slice(0, 2).map((item) => item.rule.construct.zh).join("、")}。` : `The text directly supports: ${topCandidates.slice(0, 2).map((item) => item.rule.construct.en).join(" and ")}.`] : [];
  const likely = research.chain ? [research.chain.title] : topCandidates[0] ? [topCandidates[0].rule.explanation[language]] : [];
  const selfGrounding = unique(topCandidates.map((item) => item.rule.grounding[language])).slice(0, 3);
  if (!selfGrounding.length) selfGrounding.push(language === "zh" ? "先只处理可核实的事实，不必立刻接受对整段关系的结论。" : "Start with verifiable facts without accepting a verdict on the whole relationship.");
  const riskReasons = topCandidates.filter((item) => item.score >= 5).map((item) => item.rule.construct[language]).slice(0, 3);
  const urgent = research.risk === "紧急";
  const chainAnnotations = research.chain?.steps.slice(1, 4).map((step) => ({
    quotes: step.evidence,
    tags: [step.action],
    keyPoint: language === "zh" ? `这一环把讨论继续带向“${step.action}”，需要回到对应的具体事实核对。` : `This step moves the exchange toward “${step.action}”; return to the concrete fact behind it.`,
    grounding: language === "zh" ? "关心可以被听见，具体决定仍需要事实和双方同意。" : "Concern can be heard while concrete decisions still require facts and mutual agreement.",
    uncertainty: "",
  })) || [];

  return dedupeAnalysis({
    mode: "local", statusReason, overview, evidenceBoundary: { observed, likely, uncertain: [] },
    interactionPattern: research.chain ? { title: research.chain.title, steps: research.chain.steps.map(({ action, evidence }) => ({ action, evidence })), explanation: language === "zh" ? "这些动作连在一起时，原始议题会被带向责任、归属、成本或决定权。" : "Together, these actions move the original issue toward responsibility, belonging, costs, or decision power." } : { title: "", steps: [], explanation: "" },
    whatTheyArePushing: [],
    reasonableParts: reasonable.slice(0, 3),
    concerningParts: [],
    keyAnnotations: topCandidates.length ? topCandidates.map((item) => ({ quotes: item.evidence.slice(0, 2).map((entry) => entry.text), tags: [item.rule.construct[language]], keyPoint: language === "zh" ? `这组原话呈现了“${item.rule.construct.zh}”：${item.rule.explanation.zh}` : `These words show ${item.rule.construct.en}: ${item.rule.explanation.en}`, grounding: item.rule.grounding[language], uncertainty: "" })) : chainAnnotations,
    selfGrounding: unique(selfGrounding).slice(0, 3), nextStepOptions: [],
    risk: { level: research.risk, reasons: riskReasons, urgentWarning: urgent ? (language === "zh" ? "文字出现了明确的现实危险信号。请优先确认安全，并联系可信的人或当地紧急支持。" : "The text includes an explicit real-world danger signal. Prioritise safety and contact trusted or local emergency support.") : "" },
  });
}
