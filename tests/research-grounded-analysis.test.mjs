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

const forbiddenInference = /严重认知偏差|偏执|妄想|过度猜忌|限制地理位置自由|操控策略|故意制造|有意施压|情感缓冲策略|通过施压实现控制|高度防御和攻击/;
const leakedZhLabel = /^(power|concern|contradiction|reasonable|risk|control)$/i;

function assertQualityBasics(result, expectedNextStep) {
  assert.equal(result.mode, "local");
  assert.ok(result.analysis.keyAnnotations.length <= 4);
  assert.doesNotMatch(JSON.stringify(result), forbiddenInference);
  assert.ok(result.analysis.keyAnnotations.flatMap((item) => item.tags).every((tag) => !leakedZhLabel.test(tag)));
  assert.ok(result.analysis.concerningParts.every((item) => !leakedZhLabel.test(item.label)));
  assert.ok(result.analysis.selfGrounding.every((item) => /不自动|可以同时|当前可以确认|不能继续沿用|仍需分别|要落实|无需先|不等于/.test(item)));
  assert.match(result.analysis.nextStepOptions.map((item) => `${item.title} ${item.reason}`).join(" "), expectedNextStep);
}

test("five blind regressions bind evidence, merge insights, calibrate language, and keep actions case-specific", async () => {
  const familyCorrection = await analyze(
    "你偏要找那么远的人，你没有家。把你现在的位置发我。你不听就后果自负。",
    "family", "zh", "他结束培训后会到我长期生活的城市工作，我们只是先安排见面。",
  );
  assert.match(JSON.stringify(familyCorrection), /事实修正被忽略|新事实|补充/);
  assert.doesNotMatch(JSON.stringify(familyCorrection), /煤气灯|限制地理位置自由/);
  assertQualityBasics(familyCorrection, /核心事实|工作|住房|见面/);

  const premarital = await analyze(
    "1. 你要算清生存需要，不能高消费，但我们之间不能算经济账。\n2. 生育不需要补偿，男生也辛苦。\n3. 你先和我的朋友们玩，多陪我。\n4. 男女平等，彩礼给了要带回来购房。\n5. 我以后买一辆车，你帮我补钱。\n6. 可以三六分支出，女方不能完全不支出。",
    "relationship", "zh", "我花自己的钱，也有自己的朋友。我担心婚前买个人房产和车会让他不开心，但他没有明确反对。生育还有身体、职业、照护和机会成本。",
  );
  const premaritalJson = JSON.stringify(premarital);
  for (const pattern of [/高消费|经济账/, /生育|机会成本/, /朋友|社交/, /彩礼|购房|产权/, /车|伴侣资源/, /三六分|无偿|照护/]) assert.match(premaritalJson, pattern);
  const social = premarital.analysis.keyAnnotations.find((item) => item.tags.some((tag) => /社交/.test(tag)));
  assert.ok(social); assert.ok(social.quotes.every((quote) => /朋友|陪我|社交/.test(quote))); assert.ok(social.quotes.every((quote) => !/高消费|经济账|支出/.test(quote)));
  const birth = premarital.analysis.keyAnnotations.find((item) => item.tags.some((tag) => /生育/.test(tag)));
  assert.ok(birth); assert.ok(birth.quotes.every((quote) => /生育|身体|职业|机会成本|男生也辛苦/.test(quote)));
  const property = premarital.analysis.keyAnnotations.find((item) => item.tags.some((tag) => /产权/.test(tag)));
  assert.ok(property); assert.ok(property.quotes.every((quote) => /彩礼|购房|买房|产权|个人房产/.test(quote)));
  assert.doesNotMatch(premaritalJson, /经济控制|白眼狼|没有家|服从惩罚/);
  assertQualityBasics(premarital, /八类|消费|个人资产|产权/);

  const breakup = await analyze("我压力很大，也不善表达。我们交流不深入，也许这不是爱，都是我的原因。祝你幸福，我会删除联系方式。", "relationship");
  const breakupJson = JSON.stringify(breakup);
  assert.match(breakupJson, /有权结束|有权结束关系/); assert.match(breakupJson, /逻辑跨越|关系历史重写/);
  assert.doesNotMatch(breakupJson, /惩罚性沉默|工作地点|住处|彩礼|孝顺|白眼狼|服从压力/);
  assert.equal(breakup.analysis.risk.level, "低");
  assertQualityBasics(breakup, /具体问题|停止继续追问/);

  const harm = await analyze("我说小时候被打骂。对方说：我不记得，就是没有。你有公主病，只会冤枉人。我们给你交了学费，你就是白眼狼。", "family");
  const harmJson = JSON.stringify(harm);
  assert.match(harmJson, /DARVO/); assert.match(harmJson, /养育恩情/);
  assert.ok(harm.analysis.keyAnnotations.length <= 2);
  assertQualityBasics(harm, /具体事件|辱骂/);

  const familyPressure = await analyze(
    "家里确实有困难，你应该回来。你的对象只会骗你，只有父母可靠。把位置发来，你不听我的以后一定会后悔。",
    "family", "zh", "我知道家里最近有现实困难；对象只是短期培训，之后会在我所在城市长期工作。",
  );
  const familyPressureJson = JSON.stringify(familyPressure);
  assert.match(familyPressureJson, /家里.{0,8}困难|合理/); assert.match(familyPressureJson, /贬低伴侣/); assert.match(familyPressureJson, /父母唯一|父母可靠/);
  assert.equal(familyPressure.analysis.risk.level, "中"); assert.doesNotMatch(familyPressureJson, /限制地理位置自由/);
  assertQualityBasics(familyPressure, /核心事实|工作|住房|见面/);

  const component = await readFile(new URL("../app/components/conversation-analysis-result.tsx", import.meta.url), "utf8");
  const quality = await readFile(new URL("../app/lib/conversation-analysis-quality.ts", import.meta.url), "utf8");
  assert.match(component, /selectEvidenceForDisplay/); assert.match(quality, /counts\.get\(value\).*>= 2/);
  for (const [english, chinese] of [["power", "权力与自主"], ["concern", "值得核对"], ["contradiction", "前后矛盾"], ["reasonable", "合理部分"], ["risk", "风险线索"], ["control", "控制与限制"]]) {
    assert.match(quality, new RegExp(`${english}: \\"${chinese}\\"`));
  }
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
