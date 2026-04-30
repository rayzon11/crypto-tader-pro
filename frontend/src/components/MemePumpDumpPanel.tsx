"use client";
/**
 * Meme Pump/Dump Radar
 * ────────────────────
 * Shows every meme pair with live price, 5m velocity, volume spike ratio,
 * whale pressure, and a pump/dump score (0-100).
 * Rows flash when they cross the alert threshold.
 */

import { useMemo } from "react";
import { useMemeRows, useMemeAlerts, type MemeRow } from "@/lib/memeScanner";

export default function MemePumpDumpPanel() {
  const rows = useMemeRows();

  // Optional: play a soft double-beep on pump/dump (reuses same alarm audio ctx)
  useMemeAlerts((r) => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = (window as any).__cb_actx || ((window as any).__cb_actx = new AC());
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(r.verdict === "PUMP" ? 1040 : 320, now + i * 0.15);
        g.gain.setValueAtTime(0.0001, now + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.2, now + i * 0.15 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 0.12);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.14);
      }
    } catch {}
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => Math.max(b.pumpScore, b.dumpScore) - Math.max(a.pumpScore, a.dumpScore));
  }, [rows]);

  const summary = useMemo(() => {
    let pumps = 0, dumps = 0, acc = 0, dist = 0;
    for (const r of rows) {
      if (r.verdict === "PUMP") pumps++;
      else if (r.verdict === "DUMP") dumps++;
      else if (r.verdict === "ACCUMULATE") acc++;
      else if (r.verdict === "DISTRIBUTE") dist++;
    }
    return { pumps, dumps, acc, dist, n: rows.length };
  }, [rows]);

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-purple-950/30 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            MEME RADAR · PUMP/DUMP SCANNER
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {summary.n} coins · 🚀 {summary.pumps} pumping · 💀 {summary.dumps} dumping · 🟢 {summary.acc} accumulating · 🔴 {summary.dist} distributing
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <th className="text-left px-2 py-1.5">Coin</th>
              <th className="text-right px-2 py-1.5">Price</th>
              <th className="text-right px-2 py-1.5">24h%</th>
              <th className="text-right px-2 py-1.5">5m vel</th>
              <th className="text-right px-2 py-1.5">Vol spike</th>
              <th className="text-right px-2 py-1.5">Buy $1m</th>
              <th className="text-right px-2 py-1.5">Sell $1m</th>
              <th className="text-right px-2 py-1.5">Pump</th>
              <th className="text-right px-2 py-1.5">Dump</th>
              <th className="text-left px-2 py-1.5">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => <Row key={r.pair} r={r} />)}
            {sorted.length === 0 && (
              <tr><td colSpan={10} className="px-2 py-6 text-center text-slate-500">Bootstrapping meme data…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ r }: { r: MemeRow }) {
  const verdictColor =
    r.verdict === "PUMP" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 animate-pulse" :
    r.verdict === "DUMP" ? "bg-rose-500/20 border-rose-500/50 text-rose-200 animate-pulse" :
    r.verdict === "ACCUMULATE" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" :
    r.verdict === "DISTRIBUTE" ? "bg-rose-500/10 border-rose-500/30 text-rose-300" :
    "bg-slate-800/40 border-slate-700 text-slate-400";
  const rowBg = r.verdict === "PUMP" ? "bg-emerald-500/5" : r.verdict === "DUMP" ? "bg-rose-500/5" : "";

  return (
    <tr className={`border-b border-slate-900 hover:bg-slate-900/40 ${rowBg}`}>
      <td className="px-2 py-1 text-slate-100 font-bold">{r.symbol}</td>
      <td className="px-2 py-1 text-right text-slate-300">{r.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
      <td className={`px-2 py-1 text-right ${r.change24h >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
        {r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(2)}%
      </td>
      <td className={`px-2 py-1 text-right ${r.velocity5m >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {r.velocity5m >= 0 ? "+" : ""}{r.velocity5m.toFixed(2)}%
      </td>
      <td className={`px-2 py-1 text-right ${r.volSpike >= 3 ? "text-fuchsia-300 font-bold" : r.volSpike >= 1.5 ? "text-amber-300" : "text-slate-400"}`}>
        {r.volSpike.toFixed(1)}×
      </td>
      <td className="px-2 py-1 text-right text-emerald-400">${(r.buyUsd1m / 1000).toFixed(0)}K</td>
      <td className="px-2 py-1 text-right text-rose-400">${(r.sellUsd1m / 1000).toFixed(0)}K</td>
      <td className="px-2 py-1 text-right">
        <ScoreBar v={r.pumpScore} tone="emerald" />
      </td>
      <td className="px-2 py-1 text-right">
        <ScoreBar v={r.dumpScore} tone="rose" />
      </td>
      <td className="px-2 py-1">
        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${verdictColor}`}>
          {r.verdict === "PUMP" ? "🚀 PUMP" : r.verdict === "DUMP" ? "💀 DUMP" :
           r.verdict === "ACCUMULATE" ? "🟢 ACC" : r.verdict === "DISTRIBUTE" ? "🔴 DIST" : "—"}
        </span>
      </td>
    </tr>
  );
}

function ScoreBar({ v, tone }: { v: number; tone: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  const txt = tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="inline-flex items-center gap-1">
      <div className="relative h-1.5 w-12 rounded-full bg-slate-800 overflow-hidden">
        <div className={`absolute top-0 h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className={`w-6 text-right ${txt}`}>{v}</span>
    </div>
  );
}
