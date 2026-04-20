"use client";
/**
 * VWAPKellyPanel — execution benchmark + position sizer
 * ──────────────────────────────────────────────────────
 * Left: VWAP / TWAP with 1σ / 2σ deviation bands and z-score. Tells
 *       you if current price is cheap / fair / rich vs volume-weighted
 *       fair value (the benchmark every desk executes against).
 * Right: Kelly criterion sizer with ¼ / ½ / full Kelly + risk-of-ruin.
 */
import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3002";

interface VWAP {
  symbol: string; vwap: number; twap: number; sigma: number;
  bands: { upper1: number; lower1: number; upper2: number; lower2: number };
  last: number; devPct: number; zscore: number; signal: string;
  series: { t: number; c: number; vwap: number }[];
}

interface Kelly {
  winrate: number; avgWin: number; avgLoss: number; b: number;
  kelly: number; halfKelly: number; quarterKelly: number;
  equity: number;
  sizeFull: number; sizeHalf: number; sizeQuarter: number;
  expectancy: number; edge: number; riskOfRuin: number;
  recommendation: string;
}

export default function VWAPKellyPanel({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const [vwap, setVwap] = useState<VWAP | null>(null);
  // Kelly inputs
  const [winrate, setWinrate] = useState(0.55);
  const [avgWin, setAvgWin] = useState(2.0);   // %
  const [avgLoss, setAvgLoss] = useState(1.0); // %
  const [equity, setEquity] = useState(10000);
  const [kelly, setKelly] = useState<Kelly | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/vwap?symbol=${symbol}&interval=5m&limit=288`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (!stopped) setVwap(j);
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { stopped = true; clearInterval(id); };
  }, [symbol]);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const qs = `winrate=${winrate}&avgWin=${avgWin/100}&avgLoss=${avgLoss/100}&equity=${equity}`;
        const r = await fetch(`${API}/api/v1/kelly?${qs}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (!stopped) setKelly(j);
        }
      } catch {}
    };
    load();
    return () => { stopped = true; };
  }, [winrate, avgWin, avgLoss, equity]);

  const sparkline = useMemo(() => {
    if (!vwap?.series) return null;
    const pts = vwap.series.slice(-60);
    if (pts.length < 2) return null;
    const prices = pts.map(p => p.c);
    const vwaps  = pts.map(p => p.vwap);
    const min = Math.min(...prices, ...vwaps);
    const max = Math.max(...prices, ...vwaps);
    const range = max - min || 1;
    const toY = (v: number) => 40 - ((v - min) / range) * 36;
    const pricePath = prices.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 300} ${toY(p)}`).join(" ");
    const vwapPath  = vwaps.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 300} ${toY(p)}`).join(" ");
    return { pricePath, vwapPath };
  }, [vwap]);

  const signalColor = vwap?.signal.startsWith("OVEREXTENDED_UP") ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
    : vwap?.signal.startsWith("OVEREXTENDED_DOWN") ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
    : vwap?.signal === "ABOVE_VALUE" ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
    : vwap?.signal === "BELOW_VALUE" ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/30"
    : "text-slate-300 bg-slate-800/60 border-slate-700";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* VWAP */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-emerald-950/10 to-slate-950/60 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VWAP · EXECUTION BENCHMARK · {symbol}
            </div>
            {vwap && <div className="text-sm font-bold text-slate-100 mt-0.5">
              last <span className="text-emerald-300">${vwap.last.toFixed(2)}</span>
              <span className="text-slate-400 ml-2">vwap ${vwap.vwap.toFixed(2)}</span>
              <span className={`ml-2 ${vwap.devPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{vwap.devPct >= 0 ? "+" : ""}{vwap.devPct.toFixed(2)}%</span>
            </div>}
          </div>
          {vwap && (
            <div className={`px-2 py-1 rounded text-[10px] font-bold border ${signalColor}`}>
              {vwap.signal.replace(/_/g, " ")}
            </div>
          )}
        </div>

        {sparkline && (
          <svg viewBox="0 0 300 40" className="w-full h-16">
            <path d={sparkline.vwapPath} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
            <path d={sparkline.pricePath} stroke="#10b981" strokeWidth="1.5" fill="none" />
          </svg>
        )}

        {vwap && (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Mini label="TWAP" value={`$${vwap.twap.toFixed(2)}`} />
            <Mini label="σ" value={`$${vwap.sigma.toFixed(2)}`} />
            <Mini label="Z-SCORE" value={vwap.zscore.toFixed(2)} color={Math.abs(vwap.zscore) > 2 ? "text-rose-300" : Math.abs(vwap.zscore) > 1 ? "text-amber-300" : "text-slate-200"} />
            <Mini label="UPPER 1σ" value={`$${vwap.bands.upper1.toFixed(2)}`} />
            <Mini label="LOWER 1σ" value={`$${vwap.bands.lower1.toFixed(2)}`} />
            <Mini label="UPPER 2σ" value={`$${vwap.bands.upper2.toFixed(2)}`} color="text-rose-300" />
          </div>
        )}
      </div>

      {/* Kelly */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-indigo-950/10 to-slate-950/60 p-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            KELLY SIZER · OPTIMAL POSITION
          </div>
          {kelly && <div className="text-sm font-bold text-slate-100 mt-0.5">
            Full Kelly <span className={kelly.kelly > 0 ? "text-emerald-300" : "text-rose-300"}>{(kelly.kelly * 100).toFixed(2)}%</span>
            <span className="text-slate-400 ml-2">edge {(kelly.edge * 100).toFixed(2)}%</span>
            <span className="text-slate-500 ml-2">R:R 1:{kelly.b.toFixed(2)}</span>
          </div>}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Slider label="Win rate" value={winrate * 100} onChange={v => setWinrate(v / 100)} min={10} max={95} step={1} suffix="%" />
          <Slider label="Avg win" value={avgWin} onChange={setAvgWin} min={0.1} max={10} step={0.1} suffix="%" />
          <Slider label="Avg loss" value={avgLoss} onChange={setAvgLoss} min={0.1} max={10} step={0.1} suffix="%" />
          <Slider label="Equity" value={equity} onChange={setEquity} min={1000} max={1000000} step={1000} suffix="$" integer />
        </div>

        {kelly && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <SizeTile label="¼ KELLY" size={kelly.sizeQuarter} pct={kelly.quarterKelly} color="emerald" tone="safest" />
              <SizeTile label="½ KELLY" size={kelly.sizeHalf} pct={kelly.halfKelly} color="amber" tone="recommended" />
              <SizeTile label="FULL KELLY" size={kelly.sizeFull} pct={kelly.kelly} color="rose" tone="aggressive" />
            </div>
            <div className={`text-[10px] font-bold px-2 py-1 rounded border ${
              kelly.recommendation.startsWith("NO_EDGE") ? "text-rose-300 border-rose-500/30 bg-rose-500/5"
              : kelly.recommendation.startsWith("STRONG") ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/5"
              : "text-amber-300 border-amber-500/30 bg-amber-500/5"
            }`}>
              {kelly.recommendation.replace(/_/g, " ")} · Risk of ruin {(kelly.riskOfRuin * 100).toFixed(2)}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, color = "text-slate-200" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 p-1.5">
      <div className="text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xs font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, suffix, integer }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix: string; integer?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between text-slate-400">
        <span>{label}</span>
        <span className="text-slate-200 font-bold">{suffix === "$" ? `${suffix}${value.toLocaleString()}` : `${integer ? value : value.toFixed(1)}${suffix}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full accent-indigo-400" />
    </div>
  );
}

function SizeTile({ label, size, pct, color, tone }: { label: string; size: number; pct: number; color: string; tone: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5",
    amber:   "text-amber-300 border-amber-500/30 bg-amber-500/5",
    rose:    "text-rose-300 border-rose-500/30 bg-rose-500/5",
  };
  return (
    <div className={`rounded border p-2 ${colorMap[color]}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-sm font-bold font-mono">${size.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
      <div className="text-[9px] opacity-70">{(pct * 100).toFixed(2)}% · {tone}</div>
    </div>
  );
}
