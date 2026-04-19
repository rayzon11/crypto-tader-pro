"use client";
/**
 * Volume Flow Panel
 * ─────────────────
 * Order-flow desk: for each top pair shows
 *   buy vs sell USD (1-min rolling) · CVD (session) · pressure score
 *   largest print · net imbalance bar
 *
 * Feeds from whaleFeed singleton — ~every second from Binance aggTrade stream.
 */

import { useMemo } from "react";
import { useFlowStats, WHALE_PAIRS } from "@/lib/whaleFeed";

export default function VolumeFlowPanel({ focus }: { focus?: string }) {
  const stats = useFlowStats();

  const rows = useMemo(() => {
    return WHALE_PAIRS.map(p => ({ pair: p, ...(stats[p] || { buyUsd: 0, sellUsd: 0, cvd: 0, trades: 0, largestBuy: 0, largestSell: 0, pressure: 0, lastPrice: 0 }) }))
      .sort((a, b) => (b.buyUsd + b.sellUsd) - (a.buyUsd + a.sellUsd));
  }, [stats]);

  const totals = useMemo(() => {
    let buy = 0, sell = 0;
    for (const r of rows) { buy += r.buyUsd; sell += r.sellUsd; }
    const press = buy + sell > 0 ? (buy - sell) / (buy + sell) : 0;
    return { buy, sell, press };
  }, [rows]);

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-950/80 to-slate-950/40 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ORDER-FLOW DESK · 1M ROLLING
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">Who is buying · who is selling · by volume</div>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <Big label="BUY VOL" value={`$${(totals.buy / 1e6).toFixed(2)}M`} tone="emerald" />
          <Big label="SELL VOL" value={`$${(totals.sell / 1e6).toFixed(2)}M`} tone="rose" />
          <Big label="PRESSURE" value={`${(totals.press * 100).toFixed(1)}%`} tone={totals.press > 0 ? "emerald" : totals.press < 0 ? "rose" : "slate"} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <th className="text-left px-2 py-1.5">Pair</th>
              <th className="text-right px-2 py-1.5">Last</th>
              <th className="text-right px-2 py-1.5">Buy $ (1m)</th>
              <th className="text-right px-2 py-1.5">Sell $ (1m)</th>
              <th className="text-right px-2 py-1.5">Trades</th>
              <th className="text-right px-2 py-1.5">Max Buy</th>
              <th className="text-right px-2 py-1.5">Max Sell</th>
              <th className="text-right px-2 py-1.5">CVD</th>
              <th className="text-left px-2 py-1.5 min-w-[140px]">Pressure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isFocus = focus === r.pair;
              const pct = Math.max(0, Math.min(1, (r.pressure + 1) / 2));
              const barColor = r.pressure > 0.15 ? "bg-emerald-500" : r.pressure < -0.15 ? "bg-rose-500" : "bg-slate-500";
              return (
                <tr key={r.pair} className={`border-b border-slate-900 hover:bg-slate-900/40 ${isFocus ? "bg-cyan-500/5" : ""}`}>
                  <td className="px-2 py-1 text-slate-200 font-bold">{r.pair}</td>
                  <td className="px-2 py-1 text-right text-slate-300">
                    {r.lastPrice > 0 ? r.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
                  </td>
                  <td className="px-2 py-1 text-right text-emerald-400">${(r.buyUsd / 1000).toFixed(0)}K</td>
                  <td className="px-2 py-1 text-right text-rose-400">${(r.sellUsd / 1000).toFixed(0)}K</td>
                  <td className="px-2 py-1 text-right text-slate-400">{r.trades}</td>
                  <td className="px-2 py-1 text-right text-emerald-300">${(r.largestBuy / 1000).toFixed(0)}K</td>
                  <td className="px-2 py-1 text-right text-rose-300">${(r.largestSell / 1000).toFixed(0)}K</td>
                  <td className={`px-2 py-1 text-right font-bold ${r.cvd >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {r.cvd >= 0 ? "+" : ""}${(r.cvd / 1e6).toFixed(2)}M
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <div className="relative h-1.5 w-24 rounded-full bg-slate-800 overflow-hidden">
                        <div className="absolute top-0 h-full w-px bg-slate-600 left-1/2" />
                        <div className={`absolute top-0 h-full ${barColor}`}
                          style={{
                            left: r.pressure >= 0 ? "50%" : `${50 - Math.abs(r.pressure) * 50}%`,
                            width: `${Math.abs(r.pressure) * 50}%`,
                          }} />
                      </div>
                      <span className={`text-[10px] ${r.pressure > 0 ? "text-emerald-300" : r.pressure < 0 ? "text-rose-300" : "text-slate-400"}`}>
                        {(r.pressure * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "slate" }) {
  const c = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-slate-300";
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-bold ${c}`}>{value}</div>
    </div>
  );
}
