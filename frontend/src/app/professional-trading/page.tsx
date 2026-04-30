"use client";
/**
 * /professional-trading — Institutional desk terminal
 * ────────────────────────────────────────────────────
 * Complete rewrite. Instead of mocked positions, this is a live
 * Bloomberg/BlackRock-grade analytics cockpit:
 *   • Volume Profile (VPVR)     — support/resistance via volume at price
 *   • Microstructure            — OFI, VPIN, Kyle λ, walls (HFT signals)
 *   • Block Ticker              — real-time large prints via WS
 *   • VWAP + Kelly sizer        — execution benchmark + optimal size
 *   • Candle chart              — TradingView lightweight-charts, live
 *
 * All numbers come from live Binance data through the backend Bot API v1.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import VolumeProfile from "@/components/VolumeProfile";
import MicrostructurePanel from "@/components/MicrostructurePanel";
import BlockTradesFeed from "@/components/BlockTradesFeed";
import VWAPKellyPanel from "@/components/VWAPKellyPanel";
import { useBinanceChart } from "@/hooks/useBinanceChart";

const CandleChart = dynamic(() => import("@/components/CandleChart"), { ssr: false });

const API = "http://localhost:3002";
const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT"];
const TFS = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function ProfessionalTradingPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState("15m");
  const [ticker, setTicker] = useState<{ price: number; pctChange: number; volume: number } | null>(null);
  const pairSlash = symbol.replace("USDT", "/USDT");
  const live = useBinanceChart(pairSlash, tf);

  // Live ticker
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/ticker?symbol=${symbol}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stopped) {
          setTicker({
            price: j.price || j.lastPrice || 0,
            pctChange: j.priceChangePercent || j.change24hPct || 0,
            volume: j.volume24h || j.quoteVolume || 0,
          });
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 3000);
    return () => { stopped = true; clearInterval(id); };
  }, [symbol]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-4 space-y-3">
      {/* Header */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-indigo-950/30 via-slate-950 to-rose-950/20 p-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-300">PROFESSIONAL DESK · INSTITUTIONAL TERMINAL</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-2xl font-bold font-mono">
              {symbol.replace("USDT", "/USDT")}
            </div>
            {ticker && (
              <>
                <div className="text-2xl font-bold font-mono text-amber-300">
                  ${ticker.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className={`text-sm font-bold ${ticker.pctChange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {ticker.pctChange >= 0 ? "+" : ""}{ticker.pctChange.toFixed(2)}%
                </div>
                <div className="text-[11px] text-slate-400">24h vol ${(ticker.volume / 1e9).toFixed(2)}B</div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {PAIRS.map(p => (
            <button key={p} onClick={() => setSymbol(p)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
                symbol === p ? "bg-amber-500 text-black border-amber-500" : "border-slate-700 text-slate-300 hover:border-amber-500/50"
              }`}>{p.replace("USDT", "")}</button>
          ))}
          <div className="w-px bg-slate-700 mx-1" />
          {TFS.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                tf === t ? "bg-indigo-500 text-black border-indigo-500" : "border-slate-700 text-slate-300 hover:border-indigo-500/50"
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Row 1 — chart + volume profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">PRICE · {symbol} · {tf}</div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${live.connected ? "bg-emerald-400 animate-pulse" : live.candles.length > 0 ? "bg-cyan-400 animate-pulse" : "bg-amber-400"}`} />
              <span className={live.connected ? "text-emerald-300" : live.candles.length > 0 ? "text-cyan-300" : "text-amber-300"}>
                {live.connected ? "LIVE · WS" : live.candles.length > 0 ? "LIVE · REST" : "CONNECTING"}
              </span>
              <span className="text-slate-500">{live.candles.length} bars</span>
            </div>
          </div>
          <CandleChart candles={live.candles} height={460} showVolume />
        </div>
        <VolumeProfile symbol={symbol} />
      </div>

      {/* Row 2 — microstructure + block ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MicrostructurePanel symbol={symbol} />
        <BlockTradesFeed />
      </div>

      {/* Row 3 — VWAP + Kelly */}
      <VWAPKellyPanel symbol={symbol} />

      {/* Footer info strip */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[10px] text-slate-400">
        <div className="font-bold text-slate-300 mb-1">INSTITUTIONAL DATA PIPELINE</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>• <span className="text-slate-300">VPVR</span> — volume at each price bucket (Bloomberg TPO)</div>
          <div>• <span className="text-slate-300">OFI / VPIN / Kyle λ</span> — HFT microstructure signals</div>
          <div>• <span className="text-slate-300">VWAP + σ bands</span> — execution benchmark (JPM / GS desks)</div>
          <div>• <span className="text-slate-300">Kelly criterion</span> — optimal sizing with risk-of-ruin</div>
          <div>• <span className="text-slate-300">Block ticker</span> — WS aggTrade ≥ $100K (Bloomberg MTKR)</div>
          <div>• <span className="text-slate-300">Liquidity walls</span> — ±1% depth concentration</div>
          <div>• <span className="text-slate-300">Three-stage loader</span> — cache → REST → WS, no blank paint</div>
          <div>• <span className="text-slate-300">Candle cache</span> — persistent JSONL for backtest replay</div>
        </div>
      </div>
    </div>
  );
}
