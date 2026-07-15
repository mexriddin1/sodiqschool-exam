import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sodiq School — Onlayn test",
  description: "Sodiq School qabul testlari",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        />
        {/* Brend shriftlari — birinchi bo'yoqda matn sakramasligi uchun. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/Pragmatica-400.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/SpaceMono-700.woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
