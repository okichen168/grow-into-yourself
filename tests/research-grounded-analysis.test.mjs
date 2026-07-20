import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { researchMinimalPairs, researchRuleMeta } from "./fixtures/research-grounded-minimal-pairs.mjs";
import { cases } from "./fixtures/conversation-cases.mjs";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("research-rules", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const assets = { fetch: async () => new Response("Not found", { status: 404 }) };
const context = { waitUntil() {}, passThroughOnException() {} };
let ip = 40;

async function analyze(otherText, relation = "relationship", language = "zh", myText = "") {
  const request = new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": `203.0.113.${ip += 1}` },
    body: JSON.stringify({ otherText, myText, language, context: relation }),
  });
  const response = await worker.fetch(request, { ASSETS: assets }, context);
  return response.json();
}

test("bundled research rule pack is complete and every minimal pair executes", async (t) => {
  assert.deepEqual(researchRuleMeta, { paper_count: 73, rule_count: 38, minimal_pair_count: 39 });
  assert.equal(researchMinimalPairs.length, 39);
  const source = await readFile(new URL("../app/lib/research-grounded-rules.ts", import.meta.url), "utf8");
  const ids = [...source.matchAll(/rule\("(R\d{2})"/g)].map((match) => match[1]);
  assert.equal(ids.length, 38); assert.equal(new Set(ids).size, 38);

  for (const [index, pair] of researchMinimalPairs.entries()) {
    await t.test(`minimal pair ${index + 1}: ${pair.scene}`, async () => {
      const relation = pair.scene.startsWith("家庭") ? "family" : pair.scene.startsWith("职场") ? "workplace" : "relationship";
      const [left, right] = await Promise.all([analyze(pair.input_a, relation), analyze(pair.input_b, relation)]);
      for (const result of [left, right]) {
        assert.equal(result.mode, "local"); assert.ok(result.analysis.overview); assert.ok(result.analysis.risk.level);
        assert.ok(result.analysis.keyAnnotations.length <= 4); assert.ok(result.analysis.interactionPattern.steps.length <= 6);
      }
    });
  }
});

test("construct gates require evidence and respect counterexamples", async () => {
  const denialOnly = await analyze("我没有做那件事，这是我的证据。", "family");
  const darvo = await analyze("根本没有，你又在编，你才是在伤害我们。", "family");
  assert.doesNotMatch(JSON.stringify(denialOnly), /DARVO/); assert.match(JSON.stringify(darvo), /DARVO|角色倒置/);

  const memory = await analyze("我们对那天的时间记得不同，也愿意一起核对。", "family");
  const repeatedReality = await analyze("主管多次否认书面承诺、改写指令，还反复说你记忆有问题。", "workplace");
  assert.doesNotMatch(JSON.stringify(memory), /煤气灯|现实感削弱/); assert.match(JSON.stringify(repeatedReality), /煤气灯|现实感削弱/);

  const budget = await analyze("我们按收入比例做预算，各自保留个人额度。", "relationship");
  const coercion = await analyze("不许见朋友，必须24小时开定位，关掉就断钱。", "relationship");
  assert.doesNotMatch(JSON.stringify(budget), /经济控制|强制控制/); assert.match(JSON.stringify(coercion), /强制控制|社会孤立|数字控制/);

  const consentLocation = await analyze("双方自愿共享位置，可随时关闭。", "relationship");
  const forcedLocation = await analyze("你必须24小时开定位，关掉就惩罚你。", "relationship");
  assert.doesNotMatch(JSON.stringify(consentLocation), /数字控制/); assert.match(JSON.stringify(forcedLocation), /数字控制/);

  const singleContact = await analyze("分手后只发一次归还物品信息。", "relationship");
  const stalking = await analyze("明确拒绝后，对方换号持续联系、反复定位并到住处等候，让我害怕。", "relationship");
  assert.doesNotMatch(JSON.stringify(singleContact), /跟踪|网络跟踪/); assert.match(JSON.stringify(stalking), /跟踪|网络跟踪/);

  const feedback = await analyze("这份报告缺少数据来源，请周五补充。", "workplace");
  const bullying = await analyze("主管连续数月公开羞辱、撤回资源、给不可能期限并报复申诉。", "workplace");
  assert.doesNotMatch(JSON.stringify(feedback), /职场霸凌/); assert.match(JSON.stringify(bullying), /职场霸凌|虐待型监督/);
});

test("scenario isolation and bilingual thresholds stay stable", async () => {
  await analyze(cases.familyBelonging.text, "family", "zh", cases.familyBelonging.myText);
  const breakup = await analyze(cases.respectfulBreakup.text, "relationship");
  await analyze(cases.premarital.text, "relationship", "zh", cases.premarital.myText);
  const breakupAgain = await analyze(cases.respectfulBreakup.text, "relationship");
  for (const result of [breakup, breakupAgain]) assert.doesNotMatch(JSON.stringify(result), /白眼狼|养育恩情|彩礼|三六分|工作地点|服从压力/);

  const zh = await analyze("你必须24小时开定位，关掉就惩罚你。", "relationship", "zh");
  const en = await analyze("You must share your location at all times; I will punish you if you turn it off.", "relationship", "en");
  assert.match(JSON.stringify(zh), /数字控制/); assert.match(JSON.stringify(en), /digital control/i);
});

test("local-first timing is bounded and local analysis is fast", async () => {
  const route = await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
  const checker = await readFile(new URL("../app/components/english-checker.tsx", import.meta.url), "utf8");
  assert.match(route, /SERVER_AI_TIMEOUT_MS = 45_000/); assert.match(route, /Promise\.race/);
  assert.match(checker, /CLIENT_ANALYSIS_TIMEOUT_MS = 50_000/); assert.match(checker, /Promise\.race/);
  assert.doesNotMatch(`${route}\n${checker}`, /70_000|75_000|900_000|900000/);
  assert.ok(checker.indexOf("setAnalysis(localAnalysis)") < checker.indexOf('fetch("/api/analyze"'));
  assert.doesNotMatch(checker.slice(checker.indexOf("async function runAnalysis"), checker.indexOf("function clearConversation")), /catch[\s\S]{0,300}setAnalysis\(null\)/);
  assert.equal((checker.match(/fetch\("\/api\/analyze"/g) || []).length, 1);

  const ordinary = []; const long = [];
  for (let count = 0; count < 30; count += 1) { const start = performance.now(); await analyze("我们一起核对预算，各自保留个人额度。", "relationship"); ordinary.push(performance.now() - start); }
  for (let count = 0; count < 10; count += 1) { const start = performance.now(); await analyze(cases.familyBelonging.text, "family", "zh", cases.familyBelonging.myText); long.push(performance.now() - start); }
  const percentile = (values, p) => values.sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
  assert.ok(percentile(ordinary, 0.5) < 80); assert.ok(percentile(ordinary, 0.95) < 150); assert.ok(percentile(long, 0.95) < 400);
});
