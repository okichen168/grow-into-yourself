"use client";

import { useEffect, useState } from "react";

const themes = [
  { id: "embrace", name: "公主房", colors: ["#e88d92", "#fff8f2", "#c9b8df"] },
  { id: "breath", name: "草原树", colors: ["#759b89", "#f6f2e9", "#cbd9cf"] },
  { id: "moon", name: "海岸风", colors: ["#6f98bd", "#f4f9fd", "#b7d3e6"] },
  { id: "sunny", name: "日光房", colors: ["#df8a55", "#fff8e8", "#f2cf7d"] },
  { id: "night", name: "紫月夜", colors: ["#8f88c9", "#292b43", "#777ca7"] },
];

const fonts = [
  { id: "soft", name: "圆体", en: "Soft" },
  { id: "clear", name: "黑体", en: "Clear" },
  { id: "kai", name: "楷体", en: "Kai" },
  { id: "reading", name: "宋体", en: "Reading" },
];

export default function ThemeControls({ language = "zh" }: { language?: "zh" | "en" }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => typeof window === "undefined" ? "embrace" : localStorage.getItem("grow-theme") || "embrace");
  const [font, setFont] = useState(() => typeof window === "undefined" ? "soft" : localStorage.getItem("grow-font") || "soft");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("grow-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem("grow-font", font);
  }, [font]);

  function chooseTheme(next: string) {
    setTheme(next);
  }

  function chooseFont(next: string) {
    setFont(next);
  }

  return (
    <div className="theme-control">
      <button className="theme-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>◐ <span>{language === "en" ? "Change the mood" : "换个感觉"}</span></button>
      {open && <div className="theme-panel">
        <div className="theme-panel-head"><strong>{language === "en" ? "Pick what feels easy on the eyes" : "选一个让你舒服的界面"}</strong><button onClick={() => setOpen(false)} aria-label={language === "en" ? "Close" : "关闭"}>×</button></div>
        <p>{language === "en" ? "Your theme stays on this device. It isn’t linked to your chats." : "颜色和字体只保存在当前设备，不会和你的聊天内容关联。"}</p>
        <span className="choice-label">{language === "en" ? "Colour" : "颜色"}</span>
        <div className="theme-options">{themes.map((item) => <button aria-label={language === "en" ? `Switch colour theme ${item.id}` : `切换到${item.name}主题`} className={theme === item.id ? "selected" : ""} onClick={() => chooseTheme(item.id)} key={item.id}><i>{item.colors.map((color) => <b style={{ background: color }} key={color} />)}</i></button>)}</div>
        <span className="choice-label">{language === "en" ? "Type" : "字体"}</span>
        <div className="font-options">{fonts.map((item) => <button data-font-preview={item.id} className={font === item.id ? "selected" : ""} onClick={() => chooseFont(item.id)} key={item.id}>{language === "en" ? item.en : item.name}</button>)}</div>
      </div>}
    </div>
  );
}
