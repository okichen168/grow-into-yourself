import type { Metadata } from "next";
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
