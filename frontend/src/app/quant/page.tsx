"use client";
/**
 * /quant — Cross-asset quantitative desk
 * ───────────────────────────────────────
 * CorrelationHeatmap · OptionsGreeksPanel · live candle-cache status.
 * This is the page a desk quant opens to check regime + hedge structure
 * before pushing size.
 */
import { useEffect, useState } from "react";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";
import OptionsGreeksPanel from "@/components/OptionsGreeksPanel";

const API = "http://localhost:3002";

export default function QuantPage() {
  const [cache, setCache] = useState<{ pairs: number; totalRows: number; sizeBytes: number } | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/cache/stats`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stopped) setCache(j);
      } catch {}
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-300">QUANT DESK</div>
          <div className="text-2xl font-bold text-slate-100">Cross-asset Risk · Options · Correlation</div>
          <div className="text-xs text-slate-500 mt-1">
            Rolling Pearson correlation across {`{MAJORS, DEFI, LAYER1, MEMES}`} · Black-Scholes Greeks on live spot · Candle cache builds history for backtesting.
          </div>
        </div>
        {cache && (
          <div className="text-right text-[11px] font-mono">
            <div className="text-slate-500 uppercase tracking-wider text-[9px]">CANDLE CACHE</div>
            <div className="text-indigo-300 font-bold">{cache.pairs} pairs · {cache.totalRows.toLocaleString()} rows</div>
            <div className="text-slate-500">{(cache.sizeBytes / 1024).toFixed(1)} KB on disk</div>
          </div>
        )}
      </div>

      <CorrelationHeatmap />
      <OptionsGreeksPanel />

      <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-slate-800">
        Correlation refreshes every 30s · Spot every 5s · Cache flushes every 15s to <code className="text-slate-400">data/candles/*.jsonl</code>
      </div>
    </div>
  );
}
