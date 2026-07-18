"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const themes = [
  { id: "embrace", zh: "暖粉", colors: ["#e88d92", "#fff8f2", "#c9b8df"] },
  { id: "breath", zh: "草木绿", colors: ["#759b89", "#f6f2e9", "#cbd9cf"] },
  { id: "moon", zh: "海岸蓝", colors: ["#6f98bd", "#f4f9fd", "#b7d3e6"] },
  { id: "sunny", zh: "日光黄", colors: ["#df8a55", "#fff8e8", "#f2cf7d"] },
  { id: "night", zh: "月夜紫", colors: ["#8f88c9", "#292b43", "#777ca7"] },
];

const englishFonts = [
  { id: "system", name: "System Sans" },
  { id: "serif", name: "Georgia" },
  { id: "humanist", name: "Trebuchet" },
  { id: "mono", name: "Aptos Mono" },
];

const chineseFonts = [
  { id: "soft", name: "圆体" },
  { id: "clear", name: "黑体" },
  { id: "kai", name: "楷体" },
  { id: "reading", name: "宋体" },
];

const fontStacks: Record<string, string> = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  humanist: '"Trebuchet MS", Arial, sans-serif',
  mono: '"Aptos Mono", "SFMono-Regular", Consolas, monospace',
  soft: 'ui-rounded, "PingFang SC", "Hiragino Sans GB", sans-serif',
  clear: '"PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "KaiTi_GB2312", cursive',
  reading: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
};

const fontCandidates: Record<string, string[]> = {
  soft: ['"PingFang SC"', '"Hiragino Sans GB"'],
  clear: ['"PingFang SC"', '"Helvetica Neue"', '"Microsoft YaHei"'],
  kai: ['"Kaiti SC"', '"STKaiti"', '"KaiTi"', '"KaiTi_GB2312"'],
  reading: ['"Songti SC"', '"STSong"', '"SimSun"', '"Noto Serif CJK SC"'],
};

const genericFallbacks: Record<string, string> = {
  soft: "ui-rounded",
  clear: "sans-serif",
  kai: "cursive",
  reading: "serif",
};

function detectAvailableFont(fontId: string) {
  if (typeof document === "undefined" || !document.fonts?.check) return genericFallbacks[fontId] || "system";
  return fontCandidates[fontId]?.find((candidate) => document.fonts.check(`16px ${candidate}`, "长成自己"))
    || genericFallbacks[fontId]
    || "system";
}

export default function ThemeControls({ language = "en" }: { language?: "zh" | "en" }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => typeof window === "undefined" ? "embrace" : localStorage.getItem("grow-theme") || "embrace");
  const fonts = language === "zh" ? chineseFonts : englishFonts;
  const defaultFont = language === "zh" ? "soft" : "system";
  const [font, setFont] = useState(() => typeof window === "undefined" ? defaultFont : localStorage.getItem(`grow-font-${language}`) || defaultFont);
  const resolvedFont = fonts.some((item) => item.id === font) ? font : defaultFont;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("grow-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = resolvedFont;
    document.documentElement.dataset.fontResolved = detectAvailableFont(resolvedFont).replaceAll('"', "");
    document.documentElement.style.setProperty("--app-font", fontStacks[resolvedFont] || fontStacks[defaultFont]);
    document.body.dataset.font = resolvedFont;
    document.body.style.fontFamily = fontStacks[resolvedFont] || fontStacks[defaultFont];
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    localStorage.setItem(`grow-font-${language}`, resolvedFont);
  }, [defaultFont, language, resolvedFont]);

  function chooseTheme(next: string) {
    setTheme(next);
  }

  function chooseFont(next: string) {
    setFont(next);
    if (typeof document !== "undefined") {
      const stack = fontStacks[next] || fontStacks[defaultFont];
      document.documentElement.setAttribute("data-font", next);
      document.documentElement.setAttribute("data-font-resolved", detectAvailableFont(next).replaceAll('"', ""));
      document.documentElement.style.setProperty("--app-font", stack);
      document.body.setAttribute("data-font", next);
      document.body.style.setProperty("font-family", stack);
      localStorage.setItem(`grow-font-${language}`, next);
    }
  }

  return (
    <div className="theme-control">
      <button type="button" className="theme-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>◐ <span>{language === "zh" ? "换个感觉" : "Appearance"}</span></button>
      {open && typeof document !== "undefined" && createPortal(<><button type="button" className="theme-scrim" onClick={() => setOpen(false)} aria-label={language === "zh" ? "关闭主题选择" : "Close appearance picker"} /><div className="theme-panel" role="dialog" aria-modal="true" aria-label={language === "zh" ? "主题与字体设置" : "Appearance settings"} onClick={(event) => event.stopPropagation()}>
        <div className="theme-panel-head"><strong>{language === "zh" ? "选一个让你舒服的界面" : "Make this space yours"}</strong><button type="button" onClick={() => setOpen(false)} aria-label={language === "zh" ? "关闭" : "Close"}>×</button></div>
        <p>{language === "zh" ? "颜色和字体只保存在当前设备，不会和聊天内容关联。" : "Theme and type preferences stay on this device. They are not linked to your chats."}</p>
        <span className="choice-label">{language === "zh" ? "颜色" : "Colour"}</span>
        <div className="theme-options">{themes.map((item, index) => <button type="button" aria-label={language === "zh" ? `切换到${item.zh}主题` : `Switch to colour theme ${index + 1}`} className={theme === item.id ? "selected" : ""} onClick={() => chooseTheme(item.id)} key={item.id}><i>{item.colors.map((color) => <b style={{ background: color }} key={color} />)}</i></button>)}</div>
        <span className="choice-label">{language === "zh" ? "字体" : "Type"}</span>
        <div className="font-options">{fonts.map((item) => <button type="button" data-font-preview={item.id} className={resolvedFont === item.id ? "selected" : ""} onClick={() => chooseFont(item.id)} key={item.id}>{item.name}</button>)}</div>
      </div></>, document.body)}
    </div>
  );
}
