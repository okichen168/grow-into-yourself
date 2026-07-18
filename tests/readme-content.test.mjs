import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("acceptance copy describes the text-first flow and recommended reply", async () => {
  const [english, chinese, checker] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../README.zh-CN.md", import.meta.url), "utf8"),
    readFile(new URL("../app/components/english-checker.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(english, /Why this exists/);
  assert.match(chinese, /为什么要做它/);
  assert.doesNotMatch(english, /local screenshot-reading|local OCR|screenshots are processed locally/i);
  assert.doesNotMatch(chinese, /截图本机识别|截图仅在当前设备处理|全部本地 AI 分析/);
  assert.match(checker, /Recommended reply/);
  assert.match(checker, /最推荐的回复/);
  assert.match(checker, /analysis\.suggestedReply/);
});
