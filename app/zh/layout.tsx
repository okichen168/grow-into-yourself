import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "长成自己｜关系与对话辨识工具",
  description: "帮助你分开事实、情绪压力与安全信号，不隔着屏幕给任何人下诊断。",
};

export default function ChineseLayout({ children }: { children: ReactNode }) {
  return children;
}
