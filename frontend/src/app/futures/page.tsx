"use client";

import { useEffect, useState } from "react";
import { useBinanceChart } from "@/hooks/useBinanceChart";
import CandleChart from "@/components/CandleChart";

const API = "http://localhost:3002";
const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "BNB/USDT"];
const LEVERAGES = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125];

const n = (x: any, d = 2) => (typeof x === "number" && Number.isFinite(x) ? x.toFixed(d) : "0.00");
const usd = (x: any, d = 2) => `$${n(x, d)}`;

async function api(method: string, path: string, body?: any) {
  try {
    const r = await fetch(`${API}${path}`, {
      method, headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await r.json();
  } catch { return null; }
}

export default function FuturesPage() {
  const [snap, setSnap] = useState<any>(null);
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [leverage, setLeverage] = useState(10);
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [sizeUsd, setSizeUsd] = useState("500");
  const [busy, setBusy] = useState(false);

  const [base, quote] = symbol.split("/");
  const { candles, price, change24h, connected } = useBinanceChart(`${base}/${quote}`, "5m");

  const refresh = async () => {
    const s = await api("GET", "/api/futures/status");
    if (s) setSnap(s);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  const stats = snap?.stats ?? {};
  const positions = snap?.positions ?? [];
  const trades = snap?.trades ?? [];
  const feed = snap?.feed ?? [];

  const placeOrder = async () => {
    setBusy(true);
    const r = await api("POST", "/api/futures/order", {
      symbol, side, leverage, sizeUsd: parseFloat(sizeUsd) || 100,
    });
    if (r?.error) alert(r.error);
    await refresh();
    setBusy(false);
  };

  const livePrice = price ?? 0;
  const notional = (parseFloat(sizeUsd) || 0);
  const margin = notional / leverage;
  const liqPrice = side === "LONG"
    ? livePrice * (1 - 1/leverage + 0.005)
    : livePrice * (1 + 1/leverage - 0.005);

  return (
    <div className="min-h-screen bg-black text-green-400" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      {/* HEADER */}
      <div className="border-b border-orange-500/40 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-widest text-orange-400">⚡ FUTURES TRADING · PERPETUAL CONTRACTS · UP TO 125x LEVERAGE</span>
          <span>MODE: <span className="text-yellow-300 font-bold">📄 DEMO (PAPER · LIVE BINANCE PRICES)</span></span>
          <span>STATUS: <span className={stats.running ? "text-green-400" : "text-slate-500"}>{stats.running ? "● ENGINE RUNNING" : "○ STOPPED"}</span></span>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setBusy(true); await api("POST", "/api/futures/start"); await refresh(); setBusy(false); }}
            disabled={busy || stats.running}
            className="px-3 py-1 rounded border border-green-400 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-40 text-green-300 font-bold">▶ START AUTO</button>
          <button onClick={async () => { setBusy(true); await api("POST", "/api/futures/stop"); await refresh(); setBusy(false); }}
            disabled={busy || !stats.running}
            className="px-3 py-1 rounded border border-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-300 font-bold">⏹ STOP</button>
          <button onClick={async () => { setBusy(true); await api("POST", "/api/futures/reset"); await refresh(); setBusy(false); }}
            disabled={busy}
            className="px-3 py-1 rounded border border-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 disabled:opacity-40 text-yellow-300 font-bold">↺ RESET</button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-4 p-4">
        {/* LEFT — account + chart + positions */}
        <div className="space-y-4">
          {/* ACCOUNT */}
          <div className="border border-orange-500/40 rounded p-3 grid grid-cols-6 gap-4 text-xs">
            <Stat label="Equity"          value={usd(stats.equity)} cls="text-white text-lg" />
            <Stat label="Free Balance"    value={usd(stats.freeBalance)} />
            <Stat label="Locked Margin"   value={usd(stats.lockedMargin)} cls="text-yellow-300" />
            <Stat label="Unrealized P&L"  value={`${(stats.unrealizedPnl ?? 0) >= 0 ? "+" : ""}${usd(stats.unrealizedPnl)}`} cls={(stats.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
            <Stat label="Total P&L"       value={`${(stats.totalPnl ?? 0) >= 0 ? "+" : ""}${usd(stats.totalPnl)} (${n(stats.totalPnlPct)}%)`} cls={(stats.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
            <Stat label="Win Rate"        value={`${n(stats.winRate, 1)}% (${stats.wins ?? 0}W/${stats.losses ?? 0}L)`} cls="text-cyan-300" />
          </div>

          {/* CHART */}
          <div className="border border-orange-500/40 rounded p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <select value={symbol} onChange={e => setSymbol(e.target.value)}
                  className="bg-black border border-orange-500/40 rounded px-2 py-1 text-sm font-bold text-orange-400">
                  {SYMBOLS.map(s => <option key={s} value={s}>{s} PERP</option>)}
                </select>
                <div>
                  <div className="text-xl font-bold text-white tabular-nums">{usd(livePrice)}</div>
                  {change24h != null && (
                    <div className={`text-xs ${change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {change24h >= 0 ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% · 24h
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded border ${connected ? "border-green-400 text-green-400" : "border-yellow-400 text-yellow-400"}`}>
                {connected ? "● BINANCE WS LIVE" : "○ CONNECTING"}
              </span>
            </div>
            {candles.length > 0 ? (
              <CandleChart candles={candles} height={340} showVolume title={`${symbol} PERP · 5m · ${candles.length} candles`} />
            ) : (
              <div className="h-[340px] flex items-center justify-center opacity-60 text-xs">Loading…</div>
            )}
          </div>

          {/* OPEN POSITIONS */}
          <div className="border border-orange-500/40 rounded p-3">
            <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📍 OPEN FUTURES POSITIONS ({positions.length})</div>
            <table className="w-full text-[11px] font-mono">
              <thead className="text-orange-400/70 border-b border-orange-500/20">
                <tr><Th>Symbol</Th><Th>Side</Th><Th>Lev</Th><Th>Entry</Th><Th>Mark</Th><Th>Liq</Th><Th>Dist</Th><Th>Size</Th><Th>Notional</Th><Th>Margin</Th><Th>PnL</Th><Th>%</Th><Th>Action</Th></tr>
              </thead>
              <tbody>
                {positions.map((p: any) => (
                  <tr key={p.id} className="border-b border-orange-500/10">
                    <Td>{p.symbol}</Td>
                    <Td><span className={p.side === "LONG" ? "text-green-400" : "text-red-400"}>{p.side}</span></Td>
                    <Td className="text-orange-400 font-bold">{p.leverage}x</Td>
                    <Td>{usd(p.entry)}</Td>
                    <Td className="text-white">{usd(p.currentPrice)}</Td>
                    <Td className="text-red-400">{usd(p.liqPrice)}</Td>
                    <Td className={(p.distToLiqPct ?? 0) < 3 ? "text-red-400 font-bold" : "text-yellow-300"}>{n(p.distToLiqPct, 1)}%</Td>
                    <Td>{n(p.size, 4)}</Td>
                    <Td>{usd(p.notional)}</Td>
                    <Td>{usd(p.margin)}</Td>
                    <Td className={(p.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{(p.unrealizedPnl ?? 0) >= 0 ? "+" : ""}{usd(p.unrealizedPnl)}</Td>
                    <Td className={(p.unrealizedPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{(p.unrealizedPct ?? 0) >= 0 ? "+" : ""}{n(p.unrealizedPct)}%</Td>
                    <Td>
                      <button onClick={async () => { await api("POST", "/api/futures/close", { id: p.id }); await refresh(); }}
                        className="text-[10px] px-2 py-0.5 rounded border border-red-400 text-red-400 hover:bg-red-500/10">CLOSE</button>
                    </Td>
                  </tr>
                ))}
                {positions.length === 0 && <tr><td colSpan={13} className="py-3 text-center opacity-50">No open positions</td></tr>}
              </tbody>
            </table>
          </div>

          {/* TRADE HISTORY */}
          <div className="border border-orange-500/40 rounded p-3">
            <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📊 TRADE HISTORY</div>
            <table className="w-full text-[11px] font-mono">
              <thead className="text-orange-400/70 border-b border-orange-500/20">
                <tr><Th>Symbol</Th><Th>Side</Th><Th>Lev</Th><Th>Entry</Th><Th>Exit</Th><Th>PnL</Th><Th>% (margin)</Th><Th>Reason</Th><Th>Dur</Th></tr>
              </thead>
              <tbody>
                {trades.map((t: any) => (
                  <tr key={t.id} className="border-b border-orange-500/10">
                    <Td>{t.symbol}</Td>
                    <Td><span className={t.side === "LONG" ? "text-green-400" : "text-red-400"}>{t.side}</span></Td>
                    <Td className="text-orange-400">{t.leverage}x</Td>
                    <Td>{usd(t.entry)}</Td>
                    <Td>{usd(t.exit)}</Td>
                    <Td className={t.won ? "text-green-400" : "text-red-400"}>{(t.pnl ?? 0) >= 0 ? "+" : ""}{usd(t.pnl)}</Td>
                    <Td className={t.won ? "text-green-400" : "text-red-400"}>{(t.pnlPct ?? 0) >= 0 ? "+" : ""}{n(t.pnlPct)}%</Td>
                    <Td className="opacity-70">{t.reason}</Td>
                    <Td>{Math.floor((t.durationMs ?? 0) / 1000)}s</Td>
                  </tr>
                ))}
                {trades.length === 0 && <tr><td colSpan={9} className="py-3 text-center opacity-50">No trades yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — order ticket + feed */}
        <div className="space-y-4">
          {/* ORDER TICKET */}
          <div className="border border-orange-500/40 rounded p-3 bg-black">
            <div className="text-xs font-bold tracking-widest mb-3 opacity-80">⚡ PLACE FUTURES ORDER</div>

            {/* Long/Short toggle */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setSide("LONG")}
                className={`py-2 rounded font-bold text-sm ${side === "LONG" ? "bg-green-500 text-black" : "bg-slate-900 text-green-400 border border-green-500/30"}`}>
                ▲ LONG
              </button>
              <button onClick={() => setSide("SHORT")}
                className={`py-2 rounded font-bold text-sm ${side === "SHORT" ? "bg-red-500 text-black" : "bg-slate-900 text-red-400 border border-red-500/30"}`}>
                ▼ SHORT
              </button>
            </div>

            {/* Symbol */}
            <label className="text-[10px] opacity-60 uppercase tracking-wider">Symbol</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full bg-black border border-orange-500/30 rounded px-2 py-1.5 text-sm mb-3">
              {SYMBOLS.map(s => <option key={s} value={s}>{s} PERP</option>)}
            </select>

            {/* Leverage slider */}
            <label className="text-[10px] opacity-60 uppercase tracking-wider">
              Leverage · <span className="text-orange-400 font-bold">{leverage}x</span>
              {leverage > 25 && <span className="text-red-400 ml-2">⚠ HIGH RISK</span>}
            </label>
            <div className="flex gap-1 mb-3">
              {LEVERAGES.map(l => (
                <button key={l} onClick={() => setLeverage(l)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold ${leverage === l ? "bg-orange-500 text-black" : "bg-slate-900 text-orange-400 hover:bg-slate-800"}`}>
                  {l}x
                </button>
              ))}
            </div>

            {/* Size */}
            <label className="text-[10px] opacity-60 uppercase tracking-wider">Size (USDT notional)</label>
            <input type="number" value={sizeUsd} onChange={e => setSizeUsd(e.target.value)}
              className="w-full bg-black border border-orange-500/30 rounded px-2 py-1.5 text-sm mb-3 tabular-nums" />
            <div className="grid grid-cols-4 gap-1 mb-3">
              {[100, 500, 1000, 5000].map(v => (
                <button key={v} onClick={() => setSizeUsd(String(v))}
                  className="py-1 rounded text-[10px] bg-slate-900 border border-slate-700 hover:border-orange-500/40">
                  ${v}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t border-orange-500/20 pt-3 space-y-1 text-[11px] mb-3">
              <Row k="Notional" v={usd(notional)} />
              <Row k="Required Margin" v={usd(margin)} cls="text-yellow-300" />
              <Row k="Entry Price" v={usd(livePrice)} />
              <Row k="Est. Liquidation" v={usd(liqPrice)} cls="text-red-400" />
              <Row k="Fees (0.04%)" v={usd(notional * 0.0004, 4)} cls="opacity-60" />
            </div>

            <button onClick={placeOrder} disabled={busy || !connected || livePrice === 0}
              className={`w-full py-3 rounded font-black text-sm disabled:opacity-40 ${
                side === "LONG" ? "bg-green-500 text-black hover:bg-green-400" : "bg-red-500 text-black hover:bg-red-400"
              }`}>
              ▶ EXECUTE {side} {leverage}x · {symbol}
            </button>
          </div>

          {/* LIVE FEED */}
          <div className="border border-orange-500/40 rounded p-3 bg-black">
            <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📡 FUTURES FEED</div>
            <div className="space-y-0.5 text-[11px] font-mono max-h-[400px] overflow-y-auto">
              {feed.length === 0 && <div className="opacity-50">No activity yet — place an order or START AUTO</div>}
              {feed.map((line: string, i: number) => (
                <div key={i} className={
                  line.includes("💥") ? "text-red-500 font-bold" :
                  line.includes("✅") ? "text-green-400" :
                  line.includes("❌") ? "text-red-400" :
                  line.includes("📈") ? "text-cyan-300" :
                  line.includes("🟢") ? "text-green-400" :
                  line.includes("💸") ? "text-yellow-300" :
                  "opacity-80"
                }>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls = "text-green-400" }: { label: string; value: string; cls?: string }) {
  return <div><div className="text-[10px] opacity-60 uppercase tracking-wider">{label}</div><div className={`font-bold ${cls}`}>{value}</div></div>;
}
function Th({ children }: any) { return <th className="py-1.5 px-2 text-left font-normal uppercase tracking-wider text-[10px]">{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={`py-1.5 px-2 ${className}`}>{children}</td>; }
function Row({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return <div className="flex justify-between"><span className="opacity-60">{k}</span><span className={`font-bold tabular-nums ${cls}`}>{v}</span></div>;
}
