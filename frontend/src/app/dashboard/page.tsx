"use client";

import { useEffect, useState } from "react";
import { useBinanceLive } from "@/hooks/useBinanceLive";

const API = "http://localhost:3002";
const PAIRS = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT",
  "DOGE/USDT", "AVAX/USDT", "LINK/USDT", "MATIC/USDT", "DOT/USDT", "LTC/USDT",
];

async function safeJson(url: string) {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

function PairTile({ pair }: { pair: string }) {
  const live = useBinanceLive(pair, "1m");
  const [pred, setPred] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [b, q] = pair.split("/");
      const d = await safeJson(`${API}/api/agent/predict/${b}/${q}?tf=5m`);
      if (alive && d) setPred(d);
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, [pair]);

  const price = live.price ?? pred?.currentPrice ?? 0;
  const change = live.change24h ?? 0;
  const sig = pred?.signal ?? "HOLD";
  const isBuy = sig.includes("BUY");
  const isSell = sig.includes("SELL");
  const sigColor = isBuy ? "text-green-400 border-green-500/50" : isSell ? "text-red-400 border-red-500/50" : "text-yellow-300 border-yellow-500/40";

  return (
    <div className={`border rounded p-3 bg-black ${sigColor.split(" ").slice(1).join(" ")}`}>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-bold tracking-widest">{pair}</span>
        <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${live.connected ? "border-green-400 text-green-400" : "border-yellow-400 text-yellow-400"}`}>
          <span className={`w-1 h-1 rounded-full ${live.connected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} /> WS
        </span>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">${price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 5 : 2 })}</div>
      <div className={`text-xs ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
        {change >= 0 ? "+" : ""}{change.toFixed(2)}%
      </div>
      <div className="mt-3 pt-2 border-t border-green-500/20 text-xs">
        <div className="flex justify-between">
          <span className="opacity-60">SIGNAL</span>
          <span className={`font-bold ${sigColor.split(" ")[0]}`}>{sig}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">CONF</span>
          <span className="font-bold">{pred?.confidence ?? 0}%</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">TARGET</span>
          <span className="font-bold">${(pred?.targetPrice ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [clock, setClock] = useState("");
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = await safeJson(`${API}/api/live-data/status`);
      if (alive) setStatus(s?.data ?? s);
    };
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      <div className="border-b border-green-500/40 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-widest">◆ LIVE DASHBOARD · 12 PAIRS · BINANCE WS</span>
          <span className="opacity-70">Bootstrapped: <span className={status?.bootstrapped ? "text-green-400" : "text-yellow-300"}>{status?.bootstrapped ? "YES" : "NO"}</span></span>
        </div>
        <span suppressHydrationWarning className="text-white">{clock || "—"}</span>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {PAIRS.map(p => <PairTile key={p} pair={p} />)}
      </div>
    </div>
  );
}
