"use client";
/**
 * Hedge-Fund / Bloomberg / JP Morgan-style analyst console.
 * All data computed from LIVE Binance REST + WS. No backend dependency.
 *
 * Panels:
 *   1. MARKET BREADTH       — % of majors above EMA50 + 24h advancers/decliners
 *   2. VOLATILITY REGIME    — ATR%, realized vol, Bollinger bandwidth
 *   3. SECTOR / FACTOR      — Momentum, Mean-Reversion, Trend, Volatility factor scores
 *   4. CORRELATION MATRIX   — live pairwise correlations (30-period)
 *   5. RISK METRICS         — Sharpe, max drawdown, VaR 95/99, Sortino
 *   6. LIQUIDITY DESK       — 24h volume, bid-ask spread
 *   7. FUNDING RATES        — Perp funding across major symbols
 *   8. RISK PARITY WEIGHTS  — inverse-vol portfolio construction
 */
import { useEffect, useMemo, useState } from "react";
import { useBinanceTickers } from "@/hooks/useBinanceTickers";
import { ATR, bollinger, EMA, RSI, SMA, type Candle } from "@/lib/indicators";

const UNIVERSE = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
  "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "LINK/USDT", "MATIC/USDT",
  "DOT/USDT", "LTC/USDT", "UNI/USDT", "ATOM/USDT",
];
const num = (n: any, d = 2) => (Number.isFinite(n) ? Number(n).toFixed(d) : "—");
const pct = (n: any, d = 2) => (Number.isFinite(n) ? `${Number(n).toFixed(d)}%` : "—");
const compact = (n: any) => !Number.isFinite(n) ? "—" : n > 1e9 ? `$${(n/1e9).toFixed(2)}B` : n > 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${(n/1e3).toFixed(1)}k`;

interface KlineSet { [pair: string]: Candle[] }
interface FundingRate { symbol: string; rate: number; nextFunding: number }

async function fetchKlines(pair: string, interval = "1h", limit = 100): Promise<Candle[]> {
  try {
    const sym = pair.replace("/", "");
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.map((k: any[]) => ({
      timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
    }));
  } catch { return []; }
}

async function fetchFundingRates(): Promise<FundingRate[]> {
  try {
    const r = await fetch("https://fapi.binance.com/fapi/v1/premiumIndex");
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((d: any) => UNIVERSE.some(u => u.replace("/", "") === d.symbol))
      .map((d: any) => ({
        symbol: d.symbol,
        rate: +d.lastFundingRate * 100,
        nextFunding: +d.nextFundingTime,
      }));
  } catch { return []; }
}

export default function HedgeFundAnalyst() {
  const { tickers } = useBinanceTickers(UNIVERSE);
  const [klines, setKlines] = useState<KlineSet>({});
  const [funding, setFunding] = useState<FundingRate[]>([]);
  const [lastFetch, setLastFetch] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const entries = await Promise.all(
        UNIVERSE.map(async p => [p, await fetchKlines(p, "1h", 200)] as const)
      );
      if (!alive) return;
      const map: KlineSet = {};
      for (const [p, c] of entries) if (c.length) map[p] = c;
      setKlines(map);
      setFunding(await fetchFundingRates());
      setLastFetch(Date.now());
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // ─────────────── MARKET BREADTH ───────────────
  const breadth = useMemo(() => {
    let above = 0, below = 0, advancers = 0, decliners = 0;
    for (const p of UNIVERSE) {
      const c = klines[p];
      if (!c || c.length < 50) continue;
      const price = c[c.length - 1].close;
      const ema50 = EMA(c.map(x => x.close), 50);
      const last = ema50[ema50.length - 1];
      if (Number.isFinite(last)) {
        if (price > last) above++; else below++;
      }
      const t = tickers[p];
      if (t) { if (t.change24h > 0) advancers++; else decliners++; }
    }
    const total = above + below || 1;
    return {
      pctAboveEMA50: (above / total) * 100,
      above, below, advancers, decliners,
      regime: above > below * 2 ? "RISK-ON" : below > above * 2 ? "RISK-OFF" : "NEUTRAL",
    };
  }, [klines, tickers]);

  // ─────────────── VOLATILITY REGIME ───────────────
  const volatility = useMemo(() => {
    const rows: any[] = [];
    for (const p of UNIVERSE) {
      const c = klines[p];
      if (!c || c.length < 30) continue;
      const atr14 = ATR(c, 14);
      const bb = bollinger(c.map(x => x.close), 20, 2);
      const close = c[c.length - 1].close;
      const a = atr14[atr14.length - 1];
      const bw = bb.bandwidth[bb.bandwidth.length - 1];
      const returns: number[] = [];
      for (let i = 1; i < c.length; i++) returns.push(Math.log(c[i].close / c[i - 1].close));
      const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
      const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
      const realizedVolAnn = Math.sqrt(variance) * Math.sqrt(24 * 365) * 100; // annualized
      rows.push({
        pair: p,
        atrPct: (a / close) * 100,
        bbWidth: bw,
        realizedVol: realizedVolAnn,
      });
    }
    const avgRV = rows.reduce((s, r) => s + r.realizedVol, 0) / (rows.length || 1);
    return {
      rows: rows.sort((a, b) => b.realizedVol - a.realizedVol),
      avgRealizedVol: avgRV,
      regime: avgRV > 80 ? "HIGH VOL" : avgRV > 50 ? "ELEVATED" : avgRV > 30 ? "NORMAL" : "LOW VOL",
    };
  }, [klines]);

  // ─────────────── FACTOR SCORES ───────────────
  const factors = useMemo(() => {
    const rows: any[] = [];
    for (const p of UNIVERSE) {
      const c = klines[p];
      if (!c || c.length < 50) continue;
      const closes = c.map(x => x.close);
      const price = closes[closes.length - 1];
      // Momentum: 30-period ROC
      const momentum = closes.length >= 31 ? ((price - closes[closes.length - 31]) / closes[closes.length - 31]) * 100 : 0;
      // Trend: price / EMA50
      const ema50 = EMA(closes, 50);
      const trend = ((price / ema50[ema50.length - 1]) - 1) * 100;
      // Mean-reversion: z-score vs SMA20
      const sma20 = SMA(closes, 20);
      const std = Math.sqrt(closes.slice(-20).reduce((s, v, _, a) => s + (v - sma20[sma20.length - 1]) ** 2, 0) / 20);
      const zScore = std ? (price - sma20[sma20.length - 1]) / std : 0;
      // RSI momentum
      const rsi = RSI(closes, 14);
      const rsiLast = rsi[rsi.length - 1];
      rows.push({ pair: p, momentum, trend, meanRev: -zScore, rsi: rsiLast });
    }
    return rows;
  }, [klines]);

  const factorAvg = useMemo(() => ({
    momentum: factors.reduce((s, f) => s + f.momentum, 0) / (factors.length || 1),
    trend:    factors.reduce((s, f) => s + f.trend,    0) / (factors.length || 1),
    meanRev:  factors.reduce((s, f) => s + f.meanRev,  0) / (factors.length || 1),
  }), [factors]);

  // ─────────────── CORRELATION MATRIX ───────────────
  const correlations = useMemo(() => {
    const top = UNIVERSE.slice(0, 8);
    const returns: Record<string, number[]> = {};
    for (const p of top) {
      const c = klines[p];
      if (!c || c.length < 30) continue;
      const r: number[] = [];
      for (let i = 1; i < c.length; i++) r.push(Math.log(c[i].close / c[i - 1].close));
      returns[p] = r.slice(-30);
    }
    const matrix: Record<string, Record<string, number>> = {};
    const pairs = Object.keys(returns);
    for (const a of pairs) {
      matrix[a] = {};
      for (const b of pairs) {
        const ra = returns[a], rb = returns[b];
        const n = Math.min(ra.length, rb.length);
        if (!n) { matrix[a][b] = 0; continue; }
        const ma = ra.slice(-n).reduce((s, v) => s + v, 0) / n;
        const mb = rb.slice(-n).reduce((s, v) => s + v, 0) / n;
        let num = 0, da = 0, db = 0;
        for (let i = 0; i < n; i++) {
          num += (ra[i] - ma) * (rb[i] - mb);
          da += (ra[i] - ma) ** 2;
          db += (rb[i] - mb) ** 2;
        }
        matrix[a][b] = da && db ? num / Math.sqrt(da * db) : 0;
      }
    }
    return { matrix, pairs };
  }, [klines]);

  // ─────────────── RISK PARITY WEIGHTS ───────────────
  const riskParity = useMemo(() => {
    const invVols = volatility.rows.map(r => ({ pair: r.pair, invVol: 1 / (r.realizedVol || 1) }));
    const total = invVols.reduce((s, v) => s + v.invVol, 0);
    return invVols.map(v => ({ pair: v.pair, weight: (v.invVol / total) * 100 })).sort((a, b) => b.weight - a.weight);
  }, [volatility]);

  // ─────────────── PORTFOLIO RISK METRICS (BTC as proxy benchmark) ───────────────
  const btc = klines["BTC/USDT"];
  const riskMetrics = useMemo(() => {
    if (!btc || btc.length < 30) return null;
    const returns: number[] = [];
    for (let i = 1; i < btc.length; i++) returns.push((btc[i].close - btc[i - 1].close) / btc[i - 1].close);
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    const downside = Math.sqrt(returns.filter(r => r < 0).reduce((s, v) => s + v ** 2, 0) / returns.length);
    const sorted = [...returns].sort((a, b) => a - b);
    const var95 = sorted[Math.floor(returns.length * 0.05)] * 100;
    const var99 = sorted[Math.floor(returns.length * 0.01)] * 100;
    // Max drawdown
    let peak = btc[0].close, maxDD = 0;
    for (const c of btc) {
      if (c.close > peak) peak = c.close;
      const dd = (peak - c.close) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    // Annualized
    const periodsPerYear = 24 * 365;
    return {
      sharpe: std ? (mean / std) * Math.sqrt(periodsPerYear) : 0,
      sortino: downside ? (mean / downside) * Math.sqrt(periodsPerYear) : 0,
      maxDrawdown: maxDD * 100,
      var95, var99,
      annualizedVol: std * Math.sqrt(periodsPerYear) * 100,
    };
  }, [btc]);

  // ─────────────── RENDER ───────────────
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-transparent p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-amber-300 opacity-80">HEDGE FUND · QUANT DESK · LIVE</div>
          <div className="text-xl font-bold text-amber-400">🏛 JP Morgan / Bloomberg-Grade Analyst Console</div>
          <div className="text-[11px] opacity-70 mt-1">
            Universe: {UNIVERSE.length} pairs · Last refresh: {lastFetch ? new Date(lastFetch).toLocaleTimeString() : "loading"} · 1h klines · 24h ticker WS
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge label="REGIME" value={breadth.regime} cls={breadth.regime === "RISK-ON" ? "text-green-400 border-green-500" : breadth.regime === "RISK-OFF" ? "text-red-400 border-red-500" : "text-yellow-300 border-yellow-500"} />
          <Badge label="VOL" value={volatility.regime} cls={volatility.regime === "HIGH VOL" ? "text-red-400 border-red-500" : volatility.regime === "ELEVATED" ? "text-orange-400 border-orange-500" : "text-green-400 border-green-500"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* BREADTH */}
        <Panel title="◆ MARKET BREADTH">
          <Stat k="% above EMA50" v={pct(breadth.pctAboveEMA50)} cls={breadth.pctAboveEMA50 > 60 ? "text-green-400" : breadth.pctAboveEMA50 < 40 ? "text-red-400" : "text-yellow-300"} />
          <Stat k="Advancers / Decliners" v={`${breadth.advancers} / ${breadth.decliners}`} />
          <div className="mt-2 h-3 rounded overflow-hidden flex bg-slate-900">
            <div className="bg-green-500" style={{ width: `${breadth.pctAboveEMA50}%` }} />
            <div className="bg-red-500" style={{ width: `${100 - breadth.pctAboveEMA50}%` }} />
          </div>
          <div className="text-[9px] mt-1 opacity-70">
            Bull/bear ratio derived from live price-vs-EMA50 on all {UNIVERSE.length} majors
          </div>
        </Panel>

        {/* VOLATILITY */}
        <Panel title="◆ VOLATILITY REGIME">
          <Stat k="Avg Realized Vol (Ann)" v={pct(volatility.avgRealizedVol)} cls="text-orange-300" />
          <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto text-[10px] font-mono">
            {volatility.rows.slice(0, 8).map(r => (
              <div key={r.pair} className="flex justify-between">
                <span className="text-slate-300">{r.pair}</span>
                <span className="text-orange-300">{num(r.realizedVol, 1)}%</span>
                <span className="opacity-60">ATR {num(r.atrPct, 2)}%</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* RISK METRICS */}
        <Panel title="◆ RISK METRICS (BTC benchmark, 1h)">
          {riskMetrics ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat k="Sharpe (ann)"  v={num(riskMetrics.sharpe, 2)}   cls={riskMetrics.sharpe > 1 ? "text-green-400" : "text-yellow-300"} />
              <Stat k="Sortino"       v={num(riskMetrics.sortino, 2)}  cls={riskMetrics.sortino > 1 ? "text-green-400" : "text-yellow-300"} />
              <Stat k="Max Drawdown"  v={pct(-riskMetrics.maxDrawdown, 2)} cls="text-red-400" />
              <Stat k="Ann Vol"       v={pct(riskMetrics.annualizedVol, 1)} />
              <Stat k="VaR 95%"       v={pct(riskMetrics.var95, 2)}    cls="text-red-300" />
              <Stat k="VaR 99%"       v={pct(riskMetrics.var99, 2)}    cls="text-red-400" />
            </div>
          ) : <div className="text-xs opacity-60">loading…</div>}
        </Panel>

        {/* FACTOR SCORES */}
        <Panel title="◆ FACTOR EXPOSURES">
          <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
            <FactorTag label="MOMENTUM"    value={factorAvg.momentum} />
            <FactorTag label="TREND"       value={factorAvg.trend} />
            <FactorTag label="MEAN-REV"    value={factorAvg.meanRev} />
          </div>
          <div className="max-h-36 overflow-y-auto text-[10px] font-mono space-y-0.5">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-cyan-400/70 pb-1 border-b border-slate-800">
              <span>PAIR</span><span>MOM</span><span>TRND</span><span>MR</span><span>RSI</span>
            </div>
            {factors.map(f => (
              <div key={f.pair} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2">
                <span className="text-slate-300">{f.pair}</span>
                <span className={f.momentum >= 0 ? "text-green-400" : "text-red-400"}>{num(f.momentum, 1)}</span>
                <span className={f.trend >= 0 ? "text-green-400" : "text-red-400"}>{num(f.trend, 1)}</span>
                <span className={f.meanRev >= 0 ? "text-green-400" : "text-red-400"}>{num(f.meanRev, 2)}</span>
                <span className={f.rsi > 70 ? "text-red-400" : f.rsi < 30 ? "text-green-400" : "opacity-70"}>{num(f.rsi, 0)}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* LIQUIDITY */}
        <Panel title="◆ LIQUIDITY DESK (24h)">
          <div className="max-h-44 overflow-y-auto text-[10px] font-mono space-y-0.5">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-cyan-400/70 pb-1 border-b border-slate-800">
              <span>PAIR</span><span>PRICE</span><span>24h VOL</span><span>24h</span>
            </div>
            {UNIVERSE.map(p => {
              const t = tickers[p]; if (!t) return null;
              return (
                <div key={p} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                  <span className="text-slate-300">{p}</span>
                  <span className="text-white tabular-nums">${num(t.price, t.price > 100 ? 2 : 4)}</span>
                  <span className="text-cyan-300">{compact(t.quoteVolume)}</span>
                  <span className={t.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                    {t.change24h >= 0 ? "+" : ""}{num(t.change24h, 1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* FUNDING */}
        <Panel title="◆ PERP FUNDING RATES">
          <div className="max-h-44 overflow-y-auto text-[10px] font-mono space-y-0.5">
            {funding.length === 0 && <div className="opacity-60">loading Binance futures…</div>}
            {funding.map(f => {
              const ann = f.rate * 3 * 365; // 3 per day, annualized
              return (
                <div key={f.symbol} className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <span className="text-slate-300">{f.symbol}</span>
                  <span className={f.rate >= 0 ? "text-red-300" : "text-green-300"}>
                    {f.rate >= 0 ? "+" : ""}{num(f.rate, 4)}%/8h
                  </span>
                  <span className="opacity-70">{num(ann, 1)}% ann</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1 text-[9px] opacity-60">
            Positive = longs pay shorts. &gt;0.05%/8h = crowded longs · risk of squeeze down.
          </div>
        </Panel>

        {/* RISK PARITY */}
        <Panel title="◆ RISK PARITY PORTFOLIO">
          <div className="text-[10px] opacity-70 mb-1">Inverse-vol weighted — equal risk contribution</div>
          <div className="max-h-44 overflow-y-auto text-[10px] font-mono space-y-1">
            {riskParity.map(r => (
              <div key={r.pair}>
                <div className="flex justify-between">
                  <span className="text-slate-300">{r.pair}</span>
                  <span className="text-cyan-300 font-bold">{num(r.weight, 2)}%</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${r.weight * 4}%`, maxWidth: "100%" }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* CORRELATION */}
        <Panel title="◆ CORRELATION MATRIX (30 × 1h)" wide>
          {correlations.pairs.length > 0 ? (
            <div className="overflow-auto">
              <table className="text-[9px] font-mono border-collapse">
                <thead>
                  <tr>
                    <th className="px-1 py-0.5 border border-slate-800"></th>
                    {correlations.pairs.map(p => (
                      <th key={p} className="px-1 py-0.5 border border-slate-800 text-cyan-400/70">{p.replace("/USDT", "")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlations.pairs.map(a => (
                    <tr key={a}>
                      <td className="px-1 py-0.5 border border-slate-800 text-cyan-400/70 text-left">{a.replace("/USDT", "")}</td>
                      {correlations.pairs.map(b => {
                        const v = correlations.matrix[a][b];
                        const bg = v > 0.7 ? "rgba(16,185,129,0.7)" : v > 0.3 ? "rgba(16,185,129,0.3)" : v < -0.3 ? "rgba(239,68,68,0.3)" : v < -0.7 ? "rgba(239,68,68,0.7)" : "transparent";
                        return (
                          <td key={b} className="px-1 py-0.5 border border-slate-800 text-center tabular-nums" style={{ background: bg }}>
                            {num(v, 2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-xs opacity-60">loading…</div>}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-cyan-500/30 bg-slate-900/60 p-3 ${wide ? "lg:col-span-3" : ""}`}>
      <div className="text-xs font-bold text-cyan-300 tracking-widest mb-2">{title}</div>
      {children}
    </div>
  );
}
function Badge({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`px-3 py-1.5 rounded border text-center ${cls}`}>
      <div className="text-[8px] opacity-70 tracking-widest">{label}</div>
      <div className="font-black">{value}</div>
    </div>
  );
}
function Stat({ k, v, cls = "text-white" }: { k: string; v: string; cls?: string }) {
  return <div className="flex justify-between text-xs"><span className="opacity-60">{k}</span><span className={`font-bold ${cls}`}>{v}</span></div>;
}
function FactorTag({ label, value }: { label: string; value: number }) {
  const cls = value > 2 ? "text-green-400 border-green-500" : value < -2 ? "text-red-400 border-red-500" : "text-yellow-300 border-yellow-500";
  return (
    <div className={`rounded border px-2 py-1 text-center ${cls}`}>
      <div className="text-[8px] opacity-70 tracking-widest">{label}</div>
      <div className="font-black tabular-nums">{num(value, 2)}%</div>
    </div>
  );
}
