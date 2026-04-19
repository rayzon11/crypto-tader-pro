"use client";
/**
 * Live Multi-Timeframe Consensus — Bloomberg-grade
 * ───────────────────────────────────────────────
 * Every tile pulls a real live candle stream from liveStore (refcounted
 * Binance WS, bootstrapped to 500 bars via REST). Scoring is a weighted
 * aggregate, not a binary vote — so the conviction number is real.
 *
 * Per-timeframe score ∈ [-100, +100]:
 *   Trend     (EMA20>EMA50, EMA50>EMA200, price vs VWAP, ADX-weighted DI cross)  40%
 *   Momentum  (RSI dev from 50, MACD-hist sign+magnitude, ROC, TRIX)              30%
 *   Oscillator(StochK, StochRSI, Williams%R, CCI)                                 20%
 *   Volume    (MFI, CMF)                                                          10%
 *
 * Overall = bar-weighted average (longer TFs weigh more).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveCandles } from "@/lib/liveStore";
import { summary } from "@/lib/indicators";

const TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;
type TF = typeof TFS[number];
type Sig = "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL";

// Longer timeframes carry more weight in overall consensus
const TF_WEIGHT: Record<TF, number> = { "1m": 1, "5m": 1.5, "15m": 2, "30m": 2.5, "1h": 3, "4h": 4, "1d": 5 };

const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
const sigma = (x: number, k = 5) => 2 / (1 + Math.exp(-x / k)) - 1; // smooth (-1..+1)

interface ScoreOut {
  score: number;          // -100..+100
  signal: Sig;
  bars: number;
  price: number;
  change: number;         // vs previous close (%)
  components: { trend: number; momentum: number; osc: number; vol: number };
  detail: { rsi: number; macdHist: number; adx: number; ema20: number; ema50: number; vwap: number };
  updatedAt: number;
}

function scoreTF(candles: any[]): ScoreOut | null {
  if (!candles || candles.length < 50) return null;
  const s = summary(candles as any);
  if (!s) return null;
  const price = candles[candles.length - 1].close;
  const prev = candles[candles.length - 2]?.close ?? price;
  const change = prev > 0 ? ((price - prev) / prev) * 100 : 0;

  // ── TREND ──
  let trend = 0, trendN = 0;
  if (Number.isFinite(s.ema20) && Number.isFinite(s.ema50)) { trend += clamp(((s.ema20! - s.ema50!) / s.ema50!) * 100); trendN++; }
  if (Number.isFinite(s.ema50) && Number.isFinite(s.ema200)) { trend += clamp(((s.ema50! - s.ema200!) / s.ema200!) * 100 / 2); trendN++; }
  if (Number.isFinite(s.vwap)) { trend += clamp(((price - s.vwap!) / s.vwap!) * 100); trendN++; }
  if (Number.isFinite(s.plusDI) && Number.isFinite(s.minusDI) && Number.isFinite(s.adx14)) {
    const diff = (s.plusDI! - s.minusDI!) / 50;   // ~[-1,1]
    const strength = Math.min(1, (s.adx14 ?? 0) / 40);
    trend += clamp(diff) * strength;
    trendN++;
  }
  trend = trendN ? trend / trendN : 0;

  // ── MOMENTUM ──
  let mom = 0, momN = 0;
  if (Number.isFinite(s.rsi14)) { mom += clamp((s.rsi14! - 50) / 20); momN++; }
  if (Number.isFinite(s.macdHist) && Number.isFinite(s.price)) {
    mom += clamp(((s.macdHist ?? 0) / Math.max(1e-9, Math.abs(s.price ?? 1) * 0.002)));
    momN++;
  }
  if (Number.isFinite(s.roc10)) { mom += clamp((s.roc10 ?? 0) / 3); momN++; }
  if (Number.isFinite(s.trix)) { mom += clamp((s.trix ?? 0) * 50); momN++; }
  mom = momN ? mom / momN : 0;

  // ── OSCILLATORS ──
  let osc = 0, oscN = 0;
  if (Number.isFinite(s.stochK)) { osc += clamp((s.stochK! - 50) / 30); oscN++; }
  if (Number.isFinite(s.stochRsiK)) { osc += clamp((s.stochRsiK! - 50) / 30); oscN++; }
  if (Number.isFinite(s.wpr14)) { osc += clamp(((s.wpr14 ?? 0) + 50) / 30); oscN++; } // -100..0 range; +50 shifts to -50..+50
  if (Number.isFinite(s.cci20)) { osc += clamp((s.cci20 ?? 0) / 150); oscN++; }
  osc = oscN ? osc / oscN : 0;

  // ── VOLUME ──
  let vol = 0, volN = 0;
  if (Number.isFinite(s.mfi14)) { vol += clamp((s.mfi14! - 50) / 25); volN++; }
  if (Number.isFinite(s.cmf)) { vol += clamp((s.cmf ?? 0) * 5); volN++; }
  vol = volN ? vol / volN : 0;

  const raw = 0.40 * trend + 0.30 * mom + 0.20 * osc + 0.10 * vol;
  const score = Math.round(sigma(raw * 2, 1) * 100); // smooth-squash to -100..100

  let signal: Sig = "NEUTRAL";
  if (score >= 55) signal = "STRONG BUY";
  else if (score >= 20) signal = "BUY";
  else if (score <= -55) signal = "STRONG SELL";
  else if (score <= -20) signal = "SELL";

  return {
    score, signal, bars: candles.length, price, change,
    components: { trend, momentum: mom, osc, vol },
    detail: {
      rsi: s.rsi14 ?? NaN,
      macdHist: s.macdHist ?? NaN,
      adx: s.adx14 ?? NaN,
      ema20: s.ema20 ?? NaN,
      ema50: s.ema50 ?? NaN,
      vwap: s.vwap ?? NaN,
    },
    updatedAt: candles[candles.length - 1]?.timestamp ?? Date.now(),
  };
}

const sigColor = (s: Sig) =>
  s === "STRONG BUY" ? "text-emerald-400"
  : s === "BUY" ? "text-green-400"
  : s === "SELL" ? "text-red-400"
  : s === "STRONG SELL" ? "text-rose-500"
  : "text-yellow-300";
const sigBg = (s: Sig) =>
  s === "STRONG BUY" ? "border-emerald-500/40 bg-emerald-500/10"
  : s === "BUY" ? "border-green-500/30 bg-green-500/5"
  : s === "SELL" ? "border-red-500/30 bg-red-500/5"
  : s === "STRONG SELL" ? "border-rose-500/40 bg-rose-500/10"
  : "border-yellow-500/20 bg-yellow-500/5";

export default function LiveMTFConsensus({ pair }: { pair: string }) {
  const c1m  = useLiveCandles(pair, "1m");
  const c5m  = useLiveCandles(pair, "5m");
  const c15m = useLiveCandles(pair, "15m");
  const c30m = useLiveCandles(pair, "30m");
  const c1h  = useLiveCandles(pair, "1h");
  const c4h  = useLiveCandles(pair, "4h");
  const c1d  = useLiveCandles(pair, "1d");

  const byTf: Record<TF, any[]> = { "1m": c1m, "5m": c5m, "15m": c15m, "30m": c30m, "1h": c1h, "4h": c4h, "1d": c1d };

  const rows = useMemo(() => TFS.map(tf => ({ tf, out: scoreTF(byTf[tf]) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c1m.length, c5m.length, c15m.length, c30m.length, c1h.length, c4h.length, c1d.length,
     c1m[c1m.length - 1]?.close, c5m[c5m.length - 1]?.close, c15m[c15m.length - 1]?.close,
     c30m[c30m.length - 1]?.close, c1h[c1h.length - 1]?.close, c4h[c4h.length - 1]?.close, c1d[c1d.length - 1]?.close]);

  const tickRef = useRef(0);
  const [, rerender] = useState(0);
  useEffect(() => { tickRef.current++; rerender(x => x + 1); }, [rows]);

  // Overall = TF-weighted score
  let wSum = 0, wTot = 0, agreed = 0, dir = 0;
  for (const r of rows) {
    if (!r.out) continue;
    const w = TF_WEIGHT[r.tf];
    wSum += r.out.score * w; wTot += w;
    if (r.out.score >= 20) dir++;
    else if (r.out.score <= -20) dir--;
  }
  const overallScore = wTot ? wSum / wTot : 0;
  for (const r of rows) {
    if (!r.out) continue;
    if (overallScore > 0 && r.out.score > 0) agreed++;
    if (overallScore < 0 && r.out.score < 0) agreed++;
  }
  const overall: Sig =
    overallScore >= 55 ? "STRONG BUY" :
    overallScore >= 20 ? "BUY" :
    overallScore <= -55 ? "STRONG SELL" :
    overallScore <= -20 ? "SELL" : "NEUTRAL";
  const conf = Math.round(Math.abs(overallScore));
  const valid = rows.filter(r => r.out).length;

  const latestBar = Math.max(0, ...rows.map(r => r.out?.updatedAt ?? 0));
  const secsAgo = latestBar ? Math.max(0, Math.floor((Date.now() - latestBar) / 1000)) : -1;

  return (
    <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4">
      {/* header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Timeframe Consensus</h2>
          <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE · {pair}
          </span>
          <span className="text-[9px] text-slate-500">tick #{tickRef.current} · {secsAgo >= 0 ? `${secsAgo}s ago` : "…"}</span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Overall:</span>
          <span className={`font-bold px-2 py-0.5 rounded border ${sigBg(overall)} ${sigColor(overall)}`}>{overall}</span>
          <span>Score <span className={`font-bold ${overallScore >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{overallScore.toFixed(0)}</span></span>
          <span>Conviction <span className="text-cyan-300 font-bold">{conf}%</span></span>
          <span>Agreed <span className="text-cyan-300 font-bold">{agreed}/{valid}</span></span>
        </div>
      </div>

      {/* tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {rows.map(r => {
          if (!r.out) {
            return (
              <div key={r.tf} className="border border-slate-800 bg-slate-900/40 rounded-lg p-3">
                <div className="text-xs font-mono text-slate-400">{r.tf.toUpperCase()}</div>
                <div className="text-xs text-slate-600 mt-2">bootstrapping…</div>
                <div className="text-[9px] text-slate-700">{byTf[r.tf].length} bars</div>
              </div>
            );
          }
          const { out } = r;
          const barPct = Math.abs(out.score);
          const barColor =
            out.score >= 55 ? "bg-emerald-500" :
            out.score >= 20 ? "bg-green-500" :
            out.score <= -55 ? "bg-rose-500" :
            out.score <= -20 ? "bg-red-500" : "bg-yellow-500";
          return (
            <div key={r.tf} className={`border rounded-lg p-3 ${sigBg(out.signal)}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-slate-200">{r.tf.toUpperCase()}</div>
                <div className={`text-[10px] font-mono ${out.change >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {out.change >= 0 ? "+" : ""}{out.change.toFixed(2)}%
                </div>
              </div>
              <div className={`text-sm font-bold mt-1 ${sigColor(out.signal)}`}>{out.signal}</div>
              <div className="bg-slate-950 rounded h-1.5 mt-1.5 overflow-hidden relative">
                <div className="absolute top-0 bottom-0 w-px bg-slate-700 left-1/2" />
                <div className={`absolute top-0 h-full ${barColor}`}
                  style={{
                    left: out.score >= 0 ? "50%" : `${50 - barPct / 2}%`,
                    width: `${barPct / 2}%`,
                  }} />
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                score <span className={out.score >= 0 ? "text-emerald-300" : "text-rose-300"}>{out.score}</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 font-mono leading-tight">
                RSI {Number.isFinite(out.detail.rsi) ? out.detail.rsi.toFixed(0) : "—"} ·
                MACD {out.detail.macdHist > 0 ? "▲" : out.detail.macdHist < 0 ? "▼" : "·"} ·
                ADX {Number.isFinite(out.detail.adx) ? out.detail.adx.toFixed(0) : "—"}
              </div>
              <div className="text-[9px] text-slate-600 mt-0.5">{out.bars} bars · ${out.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
            </div>
          );
        })}
      </div>

      {/* breakdown strip */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-[10px]">
        <Component label="TREND" rows={rows} get={r => r?.components.trend ?? 0} />
        <Component label="MOMENTUM" rows={rows} get={r => r?.components.momentum ?? 0} />
        <Component label="OSCILLATORS" rows={rows} get={r => r?.components.osc ?? 0} />
        <Component label="VOLUME" rows={rows} get={r => r?.components.vol ?? 0} />
      </div>
    </div>
  );
}

function Component({ label, rows, get }: { label: string; rows: { tf: TF; out: ScoreOut | null }[]; get: (o: ScoreOut | null) => number }) {
  let sum = 0, n = 0;
  for (const r of rows) { if (!r.out) continue; sum += get(r.out) * TF_WEIGHT[r.tf]; n += TF_WEIGHT[r.tf]; }
  const v = n ? sum / n : 0;
  const pct = Math.round(Math.abs(v) * 100);
  const color = v > 0.1 ? "bg-emerald-500" : v < -0.1 ? "bg-rose-500" : "bg-slate-500";
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`font-mono ${v > 0 ? "text-emerald-300" : v < 0 ? "text-rose-300" : "text-slate-400"}`}>
          {v >= 0 ? "+" : ""}{(v * 100).toFixed(0)}
        </span>
      </div>
      <div className="relative h-1 mt-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-px bg-slate-700 left-1/2" />
        <div className={`absolute top-0 h-full ${color}`}
          style={{ left: v >= 0 ? "50%" : `${50 - pct / 2}%`, width: `${pct / 2}%` }} />
      </div>
    </div>
  );
}
