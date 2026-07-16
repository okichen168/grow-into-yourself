"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const themes = [
  { id: "embrace", colors: ["#e88d92", "#fff8f2", "#c9b8df"] },
  { id: "breath", colors: ["#759b89", "#f6f2e9", "#cbd9cf"] },
  { id: "moon", colors: ["#6f98bd", "#f4f9fd", "#b7d3e6"] },
  { id: "sunny", colors: ["#df8a55", "#fff8e8", "#f2cf7d"] },
  { id: "night", colors: ["#8f88c9", "#292b43", "#777ca7"] },
];

const fonts = [
  { id: "system", name: "System Sans" },
  { id: "serif", name: "Georgia" },
  { id: "humanist", name: "Trebuchet" },
  { id: "mono", name: "Aptos Mono" },
];

export default function ThemeControls() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => typeof window === "undefined" ? "embrace" : localStorage.getItem("grow-theme") || "embrace");
  const [font, setFont] = useState(() => typeof window === "undefined" ? "system" : localStorage.getItem("grow-font") || "system");

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
      <button className="theme-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>◐ <span>Appearance</span></button>
      {open && typeof document !== "undefined" && createPortal(<><button className="theme-scrim" onClick={() => setOpen(false)} aria-label="Close appearance picker" /><div className="theme-panel" role="dialog" aria-modal="true" aria-label="Appearance settings">
        <div className="theme-panel-head"><strong>Make this space yours</strong><button onClick={() => setOpen(false)} aria-label="Close">×</button></div>
        <p>Theme and type preferences stay on this device. They are not linked to your chats.</p>
        <span className="choice-label">Colour</span>
        <div className="theme-options">{themes.map((item, index) => <button aria-label={`Switch to colour theme ${index + 1}`} className={theme === item.id ? "selected" : ""} onClick={() => chooseTheme(item.id)} key={item.id}><i>{item.colors.map((color) => <b style={{ background: color }} key={color} />)}</i></button>)}</div>
        <span className="choice-label">Type</span>
        <div className="font-options">{fonts.map((item) => <button data-font-preview={item.id} className={font === item.id ? "selected" : ""} onClick={() => chooseFont(item.id)} key={item.id}>{item.name}</button>)}</div>
      </div></>, document.body)}
    </div>
  );
}
