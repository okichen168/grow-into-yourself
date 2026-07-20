import type { AnalysisContext, AnalysisLanguage, ConcernSeverity, Confidence } from "./analyze-shared";
import { RESEARCH_RULES, type ResearchRule } from "./research-grounded-rules";

export type EvidenceItem = { id: string; text: string; speaker: "other" | "user"; index: number };
export type ResearchCandidate = { rule: ResearchRule; score: number; evidence: EvidenceItem[]; counterEvidence: EvidenceItem[]; confidence: Confidence };
export type ResearchScenario = "family" | "premarital" | "breakup" | "workplace" | "friendship" | "general";

const boundary = /(?<=[。！？!?；;])|\n+(?=\s*(?:\d+[.、)]\s*)?)/;
const restriction = /(不准|不许|必须|听我的|断钱|查手机|限制|后果自负|must|not allowed|punish|consequence)/i;
const threat = /(杀|枪|刀|跟踪|尾随|锁门|扣证件|强制|kill|weapon|stalk|confine|force)/i;

export function normalizeInput(text: string) {
  return text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function splitLong(value: string) {
  if (value.length <= 180) return [value];
  const pieces = value.match(/[^，,。！？!?；;]+[，,。！？!?；;]?/g)?.map((item) => item.trim()).filter(Boolean) || [value];
  const result: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > 180) { result.push(current); current = ""; }
    current += piece;
  }
  if (current) result.push(current);
  return result;
}

export function segmentEvidence(otherText: string, myText = "") {
  let index = 0;
  const make = (text: string, speaker: EvidenceItem["speaker"]) => normalizeInput(text).split(boundary).map((item) => item.trim()).filter(Boolean).flatMap(splitLong).map((value) => ({ id: `L${index += 1}`, text: value, speaker, index: index - 1 }));
  return [...make(otherText, "other"), ...make(myText, "user")];
}

export function classifyScenario(evidence: EvidenceItem[], context: AnalysisContext): ResearchScenario {
  const text = evidence.map((item) => item.text).join("\n");
  const count = (patterns: RegExp[]) => patterns.filter((pattern) => pattern.test(text)).length;
  const breakup = count([/(结束关系|不能继续|不合适|end the relationship|cannot continue)/i, /(不是爱|只是冲动|not love|impulse)/i, /(祝你幸福|删除联系方式|wish you well|no contact)/i]);
  const premarital = count([/(预算|支出|高消费|budget|spending)/i, /(生育|彩礼|pregnancy|bride price)/i, /(买房|买车|产权|三六分|property|contribution)/i, /(男女平等|朋友圈|婚前|equality|friends)/i]);
  const family = count([/(父母|妈妈|爸爸|家人|family|parent)/i, /(养育|白眼狼|没有家|良心|raised you|ungrateful)/i, /(听我的|后果自负|孝顺|obey)/i]);
  const workplace = count([/(主管|老板|领导|报告|工作|manager|boss|report|workplace)/i, /(绩效|开除|公开羞辱|deadline|fire|humiliat)/i]);
  if (breakup >= 2) return "breakup";
  if (premarital >= 2) return "premarital";
  if (context === "workplace" || workplace >= 2) return "workplace";
  if (context === "family" || family >= 2) return "family";
  if (context === "friendship") return "friendship";
  return "general";
}

function rawCandidate(rule: ResearchRule, evidence: EvidenceItem[], context: AnalysisContext) {
  const matched = evidence.filter((item) => rule.signals.some((pattern) => pattern.test(item.text)));
  const counterEvidence = evidence.filter((item) => rule.counterSignals.some((pattern) => pattern.test(item.text)));
  if (!matched.length) return null;
  const full = evidence.map((item) => item.text).join("\n");
  let score = 4;
  if (rule.id === "R08") score += 6;
  if (rule.id === "R17") score += 5;
  if (matched.length > 1) score += 2;
  if (matched.some((item, position) => position > 0 && item.index - matched[position - 1].index <= 2)) score += 2;
  if ((context === "family" || context === "workplace") && /(父母|领导|主管|老板|parent|manager|boss)/i.test(full)) score += 1;
  if (restriction.test(full) && matched.some((item) => restriction.test(item.text))) score += 2;
  if (threat.test(full) && matched.some((item) => threat.test(item.text))) score += 3;
  score -= counterEvidence.length * 2;
  return { rule, score, evidence: matched, counterEvidence };
}

function domains(text: string) {
  return [/(位置|定位|location)/i, /(朋友|社交|friends|social)/i, /(钱|工资|账户|财产|money|salary|account)/i, /(工作|job|work)/i, /(离开|回家|住处|leave|home)/i, /(账号|手机|密码|device|phone|password)/i].filter((pattern) => pattern.test(text)).length;
}

function applyGate(candidate: NonNullable<ReturnType<typeof rawCandidate>>, all: EvidenceItem[]) {
  const full = all.map((item) => item.text).join("\n");
  const { id } = candidate.rule;
  if (["R36", "R37", "R38"].includes(id)) return { ...candidate, score: 3 };
  if (id === "R08" && !(/(没有|没做|否认|didn't|deny)/i.test(full) && /(撒谎|编|冤枉|人格|liar|lying)/i.test(full) && /(你才|我们才|伤害我们|我是受害|you are the abuser|hurt me)/i.test(full))) return null;
  if (id === "R07" && !(/(多次|反复|一直|录音|书面|repeated|recording|written)/i.test(full) && /(记忆|精神|判断|memory|crazy|judgment)/i.test(full))) return null;
  if (id === "R03" && !(candidate.score >= 7 && domains(full) >= 2) && !/(锁门|扣证件|强制带回|明确威胁|confine|force)/i.test(full)) return null;
  if (id === "R15" && !/(交出工资|没收|冻结|不许工作|辞掉工作|花钱先申请|债务|hand over|freeze|quit your job|permission to spend)/i.test(full)) return null;
  if (id === "R16" && !/(未经允许|偷偷|强迫|必须|惩罚|without permission|must|punish)/i.test(full)) return null;
  if (id === "R17" && !(/(反复|持续|换号|多次|repeated|continued)/i.test(full) && /(拒绝|不受欢迎|害怕|干扰|refus|unwanted|fear)/i.test(full))) return null;
  if (id === "R20" && !(/(连续|数月|反复|长期|repeated|months|ongoing)/i.test(full) && /(主管|老板|领导|权力|manager|boss|power)/i.test(full))) return null;
  if (id === "R21" && !/(持续|反复|repeated|continuously)/i.test(full)) return null;
  if (id === "R22" && !/(多次|反复|repeated)/i.test(full)) return null;
  if (id === "R02" && candidate.evidence.length < 2 && !/(反复|一直|repeated)/i.test(full)) return null;
  return candidate.score >= 3 || ["R01", "R14", "R19", "R23"].includes(id) ? candidate : null;
}

export function generateCandidates(evidence: EvidenceItem[], context: AnalysisContext) {
  return RESEARCH_RULES.flatMap((item) => {
    let candidate = rawCandidate(item, evidence, context);
    if (!candidate && item.id === "R33") {
      const correction = evidence.filter((entry) => entry.speaker === "user" && /(本地|同城|同一城市|会[来到].{0,10}(工作|生活)|长期.{0,8}(工作|居住)|稳定后.{0,10}(来|回)|不是.{0,8}(外地|异地)|same city|work locally|move here|not.{0,8}far away)/i.test(entry.text));
      const oldCharge = evidence.filter((entry) => entry.speaker === "other" && /(外地|异地|很远|太远|找这[么般]远|找那么远|故意找|非要找|far away|distant|too far)/i.test(entry.text));
      if (correction.length && oldCharge.length) candidate = { rule: item, score: 5, evidence: [...correction.slice(0, 1), ...oldCharge.slice(0, 1)], counterEvidence: [] };
    }
    if (!candidate) return [];
    const gated = applyGate(candidate, evidence);
    if (!gated) return [];
    return [{ ...gated, confidence: (gated.score >= 7 ? "高" : gated.score >= 5 ? "中" : "低") as Confidence }];
  });
}

export function scoreEvidence(evidence: EvidenceItem[], context: AnalysisContext) { return generateCandidates(evidence, context); }
export function applyConstructGates(candidates: ResearchCandidate[]) { return candidates; }

export function detectInteractionChains(candidates: ResearchCandidate[], scenario: ResearchScenario, language: AnalysisLanguage, evidence: EvidenceItem[] = []) {
  const ids = new Set(candidates.map((item) => item.rule.id));
  if (scenario === "family" && evidence.length) {
    const definitions = [
      { action: ["询问收入", "Income is questioned"], pattern: /(工资多少|收入多少|salary|income)/i },
      { action: ["贬低工作或城市选择", "Work or city choice is devalued"], pattern: /(工资低|没前途|城市.{0,8}(没用|有什么用)|low salary|no future)/i },
      { action: ["强调家庭经济责任", "Family financial responsibility is emphasised"], pattern: /(家里缺钱|弟弟.{0,6}(升学|学费)|family needs money|sibling)/i },
      { action: ["索取位置或介入住处", "Location or housing access is requested"], pattern: /(发位置|定位|过段时间我来|send location|come over)/i },
      { action: ["贬低伴侣或排他式强调家人", "A partner is devalued or family is framed as the only reliable bond"], pattern: /(伴侣|男朋友|对象).{0,10}(不可靠|不行)|只有父母|只有家人|partner.{0,8}unreliable|only family/i },
      { action: ["推动回家或接受指定安排", "Returning home or accepting the preferred arrangement is pushed"], pattern: /(回来|回家|只能附近|必须回来|come home|stay nearby)/i },
    ] as const;
    const steps = definitions.flatMap((definition) => {
      const quote = evidence.find((item) => definition.pattern.test(item.text));
      return quote ? [{ action: definition.action[language === "zh" ? 0 : 1], evidence: [quote.text], ruleId: "sequence" }] : [];
    });
    if (steps.length >= 3) return { title: language === "zh" ? "现实关心逐步扩展为对位置、关系和生活选择的压力" : "Practical concern expands into pressure over location, relationships, and life choices", steps: steps.slice(0, 5) };
  }
  const definitions: Array<{ scenario: ResearchScenario | "any"; ids: string[]; title: [string, string] }> = [
    { scenario: "family", ids: ["R33", "R34", "R10", "R09", "R35"], title: ["现实议题被推成家庭忠诚与服从考试", "A practical issue becomes a test of family loyalty and obedience"] },
    { scenario: "family", ids: ["R05", "R04", "R08", "R09"], title: ["提出伤害后，事实核对被人格与恩情审判取代", "After harm is raised, fact-checking is replaced by character and caregiving judgment"] },
    { scenario: "premarital", ids: ["R14", "R26", "R27", "R29", "R30", "R31", "R32"], title: ["共同规划逐步进入定义权、成本与资源分配", "Shared planning moves into rule-making, costs, and resource allocation"] },
    { scenario: "breakup", ids: ["R23", "R24", "R25"], title: ["交流困难被快速推到关系退出与历史重写", "Communication difficulty moves quickly to exit and rewriting the relationship history"] },
    { scenario: "workplace", ids: ["R19", "R20", "R21", "R22"], title: ["工作反馈需要按持续性、权力与可执行标准区分", "Work feedback must be distinguished by persistence, power, and actionable standards"] },
  ];
  const best = definitions.filter((item) => item.scenario === scenario || item.scenario === "any").map((item) => ({ ...item, matches: item.ids.filter((id) => ids.has(id)) })).sort((left, right) => right.matches.length - left.matches.length)[0];
  if (!best || best.matches.length < 3) return null;
  const steps = best.matches.slice(0, 5).map((id) => {
    const match = candidates.find((item) => item.rule.id === id) as ResearchCandidate;
    return { action: match.rule.construct[language], evidence: match.evidence.slice(0, 1).map((item) => item.text), ruleId: id };
  });
  return { title: best.title[language === "zh" ? 0 : 1], steps };
}

export function resolveConflicts(candidates: ResearchCandidate[]) {
  const ids = new Set(candidates.map((item) => item.rule.id));
  const absorbed = new Set<string>();
  if (ids.has("R08")) ["R04", "R05"].forEach((id) => absorbed.add(id));
  if (ids.has("R03")) ["R13", "R15", "R16"].forEach((id) => absorbed.add(id));
  if (ids.has("R23")) ["R24", "R25"].forEach((id) => absorbed.add(id));
  return candidates.filter((item) => !absorbed.has(item.rule.id) && !["R36", "R37", "R38"].includes(item.rule.id)).sort((left, right) => right.score - left.score);
}

export function calibrateRisk(candidates: ResearchCandidate[], text: string) {
  if (candidates.some((item) => item.rule.id === "R18")) return "紧急";
  if (candidates.some((item) => ["R03", "R16", "R17"].includes(item.rule.id) && item.score >= 7)) return "高";
  if (candidates.some((item) => ["R04", "R08", "R09", "R10", "R20", "R21", "R35"].includes(item.rule.id)) || candidates.filter((item) => item.score >= 5).length >= 2) return "中";
  if (/(明确威胁|持武器|kill you)/i.test(text)) return "高";
  return "低";
}

export function severityFor(candidate: ResearchCandidate): ConcernSeverity {
  return candidate.rule.severity === "urgent" || candidate.rule.severity === "high" ? "high" : candidate.rule.severity === "pressure" ? "pressure" : "notice";
}

export function runResearchPipeline(otherText: string, myText: string, context: AnalysisContext, language: AnalysisLanguage) {
  const evidence = segmentEvidence(otherText, myText);
  const scenario = classifyScenario(evidence, context);
  const scored = scoreEvidence(evidence, context);
  const gated = applyConstructGates(scored);
  const chain = detectInteractionChains(gated, scenario, language, evidence);
  const resolved = resolveConflicts(gated);
  const risk = calibrateRisk(gated, evidence.map((item) => item.text).join("\n"));
  return { evidence, scenario, candidates: gated, resolved, chain, risk };
}
