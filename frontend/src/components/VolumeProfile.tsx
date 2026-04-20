"use client";
/**
 * VolumeProfile — Bloomberg-style VPVR (Volume at Price)
 * ──────────────────────────────────────────────────────
 * Horizontal bars show volume traded at each price bucket. POC (Point
 * of Control) is the highest-volume level. VAH/VAL bracket the 70%
 * value area. HVN (high-volume nodes) = support/resistance magnets,
 * LVN = fast-move zones (price slices through).
 */
import { useEffect, useState } from "react";

const API = "http://localhost:3002";

interface Node { price: number; vol: number; type: "HVN" | "LVN" | "NORMAL"; delta: number; buyPct: number; idx: number }
interface VP {
  symbol: string; interval: string;
  priceRange: { lo: number; hi: number; step: number };
  totalVol: number;
  poc: { price: number; vol: number; idx: number };
  valueArea: { vah: number; val: number; pct: number };
  nodes: Node[];
}

const INTERVALS = ["15m", "1h", "4h", "1d"] as const;

export default function VolumeProfile({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const [interval_, setInterval_] = useState<typeof INTERVALS[number]>("1h");
  const [data, setData] = useState<VP | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/api/v1/volume-profile?symbol=${symbol}&interval=${interval_}&buckets=60&limit=500`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stopped) setData(j);
      } catch {} finally { if (!stopped) setLoading(false); }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { stopped = true; clearInterval(id); };
  }, [symbol, interval_]);

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">
        Loading volume profile…
      </div>
    );
  }

  const maxVol = Math.max(...data.nodes.map(n => n.vol));
  // Render top-down (high price first)
  const nodes = [...data.nodes].reverse();

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-violet-950/20 to-slate-950/60 p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-violet-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            VOLUME PROFILE · VPVR · {symbol}
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            POC <span className="text-amber-300">${data.poc.price.toFixed(2)}</span>
            <span className="text-slate-400 ml-2">VAH ${data.valueArea.vah.toFixed(2)}</span>
            <span className="text-slate-400 ml-2">VAL ${data.valueArea.val.toFixed(2)}</span>
            <span className="text-slate-500 ml-2 text-xs">({(data.valueArea.pct * 100).toFixed(0)}% value)</span>
          </div>
        </div>
        <div className="flex gap-1">
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => setInterval_(iv)}
              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                interval_ === iv ? "bg-violet-500 text-black border-violet-500" : "border-slate-700 text-slate-300"
              }`}>{iv}</button>
          ))}
        </div>
      </div>

      <div className="font-mono text-[9px] space-y-[1px] max-h-[420px] overflow-y-auto pr-1">
        {nodes.map(n => {
          const w = (n.vol / maxVol) * 100;
          const inVA = n.price <= data.valueArea.vah && n.price >= data.valueArea.val;
          const isPOC = n.idx === data.poc.idx;
          const buyW = w * n.buyPct;
          const sellW = w * (1 - n.buyPct);
          return (
            <div key={n.idx} className="flex items-center gap-1">
              <div className={`w-14 text-right ${isPOC ? "text-amber-300 font-bold" : inVA ? "text-slate-200" : "text-slate-500"}`}>
                {n.price.toFixed(n.price < 10 ? 4 : 2)}
              </div>
              <div className="flex-1 flex h-3 bg-slate-900/60 rounded-sm overflow-hidden">
                <div className="bg-emerald-500/70" style={{ width: `${buyW}%` }} />
                <div className="bg-rose-500/70" style={{ width: `${sellW}%` }} />
              </div>
              <div className={`w-10 text-[8px] ${
                n.type === "HVN" ? "text-amber-300" : n.type === "LVN" ? "text-slate-600" : "text-slate-500"
              }`}>{n.type === "HVN" ? "HVN" : n.type === "LVN" ? "lvn" : ""}{isPOC ? " ◆" : ""}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[9px] text-slate-400 border-t border-slate-800 pt-2">
        <span><span className="text-amber-300">◆ POC</span> · most-traded price</span>
        <span><span className="text-amber-300">HVN</span> · magnet zones (S/R)</span>
        <span><span className="text-slate-500">lvn</span> · fast-move gaps</span>
        <span className="ml-auto">{loading ? "↻ updating…" : `tot ${(data.totalVol / 1e3).toFixed(1)}K`}</span>
      </div>
    </div>
  );
}
