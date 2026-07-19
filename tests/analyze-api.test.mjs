import assert from "node:assert/strict";
import test from "node:test";
import { cases } from "./fixtures/conversation-cases.mjs";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("analysis-v2", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const assets = { fetch: async () => new Response("Not found", { status: 404 }) };
const context = { waitUntil() {}, passThroughOnException() {} };
let ipCounter = 10;

async function analyze(body, ip = `198.51.100.${ipCounter += 1}`) {
  const response = await worker.fetch(new Request("http://localhost/api/analyze", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(body) }), { ASSETS: assets }, context);
  return { response, data: await response.json() };
}

function clearConfig() {
  delete process.env.ANALYSIS_API_KEY; delete process.env.ANALYSIS_API_URL; delete process.env.ANALYSIS_MODEL; delete process.env.ANALYSIS_STRICT_PRIVACY;
}

function aiFixture(overrides = {}) {
  return {
    mode: "ai", statusReason: "success", overview: "The practical question turns into a broader demand about responsibility and compliance.",
    evidenceBoundary: { observed: ["A request was made."], likely: ["The wording applies pressure."], uncertain: ["Motive cannot be confirmed."] },
    interactionPattern: { title: "Question, blame, withdrawal", steps: [{ action: "A question is raised", evidence: ["What happened?"] }, { action: "Blame follows", evidence: ["This is your fault"] }, { action: "Discussion closes", evidence: ["Nothing more to say"] }], explanation: "The original issue is not answered." },
    whatTheyArePushing: [{ point: "Accept sole responsibility", evidence: ["This is your fault"], confidence: "中" }], reasonableParts: [],
    concerningParts: [{ label: "Blame shift", explanation: "The whole conflict is assigned to one person.", evidence: ["This is your fault"], severity: "pressure", confidence: "中" }],
    keyAnnotations: [
      { quotes: ["This is your fault"], tags: ["blame"], keyPoint: "The statement assigns a total conclusion without naming an action.", grounding: "A disagreement can involve more than one person's choices.", uncertainty: "The wider history is unknown." },
      { quotes: ["Nothing more to say"], tags: ["withdrawal"], keyPoint: "The exit closes discussion before the issue is examined.", grounding: "An ended discussion is not a resolved one.", uncertainty: "This may still be a temporary pause." },
    ],
    selfGrounding: ["Separate the concrete event from a total judgment.", "No immediate reply is required."], nextStepOptions: [],
    risk: { level: "低", reasons: [], urgentWarning: "" }, ...overrides,
  };
}

test("local structured analysis", async (t) => {
  clearConfig();
  await t.test("missing configuration returns useful local content", async () => {
    const started = performance.now();
    const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: cases.familyMoney.context });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.mode, "local"); assert.equal(data.analysis.statusReason, "config"); assert.ok(data.analysis.overview.length > 30); assert.ok(data.analysis.keyAnnotations.length > 0);
    assert.ok(performance.now() - started < 2000);
  });
  await t.test("missing configuration never calls the external analysis endpoint", async (t) => {
    let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls += 1; throw new Error("unexpected request"); });
    const { data } = await analyze({ otherText: cases.harmDenial.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(calls, 0);
  });
  await t.test("family money case groups the chain and does not claim certain money motive", async () => {
    const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: "family" }); const text = JSON.stringify(data.analysis);
    assert.ok(data.analysis.interactionPattern.steps.length >= 3); assert.match(text, /位置/); assert.match(text, /伴侣|父母|家人/); assert.doesNotMatch(text, /一定想要钱/); assert.notEqual(data.analysis.risk.level, "紧急"); assert.ok(data.analysis.keyAnnotations.length <= 4);
  });
  await t.test("harm denial recognises the chain without diagnosing", async () => {
    const { data } = await analyze({ otherText: cases.harmDenial.text, language: "zh", context: "family" }); const text = JSON.stringify(data.analysis);
    assert.equal(data.analysis.risk.level, "中"); assert.ok(data.analysis.interactionPattern.steps.length >= 5); assert.match(text, /具体伤害/); assert.match(text, /否认|不记得/); assert.match(text, /人品|人格/); assert.match(text, /家庭贡献/); assert.match(text, /冤枉/); assert.match(text, /养育|学费/); assert.match(text, /白眼狼|忘恩负义/); assert.match(text, /举证|证明伤害/); assert.doesNotMatch(text, /人格障碍/);
    assert.ok(data.analysis.keyAnnotations.length >= 3 && data.analysis.keyAnnotations.length <= 4);
    assert.match(data.analysis.interactionPattern.explanation, /发生过什么/);
    assert.equal(data.analysis.nextStepOptions[0]?.type, "no_reply");
  });
  await t.test("one memory difference with willingness to listen is not gaslighting or DARVO", async () => {
    const { data } = await analyze({ otherText: "我不记得这件事，但愿意听你说，也想一起核对。", language: "zh", context: "family" }); const text = JSON.stringify(data.analysis);
    assert.doesNotMatch(text, /煤气灯|DARVO|现实感操控/); assert.match(text, /愿意|开放|核对/);
  });
  await t.test("respectful breakup finds the reasoning gap without abuse labels", async () => {
    const { data } = await analyze({ otherText: cases.respectfulBreakup.text, language: "zh", context: "relationship" }); const text = JSON.stringify(data.analysis);
    assert.match(text, /交流|关系/); assert.doesNotMatch(text, /羞辱|威胁|孝顺|经济控制/); assert.equal(data.analysis.risk.level, "低");
  });
  await t.test("premarital planning preserves reasonable and unequal parts", async () => {
    const { data } = await analyze({ otherText: cases.premarital.text, language: "zh", context: "relationship" }); const text = JSON.stringify(data.analysis);
    assert.ok(data.analysis.reasonableParts.length > 0); assert.match(text, /生育|双重|不对等|双向/); assert.notEqual(data.analysis.risk.level, "紧急");
  });
  await t.test("joint budgeting is not economic control", async () => {
    const { data } = await analyze({ otherText: "这个月预算有点紧，我们一起算一下，双方都可以提出不同意见。", language: "zh", context: "relationship" }); const text = JSON.stringify(data.analysis);
    assert.doesNotMatch(text, /经济控制/); assert.equal(data.analysis.risk.level, "低");
  });
  await t.test("ordinary pauses, feedback, location check-ins and opinions stay low", async () => {
    const samples = [
      ["我现在情绪太满，明天再聊。", "relationship"], ["这份报告缺少数据来源，请周五补充。", "workplace"], ["到家告诉我一声，不方便也没关系。", "family"], ["我不喜欢你的朋友，但不会替你决定。", "relationship"],
    ];
    for (const [otherText, relation] of samples) { const { data } = await analyze({ otherText, language: "zh", context: relation }); assert.equal(data.analysis.risk.level, "低"); }
  });
  await t.test("explicit threat is urgent but harsh words alone are not", async () => {
    const urgent = await analyze({ otherText: "你敢离开我就杀了你。", language: "zh" }); assert.equal(urgent.data.analysis.risk.level, "紧急"); assert.ok(urgent.data.analysis.risk.urgentWarning);
    const harsh = await analyze({ otherText: "你这次做得很差。", language: "zh" }); assert.notEqual(harsh.data.analysis.risk.level, "紧急");
  });
  await t.test("old fallback templates never return", async () => {
    const { data } = await analyze({ otherText: cases.workLocation.text, language: "zh", context: "family" });
    assert.doesNotMatch(JSON.stringify(data), /这段文字暂时不足以做强判断|本地兜底没有命中明确模式|但这不代表关系一定健康|仅凭这些文字不能确认对方的内心动机|部分信号只出现一次|目前无法确认/);
  });
});

test("AI request and fallback", async (t) => {
  process.env.ANALYSIS_API_KEY = "test-only"; process.env.ANALYSIS_API_URL = "https://example.invalid/analyse"; process.env.ANALYSIS_MODEL = "test-model"; process.env.ANALYSIS_STRICT_PRIVACY = "true";
  await t.test("strict request returns validated AI structure without exposing configuration", async (t) => {
    let body; let calls = 0; t.mock.method(globalThis, "fetch", async (_url, init) => { calls += 1; body = JSON.parse(init.body); return Response.json({ choices: [{ message: { content: JSON.stringify(aiFixture()) } }] }); });
    const { data } = await analyze({ otherText: "What happened? This is your fault. Nothing more to say.", language: "en" });
    assert.equal(data.mode, "ai"); assert.equal(calls, 1); assert.equal(body.temperature, 0.2); assert.equal(body.max_tokens, 2200); assert.deepEqual(body.reasoning, { effort: "low", exclude: true }); assert.deepEqual(body.provider, { require_parameters: true, data_collection: "deny" }); assert.equal(body.provider.zdr, undefined); assert.equal(body.response_format.type, "json_schema"); assert.equal(body.response_format.json_schema.strict, true); assert.ok(body.messages[0].content.length < 4000); assert.doesNotMatch(JSON.stringify(data), /test-model|example\.invalid|test-only/);
  });
  await t.test("HTTP 429 becomes quota-labelled local analysis", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 })); const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "quota"); assert.ok(data.analysis.keyAnnotations.length > 0);
  });
  await t.test("invalid model output becomes local rather than a template error", async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: "not json" } }] })); const { data } = await analyze({ otherText: cases.harmDenial.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "invalid_output");
  });
  await t.test("timeout errors immediately switch to local analysis", async (t) => {
    t.mock.method(globalThis, "fetch", async () => { throw new DOMException("timed out", "AbortError"); });
    const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "timeout");
  });
  clearConfig();
});
