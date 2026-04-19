"use client";

import React, { useEffect, useMemo, useState } from "react";
import CandleChart, { OHLCV } from "./CandleChart";
import IndicatorGrid from "./IndicatorGrid";
import QuantRiskPanel from "./QuantRiskPanel";
import WhaleTape from "./WhaleTape";
import VolumeFlowPanel from "./VolumeFlowPanel";
import AladdinPanel from "./AladdinPanel";
import LiveMTFConsensus from "./LiveMTFConsensus";
import StrategistDesk from "./StrategistDesk";
import OnChainWhalePanel from "./OnChainWhalePanel";
import MemePumpDumpPanel from "./MemePumpDumpPanel";
import { simulateAgents } from "@/lib/agentSim";
import { useBinanceLive } from "@/hooks/useBinanceLive";
import { useBinanceTickers } from "@/hooks/useBinanceTickers";
import { useLiveCandles, useLiveTickers } from "@/lib/liveStore";

const API = "http://localhost:3002";

const PAIRS = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
  "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "LINK/USDT", "MATIC/USDT",
  "DOT/USDT", "LTC/USDT", "UNI/USDT", "ATOM/USDT", "NEAR/USDT",
  "ARB/USDT", "OP/USDT", "APT/USDT", "FIL/USDT", "SHIB/USDT",
];

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];
const PRIORITY_PAIRS = ["BTC/USDT", "ETH/USDT"];

async function safeJson<T = any>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default function Terminal() {
  const [pair, setPair] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");

  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [predict, setPredict] = useState<any>(null);
  const [indicators, setIndicators] = useState<any>(null);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [ticker, setTicker] = useState<Record<string, { price: number; change: number }>>({});
  const [status, setStatus] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [clock, setClock] = useState<string>("");
  const [dual, setDual] = useState<any>(null);
  const [paused, setPaused] = useState(false);
  const [bloomberg, setBloomberg] = useState(true); // Bloomberg green-on-black theme
  const [showIndicatorGrid, setShowIndicatorGrid] = useState(true);
  const [toast, setToast] = useState<string>("");

  // ░ LIVE WEBSOCKET ░ Sub-second Binance feed for active pair + timeframe
  const live = useBinanceLive(pair, timeframe);

  // ░ LIVE STORE ░ singleton candles persisted in sessionStorage (instant across tabs)
  const storeCandles = useLiveCandles(pair, timeframe);

  // Merge live candle into historical candles so chart shows current tick.
  // Prefer storeCandles (persistent, cross-tab) over local `candles` state when available.
  const liveCandles = useMemo<OHLCV[]>(() => {
    const base: OHLCV[] = storeCandles.length ? (storeCandles as any) : candles;
    if (!live.liveCandle) return base;
    const candles_ = base;
    if (!candles_.length) return [{
      timestamp: live.liveCandle.timestamp,
      open: live.liveCandle.open,
      high: live.liveCandle.high,
      low: live.liveCandle.low,
      close: live.liveCandle.close,
      volume: live.liveCandle.volume,
    }];
    const out = [...candles_];
    const last = out[out.length - 1];
    if (last && live.liveCandle.timestamp <= last.timestamp) {
      out[out.length - 1] = {
        timestamp: live.liveCandle.timestamp,
        open: live.liveCandle.open,
        high: live.liveCandle.high,
        low: live.liveCandle.low,
        close: live.liveCandle.close,
        volume: live.liveCandle.volume,
      };
    } else {
      out.push({
        timestamp: live.liveCandle.timestamp,
        open: live.liveCandle.open,
        high: live.liveCandle.high,
        low: live.liveCandle.low,
        close: live.liveCandle.close,
        volume: live.liveCandle.volume,
      });
    }
    return out;
  }, [candles, storeCandles, live.liveCandle]);

  const livePrice = live.price ?? predict?.currentPrice ?? 0;
  const liveChange = live.change24h ?? parseFloat(predict?.percentChange24h ?? "0");

  // Clock — client-only, avoids SSR hydration mismatch
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch main pair data
  useEffect(() => {
    let alive = true;

    const fetchCore = async () => {
      const [ta, pred, ind, liveStat, port, pos, tr, ag] = await Promise.all([
        safeJson(`${API}/api/bitcoin/technical-analysis?pair=${encodeURIComponent(pair)}`),
        safeJson(`${API}/api/bitcoin/predict?pair=${encodeURIComponent(pair)}`),
        safeJson(`${API}/api/multi-tf/indicators/${encodeURIComponent(pair)}/${timeframe}`),
        safeJson(`${API}/api/live-data/status`),
        safeJson(`${API}/api/portfolio`),
        safeJson(`${API}/api/professional/positions`),
        safeJson(`${API}/api/professional/trades`),
        safeJson(`${API}/api/agents`),
      ]);
      if (!alive) return;

      if (ta?.data?.candles && ta.data.candles.length > 0) setCandles(ta.data.candles);
      if (ta?.data?.patterns) setPatterns(ta.data.patterns);
      if (pred?.data) setPredict(pred.data);
      if (ind?.data || ind) setIndicators(ind?.data || ind);
      if (liveStat?.data) setStatus(liveStat.data);
      if (port?.data || port) setPortfolio(port?.data || port);
      if (pos?.data || pos) setPositions(Array.isArray(pos?.data) ? pos.data : Array.isArray(pos) ? pos : []);
      if (tr?.data || tr) setTrades(Array.isArray(tr?.data) ? tr.data : Array.isArray(tr) ? tr : []);
      if (ag?.data || ag) setAgents(Array.isArray(ag?.data) ? ag.data : Array.isArray(ag) ? ag : []);
    };

    fetchCore();
    const t = setInterval(fetchCore, 10_000);

    // ░ DIRECT BINANCE REST BOOTSTRAP ░ fills the chart even if backend is dead
    const bootstrapBinance = async () => {
      try {
        const sym = pair.replace("/", "").toUpperCase();
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${timeframe}&limit=500`);
        const data = await r.json();
        if (!alive || !Array.isArray(data)) return;
        const fresh = data.map((k: any[]) => ({
          timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
        }));
        if (fresh.length > 0) setCandles(fresh);
      } catch {}
    };
    bootstrapBinance();
    const bt = setInterval(bootstrapBinance, 30_000);

    return () => { alive = false; clearInterval(t); clearInterval(bt); };
  }, [pair, timeframe]);

  // Autonomous Prediction Agent — BTC + ETH dual snapshot every 10s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (paused) return;
      const d = await safeJson<any>(`${API}/api/agent/dual?tf=${timeframe}`);
      if (!alive) return;
      if (d) setDual(d);
    };
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [timeframe, paused]);

  // Keyboard shortcuts — T cycle tf · C toggle BTC/ETH · I indicator grid · S stats ·
  //                     P print prediction · Q quit/clear · SPACE pause · L backtest · B Bloomberg theme
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "t") {
        const idx = TIMEFRAMES.indexOf(timeframe);
        const next = TIMEFRAMES[(idx + 1) % TIMEFRAMES.length];
        setTimeframe(next);
        showToast(`TIMEFRAME → ${next.toUpperCase()}`);
      } else if (k === "c") {
        const next = pair === "BTC/USDT" ? "ETH/USDT" : "BTC/USDT";
        setPair(next);
        showToast(`PAIR → ${next}`);
      } else if (k === "i") {
        setShowIndicatorGrid((s) => !s);
        showToast("TOGGLE INDICATOR GRID");
      } else if (k === "b") {
        setBloomberg((s) => !s);
        showToast("TOGGLE BLOOMBERG THEME");
      } else if (k === "p") {
        const btc = dual?.btc?.single;
        const eth = dual?.eth?.single;
        if (btc) console.log(`[AGENT] ${btc.prediction}`);
        if (eth) console.log(`[AGENT] ${eth.prediction}`);
        showToast("PREDICTIONS PRINTED → CONSOLE");
      } else if (k === "q") {
        showToast("CLEARED");
      } else if (k === " ") {
        e.preventDefault();
        setPaused((p) => !p);
        showToast(paused ? "▶ RESUMED" : "⏸ PAUSED");
      } else if (k === "s") {
        showToast(`STATS · AGENTS ${agents.length} · POS ${positions.length} · CANDLES ${candles.length}`);
      } else if (k === "l") {
        showToast("BACKTEST → (wire to /api/backtest)");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timeframe, pair, paused, dual, agents.length, positions.length, candles.length]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  // Ticker — LIVE Binance WS stream routed through the singleton liveStore so
  // the connection survives route changes and hydrates instantly from cache.
  const storeTickers = useLiveTickers(PAIRS);
  const { tickers: fallbackTickers } = useBinanceTickers(PAIRS);
  useEffect(() => {
    const map: Record<string, { price: number; change: number }> = {};
    for (const p of PAIRS) {
      const t = storeTickers[p] || fallbackTickers[p];
      if (t) map[p] = { price: t.price, change: t.change24h };
    }
    if (Object.keys(map).length) setTicker(map);
  }, [storeTickers, fallbackTickers]);

  const consensus = predict?.consensus;
  const ind = predict?.indicators || indicators || {};
  const trading = predict?.trading;
  const agreedCount = consensus?.agreedTimeframes?.length ?? 0;

  const signalColor = (s?: string) =>
    s === "BUY" ? "text-green-400" : s === "SELL" ? "text-red-400" : "text-yellow-400";
  const signalBg = (s?: string) =>
    s === "BUY" ? "bg-green-500/20 border-green-500/40" : s === "SELL" ? "bg-red-500/20 border-red-500/40" : "bg-yellow-500/20 border-yellow-500/40";

  return (
    <div
      className={
        bloomberg
          ? "min-h-screen bg-black text-green-400"
          : "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200"
      }
      style={bloomberg ? { fontFamily: "Consolas, 'Courier New', monospace" } : undefined}
    >
      {/* ─── TOP STATUS BAR ─── */}
      <div className="border-b border-cyan-500/30 bg-slate-950/80 backdrop-blur px-4 py-2 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-6">
          <span className="text-cyan-400 font-bold text-sm">● CRYPTOTRADER PRO</span>
          <span>Model: <span className="text-cyan-300">claude-opus-4-5</span></span>
          <span>Pairs: <span className="text-cyan-300">{status?.pairs ?? "—"}</span></span>
          <span>Timeframes: <span className="text-cyan-300">{status?.timeframes ?? "—"}</span></span>
          <span>Ingest: <span className={status?.bootstrapped ? "text-green-400" : "text-yellow-400"}>
            {status?.bootstrapped ? "LIVE" : "BOOTING"}
          </span></span>
        </div>
        <div className="flex items-center gap-6">
          <span>Equity: <span className="text-white font-bold">${(portfolio?.equity ?? portfolio?.balance ?? 10000).toLocaleString()}</span></span>
          <span>Positions: <span className="text-cyan-300">{positions.length}</span></span>
          <span suppressHydrationWarning>{clock || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-4 p-4">
        {/* ═══ MAIN COLUMN ═══ */}
        <div className="space-y-4">
          {/* ░░ AUTONOMOUS PREDICTION AGENT — Bloomberg format ░░ */}
          <div className={bloomberg ? "border border-green-500/50 bg-black rounded" : "bg-slate-900/70 border border-cyan-500/30 rounded-lg"}>
            <div className={bloomberg ? "px-3 py-1.5 border-b border-green-500/40 flex items-center justify-between text-[11px]" : "px-4 py-2 border-b border-cyan-500/30 flex items-center justify-between text-xs"}>
              <span className="font-bold tracking-widest">◆ AUTONOMOUS PREDICTION AGENT · {paused ? "PAUSED" : "LIVE"} · TF={timeframe.toUpperCase()}</span>
              <span className="opacity-70">[T]imeframe [C]ycle-Pair [I]ndicators [B]loomberg [P]rint [SPACE]Pause</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-green-500/30">
              <PredictionCard
                label="BTC/USDT"
                single={dual?.btc?.single}
                consensus={dual?.btc?.consensus}
                bloomberg={bloomberg}
              />
              <PredictionCard
                label="ETH/USDT"
                single={dual?.eth?.single}
                consensus={dual?.eth?.consensus}
                bloomberg={bloomberg}
              />
            </div>
          </div>

          {/* Pair / Timeframe Selector */}
          <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-3 flex items-center gap-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider">Pair</label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="bg-slate-950 border border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded font-mono text-sm focus:outline-none focus:border-cyan-400"
            >
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <label className="text-xs text-slate-400 uppercase tracking-wider ml-4">Timeframe</label>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded text-xs font-mono ${
                    timeframe === tf
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="ml-auto text-sm font-mono flex items-center gap-3">
              <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${live.connected ? "border-green-400 text-green-400" : "border-yellow-400 text-yellow-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${live.connected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
                {live.connected ? "LIVE · WS" : "CONNECTING"}
              </span>
              <span className="text-slate-400">Price:</span>
              <span className="text-white font-bold text-lg tabular-nums">${livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              {liveChange != null && !Number.isNaN(liveChange) && (
                <span className={`ml-1 ${liveChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {liveChange >= 0 ? "+" : ""}{liveChange.toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          {/* Candle Chart */}
          <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-3">
            {liveCandles.length > 0 ? (
              <CandleChart
                candles={liveCandles}
                height={480}
                showVolume
                title={`${pair} — ${timeframe.toUpperCase()} — LIVE · Candles + EMA20/50 + BB + Volume${live.connected ? " · ●" : ""}`}
              />
            ) : (
              <div className="h-[480px] flex items-center justify-center text-slate-500 font-mono text-sm">
                Waiting for live candles… (bootstrap in progress)
              </div>
            )}
          </div>

          {/* ALL INDICATORS — computed locally from live candles */}
          <IndicatorGrid candles={liveCandles} title={`${pair} · ${timeframe.toUpperCase()} · 30+ INDICATORS · LIVE`} />

          {/* QUANT RISK — Kalman / GARCH / Hurst / CF-VaR / OU / HMM / VPIN / Monte Carlo */}
          <QuantRiskPanel candles={liveCandles} pair={pair} />

          {/* STRATEGIST — BlackRock / JPM house view */}
          <StrategistDesk />

          {/* INSTITUTIONAL — Aladdin-style regime + whale concentration */}
          <AladdinPanel />

          {/* ON-CHAIN — live BTC whale transfers */}
          <OnChainWhalePanel />

          {/* MEME RADAR — pump/dump scanner */}
          <MemePumpDumpPanel />

          {/* ORDER FLOW — real-time buy/sell pressure by pair */}
          <VolumeFlowPanel focus={pair} />

          {/* WHALE TAPE — every aggTrade ≥$100k, live */}
          <WhaleTape pair={pair} max={40} />

          {/* Multi-TF Consensus — LIVE (computed client-side from 7 streams via liveStore) */}
          <LiveMTFConsensus pair={pair} />

          {/* Full indicator grid (press I to toggle) */}
          {showIndicatorGrid && (
            <div className={bloomberg ? "border border-green-500/40 rounded bg-black p-3" : "bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4"}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-80">
                ◆ FULL INDICATOR MATRIX · {pair} · {timeframe.toUpperCase()}
              </h3>
              <div className="grid grid-cols-6 gap-2 text-[11px] font-mono">
                <Cell k="RSI(14)" v={(ind.rsi ?? 0).toFixed(1)} />
                <Cell k="STOCH %K" v={(ind.stochastic?.k ?? ind.stochastic ?? 0).toFixed ? (ind.stochastic?.k ?? ind.stochastic ?? 0).toFixed(1) : "—"} />
                <Cell k="STOCH RSI" v={(ind.stochRsi?.k ?? 0).toFixed(1)} />
                <Cell k="CCI" v={(ind.cci ?? 0).toFixed(0)} />
                <Cell k="ROC" v={(ind.roc ?? 0).toFixed(2)} />
                <Cell k="WILLIAMS%R" v={(ind.williamsR ?? 0).toFixed(1)} />
                <Cell k="AO" v={(ind.awesome ?? 0).toFixed(2)} />
                <Cell k="MACD HIST" v={(ind.macd?.histogram ?? 0).toFixed(3)} cls={(ind.macd?.histogram ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
                <Cell k="MACD LINE" v={(ind.macd?.line ?? 0).toFixed(3)} />
                <Cell k="MACD SIG" v={(ind.macd?.signal ?? 0).toFixed(3)} />
                <Cell k="ADX" v={(ind.adx?.adx ?? ind.adx ?? 0).toFixed ? (ind.adx?.adx ?? ind.adx ?? 0).toFixed(1) : "—"} />
                <Cell k="+DI" v={(ind.adx?.plusDI ?? 0).toFixed(1)} cls="text-green-400" />
                <Cell k="-DI" v={(ind.adx?.minusDI ?? 0).toFixed(1)} cls="text-red-400" />
                <Cell k="ATR" v={(ind.atr ?? 0).toFixed(2)} />
                <Cell k="NATR" v={(ind.natr ?? 0).toFixed(2)} />
                <Cell k="BB UP" v={(ind.bb?.upper ?? 0).toFixed(2)} cls="text-purple-300" />
                <Cell k="BB MID" v={(ind.bb?.middle ?? 0).toFixed(2)} cls="text-purple-300" />
                <Cell k="BB LOW" v={(ind.bb?.lower ?? 0).toFixed(2)} cls="text-purple-300" />
                <Cell k="BB %B" v={(ind.bb?.percentB ?? 0).toFixed(2)} />
                <Cell k="SQUEEZE" v={ind.bb?.squeeze ? "YES" : "no"} cls={ind.bb?.squeeze ? "text-yellow-300" : ""} />
                <Cell k="EMA21" v={(ind.ema?.[21] ?? 0).toFixed(2)} />
                <Cell k="EMA50" v={(ind.ema?.[50] ?? 0).toFixed(2)} />
                <Cell k="EMA200" v={(ind.ema?.[200] ?? 0).toFixed(2)} />
                <Cell k="OBV TREND" v={ind.obvTrend ?? "—"} cls={ind.obvTrend === "INCREASING" ? "text-green-400" : ind.obvTrend === "DECREASING" ? "text-red-400" : ""} />
                <Cell k="MFI" v={(ind.mfi ?? 0).toFixed(1)} />
                <Cell k="VOL RATIO" v={(ind.volumeRatio ?? 0).toFixed(2)} />
                <Cell k="SUPERTREND" v={ind.supertrend?.trend ?? "—"} cls={ind.supertrend?.trend === "UP" ? "text-green-400" : "text-red-400"} />
                <Cell k="ICHIMOKU" v={ind.ichimoku?.aboveCloud ? "ABOVE" : ind.ichimoku?.belowCloud ? "BELOW" : "IN"} />
                <Cell k="PIVOT P" v={(ind.pivots?.p ?? 0).toFixed(2)} />
                <Cell k="PIVOT R1" v={(ind.pivots?.r1 ?? 0).toFixed(2)} cls="text-green-400" />
                <Cell k="PIVOT S1" v={(ind.pivots?.s1 ?? 0).toFixed(2)} cls="text-red-400" />
                <Cell k="SWING HIGH" v={(ind.swingHigh ?? 0).toFixed(2)} cls="text-green-400" />
                <Cell k="SWING LOW" v={(ind.swingLow ?? 0).toFixed(2)} cls="text-red-400" />
                <Cell k="PRICE" v={(ind.price ?? predict?.currentPrice ?? 0).toFixed(2)} cls="text-white" />
              </div>
            </div>
          )}

          {/* 4-panel row: Indicators | Patterns | Long | Short */}
          <div className="grid grid-cols-4 gap-4">
            {/* Indicators */}
            <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Indicators ({timeframe})</h3>
              <div className="space-y-3 text-xs font-mono">
                <IndicatorBar label="RSI(14)" value={ind.rsi} max={100} />
                <IndicatorBar label="Stochastic" value={ind.stochastic} max={100} />
                <IndicatorBar label="ADX" value={ind.adx} max={100} />
                <div className="pt-2 border-t border-slate-700 space-y-1 text-slate-400">
                  <div>MACD: <span className={(ind.macd?.histogram ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                    {(ind.macd?.histogram ?? 0) >= 0 ? "+" : ""}{(ind.macd?.histogram ?? 0).toFixed(3)}
                  </span></div>
                  <div>ATR: <span className="text-cyan-300">${(ind.atr ?? 0).toFixed(0)}</span></div>
                  <div>BB Upper: <span className="text-purple-300">${(ind.bb?.upper ?? 0).toFixed(0)}</span></div>
                  <div>BB Lower: <span className="text-purple-300">${(ind.bb?.lower ?? 0).toFixed(0)}</span></div>
                </div>
              </div>
            </div>

            {/* Patterns */}
            <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Candle Patterns</h3>
              <div className="space-y-2 text-xs">
                {patterns.length > 0 ? patterns.slice(0, 6).map((p: any, i: number) => (
                  <div key={i} className="flex justify-between bg-slate-950/50 p-2 rounded border border-slate-700">
                    <div className="font-mono text-slate-200">{p.name}</div>
                    <div className={p.direction === "UP" ? "text-green-400" : p.direction === "DOWN" ? "text-red-400" : "text-yellow-400"}>
                      {p.confidence ?? 0}%
                    </div>
                  </div>
                )) : <div className="text-slate-500 text-xs">No patterns detected</div>}
              </div>
            </div>

            {/* Long Setup */}
            <div className="bg-green-950/30 border border-green-500/40 rounded-lg p-4">
              <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">Long Setup</h3>
              <div className="space-y-1.5 text-xs font-mono">
                <KV k="Entry" v={fmt(trading?.buySetup?.entryPrice)} />
                <KV k="Stop" v={fmt(trading?.buySetup?.stopLoss)} valueClass="text-red-400" />
                <KV k="TP1" v={fmt(trading?.buySetup?.takeProfit1)} valueClass="text-green-400" />
                <KV k="TP2" v={fmt(trading?.buySetup?.takeProfit2)} valueClass="text-green-400" />
                <div className="pt-2 border-t border-green-500/30">
                  <KV k="R:R" v={`${(trading?.buySetup?.riskRewardRatio ?? 0).toFixed(2)}:1`} valueClass="text-cyan-300" />
                </div>
              </div>
            </div>

            {/* Short Setup */}
            <div className="bg-red-950/30 border border-red-500/40 rounded-lg p-4">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Short Setup</h3>
              <div className="space-y-1.5 text-xs font-mono">
                <KV k="Entry" v={fmt(trading?.sellSetup?.entryPrice)} />
                <KV k="Stop" v={fmt(trading?.sellSetup?.stopLoss)} valueClass="text-red-400" />
                <KV k="TP1" v={fmt(trading?.sellSetup?.takeProfit1)} valueClass="text-green-400" />
                <KV k="TP2" v={fmt(trading?.sellSetup?.takeProfit2)} valueClass="text-green-400" />
                <div className="pt-2 border-t border-red-500/30">
                  <KV k="R:R" v={`${(trading?.sellSetup?.riskRewardRatio ?? 0).toFixed(2)}:1`} valueClass="text-cyan-300" />
                </div>
              </div>
            </div>
          </div>

          {/* Agent voting + trades */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Agent Voting · 27 agents · {agents.length > 0 ? "backend" : "client-sim (indicator-driven)"}
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs font-mono">
                {(agents.length > 0
                  ? agents.slice(0, 27).map((a: any) => ({
                      name: a.name ?? a.id ?? "Agent",
                      vote: a.lastSignal ?? a.decision ?? a.vote ?? "IDLE",
                      confidence: a.confidence ?? 0,
                      reasoning: a.reasoning ?? a.lastDecision?.reasoning ?? "",
                      tier: a.tier ?? "",
                    }))
                  : simulateAgents(liveCandles, pair)
                ).map((a: any, i: number) => (
                  <div key={`${a.name}-${i}`} className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-700/60 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-200 truncate">
                        <span className="text-[9px] opacity-50 mr-1">[{a.tier}]</span>{a.name}
                      </div>
                      {a.reasoning && <div className="text-[9px] opacity-60 truncate">{a.reasoning}</div>}
                    </div>
                    <div className={`${signalColor(a.vote)} whitespace-nowrap font-bold`}>
                      {a.vote} {a.confidence ? `· ${a.confidence}%` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Live Positions / Trades</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs font-mono">
                {positions.length > 0 ? positions.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} className="flex justify-between bg-slate-950/50 p-2 rounded border border-slate-700/60">
                    <div className="text-slate-200">{p.pair ?? p.symbol ?? "—"} · <span className={p.side === "SHORT" ? "text-red-400" : "text-green-400"}>{p.side ?? "LONG"}</span></div>
                    <div className={(p.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                      {(p.pnl ?? 0) >= 0 ? "+" : ""}${(p.pnl ?? 0).toFixed(2)}
                    </div>
                  </div>
                )) : trades.length > 0 ? trades.slice(0, 10).map((t: any, i: number) => (
                  <div key={i} className="flex justify-between bg-slate-950/50 p-2 rounded border border-slate-700/60">
                    <div className="text-slate-200">{t.pair ?? t.symbol} · <span className={t.side === "SELL" ? "text-red-400" : "text-green-400"}>{t.side}</span></div>
                    <div className="text-slate-400">${(t.price ?? 0).toFixed(2)}</div>
                  </div>
                )) : <div className="text-slate-500">No open positions</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN: Live Ticker ═══ */}
        <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-3 h-fit sticky top-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Live Ticker · 20 Pairs</h3>
          <div className="space-y-1 font-mono text-xs">
            {PAIRS.map((p) => {
              const t = ticker[p];
              const active = p === pair;
              return (
                <button
                  key={p}
                  onClick={() => setPair(p)}
                  className={`w-full flex justify-between items-center px-2 py-1.5 rounded transition ${
                    active ? "bg-cyan-500/20 border border-cyan-400" : "hover:bg-slate-800 border border-transparent"
                  }`}
                >
                  <span className="text-slate-200">{p.replace("/USDT", "")}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-white tabular-nums">
                      {t?.price ? (t.price < 1 ? t.price.toFixed(5) : t.price < 100 ? t.price.toFixed(3) : t.price.toFixed(1)) : "—"}
                    </span>
                    <span className={`text-[10px] w-12 text-right ${(t?.change ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t?.change != null ? `${t.change >= 0 ? "+" : ""}${t.change.toFixed(2)}%` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black border border-green-400 text-green-400 px-4 py-2 rounded font-mono text-sm shadow-[0_0_20px_rgba(34,197,94,0.4)] z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ───
function IndicatorBar({ label, value, max }: { label: string; value?: number; max: number }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-cyan-300 font-bold">{v.toFixed(1)}</span>
      </div>
      <div className="bg-slate-950 rounded-full h-1.5 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-full" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function KV({ k, v, valueClass = "text-white" }: { k: string; v: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={`font-bold ${valueClass}`}>{v}</span>
    </div>
  );
}

function PredictionCard({ label, single, consensus, bloomberg }: { label: string; single: any; consensus: any; bloomberg: boolean; }) {
  const sig = single?.signal ?? "HOLD";
  const isBuy = sig.includes("BUY");
  const isSell = sig.includes("SELL");
  const arrow = isBuy ? "▲" : isSell ? "▼" : "▬";
  const color = bloomberg
    ? (isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-yellow-300")
    : (isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-yellow-400");
  const price = single?.currentPrice ?? 0;
  const tgt = single?.targetPrice ?? 0;
  const conf = single?.confidence ?? 0;
  const min = single?.horizonMinutes ?? 0;
  const tp1 = single?.tp1 ?? 0;
  const tp2 = single?.tp2 ?? 0;
  const sl = single?.stopLoss ?? 0;
  const notes: string[] = single?.supportingSignals ?? [];
  const gated = conf >= 60;

  return (
    <div className={"p-3 " + (bloomberg ? "" : "")}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-bold tracking-widest text-[13px]">{label}</span>
        <span className={`font-bold ${color}`}>{arrow} {sig}</span>
      </div>
      <div className={"text-[13px] leading-snug " + (bloomberg ? "text-green-300" : "text-slate-200")}>
        {single?.prediction ? (
          <div className="font-mono">
            <span className={color}>{single.prediction}</span>
          </div>
        ) : (
          <div className="opacity-60">Waiting for data…</div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] font-mono">
        <Cell k="PRICE" v={fmt(price)} />
        <Cell k="TARGET" v={fmt(tgt)} cls={color} />
        <Cell k="CONF" v={`${conf}%`} cls={gated ? "text-green-400" : "text-yellow-300"} />
        <Cell k="IN" v={`${min}m`} />
        <Cell k="TP1" v={fmt(tp1)} cls="text-green-400" />
        <Cell k="TP2" v={fmt(tp2)} cls="text-green-400" />
        <Cell k="SL"  v={fmt(sl)}  cls="text-red-400" />
        <Cell k="R:R" v={`${(single?.riskReward ?? 0).toFixed(2)}:1`} />
      </div>
      {consensus && (
        <div className="mt-2 text-[10px] font-mono opacity-80">
          CONSENSUS · <span className={color}>{consensus.overallSignal}</span> ·
          AVG {consensus.avgConfidence}% · AGREED {consensus.agreedTimeframes?.length ?? 0}/7
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-2 text-[10px] font-mono opacity-70 line-clamp-2">
          ▸ {notes.slice(0, 6).join(" · ")}
        </div>
      )}
      {!gated && single && (
        <div className="mt-1 text-[10px] font-mono text-yellow-300">
          ⚠ CONFIDENCE BELOW 60% — NO AUTO-TRADE
        </div>
      )}
    </div>
  );
}

function Cell({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="opacity-50">{k}</span>
      <span className={`font-bold ${cls}`}>{v}</span>
    </div>
  );
}

function fmt(n?: number) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
