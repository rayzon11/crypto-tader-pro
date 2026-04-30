"use client";

import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3002";
const n = (x: any, d = 2) => (typeof x === "number" && Number.isFinite(x) ? x.toFixed(d) : "0.00");
const usd = (x: any, d = 2) => `$${n(x, d)}`;

async function getJson(path: string) {
  try { const r = await fetch(`${API}${path}`); return await r.json(); } catch { return null; }
}

export default function ReportsPage() {
  const [spot, setSpot] = useState<any>(null);
  const [fut, setFut] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [s, f, a] = await Promise.all([
        getJson("/api/trader/status"),
        getJson("/api/futures/status"),
        getJson("/api/agents"),
      ]);
      if (s) setSpot(s);
      if (f) setFut(f);
      if (Array.isArray(a)) setAgents(a);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const allTrades = useMemo(() => [
    ...((spot?.trades ?? []).map((t: any) => ({ ...t, market: "SPOT" }))),
    ...((fut?.trades ?? []).map((t: any) => ({ ...t, market: "PERP" }))),
  ].sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)), [spot, fut]);

  // ── Performance metrics from real trades ──
  const metrics = useMemo(() => {
    if (allTrades.length === 0) {
      return { total: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0, profitFactor: 0, sharpe: 0, avgDuration: 0 };
    }
    const wins = allTrades.filter((t: any) => t.won);
    const losses = allTrades.filter((t: any) => !t.won);
    const winSum = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const lossSum = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const totalPnl = allTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const pnls = allTrades.map((t: any) => t.pnl ?? 0);
    const mean = pnls.reduce((s, x) => s + x, 0) / pnls.length;
    const variance = pnls.reduce((s, x) => s + (x - mean) ** 2, 0) / pnls.length;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
    return {
      total: allTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / allTrades.length) * 100,
      totalPnl,
      avgWin: wins.length ? winSum / wins.length : 0,
      avgLoss: losses.length ? -lossSum / losses.length : 0,
      bestTrade: Math.max(...pnls),
      worstTrade: Math.min(...pnls),
      profitFactor: lossSum ? winSum / lossSum : winSum > 0 ? Infinity : 0,
      sharpe,
      avgDuration: allTrades.reduce((s, t) => s + (t.durationMs ?? 0), 0) / allTrades.length / 1000,
    };
  }, [allTrades]);

  // Top performing agents (by pnl)
  const topAgents = [...agents].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)).slice(0, 10);

  const spotStats = spot?.stats ?? {};
  const futStats = fut?.stats ?? {};

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 space-y-4" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      <div className="border border-green-500/40 rounded p-3">
        <div className="text-[10px] tracking-[0.3em] opacity-70">PERFORMANCE REPORTS · COMPUTED FROM LIVE TRADE HISTORY</div>
        <div className="text-xl font-bold mt-1">{allTrades.length} total trades across spot + futures</div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-6 gap-3">
        <KPI label="Total P&L"       value={`${metrics.totalPnl >= 0 ? "+" : ""}${usd(metrics.totalPnl)}`} cls={metrics.totalPnl >= 0 ? "text-green-400" : "text-red-400"} big />
        <KPI label="Win Rate"        value={`${n(metrics.winRate, 1)}%`} cls="text-cyan-300" />
        <KPI label="Profit Factor"   value={metrics.profitFactor === Infinity ? "∞" : n(metrics.profitFactor, 2)} cls={metrics.profitFactor >= 1.5 ? "text-green-400" : "text-yellow-300"} />
        <KPI label="Sharpe (ann.)"   value={n(metrics.sharpe, 2)} cls={metrics.sharpe >= 1 ? "text-green-400" : "text-yellow-300"} />
        <KPI label="Avg Win"         value={usd(metrics.avgWin)} cls="text-green-400" />
        <KPI label="Avg Loss"        value={usd(metrics.avgLoss)} cls="text-red-400" />
        <KPI label="Best Trade"      value={usd(metrics.bestTrade)} cls="text-green-400" />
        <KPI label="Worst Trade"     value={usd(metrics.worstTrade)} cls="text-red-400" />
        <KPI label="Avg Duration"    value={`${n(metrics.avgDuration, 0)}s`} />
        <KPI label="Wins"            value={String(metrics.wins)} cls="text-green-400" />
        <KPI label="Losses"          value={String(metrics.losses)} cls="text-red-400" />
        <KPI label="Expectancy"      value={usd(metrics.total ? metrics.totalPnl / metrics.total : 0)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* ACCOUNT BREAKDOWN */}
        <div className="border border-green-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 opacity-80">◆ ACCOUNT PERFORMANCE BREAKDOWN</div>
          <table className="w-full text-[11px] font-mono">
            <thead className="border-b border-green-500/20 text-green-400/70">
              <tr><Th>Account</Th><Th>Equity</Th><Th>P&L</Th><Th>%</Th><Th>Trades</Th><Th>Win%</Th></tr>
            </thead>
            <tbody>
              <tr className="border-b border-green-500/10">
                <Td className="text-cyan-400 font-bold">SPOT</Td>
                <Td>{usd((spotStats.balance ?? 0) + (spotStats.unrealizedPnl ?? 0))}</Td>
                <Td className={(spotStats.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{(spotStats.totalPnl ?? 0) >= 0 ? "+" : ""}{usd(spotStats.totalPnl)}</Td>
                <Td className={(spotStats.totalPnlPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{n(spotStats.totalPnlPct)}%</Td>
                <Td>{spotStats.closedTrades ?? 0}</Td>
                <Td>{n(spotStats.winRate, 1)}%</Td>
              </tr>
              <tr>
                <Td className="text-orange-400 font-bold">FUTURES</Td>
                <Td>{usd(futStats.equity)}</Td>
                <Td className={(futStats.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{(futStats.totalPnl ?? 0) >= 0 ? "+" : ""}{usd(futStats.totalPnl)}</Td>
                <Td className={(futStats.totalPnlPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{n(futStats.totalPnlPct)}%</Td>
                <Td>{futStats.closedTrades ?? 0}</Td>
                <Td>{n(futStats.winRate, 1)}%</Td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TOP AGENTS */}
        <div className="border border-green-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 opacity-80">🏆 TOP 10 AGENTS (BY P&L · OF 27)</div>
          <table className="w-full text-[11px] font-mono">
            <thead className="border-b border-green-500/20 text-green-400/70">
              <tr><Th>Rank</Th><Th>Agent</Th><Th>Tier</Th><Th>Decisions</Th><Th>Trades</Th><Th>Win%</Th><Th>P&L</Th></tr>
            </thead>
            <tbody>
              {topAgents.map((a: any, i: number) => (
                <tr key={a.name} className="border-b border-green-500/10">
                  <Td className="opacity-60">#{i + 1}</Td>
                  <Td className="font-bold text-white">{a.name}</Td>
                  <Td className="text-[10px] opacity-70">{a.tier}</Td>
                  <Td>{a.totalDecisions ?? 0}</Td>
                  <Td>{a.totalTrades ?? 0}</Td>
                  <Td>{n((a.winRate ?? 0) * 100, 1)}%</Td>
                  <Td className={(a.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>{(a.pnl ?? 0) >= 0 ? "+" : ""}{usd(a.pnl)}</Td>
                </tr>
              ))}
              {topAgents.length === 0 && <tr><td colSpan={7} className="py-3 text-center opacity-50">Waiting for agent activity…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL TRADE LEDGER */}
      <div className="border border-green-500/40 rounded p-3">
        <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📋 FULL TRADE LEDGER ({allTrades.length})</div>
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-[11px] font-mono">
            <thead className="border-b border-green-500/20 text-green-400/70 sticky top-0 bg-black">
              <tr><Th>#</Th><Th>Market</Th><Th>Symbol</Th><Th>Side</Th><Th>Lev</Th><Th>Entry</Th><Th>Exit</Th><Th>Size</Th><Th>P&L</Th><Th>%</Th><Th>Reason</Th><Th>Duration</Th><Th>Closed</Th></tr>
            </thead>
            <tbody>
              {allTrades.map((t: any, i: number) => (
                <tr key={`${t.market}-${t.id}-${i}`} className="border-b border-green-500/10">
                  <Td className="opacity-60">{allTrades.length - i}</Td>
                  <Td><span className={t.market === "SPOT" ? "text-cyan-400" : "text-orange-400"}>{t.market}</span></Td>
                  <Td>{t.symbol}</Td>
                  <Td><span className={t.side === "LONG" ? "text-green-400" : "text-red-400"}>{t.side}</span></Td>
                  <Td className="text-orange-400">{t.leverage ? `${t.leverage}x` : "1x"}</Td>
                  <Td>{usd(t.entry)}</Td>
                  <Td>{usd(t.exit)}</Td>
                  <Td>{n(t.size, 4)}</Td>
                  <Td className={t.won ? "text-green-400" : "text-red-400"}>{(t.pnl ?? 0) >= 0 ? "+" : ""}{usd(t.pnl)}</Td>
                  <Td className={t.won ? "text-green-400" : "text-red-400"}>{n(t.pnlPct)}%</Td>
                  <Td className="opacity-70">{t.reason}</Td>
                  <Td>{Math.floor((t.durationMs ?? 0) / 1000)}s</Td>
                  <Td className="opacity-50 text-[9px]">{t.closedAt ? new Date(t.closedAt).toLocaleString() : "—"}</Td>
                </tr>
              ))}
              {allTrades.length === 0 && <tr><td colSpan={13} className="py-4 text-center opacity-50">No closed trades yet — start the autonomous trader or place a futures order</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, cls = "text-green-400", big = false }: { label: string; value: string; cls?: string; big?: boolean }) {
  return (
    <div className="border border-green-500/30 rounded p-2 bg-black/40">
      <div className="text-[9px] opacity-60 uppercase tracking-wider">{label}</div>
      <div className={`font-bold ${big ? "text-xl" : "text-sm"} ${cls} tabular-nums`}>{value}</div>
    </div>
  );
}
function Th({ children }: any) { return <th className="py-1.5 px-2 text-left font-normal uppercase tracking-wider text-[10px]">{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={`py-1.5 px-2 ${className}`}>{children}</td>; }
