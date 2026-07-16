import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Relationship patterns guide | Grow Into Yourself",
  description: "Practical, non-diagnostic guides to relationship pressure, coercive control, workplace bullying and emotional wellbeing.",
};

export default function LearnLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
