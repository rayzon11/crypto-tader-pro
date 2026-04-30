"use client";

import { useEffect, useState } from "react";
import { useBinanceChart } from "@/hooks/useBinanceChart";

const API = "http://localhost:3002";
const n = (x: any, d = 2) => (typeof x === "number" && Number.isFinite(x) ? x.toFixed(d) : "0.00");
const usd = (x: any, d = 2) => `$${n(x, d)}`;

async function getJson(path: string) {
  try { const r = await fetch(`${API}${path}`); return await r.json(); } catch { return null; }
}

function MiniPrice({ base, quote }: { base: string; quote: string }) {
  const { price, change24h } = useBinanceChart(`${base}/${quote}`, "1m");
  return (
    <div className="text-right">
      <div className="font-bold tabular-nums text-white">{price ? usd(price) : "—"}</div>
      {change24h != null && (
        <div className={`text-[10px] ${change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change24h >= 0 ? "+" : ""}{n(change24h)}%
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const [spot, setSpot] = useState<any>(null);
  const [fut, setFut] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const [s, f] = await Promise.all([
        getJson("/api/trader/status"),
        getJson("/api/futures/status"),
      ]);
      if (s) setSpot(s);
      if (f) setFut(f);
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const spotStats = spot?.stats ?? {};
  const futStats = fut?.stats ?? {};
  const spotEquity = (spotStats.balance ?? 0) + (spotStats.unrealizedPnl ?? 0);
  const futEquity = futStats.equity ?? 0;
  const totalEquity = spotEquity + futEquity;
  const totalInitial = (spotStats.initialBalance ?? 0) + (futStats.initialBalance ?? 0);
  const totalPnl = totalEquity - totalInitial;
  const totalPnlPct = totalInitial ? (totalPnl / totalInitial) * 100 : 0;

  const allPositions = [
    ...(spot?.positions ?? []).map((p: any) => ({ ...p, market: "SPOT" })),
    ...(fut?.positions ?? []).map((p: any) => ({ ...p, market: "PERP" })),
  ];

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 space-y-4" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      <div className="border border-green-500/40 rounded p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.3em] opacity-70">PORTFOLIO · REAL-TIME MARK-TO-MARKET</div>
          <div className="text-2xl font-bold text-white mt-1">{usd(totalEquity)}</div>
          <div className={`text-sm ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}{usd(totalPnl)} ({totalPnl >= 0 ? "+" : ""}{n(totalPnlPct)}%) since inception
          </div>
        </div>
        <div className="flex gap-6 text-xs">
          <Stat label="Spot Equity"    value={usd(spotEquity)} cls="text-cyan-300" />
          <Stat label="Futures Equity" value={usd(futEquity)}  cls="text-orange-300" />
          <Stat label="Open Positions" value={String(allPositions.length)} />
          <Stat label="Realized P&L"   value={`${((spotStats.realizedPnl ?? 0) + (futStats.realizedPnl ?? 0)) >= 0 ? "+" : ""}${usd((spotStats.realizedPnl ?? 0) + (futStats.realizedPnl ?? 0))}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-cyan-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 text-cyan-400">◆ SPOT TRADING ACCOUNT</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Stat label="Balance"       value={usd(spotStats.balance)} />
            <Stat label="Unrealized"    value={`${(spotStats.unrealizedPnl ?? 0) >= 0 ? "+" : ""}${usd(spotStats.unrealizedPnl)}`} cls={(spotStats.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
            <Stat label="Total P&L"     value={`${(spotStats.totalPnl ?? 0) >= 0 ? "+" : ""}${usd(spotStats.totalPnl)}`} cls={(spotStats.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
            <Stat label="Win Rate"      value={`${n(spotStats.winRate, 1)}%`} />
            <Stat label="Trades"        value={`${spotStats.wins ?? 0}W / ${spotStats.losses ?? 0}L`} />
            <Stat label="Status"        value={spotStats.running ? "● LIVE" : "○ STOPPED"} cls={spotStats.running ? "text-green-400" : "text-slate-500"} />
          </div>
        </div>

        <div className="border border-orange-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 text-orange-400">⚡ FUTURES (PERPETUAL) ACCOUNT</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Stat label="Equity"        value={usd(futStats.equity)} />
            <Stat label="Free"          value={usd(futStats.freeBalance)} />
            <Stat label="Locked Margin" value={usd(futStats.lockedMargin)} cls="text-yellow-300" />
            <Stat label="Unrealized"    value={`${(futStats.unrealizedPnl ?? 0) >= 0 ? "+" : ""}${usd(futStats.unrealizedPnl)}`} cls={(futStats.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
            <Stat label="Funding Paid"  value={usd(futStats.fundingPaid, 4)} cls="opacity-70" />
            <Stat label="Win Rate"      value={`${n(futStats.winRate, 1)}%`} />
          </div>
        </div>
      </div>

      <div className="border border-green-500/40 rounded p-3">
        <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📍 OPEN POSITIONS ({allPositions.length})</div>
        <table className="w-full text-[11px] font-mono">
          <thead className="text-green-400/70 border-b border-green-500/20">
            <tr><Th>Market</Th><Th>Symbol</Th><Th>Side</Th><Th>Lev</Th><Th>Entry</Th><Th>Mark</Th><Th>Liq</Th><Th>Size</Th><Th>Notional</Th><Th>Unrealized</Th><Th>%</Th></tr>
          </thead>
          <tbody>
            {allPositions.map((p: any, i: number) => (
              <tr key={`${p.market}-${p.id}-${i}`} className="border-b border-green-500/10">
                <Td><span className={p.market === "SPOT" ? "text-cyan-400" : "text-orange-400"}>{p.market}</span></Td>
                <Td>{p.symbol}</Td>
                <Td><span className={p.side === "LONG" ? "text-green-400" : "text-red-400"}>{p.side}</span></Td>
                <Td className="text-orange-400">{p.leverage ? `${p.leverage}x` : "1x"}</Td>
                <Td>{usd(p.entry)}</Td>
                <Td className="text-white">{usd(p.currentPrice)}</Td>
                <Td className="text-red-400">{p.liqPrice ? usd(p.liqPrice) : "—"}</Td>
                <Td>{n(p.size, 4)}</Td>
                <Td>{usd(p.notional ?? (p.entry ?? 0) * (p.size ?? 0))}</Td>
                <Td className={(p.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                  {(p.unrealizedPnl ?? 0) >= 0 ? "+" : ""}{usd(p.unrealizedPnl)}
                </Td>
                <Td className={(p.unrealizedPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                  {(p.unrealizedPct ?? 0) >= 0 ? "+" : ""}{n(p.unrealizedPct)}%
                </Td>
              </tr>
            ))}
            {allPositions.length === 0 && <tr><td colSpan={11} className="py-3 text-center opacity-50">No open positions across spot or futures</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="border border-green-500/40 rounded p-3">
        <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📈 WATCHLIST · LIVE BINANCE PRICES</div>
        <div className="grid grid-cols-4 gap-3">
          {[["BTC","USDT"],["ETH","USDT"],["SOL","USDT"],["XRP","USDT"],["BNB","USDT"],["ADA","USDT"],["DOGE","USDT"],["AVAX","USDT"]].map(([b,q]) => (
            <div key={b} className="flex justify-between items-center p-2 rounded border border-green-500/20 bg-black/40">
              <div className="text-sm font-bold">{b}/{q}</div>
              <MiniPrice base={b} quote={q} />
            </div>
          ))}
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
