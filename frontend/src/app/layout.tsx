import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoBot — 20 Agent Command Center",
  description: "Smart Learning Dashboard for 20-Agent Autonomous Trading System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
