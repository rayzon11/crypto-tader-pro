"use client";
/**
 * OptionsGreeksPanel — Black-Scholes Greeks for crypto options
 * ─────────────────────────────────────────────────────────────
 * Pulls spot from Binance, lets user set strike/DTE/IV/rate, and
 * computes delta/gamma/vega/theta/rho + option price in real time.
 * Intended as a quick what-if calculator for hedging desks.
 *
 * Math: closed-form Black-Scholes (European). For American/perpetual
 * this is an approximation — good enough for directional Greeks.
 */
import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3002";

// Standard normal PDF / CDF
function pdf(x: number) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
function cdf(x: number) {
  // Abramowitz-Stegun approximation — 7.5e-8 accuracy
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;   // per 1 vol point (0.01)
  theta: number;  // per day
  rho: number;    // per 1% rate
  d1: number;
  d2: number;
}

function bs(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): Greeks {
  if (T <= 0 || sigma <= 0) {
    const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price: intrinsic, delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
             gamma: 0, vega: 0, theta: 0, rho: 0, d1: 0, d2: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const Nd1 = cdf(d1), Nd2 = cdf(d2);
  const pd1 = pdf(d1);
  const disc = Math.exp(-r * T);

  const price = isCall
    ? S * Nd1 - K * disc * Nd2
    : K * disc * cdf(-d2) - S * cdf(-d1);

  const delta = isCall ? Nd1 : Nd1 - 1;
  const gamma = pd1 / (S * sigma * sqrtT);
  const vega = S * pd1 * sqrtT * 0.01;  // per 1 vol point
  const theta = (isCall
    ? -(S * pd1 * sigma) / (2 * sqrtT) - r * K * disc * Nd2
    : -(S * pd1 * sigma) / (2 * sqrtT) + r * K * disc * cdf(-d2)
  ) / 365;  // per day
  const rho = (isCall ? K * T * disc * Nd2 : -K * T * disc * cdf(-d2)) * 0.01;  // per 1% rate

  return { price, delta, gamma, vega, theta, rho, d1, d2 };
}

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

export default function OptionsGreeksPanel() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [spot, setSpot] = useState<number>(0);
  const [strikePct, setStrikePct] = useState(100);  // % of spot
  const [dte, setDte] = useState(30);               // days
  const [ivPct, setIvPct] = useState(65);           // annualized vol %
  const [ratePct, setRatePct] = useState(5);        // risk-free %
  const [side, setSide] = useState<"CALL" | "PUT">("CALL");

  // Live spot
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/ticker?symbol=${symbol}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stopped && j?.price) setSpot(j.price);
      } catch {}
    };
    load();
    const id = setInterval(load, 5000);
    return () => { stopped = true; clearInterval(id); };
  }, [symbol]);

  const { g, strike, T, r, sigma, isCall } = useMemo(() => {
    const strike = spot * (strikePct / 100);
    const T = Math.max(0.0001, dte / 365);
    const r = ratePct / 100;
    const sigma = ivPct / 100;
    const isCall = side === "CALL";
    const g = bs(spot || 1, strike || 1, T, r, sigma, isCall);
    return { g, strike, T, r, sigma, isCall };
  }, [spot, strikePct, dte, ivPct, ratePct, side]);

  // Scenario ladder — PnL at ±10% spot moves
  const ladder = useMemo(() => {
    if (!spot) return [] as { s: number; price: number; pnl: number }[];
    const pts: { s: number; price: number; pnl: number }[] = [];
    for (let pct = -10; pct <= 10; pct += 2) {
      const s = spot * (1 + pct / 100);
      const gg = bs(s, strike, T, r, sigma, isCall);
      pts.push({ s, price: gg.price, pnl: gg.price - g.price });
    }
    return pts;
  }, [spot, strike, T, r, sigma, isCall, g.price]);

  const moneyness = spot > 0 ? (isCall ? (spot > strike ? "ITM" : "OTM") : (spot < strike ? "ITM" : "OTM")) : "—";
  const moneyColor = moneyness === "ITM" ? "text-emerald-400" : moneyness === "OTM" ? "text-rose-400" : "text-slate-400";

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-amber-950/10 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            OPTIONS GREEKS · BLACK-SCHOLES · LIVE SPOT
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {symbol.replace("USDT","")} spot <span className="text-amber-300">${spot.toFixed(2)}</span>
            <span className="text-slate-400 ml-2">strike ${strike.toFixed(0)}</span>
            <span className={`ml-2 ${moneyColor}`}>{moneyness}</span>
          </div>
        </div>
        <div className="flex gap-1">
          {PAIRS.map(p => (
            <button key={p} onClick={() => setSymbol(p)}
              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                symbol === p ? "bg-amber-500 text-black border-amber-500" : "border-slate-700 text-slate-300 hover:border-amber-500/50"
              }`}>{p.replace("USDT","")}</button>
          ))}
        </div>
      </div>

      {/* Input sliders */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
        <div>
          <div className="flex justify-between text-slate-400">
            <span>Side</span>
          </div>
          <div className="flex gap-1 mt-1">
            <button onClick={() => setSide("CALL")}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-bold border ${
                side === "CALL" ? "bg-emerald-500 text-black border-emerald-500" : "border-slate-700 text-slate-300"}`}>CALL</button>
            <button onClick={() => setSide("PUT")}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-bold border ${
                side === "PUT" ? "bg-rose-500 text-black border-rose-500" : "border-slate-700 text-slate-300"}`}>PUT</button>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-slate-400">
            <span>Strike</span><span className="text-slate-200 font-bold">{strikePct}%</span>
          </div>
          <input type="range" min={50} max={150} step={1} value={strikePct}
            onChange={e => setStrikePct(+e.target.value)} className="w-full accent-amber-400" />
        </div>
        <div>
          <div className="flex justify-between text-slate-400">
            <span>DTE</span><span className="text-slate-200 font-bold">{dte}d</span>
          </div>
          <input type="range" min={1} max={365} step={1} value={dte}
            onChange={e => setDte(+e.target.value)} className="w-full accent-amber-400" />
        </div>
        <div>
          <div className="flex justify-between text-slate-400">
            <span>IV</span><span className="text-slate-200 font-bold">{ivPct}%</span>
          </div>
          <input type="range" min={10} max={200} step={1} value={ivPct}
            onChange={e => setIvPct(+e.target.value)} className="w-full accent-amber-400" />
        </div>
        <div>
          <div className="flex justify-between text-slate-400">
            <span>Rate</span><span className="text-slate-200 font-bold">{ratePct}%</span>
          </div>
          <input type="range" min={0} max={15} step={0.25} value={ratePct}
            onChange={e => setRatePct(+e.target.value)} className="w-full accent-amber-400" />
        </div>
      </div>

      {/* Greeks grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Tile label="PRICE" value={`$${g.price.toFixed(2)}`} accent="amber" sub={`${((g.price/spot)*100).toFixed(2)}% of spot`} />
        <Tile label="DELTA" value={g.delta.toFixed(3)} accent={g.delta >= 0 ? "emerald" : "rose"} sub="$ move per $1 spot" />
        <Tile label="GAMMA" value={g.gamma.toFixed(5)} accent="indigo" sub="Δ convexity" />
        <Tile label="VEGA" value={g.vega.toFixed(2)} accent="cyan" sub="per 1 vol pt" />
        <Tile label="THETA" value={g.theta.toFixed(2)} accent="rose" sub="$ decay / day" />
        <Tile label="RHO" value={g.rho.toFixed(3)} accent="slate" sub="per 1% rate" />
      </div>

      {/* Scenario ladder */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">SPOT SCENARIO · PnL LADDER</div>
        <div className="grid grid-cols-11 gap-1 text-[10px] font-mono">
          {ladder.map((pt, i) => {
            const up = pt.pnl >= 0;
            return (
              <div key={i} className={`p-1 rounded text-center border ${
                up ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
              }`}>
                <div className="text-slate-400">${pt.s.toFixed(0)}</div>
                <div className={`font-bold ${up ? "text-emerald-300" : "text-rose-300"}`}>
                  {up ? "+" : ""}{pt.pnl.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-2">
        European Black-Scholes · d1={g.d1.toFixed(3)} d2={g.d2.toFixed(3)} · T={T.toFixed(4)}y · For American/perpetual
        treat Greeks as directional estimates. Flat rate curve assumed.
      </div>
    </div>
  );
}

function Tile({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  const colorMap: Record<string, string> = {
    amber:   "text-amber-300 border-amber-500/30",
    emerald: "text-emerald-300 border-emerald-500/30",
    rose:    "text-rose-300 border-rose-500/30",
    indigo:  "text-indigo-300 border-indigo-500/30",
    cyan:    "text-cyan-300 border-cyan-500/30",
    slate:   "text-slate-300 border-slate-500/30",
  };
  return (
    <div className={`rounded border p-2 ${colorMap[accent] || colorMap.slate}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-base font-bold font-mono">{value}</div>
      <div className="text-[9px] opacity-50 mt-0.5">{sub}</div>
    </div>
  );
}
