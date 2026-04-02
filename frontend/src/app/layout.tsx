import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "CryptoBot - 25 Agent Autonomous Trading System",
  description:
    "Smart Learning Dashboard for 25-Agent Autonomous Crypto Trading System with Self-Learning AI",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="ml-16 lg:ml-56 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
