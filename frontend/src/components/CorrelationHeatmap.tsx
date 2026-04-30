"use client";
/**
 * CorrelationHeatmap — N×N rolling Pearson correlation
 * ─────────────────────────────────────────────────────
 * Consumes /api/v1/correlation (server-side endpoint). Visualizes as
 * a BlackRock/Bloomberg-style heatmap — green = positive correlation
 * (crash together), red = negative (diversifier), cell alpha = |r|.
 *
 * Auto-refreshes every 30s. Interval selector (1h/4h/1d). Clicking
 * a cell pins the pair for closer inspection.
 */
import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3002";

const PRESETS: Record<string, string[]> = {
  MAJORS:  ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT"],
  DEFI:    ["UNIUSDT","AAVEUSDT","LINKUSDT","MKRUSDT","COMPUSDT","CRVUSDT","SUSHIUSDT","DYDXUSDT"],
  LAYER1:  ["ETHUSDT","SOLUSDT","AVAXUSDT","ADAUSDT","DOTUSDT","NEARUSDT","TRXUSDT","ATOMUSDT"],
  MEMES:   ["DOGEUSDT","SHIBUSDT","PEPEUSDT","FLOKIUSDT","BONKUSDT","WIFUSDT","MEMEUSDT","BOMEUSDT"],
};

const INTERVALS = ["1h", "4h", "1d"] as const;

export default function CorrelationHeatmap() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>("MAJORS");
  const [interval, setInterval_] = useState<typeof INTERVALS[number]>("1h");
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<{ a: string; b: string; r: number } | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          symbols: PRESETS[preset].join(","),
          interval,
          limit: interval === "1h" ? "168" : interval === "4h" ? "180" : "120",
        });
        const r = await fetch(`${API}/api/v1/correlation?${qs}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (stopped) return;
        setMatrix(j.matrix || {});
        setSymbols(j.symbols || PRESETS[preset]);
        setUpdatedAt(Date.now());
      } catch {} finally { if (!stopped) setLoading(false); }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { stopped = true; clearInterval(id); };
  }, [preset, interval]);

  const stats = useMemo(() => {
    const vals: number[] = [];
    for (const a of symbols) for (const b of symbols) if (a !== b) vals.push(matrix[a]?.[b] ?? 0);
    if (vals.length === 0) return { avg: 0, max: 0, min: 0 };
    const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
    return { avg, max: Math.max(...vals), min: Math.min(...vals) };
  }, [matrix, symbols]);

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-indigo-950/20 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            CORRELATION MATRIX · ROLLING PEARSON · {interval.toUpperCase()}
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            Avg ρ = <span className="text-indigo-300">{stats.avg.toFixed(2)}</span> ·
            <span className="text-emerald-400 ml-2">max {stats.max.toFixed(2)}</span> ·
            <span className="text-rose-400 ml-2">min {stats.min.toFixed(2)}</span>
            {updatedAt > 0 && <span className="text-slate-500 ml-2">· {Math.max(1, Math.floor((Date.now() - updatedAt) / 1000))}s ago</span>}
          </div>
        </div>
        <div className="flex gap-1">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(p => (
            <button key={p} onClick={() => setPreset(p)}
              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                preset === p ? "bg-indigo-500 text-black border-indigo-500" : "border-slate-700 text-slate-300 hover:border-indigo-500/50"
              }`}>{p}</button>
          ))}
          <div className="w-px bg-slate-800 mx-1" />
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => setInterval_(iv)}
              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                interval === iv ? "bg-indigo-500 text-black border-indigo-500" : "border-slate-700 text-slate-300 hover:border-indigo-500/50"
              }`}>{iv}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-[10px] font-mono border-collapse">
          <thead>
            <tr>
              <th className="p-1.5"></th>
              {symbols.map(s => (
                <th key={s} className="p-1.5 text-slate-400 font-bold min-w-[56px] text-center">
                  {s.replace("USDT", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map(a => (
              <tr key={a}>
                <td className="p-1.5 text-slate-400 font-bold text-right pr-2">{a.replace("USDT", "")}</td>
                {symbols.map(b => {
                  const r = matrix[a]?.[b] ?? 0;
                  return (
                    <td key={b}
                      onMouseEnter={() => setHover({ a, b, r })}
                      onMouseLeave={() => setHover(null)}
                      className="p-0.5">
                      <Cell a={a} b={b} r={r} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover detail */}
      <div className="flex items-center justify-between text-[11px] border-t border-slate-800 pt-2">
        <div className="text-slate-300">
          {hover ? (
            <span>
              <span className="text-indigo-300 font-bold">{hover.a.replace("USDT","")}</span>
              <span className="opacity-60 mx-2">↔</span>
              <span className="text-indigo-300 font-bold">{hover.b.replace("USDT","")}</span>
              <span className="ml-3">ρ = <span className={`font-bold ${hover.r > 0.7 ? "text-emerald-300" : hover.r < -0.3 ? "text-rose-300" : "text-slate-300"}`}>{hover.r.toFixed(3)}</span></span>
              <span className="opacity-60 ml-3">{interpret(hover.r)}</span>
            </span>
          ) : <span className="opacity-60">Hover a cell for pair detail · Green = co-moves · Red = diversifier</span>}
        </div>
        {loading && <span className="text-indigo-300 text-[10px] animate-pulse">REFRESHING…</span>}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="opacity-60">ρ scale:</span>
        {[-1, -0.5, 0, 0.5, 1].map(v => (
          <div key={v} className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: colorFor(v) }} />
            <span className="opacity-70">{v.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ a, b, r }: { a: string; b: string; r: number }) {
  const same = a === b;
  const bg = same ? "#334155" : colorFor(r);
  const textColor = Math.abs(r) > 0.6 ? "#0f172a" : "#e2e8f0";
  return (
    <div
      className="w-[56px] h-[38px] flex flex-col items-center justify-center rounded font-mono transition"
      style={{ backgroundColor: bg, color: textColor }}
      title={`${a} ↔ ${b} = ${r.toFixed(3)}`}
    >
      <div className="font-bold">{same ? "—" : r.toFixed(2)}</div>
    </div>
  );
}

// Green for positive correlation, red for negative, alpha by magnitude
function colorFor(r: number): string {
  const mag = Math.min(1, Math.abs(r));
  const alpha = 0.25 + mag * 0.75;
  if (r >= 0) {
    // emerald: rgb(16, 185, 129)
    return `rgba(16, 185, 129, ${alpha.toFixed(2)})`;
  }
  // rose: rgb(244, 63, 94)
  return `rgba(244, 63, 94, ${alpha.toFixed(2)})`;
}

function interpret(r: number): string {
  const m = Math.abs(r);
  const direction = r > 0 ? "positive" : "negative";
  if (m < 0.2) return "independent";
  if (m < 0.4) return `weak ${direction}`;
  if (m < 0.7) return `moderate ${direction}`;
  if (m < 0.9) return `strong ${direction}`;
  return `near-perfect ${direction}`;
}
