import type { Metadata } from "next";
import "@fontsource/zcool-kuaile/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-700.css";
import "lxgw-wenkai-webfont/lxgwwenkai-regular.css";
import "@fontsource/noto-serif-sc/chinese-simplified-400.css";
import "@fontsource/noto-serif-sc/chinese-simplified-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grow Into Yourself | Relationship clarity tool",
  description: "A privacy-first relationship clarity tool for separating facts, emotional pressure and safety signals in difficult conversations.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
