"use client";
/**
 * WhaleAlarm
 * ──────────
 * Plays a buzzer (Web Audio) and shows a floating toast every time a
 * MEGA whale trade (≥ $1M) crosses the tape. Toggleable from header.
 *
 * Also emits on-chain whale transfers from the optional onChainFeed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWhaleAlerts, type WhaleTrade } from "@/lib/whaleFeed";

type Toast = { id: string; kind: "BUY" | "SELL"; pair: string; usd: number; price: number; ts: number };

function playBeep(kind: "BUY" | "SELL") {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = (window as any).__cb_actx || ((window as any).__cb_actx = new AC());
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(kind === "BUY" ? 880 : 330, now);
    osc.frequency.exponentialRampToValueAtTime(kind === "BUY" ? 1760 : 180, now + 0.25);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.32);
  } catch {}
}

const LS_KEY = "cb:whaleAlarm:on";

export default function WhaleAlarm() {
  const [on, setOn] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const onRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    try { const v = localStorage.getItem(LS_KEY); if (v === "0") setOn(false); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, on ? "1" : "0"); } catch {}
  }, [on]);

  const handler = useCallback((t: WhaleTrade) => {
    if (!onRef.current) return;
    playBeep(t.side);
    setToasts(xs => [{ id: t.id, kind: t.side, pair: t.pair, usd: t.usd, price: t.price, ts: t.ts }, ...xs].slice(0, 6));
    setTimeout(() => setToasts(xs => xs.filter(x => x.id !== t.id)), 6000);
  }, []);
  useWhaleAlerts(handler);

  return (
    <>
      {/* Floating control + toasts */}
      <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 max-w-[360px] pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-end">
          <button
            onClick={() => setOn(v => !v)}
            className={`text-[10px] px-2.5 py-1 rounded-full border shadow-lg backdrop-blur ${
              on ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                 : "border-slate-700 bg-slate-900/80 text-slate-400 hover:bg-slate-800"
            }`}
            title="Toggle mega-whale alarm sound"
          >
            {on ? "🔔 ALARM ON · ≥$1M" : "🔕 ALARM OFF"}
          </button>
        </div>
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto rounded-lg border-2 shadow-2xl p-3 backdrop-blur animate-in fade-in slide-in-from-right-4 ${
              t.kind === "BUY"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-100"
                : "border-rose-500 bg-rose-500/20 text-rose-100"
            }`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider">
                {t.kind === "BUY" ? "🟢 MEGA BUY" : "🔴 MEGA SELL"}
              </div>
              <div className="text-[10px] opacity-70">{new Date(t.ts).toLocaleTimeString()}</div>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black">{t.pair}</span>
              <span className="text-sm font-mono opacity-90">@ {t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            </div>
            <div className="mt-0.5 text-xl font-black font-mono">
              ${(t.usd / 1e6).toFixed(2)}M
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
