import type { AnalysisLanguage } from "./analyze-shared";

export const ANALYSIS_LOADING_MESSAGES = [
  ["先承认自己的感受，它不需要别人批准才成立。", "Your feelings do not need someone else's approval to be real."],
  ["你不必在情绪最满的时候立刻回答。", "You do not have to reply at the most emotional moment."],
  ["对方说得很确定，不等于对方一定正确。", "Certainty in someone's tone does not make them correct."],
  ["关心可以被听见，但决定权仍然属于你。", "Concern can be heard while the decision remains yours."],
  ["先把事实和评价分开，很多混乱会少一半。", "Separate facts from verdicts; much of the confusion may ease."],
  ["不记得，不等于没有发生。", "Not remembering does not mean it never happened."],
  ["付出过，和伤害过，可以同时成立。", "Care and harm can both have happened."],
  ["你不需要证明自己是“好孩子”，才有资格做决定。", "You need not prove you are a good child before making a decision."],
  ["你可以感谢别人，也可以保留不同意见。", "You can be grateful and still disagree."],
  ["别人的失望，不是你自动做错了什么的证据。", "Someone's disappointment is not proof that you did wrong."],
  ["先深呼吸，让身体慢一点，再继续看这些话。", "Take one slow breath before reading on."],
  ["暂时不回复，也是一种完整选择。", "Not replying yet is a complete choice."],
  ["真正的协商会允许双方都提出条件。", "Real negotiation lets both people name conditions."],
  ["“为了你好”也需要尊重你的边界。", "Even 'for your own good' must respect your limits."],
  ["如果规则只约束一方，那就不是共同规则。", "A rule that binds only one person is not a shared rule."],
  ["看看谁在定义“合理”，谁拥有例外。", "Notice who defines reasonable and who gets exceptions."],
  ["口号是否平等，要看具体安排是否平等。", "Equality is shown by arrangements, not slogans."],
  ["把问题说具体，不要让它被改写成你的人品。", "Keep the issue concrete; do not let it become a verdict on you."],
  ["你可以只回应事实，不接住羞辱。", "You can answer facts without accepting an insult."],
  ["一次选择，不等于对整个人的结论。", "One choice is not a verdict on your whole character."],
  ["你的钱、时间、身体和关系都值得认真协商。", "Your money, time, body, and relationships deserve real negotiation."],
  ["爱不需要靠恐惧、亏欠或不断自证来维持。", "Love need not be maintained through fear, debt, or constant proof."],
  ["当你开始先管理对方情绪，先看看自己的决定去了哪里。", "If you manage their reaction first, notice where your own decision went."],
  ["对方的辛苦，不能自动抵消你的辛苦。", "Their hardship does not automatically cancel yours."],
  ["两种付出可以同时被看见，不必互相取消。", "Two kinds of effort can both be seen without cancelling each other."],
  ["你不需要立刻说服任何人。", "You do not have to convince anyone immediately."],
  ["先确认对方到底提出了什么具体要求。", "First identify the exact request being made."],
  ["亲密不等于单向融入另一个人的生活。", "Closeness does not require one-way integration into another life."],
  ["一个建议如果附带惩罚，就不再只是建议。", "Advice tied to punishment is no longer only advice."],
  ["不同意不等于背叛，不服从不等于不爱。", "Disagreement is not betrayal; non-compliance is not lack of love."],
  ["先看前后有没有矛盾，再看谁被要求让步。", "Look for contradictions, then notice who is expected to yield."],
  ["你可以保留个人资产，也可以讨论共同计划。", "You can keep personal assets and still discuss shared plans."],
  ["共同未来不等于提前预算对方全部资源。", "A shared future does not mean pre-allocating all of a partner's resources."],
  ["你不是问题本身，先把行为和人格分开。", "You are not the problem itself; separate actions from character."],
  ["今天先照顾好自己，再决定要不要继续谈。", "Care for yourself first, then decide whether to continue."],
  ["世界上最应该站在你这边的人，也包括你自己。", "The people standing with you should include you."],
] as const;

export type LoadingMessage = { id: number; text: string };

export function createLoadingSequence(language: AnalysisLanguage, recentIds: number[] = []): LoadingMessage[] {
  const recent = new Set(recentIds.slice(-6));
  const rows = ANALYSIS_LOADING_MESSAGES.map((entry, id) => ({ id, text: entry[language === "zh" ? 0 : 1] }));
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [rows[index], rows[swap]] = [rows[swap], rows[index]];
  }
  return [...rows.filter((row) => !recent.has(row.id)), ...rows.filter((row) => recent.has(row.id))];
}
