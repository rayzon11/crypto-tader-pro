"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:3002";

interface AgentStatus {
  name: string;
  type: string;
  active: boolean;
  weight: number;
  winRate: number;
  sharpeRatio: number;
  totalTrades: number;
  totalDecisions: number;
  lastDecision: any;
}

interface Decision {
  timestamp: string;
  agent: string;
  type?: string;
  signal_type?: string;
  reasoning?: string;
  status?: string;
  [k: string]: any;
}

// Agent metadata — what each agent collects and what it executes
const AGENT_META: Record<string, { collects: string; executes: string; color: string }> = {
  TRADER:            { collects: "Multi-TF price, indicators, agent consensus", executes: "Market/limit orders, position entries", color: "#10B981" },
  RISK_MANAGER:      { collects: "Open positions, VaR, drawdown, exposure",      executes: "Halt trading, reduce size, force-close",   color: "#EF4444" },
  MARKET_ANALYST:    { collects: "OHLCV, 30+ indicators, orderbook depth",       executes: "Signal broadcasts, regime classification", color: "#3B82F6" },
  ARBITRAGE_SCOUT:   { collects: "Cross-exchange spreads (Binance/Kraken/Coinbase)", executes: "Simultaneous buy/sell, hedge legs",     color: "#F59E0B" },
  GRID_MASTER:       { collects: "Range-bound ranges, volatility cones",          executes: "Grid orders, DCA ladders",                  color: "#8B5CF6" },
  PORTFOLIO_MANAGER: { collects: "Position weights, correlation matrix",          executes: "Rebalancing, concentration fixes",          color: "#14B8A6" },
  ORDER_EXECUTOR:    { collects: "Orderbook, slippage, fee schedules",            executes: "Smart order routing, iceberg splits",       color: "#F97316" },
};

function fmt(n: number | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [traderFeed, setTraderFeed] = useState<string[]>([]);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, d, t] = await Promise.all([
          fetch(`${API}/api/agents`).then(r => r.json()).catch(() => []),
          fetch(`${API}/api/agents/decisions?limit=30`).then(r => r.json()).catch(() => ({ decisions: [] })),
          fetch(`${API}/api/trader/status`).then(r => r.json()).catch(() => ({ feed: [] })),
        ]);
        if (Array.isArray(a)) setAgents(a);
        if (d?.decisions) setDecisions(d.decisions);
        if (t?.feed) setTraderFeed(t.feed);
        setPulse(p => p + 1);
      } catch { /* ignore */ }
    };
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, []);

  const activeCount = agents.filter(a => a.active).length;
  const totalDecisions = agents.reduce((s, a) => s + (a.totalDecisions || 0), 0);

  return (
    <div className="min-h-screen bg-black text-green-400 p-4" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      {/* HEADER */}
      <div className="border border-green-500/40 rounded p-3 mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs tracking-widest opacity-70">◆ AGENT COMMAND CENTER · 27-AGENT AUTONOMOUS SYSTEM</div>
          <div className="text-2xl font-bold mt-1">{activeCount}/{agents.length} AGENTS ONLINE</div>
        </div>
        <div className="flex gap-6 text-xs">
          <Stat label="Total Decisions" value={totalDecisions.toLocaleString()} />
          <Stat label="Live Pulses" value={pulse.toString()} />
          <Stat label="Refresh" value="2.5s" />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-4">
        {/* LEFT — AGENT CARDS */}
        <div className="grid grid-cols-2 gap-3">
          {agents.map(agent => {
            const meta = AGENT_META[agent.type] ?? { collects: "—", executes: "—", color: "#6B7280" };
            const ld = agent.lastDecision;
            const recentDecisions = decisions.filter(d => d.agent === agent.name).slice(-3).reverse();

            return (
              <div
                key={agent.name}
                className="border rounded p-3 bg-black/60 relative overflow-hidden"
                style={{ borderColor: `${meta.color}60` }}
              >
                {/* Activity pulse dot */}
                {agent.active && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
                    style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                  />
                )}

                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-bold text-sm" style={{ color: meta.color }}>{agent.name}</div>
                    <div className="text-[10px] opacity-60 uppercase tracking-widest">{agent.type}</div>
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded border ${agent.active ? "border-green-400 text-green-400" : "border-slate-600 text-slate-500"}`}>
                    {agent.active ? "● ACTIVE" : "○ IDLE"}
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 text-[10px] mb-2 pb-2 border-b border-green-500/10">
                  <div><div className="opacity-50">DECISIONS</div><div className="font-bold text-white">{agent.totalDecisions}</div></div>
                  <div><div className="opacity-50">TRADES</div><div className="font-bold text-white">{agent.totalTrades}</div></div>
                  <div><div className="opacity-50">WIN %</div><div className="font-bold text-white">{fmt(agent.winRate * 100, 1)}%</div></div>
                  <div><div className="opacity-50">WEIGHT</div><div className="font-bold text-white">{fmt(agent.weight, 2)}</div></div>
                </div>

                {/* Data panel */}
                <div className="text-[10px] space-y-1">
                  <div>
                    <span className="opacity-50">📥 COLLECTS:</span>{" "}
                    <span className="opacity-90">{meta.collects}</span>
                  </div>
                  <div>
                    <span className="opacity-50">⚡ EXECUTES:</span>{" "}
                    <span className="opacity-90">{meta.executes}</span>
                  </div>
                </div>

                {/* Last decision */}
                {ld && (
                  <div className="mt-2 pt-2 border-t border-green-500/10 text-[10px]">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="opacity-50">LAST DECISION</span>
                      <span className="opacity-50">{new Date(ld.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-bold" style={{ color: meta.color }}>
                      {ld.signal_type || ld.status || ld.type || "UPDATE"}
                    </div>
                    <div className="opacity-70 line-clamp-2">
                      {ld.reasoning || (ld.actions ? `${ld.actions.length} action(s): ${ld.actions.map((a: any) => `${a.action} ${a.asset}`).join(", ")}` : JSON.stringify(ld).slice(0, 100))}
                    </div>
                  </div>
                )}

                {/* Recent decision flow — animated */}
                {recentDecisions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-500/10">
                    <div className="text-[9px] opacity-50 mb-1">RECENT ACTIVITY (oldest → newest)</div>
                    <div className="flex gap-1">
                      {recentDecisions.map((d, i) => (
                        <div
                          key={i}
                          className="flex-1 h-8 rounded flex items-center justify-center text-[9px] font-bold"
                          style={{
                            background: `${meta.color}20`,
                            borderLeft: `2px solid ${meta.color}`,
                            opacity: 0.4 + (i * 0.3),
                          }}
                          title={d.reasoning || d.signal_type}
                        >
                          {d.signal_type?.slice(0, 6) || d.status?.slice(0, 6) || "→"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!agent.active && !ld && (
                  <div className="mt-2 text-[10px] opacity-40 italic">No decisions yet — waiting for market signal…</div>
                )}
              </div>
            );
          })}
          {agents.length === 0 && (
            <div className="col-span-2 text-center opacity-50 py-10">Connecting to backend…</div>
          )}
        </div>

        {/* RIGHT — LIVE DECISION FEED */}
        <div className="space-y-3">
          {/* Autonomous Trader Feed */}
          <div className="border border-green-500/40 rounded p-3">
            <div className="text-xs font-bold tracking-widest mb-2 opacity-80 flex justify-between items-center">
              <span>📡 AUTONOMOUS TRADER · LIVE FEED</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="space-y-0.5 text-[11px] max-h-[300px] overflow-y-auto">
              {traderFeed.length === 0 && <div className="opacity-50">No activity yet…</div>}
              {traderFeed.map((line, i) => (
                <div key={i} className={
                  line.includes("✅") ? "text-green-400" :
                  line.includes("❌") ? "text-red-400" :
                  line.includes("📈") ? "text-cyan-300" :
                  line.includes("🟢") ? "text-green-400" :
                  line.includes("🔴") ? "text-red-400" :
                  line.includes("⏹") ? "text-yellow-300" : "opacity-80"}>
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Cross-Agent Decision Stream */}
          <div className="border border-green-500/40 rounded p-3">
            <div className="text-xs font-bold tracking-widest mb-2 opacity-80 flex justify-between items-center">
              <span>◆ CROSS-AGENT DECISION STREAM</span>
              <span className="opacity-60">{decisions.length}</span>
            </div>
            <div className="space-y-1 text-[10px] max-h-[500px] overflow-y-auto">
              {decisions.length === 0 && <div className="opacity-50">No decisions yet…</div>}
              {[...decisions].reverse().map((d, i) => {
                const meta = AGENT_META[d.agent] ?? { color: "#6B7280" };
                return (
                  <div key={i} className="p-1.5 rounded border-l-2" style={{ borderColor: meta.color, background: `${meta.color}08` }}>
                    <div className="flex justify-between">
                      <span className="font-bold" style={{ color: meta.color }}>{d.agent}</span>
                      <span className="opacity-50">{new Date(d.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-bold mt-0.5">{d.signal_type || d.status || d.type}</div>
                    <div className="opacity-70 line-clamp-2">{d.reasoning || JSON.stringify(d).slice(0, 120)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] opacity-60 uppercase tracking-wider">{label}</div>
      <div className="font-bold text-lg text-white">{value}</div>
    </div>
  );
}
