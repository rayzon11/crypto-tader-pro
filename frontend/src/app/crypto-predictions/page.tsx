"use client";

import { useEffect, useState } from "react";
import CandleChart from "@/components/CandleChart";
import { useBinanceChart } from "@/hooks/useBinanceChart";

const API = "http://localhost:3002";
const TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;
type TF = typeof TFS[number];

interface Prediction {
  symbol?: string;
  timeframe?: string;
  horizonMinutes?: number;
  currentPrice?: number;
  signal?: string;
  confidence?: number;
  prediction?: string;
  targetPrice?: number;
  tp1?: number;
  tp2?: number;
  stopLoss?: number;
  riskReward?: number;
  supportingSignals?: string[];
  scores?: { buy?: number; sell?: number };
}

interface Matrix {
  pair?: string;
  matrix?: Record<string, Prediction | null | undefined>;
  consensus?: {
    overallSignal?: string;
    avgConfidence?: number;
    agreedTimeframes?: string[];
  };
  equations?: Record<string, string>;
}

// ─── Safe formatters — never throw, even on undefined/NaN ───
const num = (n: unknown, d = 2): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : null;
  return v === null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: d });
};
const pct = (n: unknown, d = 0): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : null;
  return v === null ? "—" : `${v.toFixed(d)}%`;
};
const usd = (n: unknown, d = 2): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : null;
  return v === null ? "—" : `$${v.toLocaleString(undefined, { maximumFractionDigits: d })}`;
};
const rr = (n: unknown): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : null;
  return v === null ? "—" : `${v.toFixed(2)}:1`;
};

async function safeJson<T = any>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Agent YES/NO verdict: YES only if STRONG BUY/SELL + conf ≥ 75 + R:R ≥ 2 */
function agentVerdict(p: Prediction | null | undefined): { verdict: "YES" | "NO"; reason: string; side: "LONG" | "SHORT" | "NONE" } {
  if (!p || !p.signal) return { verdict: "NO", reason: "No signal yet — waiting for data", side: "NONE" };
  const strong = p.signal.includes("STRONG");
  const directional = p.signal.includes("BUY") || p.signal.includes("SELL");
  const conf = typeof p.confidence === "number" ? p.confidence : 0;
  const rrVal = typeof p.riskReward === "number" ? p.riskReward : 0;

  if (!directional) return { verdict: "NO", reason: "Signal is neutral/hold — no directional edge", side: "NONE" };
  if (conf < 75) return { verdict: "NO", reason: `Confidence ${conf}% below 75% threshold`, side: "NONE" };
  if (rrVal < 2) return { verdict: "NO", reason: `R:R ${rrVal.toFixed(2)} below 2:1 minimum`, side: "NONE" };
  if (!strong) return { verdict: "NO", reason: "Not STRONG — waiting for high-conviction setup", side: "NONE" };

  const side: "LONG" | "SHORT" = p.signal.includes("BUY") ? "LONG" : "SHORT";
  return {
    verdict: "YES",
    reason: `${side} — ${p.signal} · ${conf}% conf · ${rrVal.toFixed(2)}:1 R:R · all gates passed`,
    side,
  };
}

interface ForecastHorizon {
  horizon: string; minutes: number;
  price: number; low: number; high: number;
  pct: number; confidence: number;
  verdict?: "YES" | "NO"; side?: "LONG" | "SHORT" | "FLAT"; reason?: string;
}
interface PredictorStatus {
  agent?: string; symbol?: string; lastUpdate?: number;
  forecast?: {
    spot?: number; direction?: string; atr5m?: number;
    realizedVolPct?: number; liquidityImbalance?: number; change24hPct?: number;
    horizons?: ForecastHorizon[];
  } | null;
  mapePct?: Record<string, number | null>;
  samples?: number;
}

function SymbolSection({ symbol, base, quote, accent }: { symbol: string; base: string; quote: string; accent: string }) {
  const [activeTF, setActiveTF] = useState<TF>("5m");
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [predictor, setPredictor] = useState<PredictorStatus | null>(null);
  const { candles, price, change24h, connected, error } = useBinanceChart(`${base}/${quote}`, activeTF);

  useEffect(() => {
    let alive = true;
    const endpoint = base.toLowerCase() === "btc" ? "btc" : base.toLowerCase() === "eth" ? "eth" : null;
    const load = async () => {
      const [m, p] = await Promise.all([
        safeJson<Matrix>(`${API}/api/agent/matrix/${base}/${quote}`),
        endpoint ? safeJson<PredictorStatus>(`${API}/api/predictor/${endpoint}`) : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (m) setMatrix(m);
      if (p) setPredictor(p);
    };
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [base, quote]);

  const active: Prediction | null = (matrix?.matrix?.[activeTF] ?? null) as Prediction | null;
  const verdict = agentVerdict(active);
  const livePrice = price ?? active?.currentPrice ?? null;
  const change = change24h ?? 0;

  const signalColor = (s?: string) =>
    !s ? "text-slate-400"
    : s.includes("BUY") ? "text-green-400"
    : s.includes("SELL") ? "text-red-400"
    : "text-yellow-300";

  return (
    <div className="border-2 rounded bg-black overflow-hidden" style={{ borderColor: accent }}>
      {/* SECTION HEADER */}
      <div className="px-4 py-3 border-b" style={{ borderColor: `${accent}66`, background: `${accent}10` }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[10px] tracking-[0.3em] opacity-70">AUTONOMOUS PREDICTION AGENT</div>
            <div className="text-xl font-bold mt-0.5" style={{ color: accent }}>◆ {symbol.split("/")[0]} PRICE PREDICTION</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] opacity-60 tracking-wider">LIVE PRICE</div>
              <div className="text-2xl font-bold text-white tabular-nums">{usd(livePrice)}</div>
              <div className={`text-xs font-bold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% · 24h
              </div>
            </div>
            <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
              connected ? "border-green-400 text-green-400" : "border-yellow-400 text-yellow-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-yellow-400"} animate-pulse`} />
              {connected ? "LIVE · BINANCE WS" : "CONNECTING"}
            </div>
          </div>
        </div>
      </div>

      {/* AGENT VERDICT — BIG YES/NO BANNER */}
      <div className="px-4 py-4 border-b border-slate-800 grid grid-cols-[auto_1fr] gap-6 items-center">
        <div className="text-center">
          <div className="text-[10px] opacity-60 tracking-[0.3em] mb-1">AGENT VERDICT</div>
          <div
            className={`text-6xl font-black px-6 py-2 rounded-lg border-4 ${
              verdict.verdict === "YES"
                ? "text-green-400 border-green-400 bg-green-500/10 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                : "text-red-400 border-red-400 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            }`}
          >
            {verdict.verdict}
          </div>
          <div className="mt-1 text-[10px] opacity-70">Should we take the trade?</div>
        </div>
        <div>
          <div className="text-xs opacity-60 mb-1">REASONING ({activeTF.toUpperCase()})</div>
          <div className="text-sm font-bold" style={{ color: verdict.verdict === "YES" ? "#10b981" : "#f87171" }}>
            {verdict.reason}
          </div>
          {active && (
            <div className="grid grid-cols-4 gap-3 mt-3 text-[11px] font-mono">
              <KV label="SIGNAL" value={active.signal ?? "—"} cls={signalColor(active.signal)} />
              <KV label="CONFIDENCE" value={pct(active.confidence)} cls={(active.confidence ?? 0) >= 75 ? "text-green-400" : "text-yellow-300"} />
              <KV label="R:R" value={rr(active.riskReward)} cls={(active.riskReward ?? 0) >= 2 ? "text-green-400" : "text-yellow-300"} />
              <KV label="HORIZON" value={active.horizonMinutes != null ? `${active.horizonMinutes}m` : "—"} />
              <KV label="ENTRY" value={usd(active.currentPrice)} cls="text-white" />
              <KV label="TP1" value={usd(active.tp1)} cls="text-green-400" />
              <KV label="TP2" value={usd(active.tp2)} cls="text-green-400" />
              <KV label="STOP LOSS" value={usd(active.stopLoss)} cls="text-red-400" />
            </div>
          )}
          {active?.supportingSignals && active.supportingSignals.length > 0 && (
            <div className="mt-2 text-[10px] opacity-70 leading-relaxed">
              ▸ {active.supportingSignals.slice(0, 10).join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/* TF SELECTOR */}
      <div className="flex gap-1 p-2 border-b border-slate-800">
        {TFS.map(tf => (
          <button
            key={tf}
            onClick={() => setActiveTF(tf)}
            className={`flex-1 px-2 py-1.5 rounded text-[11px] font-bold transition-colors ${
              activeTF === tf ? "text-black" : "bg-slate-900 text-green-400 hover:bg-slate-800"
            }`}
            style={activeTF === tf ? { background: accent } : {}}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* FUTURE-PRICE FORECAST LADDER — dedicated predictor agent */}
      {predictor?.forecast?.horizons && predictor.forecast.horizons.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[10px] tracking-[0.3em] opacity-70">DEDICATED FUTURE-PRICE PREDICTOR AGENT</div>
              <div className="text-sm font-bold" style={{ color: accent }}>
                ◆ {predictor.agent} · {base} forecast ladder
                <span className="ml-2 text-[10px] opacity-60">
                  direction <span className={
                    predictor.forecast.direction === "UP" ? "text-green-400"
                    : predictor.forecast.direction === "DOWN" ? "text-red-400" : "text-yellow-300"
                  }>{predictor.forecast.direction}</span>
                  {" · "}vol/min {num(predictor.forecast.realizedVolPct, 4)}%
                  {" · "}liq-imbalance {num(predictor.forecast.liquidityImbalance, 3)}
                  {" · "}24h {num(predictor.forecast.change24hPct, 2)}%
                </span>
              </div>
            </div>
            <div className="text-[10px] opacity-60">
              spot <span className="text-white font-bold">{usd(predictor.forecast.spot)}</span>
              {" · "}samples <span className="text-white">{predictor.samples ?? 0}</span>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2 text-[11px] font-mono">
            {predictor.forecast.horizons.map((h) => {
              const up = h.pct >= 0;
              const mape = predictor.mapePct?.[h.horizon];
              const yes = h.verdict === "YES";
              return (
                <div
                  key={h.horizon}
                  className="p-2 rounded border bg-black/60 relative"
                  style={{ borderColor: yes ? (up ? "#10b981" : "#ef4444") : "rgba(100,116,139,0.4)" }}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-white">T+{h.horizon}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      yes ? (up ? "bg-green-500/20 text-green-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                : "bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]")
                          : "bg-slate-800 text-slate-400"
                    }`}>
                      {h.verdict ?? "—"}
                    </span>
                  </div>
                  <div className={`text-[10px] font-bold mt-1 ${up ? "text-green-400" : "text-red-400"}`}>
                    {up ? "▲ LONG" : "▼ SHORT"} {up ? "+" : ""}{num(h.pct, 2)}%
                  </div>
                  <div className="text-lg font-bold tabular-nums mt-0.5" style={{ color: up ? "#10b981" : "#f87171" }}>
                    {usd(h.price)}
                  </div>
                  <div className="text-[9px] opacity-70 mt-0.5">
                    1σ: {usd(h.low)} – {usd(h.high)}
                  </div>
                  <div className="flex justify-between text-[9px] mt-1">
                    <span className="opacity-60">conf</span>
                    <span className={h.confidence >= 0.7 ? "text-green-400" : "text-yellow-300"}>
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </div>
                  {mape != null && (
                    <div className="flex justify-between text-[9px]">
                      <span className="opacity-60">MAPE</span>
                      <span className="text-cyan-400">{num(mape, 2)}%</span>
                    </div>
                  )}
                  {h.reason && (
                    <div className="text-[8px] opacity-60 mt-1 leading-tight truncate" title={h.reason}>
                      {h.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CHART */}
      <div className="p-2 border-b border-slate-800">
        {candles.length > 0 ? (
          <CandleChart
            candles={candles}
            height={420}
            showVolume
            title={`${symbol} · ${activeTF.toUpperCase()} · ${candles.length} candles · EMA20/50 + Bollinger Bands + Volume`}
          />
        ) : (
          <div className="h-[420px] flex items-center justify-center opacity-60 text-xs">
            {error || "Loading Binance candles…"}
          </div>
        )}
      </div>

      {/* ALL 8 TIMEFRAME PREDICTIONS */}
      <div className="p-4">
        <div className="text-xs font-bold tracking-widest mb-2 opacity-80">◆ ALL 8 TIMEFRAMES · AGENT FORECASTS</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          {TFS.map(tf => {
            const p = matrix?.matrix?.[tf];
            const v = agentVerdict(p);
            const isActive = tf === activeTF;
            if (!p) {
              return (
                <div key={tf} className="p-2 rounded border border-slate-700 bg-slate-900/40 opacity-50 flex justify-between">
                  <span className="font-bold">{tf.toUpperCase()}</span>
                  <span>Loading…</span>
                </div>
              );
            }
            return (
              <button
                key={tf}
                onClick={() => setActiveTF(tf)}
                className={`text-left p-2 rounded border transition-colors ${
                  isActive ? "border-green-400 bg-green-500/5" : "border-slate-700 bg-black hover:border-slate-500"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold w-10 text-white">{tf.toUpperCase()}</span>
                  <span className={`font-bold ${signalColor(p.signal)}`}>{p.signal ?? "—"}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    v.verdict === "YES" ? "bg-green-500/20 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {v.verdict}
                  </span>
                </div>
                <div className="opacity-80 text-[10px]">
                  Target <span className="text-white font-bold">{usd(p.targetPrice)}</span>
                  {" · "}conf <span className="text-white">{pct(p.confidence)}</span>
                  {" · "}R:R <span className="text-white">{rr(p.riskReward)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* CONSENSUS */}
        {matrix?.consensus && (
          <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] grid grid-cols-3 gap-2">
            <KV label="◆ OVERALL SIGNAL" value={matrix.consensus.overallSignal ?? "—"} cls={signalColor(matrix.consensus.overallSignal)} />
            <KV label="AVG CONFIDENCE" value={pct(matrix.consensus.avgConfidence)} />
            <KV label="AGREED TFs" value={`${matrix.consensus.agreedTimeframes?.length ?? 0} / 8`} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CryptoPredictionsPage() {
  const [equations, setEquations] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const m = await safeJson<Matrix>(`${API}/api/agent/matrix/BTC/USDT`);
      if (m?.equations) setEquations(m.equations);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 space-y-6" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      <div className="border-b border-green-500/40 pb-2 flex items-center justify-between text-xs">
        <span className="font-bold tracking-widest">◆ CRYPTO PRICE PREDICTIONS · BITCOIN + ETHEREUM ONLY · YES/NO AGENT VERDICT</span>
        <span className="opacity-70">[Binance live WS · 8 timeframes · 30+ indicators · gated at 75% conf + 2:1 R:R]</span>
      </div>

      {/* BTC — full width, own chart */}
      <SymbolSection symbol="BTC/USDT" base="BTC" quote="USDT" accent="#f7931a" />

      {/* ETH — full width, own chart */}
      <SymbolSection symbol="ETH/USDT" base="ETH" quote="USDT" accent="#627eea" />

      {/* MATH FORMULAS */}
      <div className="border border-green-500/40 rounded bg-black p-4">
        <div className="text-xs font-bold tracking-widest mb-3 opacity-80">◆ MATHEMATICAL MODELS BEHIND EVERY PREDICTION</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono">
          {Object.entries(equations).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-green-400 font-bold uppercase w-20">{k}</span>
              <span className="opacity-80">{v}</span>
            </div>
          ))}
          {Object.keys(equations).length === 0 && <div className="opacity-60">Loading equations…</div>}
        </div>
        <div className="text-[10px] opacity-60 mt-3 leading-relaxed">
          YES verdict requires ALL of: STRONG directional signal · confidence ≥ 75% · R:R ≥ 2:1.
          Consensus = max(buyScore, sellScore) / (buyScore + sellScore).
          Target = P ± ATR·mult(conf). 500 candles/TF bootstrapped from Binance REST,
          sub-second ticks from kline WebSocket. All indicators Wilder-smoothed (RSI, ATR, ADX).
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="opacity-50 text-[9px] uppercase tracking-wider">{label}</span>
      <span className={`font-bold ${cls}`}>{value}</span>
    </div>
  );
}
