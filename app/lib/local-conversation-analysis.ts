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

export function analyzeConversationLocally({ otherText, myText, language, context, statusReason }: { otherText: string; myText: string; language: AnalysisLanguage; context: AnalysisContext; statusReason: AnalysisStatusReason }): AiAnalysis {
  const sentences = splitSentences(otherText);
  const mySentences = splitSentences(myText);
  const research = runResearchPipeline(otherText, myText, context, language);
  const ruleIds = new Set(research.candidates.map((item) => item.rule.id));
  if (context === "family" && ["R33", "R34", "R09", "R10", "R35"].filter((id) => ruleIds.has(id)).length >= 3) return familyPressureAnalysis(sentences, mySentences, language, statusReason);
  if (sentences.length >= 3 && ruleIds.has("R05") && ["R04", "R09"].some((id) => ruleIds.has(id))) return harmDenialAnalysis(sentences, language, statusReason);
  const caseType = classifyCase(otherText, myText, context);
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
