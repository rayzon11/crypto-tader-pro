"use client";
/**
 * Real-Time Whale Tape
 * ────────────────────
 * Bloomberg/Aladdin-style prints ticker. Every trade ≥$100k on Binance
 * across the top 20 pairs flashes here the instant it executes.
 */

import { useMemo, useState } from "react";
import { useWhaleTape, WhaleTrade } from "@/lib/whaleFeed";

export default function WhaleTape({ pair, max = 50 }: { pair?: string; max?: number }) {
  const tape = useWhaleTape();
  const [tierFilter, setTierFilter] = useState<"ALL" | "MEGA" | "LARGE" | "WHALE">("ALL");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  const filtered = useMemo(() => {
    let t = tape;
    if (pair) t = t.filter(x => x.pair === pair);
    if (tierFilter !== "ALL") t = t.filter(x => x.tier === tierFilter);
    if (sideFilter !== "ALL") t = t.filter(x => x.side === sideFilter);
    return t.slice(0, max);
  }, [tape, pair, tierFilter, sideFilter, max]);

  const { totBuy, totSell, mega } = useMemo(() => {
    let totBuy = 0, totSell = 0, mega = 0;
    for (const t of tape.slice(0, 200)) {
      if (t.side === "BUY") totBuy += t.usd; else totSell += t.usd;
      if (t.tier === "MEGA") mega++;
    }
    return { totBuy, totSell, mega };
  }, [tape]);

  const pressure = totBuy + totSell > 0 ? (totBuy - totSell) / (totBuy + totSell) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-950/80 to-slate-950/40">
      {/* header */}
      <div className="flex items-center justify-between gap-2 flex-wrap p-3 border-b border-slate-800">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            LIVE WHALE TAPE · BINANCE AGGTRADE
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {filtered.length} prints · {mega} mega
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <div className="text-emerald-400">BUY ${(totBuy / 1e6).toFixed(1)}M</div>
          <div className="text-rose-400">SELL ${(totSell / 1e6).toFixed(1)}M</div>
          <div className={`font-bold ${pressure > 0.1 ? "text-emerald-300" : pressure < -0.1 ? "text-rose-300" : "text-slate-300"}`}>
            Δ {(pressure * 100).toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          {(["ALL", "MEGA", "LARGE", "WHALE"] as const).map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`px-2 py-0.5 rounded border ${tierFilter === t ? "border-cyan-500 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
              {t}
            </button>
          ))}
          <span className="w-px h-3 bg-slate-700 mx-1" />
          {(["ALL", "BUY", "SELL"] as const).map(s => (
            <button key={s} onClick={() => setSideFilter(s)}
              className={`px-2 py-0.5 rounded border ${
                sideFilter === s
                  ? s === "BUY" ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : s === "SELL" ? "border-rose-500 bg-rose-500/20 text-rose-200"
                  : "border-cyan-500 bg-cyan-500/20 text-cyan-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* tape */}
      <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            Waiting for whale prints… (≥$100k on Binance)
          </div>
        ) : (
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-3 py-1.5">Time</th>
                <th className="text-left px-2 py-1.5">Pair</th>
                <th className="text-left px-2 py-1.5">Side</th>
                <th className="text-right px-2 py-1.5">Price</th>
                <th className="text-right px-2 py-1.5">Qty</th>
                <th className="text-right px-2 py-1.5">USD</th>
                <th className="text-left px-3 py-1.5">Tier</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => <Row key={t.id} t={t} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({ t }: { t: WhaleTrade }) {
  const time = new Date(t.ts).toLocaleTimeString();
  const sideColor = t.side === "BUY" ? "text-emerald-400" : "text-rose-400";
  const rowBg =
    t.tier === "MEGA" ? (t.side === "BUY" ? "bg-emerald-500/10" : "bg-rose-500/10") :
    t.tier === "LARGE" ? (t.side === "BUY" ? "bg-emerald-500/5" : "bg-rose-500/5") : "";
  const tierColor =
    t.tier === "MEGA" ? "bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-500/50" :
    t.tier === "LARGE" ? "bg-amber-500/20 text-amber-200 border-amber-500/40" :
    "bg-slate-700/40 text-slate-300 border-slate-600/40";
  return (
    <tr className={`border-b border-slate-900 hover:bg-slate-900/40 ${rowBg}`}>
      <td className="px-3 py-1 text-slate-500">{time}</td>
      <td className="px-2 py-1 text-slate-200">{t.pair}</td>
      <td className={`px-2 py-1 font-bold ${sideColor}`}>{t.side === "BUY" ? "▲ BUY" : "▼ SELL"}</td>
      <td className="px-2 py-1 text-right text-slate-300">{t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
      <td className="px-2 py-1 text-right text-slate-400">{t.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
      <td className={`px-2 py-1 text-right font-bold ${sideColor}`}>
        ${(t.usd / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K
      </td>
      <td className="px-3 py-1">
        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${tierColor}`}>{t.tier}</span>
      </td>
    </tr>
  );
}
