"use client";
/**
 * MicrostructurePanel — HFT-desk signals
 * ──────────────────────────────────────
 * OFI (order-flow imbalance), VPIN (toxicity), Kyle's λ (price impact),
 * depth imbalance, and liquidity walls. These are the four signals
 * Citadel/Jump/JPM EFX desks watch at sub-second resolution.
 */
import { useEffect, useState } from "react";

const API = "http://localhost:3002";

interface Micro {
  symbol: string; mid: number; spread: number; spreadBps: number;
  depth: { bidQty: number; askQty: number; imbalance: number };
  orderFlow: { buyVol: number; sellVol: number; buyCount: number; sellCount: number; ofi: number; pressure: string };
  vpin: number; toxicity: string;
  kyleLambda: number;
  walls: { side: "BID" | "ASK"; price: number; qty: number; usd: number }[];
}

export default function MicrostructurePanel({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const [m, setM] = useState<Micro | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/microstructure?symbol=${symbol}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stopped) setM(j);
      } catch {}
    };
    load();
    const id = setInterval(load, 2000);  // 2s — HFT cadence
    return () => { stopped = true; clearInterval(id); };
  }, [symbol]);

  if (!m) return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">Loading microstructure…</div>;

  const toxColor = m.toxicity === "TOXIC" ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
    : m.toxicity === "ELEVATED" ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
    : "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";

  const pressColor = m.orderFlow.pressure.startsWith("STRONG_BUY") ? "text-emerald-300"
    : m.orderFlow.pressure === "BUY" ? "text-emerald-400"
    : m.orderFlow.pressure.startsWith("STRONG_SELL") ? "text-rose-300"
    : m.orderFlow.pressure === "SELL" ? "text-rose-400"
    : "text-slate-300";

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-cyan-950/20 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            MICROSTRUCTURE · HFT SIGNALS · {symbol}
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            Mid <span className="text-cyan-300">${m.mid.toFixed(2)}</span>
            <span className="text-slate-400 ml-2">spread {m.spreadBps.toFixed(2)} bps</span>
          </div>
        </div>
        <div className={`px-3 py-1 rounded border text-xs font-bold ${toxColor}`}>
          {m.toxicity}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="OFI" value={`${(m.orderFlow.ofi * 100).toFixed(1)}%`} sub={m.orderFlow.pressure.replace("_", " ")} color={pressColor} />
        <Kpi label="VPIN" value={m.vpin.toFixed(3)} sub="informed-flow prob" color={m.vpin > 0.4 ? "text-rose-300" : m.vpin > 0.25 ? "text-amber-300" : "text-emerald-300"} />
        <Kpi label="KYLE λ" value={m.kyleLambda.toExponential(2)} sub="$ impact / unit vol" color="text-indigo-300" />
        <Kpi label="DEPTH IMB" value={`${(m.depth.imbalance * 100).toFixed(1)}%`} sub={`bid ${(m.depth.bidQty).toFixed(2)} / ask ${(m.depth.askQty).toFixed(2)}`} color={m.depth.imbalance >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </div>

      {/* OFI meter */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>SELL PRESSURE</span><span>BALANCED</span><span>BUY PRESSURE</span>
        </div>
        <div className="relative h-3 bg-slate-900 rounded overflow-hidden">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600" />
          {m.orderFlow.ofi >= 0 ? (
            <div className="absolute top-0 bottom-0 left-1/2 bg-emerald-500/70" style={{ width: `${Math.min(50, Math.abs(m.orderFlow.ofi) * 50)}%` }} />
          ) : (
            <div className="absolute top-0 bottom-0 right-1/2 bg-rose-500/70" style={{ width: `${Math.min(50, Math.abs(m.orderFlow.ofi) * 50)}%` }} />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
          <span>{m.orderFlow.sellCount} sells · ${(m.orderFlow.sellVol * m.mid).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span>{m.orderFlow.buyCount} buys · ${(m.orderFlow.buyVol * m.mid).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Liquidity walls */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">LIQUIDITY WALLS · ±1% FROM MID</div>
        <div className="space-y-0.5 max-h-40 overflow-y-auto text-[11px] font-mono">
          {m.walls.length === 0 && <div className="text-slate-500 text-[10px]">— no walls &gt; $500K —</div>}
          {m.walls.map((w, i) => {
            const dist = ((w.price - m.mid) / m.mid) * 100;
            return (
              <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded ${w.side === "ASK" ? "bg-rose-500/5" : "bg-emerald-500/5"}`}>
                <span className={`w-8 text-[9px] font-bold ${w.side === "ASK" ? "text-rose-300" : "text-emerald-300"}`}>{w.side}</span>
                <span className="text-slate-200 w-20">${w.price.toFixed(2)}</span>
                <span className="text-slate-400 w-16">{w.qty.toFixed(3)}</span>
                <span className={`w-20 font-bold ${w.side === "ASK" ? "text-rose-300" : "text-emerald-300"}`}>${(w.usd / 1e6).toFixed(2)}M</span>
                <span className="text-slate-500">{dist >= 0 ? "+" : ""}{dist.toFixed(2)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
