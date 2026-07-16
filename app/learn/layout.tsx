import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "通俗心理科普 | 长成自己",
  description: "用简单的话理解情感操控、强制控制、DARVO、NPD、冷处理、友情背叛和职场霸凌。",
};

export default function LearnLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
