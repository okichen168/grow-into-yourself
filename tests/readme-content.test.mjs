import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("conversation analysis UI and guidelines acceptance", async () => {
  const [checker, result, guidelines, css] = await Promise.all([
    readFile(new URL("../app/components/english-checker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/conversation-analysis-result.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/conversation-analysis-guidelines.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(checker, /Clear this conversation/);
  assert.match(checker, /清空本次内容/);
  assert.match(checker, /setOtherText\(""\).*setMyText\(""\).*setAnalysis\(null\)/s);
  assert.doesNotMatch(checker, /setContext\([^n]/);
  assert.match(checker, /Deep analysis is temporarily unavailable/);
  assert.match(checker, /深度分析暂时不可用/);
  assert.match(result, /AI 深度分析/);
  assert.match(result, /AI analysis/);
  assert.doesNotMatch(result, /Recommended reply|最推荐的回复|Soft boundary|温和边界/);
  assert.match(guidelines, /Read the whole exchange before analysing any line/);
  assert.match(guidelines, /Family control/);
  assert.match(guidelines, /Premarital finance/);
  assert.match(css, /\.text-analyzer textarea::placeholder[^}]*font-style:italic[^}]*opacity:1/s);
  assert.match(css, /\.text-analyzer textarea \{[^}]*font-style:normal/s);
});
