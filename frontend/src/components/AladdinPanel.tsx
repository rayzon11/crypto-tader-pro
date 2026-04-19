"use client";
/**
 * Aladdin-Style Institutional Panel
 * ─────────────────────────────────
 * BlackRock-inspired portfolio lens sitting on top of real-time whale
 * + price data. Everything here is computed from live Binance flow —
 * no mocks, no backend dependency.
 *
 * Sections:
 *   1. Market-wide whale pressure (aggregate buy/sell USD, 1-min)
 *   2. Concentration — top 3 pairs by flow as % of total
 *   3. Side bias by tier — MEGA buy vs sell count
 *   4. CVD leaderboard — biggest inflow / outflow pairs (session)
 *   5. Regime signal — pressure + CVD consensus → RISK-ON / RISK-OFF
 */

import { useMemo } from "react";
import { useFlowStats, useWhaleTape } from "@/lib/whaleFeed";

export default function AladdinPanel() {
  const stats = useFlowStats();
  const tape = useWhaleTape();

  const metrics = useMemo(() => {
    const entries = Object.entries(stats);
    let totBuy = 0, totSell = 0;
    const flowByPair: { pair: string; flow: number; pressure: number; cvd: number }[] = [];
    for (const [pair, s] of entries) {
      totBuy += s.buyUsd; totSell += s.sellUsd;
      flowByPair.push({ pair, flow: s.buyUsd + s.sellUsd, pressure: s.pressure, cvd: s.cvd });
    }
    const tot = totBuy + totSell;
    const pressure = tot > 0 ? (totBuy - totSell) / tot : 0;

    flowByPair.sort((a, b) => b.flow - a.flow);
    const top3 = flowByPair.slice(0, 3);
    const concentration = tot > 0 ? top3.reduce((s, x) => s + x.flow, 0) / tot : 0;

    // Tier split from recent tape
    let megaBuy = 0, megaSell = 0, largeBuy = 0, largeSell = 0;
    for (const t of tape.slice(0, 200)) {
      if (t.tier === "MEGA")  { if (t.side === "BUY") megaBuy++;  else megaSell++; }
      if (t.tier === "LARGE") { if (t.side === "BUY") largeBuy++; else largeSell++; }
    }

    // CVD leaderboard (session-wide)
    const cvdSorted = [...flowByPair].sort((a, b) => b.cvd - a.cvd);
    const inflow = cvdSorted.slice(0, 3);
    const outflow = cvdSorted.slice(-3).reverse();

    // Regime: pressure >0.2 with >60% pairs bullish → RISK-ON
    const bullPairs = flowByPair.filter(f => f.pressure > 0.1).length;
    const bearPairs = flowByPair.filter(f => f.pressure < -0.1).length;
    const bullRatio = entries.length > 0 ? bullPairs / entries.length : 0;

    let regime: "RISK-ON" | "RISK-OFF" | "MIXED" = "MIXED";
    if (pressure > 0.15 && bullRatio > 0.55) regime = "RISK-ON";
    else if (pressure < -0.15 && bearPairs / Math.max(1, entries.length) > 0.55) regime = "RISK-OFF";

    return { totBuy, totSell, pressure, top3, concentration, megaBuy, megaSell, largeBuy, largeSell, inflow, outflow, regime, bullPairs, bearPairs };
  }, [stats, tape]);

  const regimeColor =
    metrics.regime === "RISK-ON" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200" :
    metrics.regime === "RISK-OFF" ? "bg-rose-500/20 border-rose-500/40 text-rose-200" :
    "bg-amber-500/20 border-amber-500/40 text-amber-200";

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-indigo-950/30 to-slate-950/60 p-4 space-y-3">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            ALADDIN · INSTITUTIONAL LENS
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">Real-time whale flow · concentration · regime</div>
        </div>
        <div className={`px-3 py-1.5 rounded border text-xs font-bold ${regimeColor}`}>
          REGIME · {metrics.regime}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KPI label="WHALE BUY $" value={`$${(metrics.totBuy / 1e6).toFixed(2)}M`} tone="emerald" />
        <KPI label="WHALE SELL $" value={`$${(metrics.totSell / 1e6).toFixed(2)}M`} tone="rose" />
        <KPI label="NET PRESSURE" value={`${(metrics.pressure * 100).toFixed(1)}%`} tone={metrics.pressure >= 0 ? "emerald" : "rose"} />
        <KPI label="CONCENTRATION" value={`${(metrics.concentration * 100).toFixed(1)}%`} sub="top 3 of total" />
        <KPI label="BULL / BEAR PAIRS" value={`${metrics.bullPairs} · ${metrics.bearPairs}`} />
      </div>

      {/* Tier split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card title="MEGA PRINTS · ≥$1M">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex-1">
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-emerald-500" style={{ width: `${metrics.megaBuy + metrics.megaSell > 0 ? (metrics.megaBuy / (metrics.megaBuy + metrics.megaSell)) * 100 : 0}%` }} />
                <div className="bg-rose-500" style={{ width: `${metrics.megaBuy + metrics.megaSell > 0 ? (metrics.megaSell / (metrics.megaBuy + metrics.megaSell)) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px]">
                <span className="text-emerald-300">{metrics.megaBuy} BUY</span>
                <span className="text-rose-300">{metrics.megaSell} SELL</span>
              </div>
            </div>
          </div>
        </Card>
        <Card title="LARGE PRINTS · ≥$250K">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex-1">
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-emerald-500" style={{ width: `${metrics.largeBuy + metrics.largeSell > 0 ? (metrics.largeBuy / (metrics.largeBuy + metrics.largeSell)) * 100 : 0}%` }} />
                <div className="bg-rose-500" style={{ width: `${metrics.largeBuy + metrics.largeSell > 0 ? (metrics.largeSell / (metrics.largeBuy + metrics.largeSell)) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px]">
                <span className="text-emerald-300">{metrics.largeBuy} BUY</span>
                <span className="text-rose-300">{metrics.largeSell} SELL</span>
              </div>
            </div>
          </div>
        </Card>
        <Card title="TOP FLOW PAIRS">
          <div className="space-y-1 text-[11px] font-mono">
            {metrics.top3.map(p => (
              <div key={p.pair} className="flex justify-between">
                <span className="text-slate-300">{p.pair}</span>
                <span className={p.pressure >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  ${(p.flow / 1e6).toFixed(2)}M · {(p.pressure * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            {metrics.top3.length === 0 && <div className="text-slate-500">—</div>}
          </div>
        </Card>
      </div>

      {/* CVD leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="💰 CVD INFLOW LEADERS · SESSION">
          <div className="space-y-1 text-[11px] font-mono">
            {metrics.inflow.map(p => (
              <div key={p.pair} className="flex justify-between">
                <span className="text-slate-300">{p.pair}</span>
                <span className="text-emerald-300 font-bold">+${(p.cvd / 1e6).toFixed(2)}M</span>
              </div>
            ))}
            {metrics.inflow.length === 0 && <div className="text-slate-500">—</div>}
          </div>
        </Card>
        <Card title="🩸 CVD OUTFLOW LEADERS · SESSION">
          <div className="space-y-1 text-[11px] font-mono">
            {metrics.outflow.map(p => (
              <div key={p.pair} className="flex justify-between">
                <span className="text-slate-300">{p.pair}</span>
                <span className="text-rose-300 font-bold">${(p.cvd / 1e6).toFixed(2)}M</span>
              </div>
            ))}
            {metrics.outflow.length === 0 && <div className="text-slate-500">—</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "rose" }) {
  const c = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-slate-100";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`text-sm font-bold font-mono mt-0.5 ${c}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">{title}</div>
      {children}
    </div>
  );
}
