import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FONT_CLASSNAMES } from "./fonts";

export const metadata: Metadata = {
  title: "Agentic Whiteboard v2",
  description: "A workspace read through one capability.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={FONT_CLASSNAMES}>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
