import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import CommandPalette from "@/components/CommandPalette";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex — 個人百科事典",
  description:
    "学んだことを1か所に貯めて、検索・つなげて・反復練習するための個人百科事典。Heptabase 型ホワイトボード + 百科事典 + SM-2 復習。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <Nav />
        <CommandPalette />
        {children}
      </body>
    </html>
  );
}
