"use client";

import { useEffect, useState } from "react";

const sectionMap: Record<string, string> = {
  "#check": "#tool",
  "#tool": "#check",
  "#help": "#safety",
  "#safety": "#help",
};

export default function LanguageSwitch({ language }: { language: "en" | "zh" }) {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const targetHash = sectionMap[hash] ?? hash;
  const base = language === "en" ? "/zh" : "/";
  return <a href={`${base}${targetHash}`}>{language === "en" ? "中文" : "English"}</a>;
}
