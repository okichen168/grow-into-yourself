import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("analyze-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const assets = { fetch: async () => new Response("Not found", { status: 404 }) };
const context = { waitUntil() {}, passThroughOnException() {} };

let ipCounter = 20;
async function analyze(body, { ip = `198.51.100.${ipCounter += 1}`, expectedStatus = 200 } = {}) {
  const response = await worker.fetch(new Request("http://localhost/api/analyze", {
    method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(body),
  }), { ASSETS: assets }, context);
  assert.equal(response.status, expectedStatus);
  return { data: await response.json(), response };
}

function fixture(overrides = {}) {
  return {
    mode: "ai",
    overview: "The exchange moves from a practical disagreement into pressure about what the user should accept.",
    interactionPattern: { title: "Question, blame, then withdrawal", steps: ["A practical question is raised", "Responsibility shifts", "The conversation closes"], explanation: "The order matters because the original question is never answered." },
    whatTheyArePushing: [{ point: "Accept sole responsibility for the conflict", evidence: ["This is all your fault"], certainty: "clear" }],
    reasonableParts: [],
    concerningParts: [{ label: "Blame shift", explanation: "One person assigns the whole conflict to the other without naming a concrete action.", severity: "pressure" }],
    keyAnnotations: [
      { quotes: ["This is all your fault"], tags: ["blame"], keyPoint: "The statement skips shared facts and assigns a total conclusion.", grounding: "A disagreement can involve more than one person's choices.", uncertainty: "The wider history is not shown." },
      { quotes: ["I have nothing else to say"], tags: ["withdrawal"], keyPoint: "The exit ends the discussion before the practical issue is examined.", grounding: "An ended conversation is not the same as a resolved one.", uncertainty: "This could also be a temporary pause." },
    ],
    selfGrounding: ["You can separate what happened from a total judgment about you."],
    nextStepOptions: [{ type: "no_reply", title: "Pause", reason: "There is no clear question that needs an immediate answer.", message: "" }],
    risk: { level: "Low", reasons: ["No explicit real-world danger appears in the text."], urgentWarning: "" },
    ...overrides,
  };
}

function mockModel(t, result, capture) {
  process.env.OPENROUTER_API_KEY = "test-only-key";
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    if (capture) capture(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  });
}

test("conversation analysis API", async (t) => {
  await t.test("returns only an unavailable state when no key is configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { data } = await analyze({ otherText: "You are too sensitive.", language: "en" });
    assert.equal(data.mode, "unavailable");
    assert.equal(data.label, "Basic mode");
    assert.equal(data.analysis, undefined);
  });

  await t.test("returns only an unavailable state when the model request fails", async (t) => {
    process.env.OPENROUTER_API_KEY = "test-only-key";
    t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
    const { data } = await analyze({ otherText: "You always make everything my fault.", language: "en" });
    assert.equal(data.mode, "unavailable");
    assert.equal(data.analysis, undefined);
  });

  await t.test("requests strict structured output and returns the complete structure", async (t) => {
    let requestBody;
    mockModel(t, fixture(), (body) => { requestBody = body; });
    const { data } = await analyze({ otherText: "This is all your fault. I have nothing else to say.", language: "en", context: "relationship" });
    assert.equal(requestBody.model, "openrouter/free");
    assert.equal(requestBody.response_format.type, "json_schema");
    assert.equal(requestBody.response_format.json_schema.strict, true);
    assert.equal(data.analysis.mode, "ai");
    assert.deepEqual(Object.keys(data.analysis).sort(), ["mode", "overview", "interactionPattern", "whatTheyArePushing", "reasonableParts", "concerningParts", "keyAnnotations", "selfGrounding", "nextStepOptions", "risk"].sort());
  });

  await t.test("a respectful breakup does not acquire stock shame or threat claims", async (t) => {
    const breakup = fixture({
      overview: "This reads as an emotionally distant breakup with gaps in the explanation, not clear evidence of coercion.",
      interactionPattern: { title: "Distance, broad conclusion, ending", steps: ["Pressure is mentioned", "Limited communication becomes a conclusion about love", "The relationship is ended"], explanation: "The missing middle is how communication difficulty became proof that the relationship was not love." },
      whatTheyArePushing: [], reasonableParts: ["A person may decide to end a relationship without proving wrongdoing."], concerningParts: [],
      keyAnnotations: fixture().keyAnnotations.map((item, index) => ({ ...item, keyPoint: index ? "The farewell is clear even though the explanation stays broad." : "The conclusion about love is stronger than the reasons given." })),
      nextStepOptions: [],
    });
    mockModel(t, breakup);
    const { data } = await analyze({ otherText: "I am under pressure and perhaps this is not love. I wish you well.", language: "en" });
    const text = JSON.stringify(data.analysis);
    assert.doesNotMatch(text, /filial|obedience|threat|humiliat/i);
  });

  await t.test("a family-control case keeps the chain grouped instead of one card per sentence", async (t) => {
    const family = fixture({
      interactionPattern: { title: "Economic questioning becomes a return-home demand", steps: ["Income is questioned", "The city and work choice are devalued", "Family need creates guilt", "Location is requested", "The partner is discredited and returning home is framed as safest"], explanation: "Together these moves narrow the user's choices even if some concern is genuine." },
      keyAnnotations: [
        { quotes: ["工资多少", "在上海有什么用", "家里缺钱"], tags: ["经济盘问", "内疚"], keyPoint: "Three remarks combine money, choice and family need into one pressure sequence.", grounding: "Concern about money does not decide where an adult must live.", uncertainty: "The family's actual finances are not known." },
        { quotes: ["发位置", "只有父母真心", "他不可靠"], tags: ["定位", "排他式亲情"], keyPoint: "The location request gains force from discrediting outside support.", grounding: "A precise location can be declined even within a caring family.", uncertainty: "The reason for asking is not fully shown." },
      ],
    });
    mockModel(t, family);
    const { data } = await analyze({ otherText: "工资多少？上海有什么用？家里缺钱。发位置。他不可靠，只有父母真心，回来。", language: "en", context: "family" });
    assert.equal(data.analysis.interactionPattern.steps.length, 5);
    assert.equal(data.analysis.keyAnnotations.length, 2);
  });

  await t.test("a harm-denial case retains denial, reversal and caregiving debt", async (t) => {
    const denial = fixture({
      concerningParts: [
        { label: "否认与反咬", explanation: "伤害被否认后，提出伤害的人反而被描述成冤枉别人。", severity: "pressure" },
        { label: "养育恩情压制", explanation: "学费被用来抵销对具体打骂的讨论。", severity: "pressure" },
      ],
      keyAnnotations: fixture().keyAnnotations.map((item, index) => ({ ...item, keyPoint: index ? "履行养育责任不能回答具体伤害是否发生。" : "不记得并不能证明事情没有发生。" })),
      risk: { level: "中", reasons: ["持续否认和人格攻击会削弱现实感。"], urgentWarning: "" },
    });
    mockModel(t, denial);
    const { data } = await analyze({ otherText: "什么时候打你了？我不记得。公主病。交学费的时候怎么不难受。白眼狼。", language: "zh", context: "family" });
    const text = JSON.stringify(data.analysis);
    assert.match(text, /否认与反咬/);
    assert.match(text, /养育恩情压制/);
  });

  await t.test("premarital planning can contain both reasonable and unequal parts", async (t) => {
    const planning = fixture({
      reasonableParts: ["提前讨论共同预算、父母赡养和支出比例是有必要的。"],
      concerningParts: [{ label: "规则是否双向", explanation: "需要确认消费标准和社交融入是否对双方一致。", severity: "notice" }],
      risk: { level: "低", reasons: [], urgentWarning: "" },
    });
    mockModel(t, planning);
    const { data } = await analyze({ otherText: "婚后按比例支出，你要控制消费并进入我的朋友圈。生育不需要补偿。", language: "zh" });
    assert.ok(data.analysis.reasonableParts.length > 0);
    assert.ok(data.analysis.concerningParts.length > 0);
  });

  await t.test("duplicate annotation text is removed and annotations never exceed six", async (t) => {
    const repeated = fixture();
    repeated.keyAnnotations = Array.from({ length: 8 }, (_, index) => ({ ...repeated.keyAnnotations[index % 2], keyPoint: index < 2 ? repeated.keyAnnotations[0].keyPoint : `Specific point ${index}` }));
    mockModel(t, repeated);
    const { data } = await analyze({ otherText: "A repeated argument with several related lines.", language: "en" });
    assert.ok(data.analysis.keyAnnotations.length <= 6);
    assert.equal(data.analysis.keyAnnotations.filter((item) => item.keyPoint === repeated.keyAnnotations[0].keyPoint).length, 1);
  });

  await t.test("next steps may be empty", async (t) => {
    mockModel(t, fixture({ nextStepOptions: [] }));
    const { data } = await analyze({ otherText: "I have decided to end this relationship. I wish you well.", language: "en" });
    assert.deepEqual(data.analysis.nextStepOptions, []);
  });

  await t.test("not replying is a valid next step", async (t) => {
    mockModel(t, fixture({ nextStepOptions: [{ type: "no_reply", title: "Wait", reason: "There is no immediate question to answer.", message: "" }] }));
    const { data } = await analyze({ otherText: "I am not discussing this further.", language: "en" });
    assert.equal(data.analysis.nextStepOptions[0].type, "no_reply");
    assert.equal(data.analysis.nextStepOptions[0].message, "");
  });

  await t.test("an ordinary disagreement is not upgraded to urgent", async (t) => {
    mockModel(t, fixture({ risk: { level: "Urgent", reasons: ["The model was over-cautious."], urgentWarning: "Call emergency services." } }));
    const { data } = await analyze({ otherText: "I disagree about where we should eat tonight.", language: "en" });
    assert.equal(data.analysis.risk.level, "High");
    assert.equal(data.analysis.risk.urgentWarning, "");
  });

  await t.test("an explicit threat is upgraded to urgent", async (t) => {
    mockModel(t, fixture({ risk: { level: "Low", reasons: [], urgentWarning: "" } }));
    const { data } = await analyze({ otherText: "If you leave, I will kill you.", language: "en" });
    assert.equal(data.analysis.risk.level, "Urgent");
    assert.notEqual(data.analysis.risk.urgentWarning, "");
  });

  await t.test("rate limiting still returns 429", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ip = "198.51.100.250";
    const body = { otherText: "We disagree about dinner.", language: "en" };
    for (let index = 0; index < 5; index += 1) await analyze(body, { ip });
    const { response } = await analyze(body, { ip, expectedStatus: 429 });
    assert.equal(response.headers.get("retry-after"), "60");
  });

  delete process.env.OPENROUTER_API_KEY;
});
