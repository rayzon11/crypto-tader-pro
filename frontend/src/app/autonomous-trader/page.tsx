"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:3002";

interface Position {
  id: number; symbol: string; side: string; entry: number; size: number;
  sl: number; tp1: number; tp2: number; tp1Done: boolean; openedAt: number;
  confidence: number; reasoning: string; currentPrice: number;
  unrealizedPnl: number; unrealizedPct: number;
}
interface Trade {
  id: number; symbol: string; side: string; entry: number; exit: number;
  size: number; pnl: number; pnlPct: number; openedAt: number; closedAt: number;
  durationMs: number; confidence: number; reason: string; reasoning: string; won: boolean;
}
interface Snapshot {
  stats: any;
  positions: Position[];
  trades: Trade[];
  feed: string[];
}

// ─── Safe formatters (never throw) ───
const safeNum = (n: any, d = 2): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toFixed(d);
};
const safeUsd = (n: any, d = 2): string => `$${safeNum(n, d)}`;
const safePct = (n: any, d = 2): string => `${safeNum(n, d)}%`;

async function api(method: string, path: string, body?: any) {
  try {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await r.json();
  } catch { return null; }
}

export default function AutonomousTraderPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const s = await api("GET", "/api/trader/status");
    if (s) setSnap(s);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  const start = async () => { setBusy(true); await api("POST", "/api/trader/start"); await refresh(); setBusy(false); };
  const stop  = async () => { setBusy(true); await api("POST", "/api/trader/stop");  await refresh(); setBusy(false); };
  const reset = async () => { setBusy(true); await api("POST", "/api/trader/reset"); await refresh(); setBusy(false); };
  const toggleMode = async () => {
    const next = snap?.stats?.mode === "DEMO" ? "LIVE" : "DEMO";
    setBusy(true); await api("POST", "/api/trader/mode", { mode: next }); await refresh(); setBusy(false);
  };

  const stats = snap?.stats ?? {};
  const pnlColor = (stats.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-black text-green-400" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      {/* HEADER */}
      <div className="border-b border-green-500/40 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-widest">◆ AUTONOMOUS CRYPTO TRADING AGENT</span>
          <span>MODE: <span className={stats.mode === "LIVE" ? "text-red-400 font-bold" : "text-yellow-300 font-bold"}>
            {stats.mode === "LIVE" ? "💰 LIVE (REAL MONEY)" : "📄 DEMO (PAPER TRADING)"}
          </span></span>
          <span>STATUS: <span className={stats.running ? "text-green-400 font-bold" : "text-slate-500 font-bold"}>
            {stats.running ? "● RUNNING" : "○ STOPPED"}
          </span></span>
          <span className="opacity-60">Uptime: {stats.uptimeSec ?? 0}s</span>
        </div>
        <div className="flex gap-2">
          <button onClick={start} disabled={busy || stats.running}
            className="px-3 py-1 rounded border border-green-400 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-40 text-green-300 font-bold">▶ START</button>
          <button onClick={stop} disabled={busy || !stats.running}
            className="px-3 py-1 rounded border border-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-300 font-bold">⏹ STOP</button>
          <button onClick={reset} disabled={busy}
            className="px-3 py-1 rounded border border-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 disabled:opacity-40 text-yellow-300 font-bold">↺ RESET</button>
          <button onClick={toggleMode} disabled={busy}
            className="px-3 py-1 rounded border border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 text-purple-300 font-bold">⇄ {stats.mode === "DEMO" ? "GO LIVE" : "GO DEMO"}</button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-4 p-4">
        <div className="space-y-4">
          {/* ACCOUNT STATS */}
          <div className="border border-green-500/40 rounded p-4">
            <div className="text-xs font-bold tracking-widest mb-3 opacity-80">💼 ACCOUNT STATISTICS</div>
            <div className="grid grid-cols-6 gap-4 text-sm">
              <Stat label="Initial" value={`$${(stats.initialBalance ?? 1000).toLocaleString()}`} />
              <Stat label="Balance" value={`$${(stats.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} cls="text-white" />
              <Stat label="Realized P&L" value={`${(stats.realizedPnl ?? 0) >= 0 ? "+" : ""}$${(stats.realizedPnl ?? 0).toFixed(2)}`} cls={(stats.realizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
              <Stat label="Unrealized" value={`${(stats.unrealizedPnl ?? 0) >= 0 ? "+" : ""}$${(stats.unrealizedPnl ?? 0).toFixed(2)}`} cls={(stats.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
              <Stat label="Total P&L" value={`${(stats.totalPnl ?? 0) >= 0 ? "+" : ""}$${(stats.totalPnl ?? 0).toFixed(2)} (${(stats.totalPnlPct ?? 0).toFixed(2)}%)`} cls={pnlColor} />
              <Stat label="Win Rate" value={`${stats.winRate ?? 0}% (${stats.wins ?? 0}W/${stats.losses ?? 0}L)`} cls="text-cyan-300" />
            </div>
            <div className="mt-3 pt-3 border-t border-green-500/20 grid grid-cols-6 gap-4 text-xs opacity-80">
              <Stat label="Decision TF" value={stats.config?.decisionTf ?? "5m"} />
              <Stat label="Loop" value={`${(stats.config?.loopMs ?? 5000) / 1000}s`} />
              <Stat label="Min Confidence" value={`${stats.config?.minConfidence ?? 75}%`} />
              <Stat label="Min R:R" value={`${stats.config?.minRR ?? 2}:1`} />
              <Stat label="Risk / Trade" value={`${stats.config?.riskPct ?? 5}%`} />
              <Stat label="Avg Win / Loss" value={`+$${stats.avgWin ?? 0} / $${stats.avgLoss ?? 0}`} />
            </div>
          </div>

          {/* OPEN POSITIONS */}
          <div className="border border-green-500/40 rounded p-4">
            <div className="text-xs font-bold tracking-widest mb-3 opacity-80">📍 OPEN POSITIONS ({snap?.positions.length ?? 0})</div>
            <table className="w-full text-xs font-mono">
              <thead className="text-green-400/70 border-b border-green-500/20">
                <tr><Th>Symbol</Th><Th>Side</Th><Th>Entry</Th><Th>Current</Th><Th>Size</Th><Th>Unrealized</Th><Th>%</Th><Th>SL</Th><Th>TP1</Th><Th>TP2</Th><Th>Conf</Th><Th>Reasoning</Th></tr>
              </thead>
              <tbody>
                {(snap?.positions ?? []).map(p => (
                  <tr key={p.id} className="border-b border-green-500/10 hover:bg-green-500/5">
                    <Td>{p.symbol}</Td>
                    <Td><span className={p.side === "LONG" ? "text-green-400" : "text-red-400"}>{p.side}</span></Td>
                    <Td>{safeUsd(p.entry)}</Td>
                    <Td className="text-white">{safeUsd(p.currentPrice)}</Td>
                    <Td>{safeNum(p.size, 6)}</Td>
                    <Td className={(p.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                      {(p.unrealizedPnl ?? 0) >= 0 ? "+" : ""}{safeUsd(p.unrealizedPnl)}
                    </Td>
                    <Td className={(p.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                      {(p.unrealizedPct ?? 0) >= 0 ? "+" : ""}{safePct(p.unrealizedPct)}
                    </Td>
                    <Td className="text-red-400">{safeUsd(p.sl)}</Td>
                    <Td className="text-green-400">{safeUsd(p.tp1)}{p.tp1Done && " ✓"}</Td>
                    <Td className="text-green-400">{safeUsd(p.tp2)}</Td>
                    <Td>{p.confidence ?? 0}%</Td>
                    <Td className="opacity-70 text-[10px]">{p.reasoning?.slice(0, 50)}</Td>
                  </tr>
                ))}
                {(!snap || snap.positions.length === 0) && (
                  <tr><td colSpan={12} className="py-3 text-center opacity-50">No open positions</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TRADE HISTORY */}
          <div className="border border-green-500/40 rounded p-4">
            <div className="text-xs font-bold tracking-widest mb-3 opacity-80">📊 TRADE HISTORY (Last 50)</div>
            <table className="w-full text-xs font-mono">
              <thead className="text-green-400/70 border-b border-green-500/20">
                <tr><Th>#</Th><Th>Symbol</Th><Th>Side</Th><Th>Entry</Th><Th>Exit</Th><Th>Size</Th><Th>P&L</Th><Th>%</Th><Th>Conf</Th><Th>Reason</Th><Th>Duration</Th><Th></Th></tr>
              </thead>
              <tbody>
                {(snap?.trades ?? []).map(t => (
                  <tr key={t.id} className="border-b border-green-500/10 hover:bg-green-500/5">
                    <Td>{t.id}</Td>
                    <Td>{t.symbol}</Td>
                    <Td><span className={t.side === "LONG" ? "text-green-400" : "text-red-400"}>{t.side}</span></Td>
                    <Td>{safeUsd(t.entry)}</Td>
                    <Td>{safeUsd(t.exit)}</Td>
                    <Td>{safeNum(t.size, 6)}</Td>
                    <Td className={t.won ? "text-green-400" : "text-red-400"}>
                      {(t.pnl ?? 0) >= 0 ? "+" : ""}{safeUsd(t.pnl)}
                    </Td>
                    <Td className={t.won ? "text-green-400" : "text-red-400"}>
                      {(t.pnlPct ?? 0) >= 0 ? "+" : ""}{safePct(t.pnlPct)}
                    </Td>
                    <Td>{t.confidence ?? 0}%</Td>
                    <Td className="opacity-70">{t.reason}</Td>
                    <Td>{Math.floor((t.durationMs ?? 0) / 1000)}s</Td>
                    <Td>{t.won ? "✅" : "❌"}</Td>
                  </tr>
                ))}
                {(!snap || snap.trades.length === 0) && (
                  <tr><td colSpan={12} className="py-3 text-center opacity-50">No closed trades yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LIVE FEED */}
        <div className="border border-green-500/40 rounded p-3 h-fit sticky top-4">
          <div className="text-xs font-bold tracking-widest mb-2 opacity-80">📡 LIVE TRADE FEED</div>
          <div className="space-y-0.5 text-[11px] font-mono max-h-[80vh] overflow-y-auto">
            {(snap?.feed ?? []).length === 0 && <div className="opacity-50">No activity yet — click START</div>}
            {(snap?.feed ?? []).map((line, i) => (
              <div key={i} className={
                line.includes("✅") ? "text-green-400" :
                line.includes("❌") ? "text-red-400" :
                line.includes("📈") ? "text-cyan-300" :
                line.includes("🛑") ? "text-red-400" :
                line.includes("🟢") ? "text-green-400" :
                line.includes("⏹") ? "text-yellow-300" :
                line.includes("🔴") ? "text-red-400" :
                "opacity-80"}>
                {line}
              </div>
            ))}
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
