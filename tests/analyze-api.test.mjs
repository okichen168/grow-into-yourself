import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("analyze-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const assets = { fetch: async () => new Response("Not found", { status: 404 }) };
const context = { waitUntil() {}, passThroughOnException() {} };

async function analyze(body, { ip = "198.51.100.1", expectedStatus = 200 } = {}) {
  const response = await worker.fetch(new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  }), { ASSETS: assets }, context);
  assert.equal(response.status, expectedStatus);
  return { data: await response.json(), response };
}

const validModelResult = {
  summary: "This is a specific but non-diagnostic reading of the conversation.",
  pressureSignals: ["The request includes blame rather than a clear fact."],
  myPattern: ["The reply may be over-explaining."],
  sentenceAnalysis: [{
    original: "This is all your fault.",
    pressure: "It assigns total responsibility.",
    whyItHurts: "It leaves no room to examine what actually happened.",
    clearerReading: "A conflict can involve shared responsibility and verifiable facts.",
  }],
  replyOptions: {
    soft: "I can discuss the facts without blame.",
    firm: "I will not continue while I am being blamed for everything.",
    exit: "I am pausing this conversation now.",
  },
  suggestedReply: "I can discuss the facts without blame.",
  riskLevel: "Low",
  urgentWarning: "",
};

test("analysis route fallback and model behaviour", async (t) => {
  await t.test("returns local fallback when no key is configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { data } = await analyze({ otherText: "You are too sensitive.", myText: "", language: "en", context: "relationship" }, { ip: "198.51.100.2" });
    assert.equal(data.fallback, true);
    assert.equal(data.analysis.source, "local");
  });

  await t.test("returns local fallback when the model request fails", async (t) => {
    process.env.OPENROUTER_API_KEY = "test-only-key";
    t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
    const { data } = await analyze({ otherText: "You always make everything my fault.", myText: "", language: "en", context: "relationship" }, { ip: "198.51.100.3" });
    assert.equal(data.fallback, true);
    assert.equal(data.analysis.source, "local");
  });

  await t.test("returns a complete structured model result", async (t) => {
    process.env.OPENROUTER_API_KEY = "test-only-key";
    t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: JSON.stringify(validModelResult) } }] }));
    const { data } = await analyze({ otherText: "This is all your fault.", myText: "I am sorry.", language: "en", context: "relationship" }, { ip: "198.51.100.4" });
    assert.equal(data.fallback, false);
    assert.equal(data.analysis.source, "ai");
    assert.ok(data.analysis.suggestedReply);
    assert.deepEqual(Object.keys(data.analysis).sort(), ["myPattern", "pressureSignals", "replyOptions", "riskLevel", "sentenceAnalysis", "source", "suggestedReply", "summary", "urgentWarning"].sort());
    assert.deepEqual(Object.keys(data.analysis.replyOptions).sort(), ["exit", "firm", "soft"]);
  });

  await t.test("does not show an urgent warning for an ordinary disagreement", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { data } = await analyze({ otherText: "I disagree about where we should eat tonight.", myText: "Let's decide later.", language: "en", context: "relationship" }, { ip: "198.51.100.5" });
    assert.equal(data.analysis.urgentWarning, "");
    assert.notEqual(data.analysis.riskLevel, "Urgent");
  });

  await t.test("shows an urgent warning for an explicit threat", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { data } = await analyze({ otherText: "If you leave, I will kill you.", myText: "", language: "en", context: "relationship" }, { ip: "198.51.100.6" });
    assert.notEqual(data.analysis.urgentWarning, "");
    assert.equal(data.analysis.riskLevel, "Urgent");

    const { data: chineseData } = await analyze({ otherText: "你敢走，我就杀了你。", myText: "", language: "zh", context: "relationship" }, { ip: "198.51.100.8" });
    assert.notEqual(chineseData.analysis.urgentWarning, "");
    assert.equal(chineseData.analysis.riskLevel, "紧急");
  });

  await t.test("returns 429 after five requests from one address", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const body = { otherText: "We disagree about dinner.", myText: "", language: "en", context: "relationship" };
    for (let index = 0; index < 5; index += 1) {
      await analyze(body, { ip: "198.51.100.7" });
    }
    const { data, response } = await analyze(body, { ip: "198.51.100.7", expectedStatus: 429 });
    assert.equal(response.headers.get("retry-after"), "60");
    assert.match(data.error, /too many requests/i);
  });

  delete process.env.OPENROUTER_API_KEY;
});
