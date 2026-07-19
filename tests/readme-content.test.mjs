import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("conversation analysis UI and rules acceptance", async () => {
  const [checker, result, guidelines, rules, css] = await Promise.all([
    readFile(new URL("../app/components/english-checker.tsx", import.meta.url), "utf8"), readFile(new URL("../app/components/conversation-analysis-result.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/conversation-analysis-guidelines.ts", import.meta.url), "utf8"), readFile(new URL("../app/lib/local-analysis-rules.ts", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(checker, /Clear this conversation and its analysis/); assert.match(checker, /清空这次输入和分析结果/); assert.match(checker, /setOtherText\(""\).*setMyText\(""\).*setAnalysis\(null\)/s); assert.doesNotMatch(checker, /setContext\("/);
  assert.match(result, /Local structured analysis/); assert.match(result, /证据边界/); assert.doesNotMatch(result, /Recommended reply|最推荐的回复|温和边界/);
  assert.match(guidelines, /Read the whole exchange first/); assert.match(guidelines, /Five compact calibration examples/); assert.match(guidelines, /Every judgment must cite exact input text/);
  for (const id of ["reality_erosion", "role_reversal", "conditional_acceptance", "contempt", "obedience_pressure", "social_location_control", "economic_control", "double_standard", "communication_shutdown", "relationship_rewrite", "workplace_bullying", "direct_safety"]) assert.match(rules, new RegExp(`id: "${id}"`));
  assert.match(css, /\.text-analyzer textarea::placeholder[^}]*font-style:italic[^}]*opacity:1/s); assert.match(css, /\.text-analyzer textarea \{[^}]*font-style:normal/s);
});
