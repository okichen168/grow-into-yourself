import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grow Into Yourself | A calmer look at difficult chats",
  description: "A private, friendly tool for checking pressure, manipulation and difficult relationship patterns — without labelling anyone.",
};

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
