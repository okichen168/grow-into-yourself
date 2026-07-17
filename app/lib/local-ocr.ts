type OcrBox = { x0: number; y0: number; x1: number; y1: number };
type OcrLine = { text: string; bbox: OcrBox };
type OcrPage = { text: string; blocks: Array<{ paragraphs: Array<{ lines: OcrLine[] }> }> | null };

const chromeNoise = /^(微信|wechat|whatsapp|instagram|messenger|messages?|短信|返回|更多|发送|send|typing|online|delivered|read|已读|正在输入|相册|照片|photo|camera|语音|voice|视频|video|wifi|5g|4g|lte|vpn|[▮▯◼◻●○·•]+)$/i;
const clockOnly = /^\d{1,2}:\d{2}(?:\s?[ap]m)?$/i;

function compact(line: string) {
  const cjk = "\\u3400-\\u9fff";
  return line.replace(new RegExp(`([${cjk}])\\s+(?=[${cjk}])`, "g"), "$1").replace(/\s+([，。！？；：、）】》])/g, "$1").replace(/([（【《])\s+/g, "$1").replace(/\s{2,}/g, " ").trim();
}

function fallback(raw: string) {
  return raw.replace(/\r/g, "").split("\n").map(compact).filter((line) => line && !chromeNoise.test(line)).reduce<string[]>((lines, line) => {
    const previous = lines.at(-1) ?? "";
    const startsSpeaker = /^(Me|Them|Partner|Family|Manager|Friend|Left side|Right side|我|对方|妈妈|爸爸|老板|同事|左侧|右侧)[：:]/i.test(line);
    if (!previous || startsSpeaker || /[。！？!?…]$/.test(previous)) lines.push(line);
    else lines[lines.length - 1] += line;
    return lines;
  }, []).join("\n").replace(/([。！？!?])(?=[^\n”’])/g, "$1\n").trim();
}

export function extractLocalOcrText(page: OcrPage, language: "en" | "zh") {
  const lines = page.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)) ?? [];
  if (!lines.length) return fallback(page.text);
  const pageWidth = Math.max(...lines.map((line) => line.bbox.x1), 1);
  const pageHeight = Math.max(...lines.map((line) => line.bbox.y1), 1);
  const leftLabel = language === "zh" ? "左侧" : "Left side";
  const rightLabel = language === "zh" ? "右侧" : "Right side";
  const output: string[] = [];
  let lastSide = "";

  for (const item of [...lines].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)) {
    const text = compact(item.text);
    if (!text || chromeNoise.test(text)) continue;
    const nearStatusBar = item.bbox.y0 < pageHeight * .1;
    if (nearStatusBar && (clockOnly.test(text) || /^(wifi|5g|4g|lte|vpn|\d{1,3}%?)$/i.test(text))) continue;
    const centre = (item.bbox.x0 + item.bbox.x1) / 2 / pageWidth;
    const side = centre < .46 ? leftLabel : centre > .54 ? rightLabel : "";
    if (!side) {
      output.push(clockOnly.test(text) ? `[${text}]` : text);
      lastSide = "";
      continue;
    }
    if (side !== lastSide) output.push(`${side}：${text}`);
    else output[output.length - 1] = `${output.at(-1)}${/[。！？!?…]$/.test(output.at(-1) ?? "") ? "\n" : ""}${text}`;
    lastSide = side;
  }
  return fallback(output.join("\n"));
}
