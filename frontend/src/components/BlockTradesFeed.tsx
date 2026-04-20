"use client";
/**
 * BlockTradesFeed — Bloomberg Block Ticker equivalent
 * ────────────────────────────────────────────────────
 * Live feed of large prints via Binance @aggTrade WS. Filter by USD
 * threshold. Shows buy/sell pressure in real time, plays an alarm for
 * MEGA prints (≥$1M).
 */
import { useEffect, useRef, useState } from "react";

interface Block {
  id: number; price: number; qty: number; usd: number; time: number;
  side: "BUY" | "SELL"; tier: "MEGA" | "LARGE" | "BLOCK";
  symbol: string;
}

const THRESHOLDS = [50_000, 100_000, 250_000, 1_000_000];
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export default function BlockTradesFeed() {
  const [minUsd, setMinUsd] = useState(100_000);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ buyUsd: 0, sellUsd: 0, buyCount: 0, sellCount: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const streams = SYMBOLS.map(s => `${s.toLowerCase()}@aggTrade`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const d = msg?.data;
        if (!d || d.e !== "aggTrade") return;
        const price = parseFloat(d.p);
        const qty = parseFloat(d.q);
        const usd = price * qty;
        if (usd < minUsd) return;
        const b: Block = {
          id: d.a, price, qty, usd, time: d.T,
          side: d.m ? "SELL" : "BUY",
          tier: usd >= 1_000_000 ? "MEGA" : usd >= 250_000 ? "LARGE" : "BLOCK",
          symbol: d.s,
        };
        setBlocks(prev => [b, ...prev].slice(0, 100));
        setStats(prev => ({
          buyUsd: prev.buyUsd + (b.side === "BUY" ? b.usd : 0),
          sellUsd: prev.sellUsd + (b.side === "SELL" ? b.usd : 0),
          buyCount: prev.buyCount + (b.side === "BUY" ? 1 : 0),
          sellCount: prev.sellCount + (b.side === "SELL" ? 1 : 0),
        }));
        // MEGA alarm
        if (b.tier === "MEGA" && typeof window !== "undefined") {
          try {
            const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AC) {
              const ctx = new AC();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = b.side === "BUY" ? 880 : 440;
              osc.connect(gain); gain.connect(ctx.destination);
              gain.gain.setValueAtTime(0.06, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
              osc.start(); osc.stop(ctx.currentTime + 0.3);
            }
          } catch {}
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [minUsd]);

  const total = stats.buyUsd + stats.sellUsd;
  const netPct = total > 0 ? ((stats.buyUsd - stats.sellUsd) / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-rose-950/10 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-rose-300 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            BLOCK TICKER · BTC · ETH · SOL · {connected ? "LIVE" : "CONNECTING"}
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            <span className="text-emerald-300">BUY ${(stats.buyUsd / 1e6).toFixed(2)}M</span>
            <span className="text-slate-500 mx-2">·</span>
            <span className="text-rose-300">SELL ${(stats.sellUsd / 1e6).toFixed(2)}M</span>
            <span className="text-slate-500 mx-2">·</span>
            <span className={netPct >= 0 ? "text-emerald-300" : "text-rose-300"}>NET {netPct >= 0 ? "+" : ""}{netPct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex gap-1">
          {THRESHOLDS.map(t => (
            <button key={t} onClick={() => setMinUsd(t)}
              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                minUsd === t ? "bg-rose-500 text-black border-rose-500" : "border-slate-700 text-slate-300"
              }`}>≥${t >= 1e6 ? `${t/1e6}M` : `${t/1e3}K`}</button>
          ))}
        </div>
      </div>

      <div className="space-y-0.5 max-h-[420px] overflow-y-auto font-mono text-[11px]">
        {blocks.length === 0 && <div className="text-slate-500 text-[10px] py-4 text-center">Waiting for block prints ≥ ${(minUsd/1e3).toFixed(0)}K…</div>}
        {blocks.map(b => {
          const ageSec = Math.floor((Date.now() - b.time) / 1000);
          const flash = ageSec < 3 ? "ring-1 ring-amber-400/40" : "";
          return (
            <div key={b.id} className={`flex items-center gap-2 px-2 py-1 rounded ${
              b.tier === "MEGA" ? "bg-amber-500/10 border border-amber-500/30"
              : b.tier === "LARGE" ? "bg-slate-800/60"
              : "bg-slate-900/40"
            } ${flash}`}>
              <span className="text-slate-500 w-12 text-[9px]">{new Date(b.time).toLocaleTimeString().slice(0, 8)}</span>
              <span className="text-slate-300 w-16 text-[10px]">{b.symbol.replace("USDT","")}</span>
              <span className={`w-12 text-[10px] font-bold ${b.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}>{b.side}</span>
              <span className="text-slate-200 w-24">${b.price.toFixed(2)}</span>
              <span className="text-slate-400 w-20">{b.qty.toFixed(4)}</span>
              <span className={`w-24 font-bold ${b.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}>
                ${b.usd >= 1e6 ? `${(b.usd/1e6).toFixed(2)}M` : `${(b.usd/1e3).toFixed(0)}K`}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                b.tier === "MEGA" ? "bg-amber-500 text-black"
                : b.tier === "LARGE" ? "bg-slate-700 text-slate-200"
                : "bg-slate-800 text-slate-400"
              }`}>{b.tier}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
