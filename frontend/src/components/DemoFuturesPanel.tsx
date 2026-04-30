"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:3002";
const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "BNB/USDT"];
const LEVERAGES = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125];
const QUICK = [100, 250, 500, 1000, 5000];

const num = (n: any, d = 2) => (Number.isFinite(n) ? Number(n).toFixed(d) : "—");
const usd = (n: any, d = 2) => (Number.isFinite(n) ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: d })}` : "—");

async function postJson(path: string, body?: any) {
  try {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return await r.json();
  } catch {
    return null;
  }
}
async function getJson(path: string) {
  try { const r = await fetch(`${API}${path}`); return await r.json(); } catch { return null; }
}

export default function DemoFuturesPanel() {
  const [snap, setSnap] = useState<any>(null);
  const [bridge, setBridge] = useState<any>(null);
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState(10);
  const [sizeUsd, setSizeUsd] = useState("500");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [s, b] = await Promise.all([
        getJson("/api/futures/status"),
        getJson("/api/agent-futures/status"),
      ]);
      setSnap(s);
      setBridge(b);
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const stats = snap?.stats ?? {};
  const positions = snap?.positions ?? [];
  const feed = snap?.feed ?? [];
  const price = (sym: string) => positions.find((p: any) => p.symbol === sym)?.currentPrice ?? null;
  const currentPrice = price(symbol);

  const notional = Number(sizeUsd) || 0;
  const margin = notional / leverage;
  const estLiq = currentPrice
    ? (side === "LONG" ? currentPrice * (1 - 1 / leverage + 0.005) : currentPrice * (1 + 1 / leverage - 0.005))
    : null;
  const fees = notional * 0.0004;

  const placeOrder = async () => {
    setBusy(true);
    const r = await postJson("/api/futures/order", { symbol, side, leverage, sizeUsd: notional });
    setBusy(false);
    setToast(r?.ok ? `✓ ${side} ${symbol} @ ${leverage}x opened` : `✗ ${r?.error || "Order rejected"}`);
    setTimeout(() => setToast(null), 3000);
  };

  const closePos = async (id: number) => {
    await postJson("/api/futures/close", { id });
  };

  const toggleBridge = async () => {
    if (bridge?.enabled) await postJson("/api/agent-futures/stop");
    else await postJson("/api/agent-futures/start");
  };
  const toggleTrader = async () => {
    if (stats.running) await postJson("/api/futures/stop");
    else await postJson("/api/futures/start");
  };

  return (
    <div className="mb-6 rounded-xl border border-orange-500/40 bg-black/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-orange-500/30 flex items-center justify-between flex-wrap gap-2 bg-gradient-to-r from-orange-500/10 to-transparent">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-orange-300 opacity-70">LEVERAGED FUTURES · ISOLATED MARGIN</div>
          <div className="text-lg font-bold text-orange-400">⚡ FUTURES TRADING — DEMO (live Binance prices)</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={toggleTrader} className={`px-3 py-1.5 rounded font-bold ${stats.running ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-green-500/20 text-green-300 border border-green-500/40"}`}>
            {stats.running ? "■ STOP TRADER" : "▶ START TRADER"}
          </button>
          <button onClick={toggleBridge} className={`px-3 py-1.5 rounded font-bold ${bridge?.enabled ? "bg-purple-500/30 text-purple-200 border border-purple-500/50" : "bg-slate-700 text-slate-300 border border-slate-600"}`}>
            {bridge?.enabled ? "🤖 AGENT AUTO-TRADE: ON" : "🤖 AGENT AUTO-TRADE: OFF"}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 px-4 py-3 border-b border-orange-500/20 text-xs">
        <Stat label="Equity"        value={usd(stats.equity)} cls="text-white" />
        <Stat label="Free Balance"  value={usd(stats.freeBalance)} />
        <Stat label="Locked Margin" value={usd(stats.lockedMargin)} cls="text-yellow-300" />
        <Stat label="Unrealized"    value={usd(stats.unrealizedPnl)} cls={(stats.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
        <Stat label="Realized P&L"  value={usd(stats.realizedPnl)} cls={(stats.realizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
        <Stat label="Win Rate"      value={`${num(stats.winRate, 1)}% · ${stats.wins ?? 0}W/${stats.losses ?? 0}L`} />
      </div>

      {/* Order ticket + positions */}
      <div className="grid md:grid-cols-[320px_1fr] gap-0">
        {/* Ticket */}
        <div className="p-4 border-r border-orange-500/20 bg-black/40 space-y-3">
          <div className="text-xs font-bold text-orange-300 tracking-widest">◆ ORDER TICKET</div>

          <div className="flex gap-1">
            {(["LONG", "SHORT"] as const).map((s) => (
              <button key={s} onClick={() => setSide(s)}
                className={`flex-1 py-2 rounded font-bold text-sm ${
                  side === s
                    ? s === "LONG" ? "bg-green-500 text-black" : "bg-red-500 text-black"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}>
                {s === "LONG" ? "▲ LONG / BUY" : "▼ SHORT / SELL"}
              </button>
            ))}
          </div>

          <div>
            <div className="text-[10px] opacity-60 mb-1">SYMBOL</div>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-[10px] opacity-60 mb-1">
              <span>LEVERAGE</span>
              <span className="font-bold text-orange-400">{leverage}x</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {LEVERAGES.map(l => (
                <button key={l} onClick={() => setLeverage(l)}
                  className={`px-2 py-1 text-[10px] rounded border ${
                    leverage === l ? "bg-orange-500 text-black border-orange-500 font-bold" : "border-slate-700 text-slate-400 hover:border-orange-500/50"
                  }`}>
                  {l}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] opacity-60 mb-1">SIZE (USD NOTIONAL)</div>
            <input type="number" value={sizeUsd} onChange={(e) => setSizeUsd(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
            <div className="flex gap-1 mt-1">
              {QUICK.map(q => (
                <button key={q} onClick={() => setSizeUsd(String(q))}
                  className="flex-1 py-1 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                  ${q}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded bg-slate-900/80 border border-slate-700 p-2 space-y-1 text-[11px]">
            <Row k="Mark Price" v={usd(currentPrice)} vCls="text-white" />
            <Row k="Notional"   v={usd(notional)} />
            <Row k="Req. Margin" v={usd(margin)} vCls="text-yellow-300" />
            <Row k="Est. Liq"   v={usd(estLiq)}  vCls="text-red-400" />
            <Row k="Fees (0.04%)" v={usd(fees, 3)} vCls="opacity-70" />
          </div>

          <button disabled={busy} onClick={placeOrder}
            className={`w-full py-2.5 rounded font-bold text-sm ${
              side === "LONG" ? "bg-green-500 hover:bg-green-400 text-black" : "bg-red-500 hover:bg-red-400 text-black"
            } ${busy ? "opacity-50" : ""}`}>
            {busy ? "PLACING..." : `PLACE ${side} @ ${leverage}x`}
          </button>

          {toast && (
            <div className={`text-[11px] p-2 rounded border ${
              toast.startsWith("✓") ? "border-green-500/50 text-green-400 bg-green-500/10" : "border-red-500/50 text-red-400 bg-red-500/10"
            }`}>
              {toast}
            </div>
          )}
        </div>

        {/* Positions & feed */}
        <div className="p-4">
          <div className="text-xs font-bold text-orange-300 tracking-widest mb-2">◆ OPEN POSITIONS ({positions.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="text-orange-300/70">
                <tr>
                  {["Agent/Source", "Symbol", "Side", "Lev", "Entry", "Mark", "Liq", "Margin", "uPnL", "%", ""].map(h => (
                    <th key={h} className="text-left px-1.5 py-1 font-normal uppercase text-[9px] tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p: any) => {
                  const distLiq = p.currentPrice && p.liqPrice
                    ? (Math.abs(p.currentPrice - p.liqPrice) / p.currentPrice) * 100
                    : null;
                  return (
                    <tr key={p.id} className="border-t border-slate-800">
                      <td className="px-1.5 py-1.5 text-purple-300">{p.agent || p.confidence}</td>
                      <td className="px-1.5 py-1.5 text-white">{p.symbol}</td>
                      <td className={`px-1.5 py-1.5 font-bold ${p.side === "LONG" ? "text-green-400" : "text-red-400"}`}>{p.side}</td>
                      <td className="px-1.5 py-1.5 text-orange-400">{p.leverage}x</td>
                      <td className="px-1.5 py-1.5">{usd(p.entry)}</td>
                      <td className="px-1.5 py-1.5 text-white">{usd(p.currentPrice)}</td>
                      <td className={`px-1.5 py-1.5 ${distLiq !== null && distLiq < 3 ? "text-red-400 font-bold animate-pulse" : "text-red-300/70"}`}>
                        {usd(p.liqPrice)}{distLiq !== null ? ` (${num(distLiq, 1)}%)` : ""}
                      </td>
                      <td className="px-1.5 py-1.5">{usd(p.margin)}</td>
                      <td className={`px-1.5 py-1.5 ${(p.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(p.unrealizedPnl ?? 0) >= 0 ? "+" : ""}{usd(p.unrealizedPnl)}
                      </td>
                      <td className={`px-1.5 py-1.5 ${(p.unrealizedPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(p.unrealizedPct ?? 0) >= 0 ? "+" : ""}{num(p.unrealizedPct, 2)}%
                      </td>
                      <td className="px-1.5 py-1.5">
                        <button onClick={() => closePos(p.id)}
                          className="px-2 py-0.5 text-[10px] rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/40">
                          CLOSE
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {positions.length === 0 && (
                  <tr><td colSpan={11} className="px-2 py-4 text-center text-slate-500 italic">No open positions — place an order or enable agent auto-trade</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Activity feed */}
          <div className="mt-3">
            <div className="text-xs font-bold text-orange-300 tracking-widest mb-1">◆ ACTIVITY</div>
            <div className="max-h-40 overflow-y-auto bg-black/60 border border-slate-800 rounded p-2 space-y-0.5 font-mono text-[10px]">
              {(bridge?.recentLog ?? []).slice(-8).reverse().map((l: any, i: number) => (
                <div key={`br-${i}`} className="text-purple-300">
                  [{new Date(l.ts).toLocaleTimeString()}] 🤖 {l.line}
                </div>
              ))}
              {feed.slice(0, 15).map((f: any, i: number) => (
                <div key={`f-${i}`} className="text-slate-300">
                  [{new Date(f.ts).toLocaleTimeString()}] {f.line}
                </div>
              ))}
              {feed.length === 0 && (bridge?.recentLog?.length ?? 0) === 0 && (
                <div className="text-slate-500 italic">No activity yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls = "text-green-400" }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[9px] opacity-60 uppercase tracking-wider">{label}</div>
      <div className={`font-bold ${cls}`}>{value}</div>
    </div>
  );
}
function Row({ k, v, vCls = "text-white" }: { k: string; v: string; vCls?: string }) {
  return <div className="flex justify-between"><span className="opacity-60">{k}</span><span className={`font-bold ${vCls}`}>{v}</span></div>;
}
