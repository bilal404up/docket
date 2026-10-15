import type { Metadata, Viewport } from "next";
import { Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Public_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Docket: messy orders in, checked data out", template: "%s | Docket" },
  description: "A demo of an AI document intake tool. Orders arrive as PDFs, photos and emails. Docket reads them, checks them against a catalog and flags what a person should look at. Invented data.",
};
export const viewport: Viewport = { themeColor: "#F2F3F5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
