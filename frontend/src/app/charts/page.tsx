"use client";

import { useState } from "react";
import CandleChart from "@/components/CandleChart";
import { useBinanceChart } from "@/hooks/useBinanceChart";

const TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;
type TF = typeof TFS[number];

const PAIRS = [
  { pair: "SOL/USDT",  label: "Solana" },
  { pair: "XRP/USDT",  label: "Ripple" },
  { pair: "BNB/USDT",  label: "Binance" },
  { pair: "ADA/USDT",  label: "Cardano" },
  { pair: "DOGE/USDT", label: "Dogecoin" },
  { pair: "AVAX/USDT", label: "Avalanche" },
  { pair: "LINK/USDT", label: "Chainlink" },
  { pair: "MATIC/USDT", label: "Polygon" },
];

function fmtPrice(n: number | null, digits = 2) {
  if (n == null) return "—";
  if (n < 1) return `$${n.toFixed(5)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

/** Full-width chart panel for a single symbol — 8 TFs + live WS + volume overlay */
function ChartPanel({ pair, label, big = false }: { pair: string; label: string; big?: boolean }) {
  const [tf, setTf] = useState<TF>("5m");
  const { candles, price, change24h, connected, error, lastTickAt } = useBinanceChart(pair, tf);
  const ageSec = lastTickAt ? Math.floor((Date.now() - lastTickAt) / 1000) : null;

  const up = (change24h ?? 0) >= 0;

  return (
    <div className="border border-green-500/40 rounded bg-black overflow-hidden">
      {/* HEADER */}
      <div className="p-3 border-b border-green-500/30 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] opacity-60 tracking-widest">{label.toUpperCase()} · {pair}</div>
            <div className={`${big ? "text-3xl" : "text-xl"} font-bold text-white tabular-nums`}>
              {fmtPrice(price, price && price < 10 ? 5 : 2)}
            </div>
          </div>
          {change24h != null && (
            <div className={`text-sm font-bold ${up ? "text-green-400" : "text-red-400"}`}>
              {up ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% <span className="opacity-60 text-[10px]">24h</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
            connected ? "border-green-400 text-green-400" : "border-yellow-400 text-yellow-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-yellow-400 animate-pulse"}`} />
            {connected ? "LIVE · BINANCE WS" : "CONNECTING…"}
          </span>
          {candles.length > 0 && (
            <span className="opacity-60">{candles.length} candles · last tick {ageSec ?? "?"}s ago</span>
          )}
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </div>

      {/* TF SELECTOR */}
      <div className="flex gap-1 p-2 border-b border-green-500/20">
        {TFS.map(t => (
          <button
            key={t}
            onClick={() => setTf(t)}
            className={`flex-1 px-2 py-1 rounded text-[11px] font-bold ${
              tf === t ? "bg-green-500 text-black" : "bg-slate-900 text-green-400 hover:bg-slate-800"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* CHART */}
      <div className="p-2">
        {candles.length > 0 ? (
          <CandleChart
            candles={candles}
            height={big ? 520 : 360}
            showVolume
            title={`${pair} · ${tf.toUpperCase()} · ${candles.length} candles · EMA20/50 + Bollinger Bands + Volume`}
          />
        ) : (
          <div className={`flex items-center justify-center text-green-400/70 text-xs ${big ? "h-[520px]" : "h-[360px]"}`}>
            {error ? error : "Loading candles from Binance…"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChartsPage() {
  return (
    <div className="min-h-screen bg-black text-green-400 p-4 space-y-6" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      {/* MASTER HEADER */}
      <div className="border border-green-500/40 rounded px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs tracking-widest opacity-70">◆ CHART TERMINAL · BINANCE LIVE WS + REST</div>
          <div className="text-lg font-bold text-white mt-1">BTC · ETH · 8 Major Pairs · 8 Timeframes Each</div>
          <div className="text-[10px] opacity-60">Direct Binance feed (no backend dependency) · EMA20 · EMA50 · Bollinger Bands · Volume</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>REAL-TIME</span>
        </div>
      </div>

      {/* BTC SECTION */}
      <section>
        <div className="text-sm font-bold tracking-widest mb-2 flex items-center gap-2">
          <span className="text-orange-400">◆ BITCOIN · BTC/USDT</span>
          <span className="opacity-50 text-[10px]">DIGITAL GOLD · #1 MARKET CAP</span>
        </div>
        <ChartPanel pair="BTC/USDT" label="Bitcoin" big />
      </section>

      {/* ETH SECTION */}
      <section>
        <div className="text-sm font-bold tracking-widest mb-2 flex items-center gap-2">
          <span className="text-indigo-400">◆ ETHEREUM · ETH/USDT</span>
          <span className="opacity-50 text-[10px]">SMART CONTRACT LAYER · #2 MARKET CAP</span>
        </div>
        <ChartPanel pair="ETH/USDT" label="Ethereum" big />
      </section>

      {/* PAIRS SECTION */}
      <section>
        <div className="text-sm font-bold tracking-widest mb-2 flex items-center gap-2">
          <span className="text-cyan-400">◆ MAJOR ALTCOIN PAIRS</span>
          <span className="opacity-50 text-[10px]">TOP-10 BY MARKET CAP · ALL TIMEFRAMES</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {PAIRS.map(p => (
            <ChartPanel key={p.pair} pair={p.pair} label={p.label} />
          ))}
        </div>
      </section>

      <div className="text-[10px] opacity-50 text-center pt-4 border-t border-green-500/20">
        Data: Binance public REST (500 candles bootstrap) + WebSocket kline stream (sub-second tick updates) + 24hrTicker stream (24h change).
        Indicators computed client-side from the live candle series.
      </div>
    </div>
  );
}
