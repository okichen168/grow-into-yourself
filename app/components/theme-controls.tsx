"use client";

import { useEffect, useState } from "react";

const themes = [
  { id: "embrace", name: "拥抱", colors: ["#e88d92", "#fff8f2", "#c9b8df"] },
  { id: "breath", name: "呼吸", colors: ["#759b89", "#f6f2e9", "#cbd9cf"] },
  { id: "moon", name: "月光", colors: ["#8d83bc", "#f8f6fb", "#b7c9df"] },
  { id: "sunny", name: "晴日", colors: ["#df8a55", "#fff8e8", "#f2cf7d"] },
  { id: "night", name: "夜航", colors: ["#8f88c9", "#202236", "#474c72"] },
];

const fonts = [
  { id: "soft", name: "柔和体" },
  { id: "clear", name: "清晰体" },
  { id: "reading", name: "阅读体" },
];

export default function ThemeControls() {
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
      <button className="theme-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>◐ <span>换个感觉</span></button>
      {open && <div className="theme-panel">
        <div className="theme-panel-head"><strong>选一个让你舒服的界面</strong><button onClick={() => setOpen(false)} aria-label="关闭">×</button></div>
        <p>颜色和字体只保存在当前设备，不会和你的聊天内容关联。</p>
        <span className="choice-label">颜色</span>
        <div className="theme-options">{themes.map((item) => <button className={theme === item.id ? "selected" : ""} onClick={() => chooseTheme(item.id)} key={item.id}><i>{item.colors.map((color) => <b style={{ background: color }} key={color} />)}</i><span>{item.name}</span></button>)}</div>
        <span className="choice-label">字体</span>
        <div className="font-options">{fonts.map((item) => <button className={font === item.id ? "selected" : ""} onClick={() => chooseFont(item.id)} key={item.id}>{item.name}</button>)}</div>
      </div>}
    </div>
  );
}
