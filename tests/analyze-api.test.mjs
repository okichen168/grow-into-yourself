import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    coreShift: "The original issue is displaced by a total judgment.",
    interaction: [{ title: "Question", insight: "A concrete event is raised.", evidenceIds: ["E1"] }, { title: "Blame", insight: "Responsibility is assigned broadly.", evidenceIds: ["E2"] }, { title: "Exit", insight: "Discussion is closed.", evidenceIds: ["E3"] }],
    findings: [{ kind: "reasonable", title: "A clear question", insight: "The opening asks about a concrete event.", evidenceIds: ["E1"], grounding: "Keep the discussion on the event." }, { kind: "concern", title: "Blame shift", insight: "A total conclusion replaces a specific action.", evidenceIds: ["E2"], grounding: "A verdict is not an explanation." }],
    nextSteps: [], risk: { level: "低", reasons: ["No immediate safety signal."] }, ...overrides,
  };
}

test("local structured analysis", async (t) => {
  clearConfig();
  await t.test("missing configuration returns useful local content", async () => {
    const started = performance.now();
    const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: cases.familyMoney.context });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.mode, "local"); assert.equal(data.analysis.statusReason, "runtime_config_missing"); assert.ok(data.analysis.overview.length > 30); assert.ok(data.analysis.keyAnnotations.length > 0);
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
    assert.ok(data.analysis.keyAnnotations.length >= 2 && data.analysis.keyAnnotations.length <= 4);
    assert.match(data.analysis.interactionPattern.explanation, /发生过什么/);
    assert.ok(data.analysis.nextStepOptions.some((item) => item.type === "no_reply"));
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
    const { data } = await analyze({ otherText: cases.premarital.text, myText: cases.premarital.myText, language: "zh", context: "relationship" }); const text = JSON.stringify(data.analysis);
    assert.ok(data.analysis.reasonableParts.length > 0); assert.match(text, /消费|定义权/); assert.match(text, /生育|议题错位/); assert.match(text, /社交|朋友圈/); assert.match(text, /平等|双向/); assert.match(text, /彩礼|产权|购房/); assert.match(text, /补车|资源预先/); assert.match(text, /三六分|无偿|照护/); assert.match(text, /个人资产|不开心/); assert.doesNotMatch(text, /白眼狼|没有家|服从惩罚/); assert.notEqual(data.analysis.risk.level, "紧急");
  });
  await t.test("sequential family then breakup and finance then breakup do not leak content", async () => {
    await analyze({ otherText: cases.familyBelonging.text, myText: cases.familyBelonging.myText, language: "zh", context: "family" });
    const firstBreakup = await analyze({ otherText: cases.respectfulBreakup.text, language: "zh", context: "relationship" });
    await analyze({ otherText: cases.premarital.text, myText: cases.premarital.myText, language: "zh", context: "relationship" });
    const secondBreakup = await analyze({ otherText: cases.respectfulBreakup.text, language: "zh", context: "relationship" });
    for (const result of [firstBreakup.data, secondBreakup.data]) {
      const text = JSON.stringify(result.analysis); assert.match(text, /结束|关系退出|交流/); assert.match(text, /有权结束/); assert.match(text, /逻辑跨越|历史/);
      assert.doesNotMatch(text, /工作地点|住处|孝顺|白眼狼|养育债|彩礼|三六分|支出比例|服从压力/);
    }
  });
  await t.test("family belonging case notices ignored correction and escalation", async () => {
    const { data } = await analyze({ otherText: cases.familyBelonging.text, myText: cases.familyBelonging.myText, language: "zh", context: "family" }); const text = JSON.stringify(data.analysis);
    assert.equal(data.mode, "local"); assert.equal(data.analysis.risk.level, "中"); assert.ok(data.analysis.keyAnnotations.length <= 4);
    for (const expected of cases.familyBelonging.must) assert.match(text, new RegExp(expected));
    for (const excluded of cases.familyBelonging.mustNot) assert.doesNotMatch(text, new RegExp(excluded));
    assert.ok(data.analysis.reasonableParts.length > 0); assert.ok(data.analysis.nextStepOptions.some((item) => item.type === "no_reply"));
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
    assert.equal(data.mode, "ai"); assert.equal(calls, 1); assert.equal(body.temperature, 0.2); assert.equal(body.max_tokens, 900); assert.equal(body.reasoning, undefined); assert.deepEqual(body.provider, { require_parameters: true, data_collection: "deny", sort: "throughput", allow_fallbacks: true }); assert.equal(body.provider.zdr, undefined); assert.deepEqual(body.plugins, [{ id: "response-healing" }]); assert.equal(body.response_format.type, "json_schema"); assert.equal(body.response_format.json_schema.strict, true); assert.equal(body.response_format.json_schema.schema.properties.coreShift.maxLength, 100); assert.equal(body.response_format.json_schema.schema.properties.interaction.maxItems, 4); assert.equal(body.response_format.json_schema.schema.properties.findings.maxItems, 5); assert.equal(data.analysis.evidenceBoundary.likely[0], aiFixture().coreShift); assert.deepEqual(data.analysis.interactionPattern.steps[0].evidence, ["What happened?"]); assert.ok(data.analysis.reasonableParts.some((item) => /clear question/i.test(item))); assert.ok(data.analysis.concerningParts.some((item) => /Blame shift/.test(item.label))); assert.match(body.messages[0].content, /natural English/); assert.match(body.messages[1].content, /Language: en/); assert.match(body.messages[1].content, /E1: What happened\?|E1: \"What happened\?\"/); assert.match(body.messages[1].content, /E2:/); assert.match(body.messages[1].content, /E3:/); assert.ok(body.messages[0].content.length < 7000); assert.doesNotMatch(JSON.stringify(data), /test-model|example\.invalid|test-only/);
  });
  await t.test("numbered evidence is complete, uniquely numbered, and mapped safely", async (t) => {
    let body; const fixture = aiFixture({
      interaction: [{ title: "First", insight: "The sequence starts here.", evidenceIds: ["E1", "E6"] }, { title: "Second", insight: "The next item develops it.", evidenceIds: ["E2"] }, { title: "Third", insight: "The third item completes it.", evidenceIds: ["E3"] }],
      findings: [{ kind: "concern", title: "Check evidence", insight: "Only supplied evidence is retained.", evidenceIds: ["E2", "E999"], grounding: "Use the exact supplied words." }, { kind: "contradiction", title: "No duplicates", insight: "Repeated identifiers do not repeat the quote.", evidenceIds: ["E3", "E3"], grounding: "Keep one accurate quote." }],
    });
    t.mock.method(globalThis, "fetch", async (_url, init) => { body = JSON.parse(init.body); return Response.json({ choices: [{ message: { content: JSON.stringify(fixture) } }] }); });
    const numbered = "1. First complete item.\n2、Second complete item.\n3) Third complete item.\n4. Fourth complete item.\n5、Fifth complete item.\n6) Sixth complete item.";
    const { data } = await analyze({ otherText: numbered, language: "en" });
    assert.equal(data.mode, "ai"); for (let index = 1; index <= 6; index += 1) assert.match(body.messages[1].content, new RegExp(`E${index}:`));
    assert.deepEqual(data.analysis.interactionPattern.steps[0].evidence, ["1. First complete item.", "6) Sixth complete item."]);
    assert.deepEqual(data.analysis.concerningParts[0].evidence, ["2、Second complete item."]); assert.deepEqual(data.analysis.keyAnnotations[1].quotes, ["3) Third complete item."]);
  });
  await t.test("content string, text array, object, and fenced JSON all parse", async (t) => {
    const formats = [JSON.stringify(aiFixture()), [{ type: "text", text: JSON.stringify(aiFixture()) }], aiFixture(), `\`\`\`json\n${JSON.stringify(aiFixture())}\n\`\`\``];
    let index = 0; t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: formats[index++] } }] }));
    for (let count = 0; count < formats.length; count += 1) { const { data } = await analyze({ otherText: "What happened? This is your fault. Nothing more to say.", language: "en" }); assert.equal(data.mode, "ai"); }
  });
  await t.test("fewer than three valid AI interaction steps preserve the local chain", async (t) => {
    const overlay = aiFixture({ interaction: [{ title: "Budget", insight: "A budget is proposed.", evidenceIds: ["E1"] }, { title: "Cost", insight: "A cost is disputed.", evidenceIds: ["E2"] }] });
    t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(overlay) } }] }));
    const { data } = await analyze({ otherText: cases.premarital.text, myText: cases.premarital.myText, language: "zh", context: "relationship" });
    assert.equal(data.mode, "ai"); assert.match(JSON.stringify(data.analysis.interactionPattern), /婚前|规则|消费|生育/);
  });
  await t.test("HTTP 429 becomes quota-labelled local analysis", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 })); const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "upstream_429"); assert.ok(data.analysis.keyAnnotations.length > 0);
  });
  await t.test("invalid output classifications stay distinct", async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: "not json" } }] })); const { data } = await analyze({ otherText: cases.harmDenial.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "invalid_output_json_syntax");
  });
  await t.test("timeout errors immediately switch to local analysis", async (t) => {
    t.mock.method(globalThis, "fetch", async () => { throw new DOMException("timed out", "AbortError"); });
    const { data } = await analyze({ otherText: cases.familyMoney.text, language: "zh", context: "family" });
    assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "timeout");
  });
  await t.test("the server hard deadline wins without waiting for a hanging fetch", async (t) => {
    let scheduledDelay = 0; let cleared = false;
    t.mock.method(globalThis, "setTimeout", (callback, delay) => { scheduledDelay = Number(delay); queueMicrotask(callback); return 77; });
    t.mock.method(globalThis, "clearTimeout", (handle) => { if (handle === 77) cleared = true; });
    t.mock.method(globalThis, "fetch", async () => new Promise(() => {}));
    const { data } = await analyze({ otherText: cases.premarital.text, myText: cases.premarital.myText, language: "zh", context: "relationship" });
    assert.equal(scheduledDelay, 45_000); assert.equal(data.mode, "local"); assert.equal(data.analysis.statusReason, "timeout"); assert.equal(cleared, true); assert.ok(data.analysis.reasonableParts.length > 0);
  });
  await t.test("Chinese and English locale instructions and fallbacks stay aligned", async (t) => {
    const prompts = []; t.mock.method(globalThis, "fetch", async (_url, init) => { prompts.push(JSON.parse(init.body).messages); return new Response(null, { status: 429 }); });
    const zh = await analyze({ otherText: "我们一起把预算算清楚。", language: "zh", context: "relationship" });
    const en = await analyze({ otherText: "Let us work out the budget together.", language: "en", context: "relationship" });
    assert.match(prompts[0][0].content, /natural Simplified Chinese/); assert.match(prompts[0][1].content, /Language: zh/);
    assert.match(prompts[1][0].content, /natural English/); assert.match(prompts[1][1].content, /Language: en/);
    assert.match(zh.data.analysis.overview, /[\u3400-\u9fff]/); assert.doesNotMatch(en.data.analysis.overview, /[\u3400-\u9fff]/);
  });
  clearConfig();
});

test("loading experience stays client-only and bounded", async () => {
  const routeSource = await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
  const loadingSource = await readFile(new URL("../app/lib/analysis-loading-messages.ts", import.meta.url), "utf8");
  const checkerSource = await readFile(new URL("../app/components/english-checker.tsx", import.meta.url), "utf8");
  const resultSource = await readFile(new URL("../app/components/conversation-analysis-result.tsx", import.meta.url), "utf8");
  const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const chineseMessages = [...loadingSource.matchAll(/^\s*\["([^"]+)",\s*"[^"]+"\],?$/gm)].map((match) => match[1]);
  assert.ok(chineseMessages.length >= 30); assert.equal(new Set(chineseMessages).size, chineseMessages.length); assert.doesNotMatch(loadingSource, /乳腺增生|必须离开|一定在操控/);
  const bilingualRows = [...loadingSource.matchAll(/^\s*\["([^"]+)",\s*"([^"]+)"\],?$/gm)];
  assert.equal(bilingualRows.length, chineseMessages.length); assert.ok(bilingualRows.every(([, zh, en]) => zh && en));
  assert.match(routeSource, /SERVER_AI_TIMEOUT_MS = 45_000/); assert.match(routeSource, /Promise\.race/); assert.match(routeSource, /max_tokens: 900/); assert.doesNotMatch(routeSource, /reasoning\s*:/); assert.doesNotMatch(routeSource, /70_?000|75_?000|900_?000|954_?000/);
  assert.match(loadingSource, /slice\(-6\)/); assert.match(checkerSource, /CLIENT_ANALYSIS_TIMEOUT_MS = 50_000/); assert.match(checkerSource, /Promise\.race/); assert.doesNotMatch(checkerSource, /70_?000|75_?000|900_?000|954_?000/); assert.match(checkerSource, /正在分析，不是页面卡住了/); assert.match(checkerSource, /Analysis is running — the page is not stuck/); assert.match(checkerSource, /elapsed >= 6/); assert.match(checkerSource, /正在仔细读这段对话/); assert.match(checkerSource, /Reading this conversation carefully/); assert.match(checkerSource, /analysis-loading-messages/);
  assert.equal((checkerSource.match(/fetch\("\/api\/analyze"/g) || []).length, 1); assert.doesNotMatch(checkerSource, /ANALYSIS_LOADING_MESSAGES.*JSON\.stringify/s);
  assert.doesNotMatch(checkerSource, /DetectiveMark|detective-person|detective-hat/); assert.match(checkerSource, /ConversationScan|scan-paper|scan-light/);
  assert.match(checkerSource, /requestId\.current !== currentRequest/); assert.match(checkerSource, /setAnalysis\(localAnalysis\)/); assert.match(checkerSource, /已保留基础分析/); assert.match(resultSource, /analysis-mode-banner/); assert.match(resultSource, /深度分析暂未完成/);
  assert.match(resultSource, /analysis\.keyAnnotations\.length > 0/); assert.match(resultSource, /analysis\.nextStepOptions\.length > 0/); assert.match(cssSource, /textarea::placeholder[^}]+font-style:italic/);
  for (const title of ["What happened", "One thing to hold onto first", "How this conversation pulls you away from the original issue", "What the conversation is pushing", "What is reasonable", "What deserves attention", "Key annotations", "Steady yourself first", "What you could do next", "Risk level"]) assert.match(resultSource, new RegExp(title));
  for (const title of ["发生了什么", "先说清楚一件事", "这段对话是怎么一步步把你带走的", "对方在推动什么", "合理的部分", "值得警惕的部分", "重点批注", "先把自己站稳", "下一步可以怎么做", "风险等级"]) assert.match(resultSource, new RegExp(title));
  assert.match(resultSource, /riskLabel\(analysis\.risk\.level, language\)/); assert.match(resultSource, /confidenceLabel\(item\.confidence, language\)/);
  assert.match(cssSource, /prefers-reduced-motion/); assert.match(cssSource, /analysis-loading/);
});
