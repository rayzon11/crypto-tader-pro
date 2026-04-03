"use client";

import { useEffect, useState } from "react";
import AgentCard from "./AgentCard";
import MasterStats from "./MasterStats";
import LiveTicker from "./LiveTicker";
import { generateMasterState } from "@/lib/mockData";
import { AGENTS, AGENT_TOOLS, AGENT_HOOKS } from "@/lib/agents";
import { getSectorHeatMap, getCorrelationMatrix, getEconomicCalendar } from "@/lib/bloomberg";

const TIERS: Record<string, string[]> = {
  Strategy: ["trend", "momentum", "mean_reversion", "arbitrage", "breakout", "indicator_master"],
  "Data+Risk": ["sentiment", "onchain", "risk", "portfolio", "orderbook"],
  Execution: ["order", "slippage", "stoploss", "fee", "defi"],
  Intelligence: ["ml", "backtest", "alert", "audit", "rebalance", "news"],
  Security: ["npm_security", "db_security", "code_security"],
};

const TIER_COLORS: Record<string, string> = {
  Strategy: "#3B82F6",
  "Data+Risk": "#14B8A6",
  Execution: "#F97316",
  Intelligence: "#8B5CF6",
  Security: "#EF4444",
};

const TIER_ICONS: Record<string, string> = {
  Strategy: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "Data+Risk": "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  Execution: "M13 10V3L4 14h7v7l9-11h-7z",
  Intelligence: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  Security: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

export default function Dashboard() {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<ReturnType<typeof generateMasterState> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState(generateMasterState(0));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        setState(generateMasterState(next));
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [mounted]);

  if (!mounted || !state) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading Command Center...</div>;
  }

  return (
    <div className="min-h-screen text-slate-200">
      {/* Ticker */}
      <LiveTicker />

      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                25 AGENT COMMAND CENTER
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time autonomous trading system with self-learning security
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-green-400 font-medium">LIVE</span>
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg">
              Cycle: {state.cycleTs ? new Date(state.cycleTs).toLocaleTimeString() : "..."}
            </span>
          </div>
        </div>

        {/* Master Stats */}
        <MasterStats
          masterPnl={state.masterPnl}
          activeAgents={state.activeAgents}
          consensus={state.consensus}
          killSwitch={state.killSwitch}
          confidence={state.confidence}
        />

        {/* Risk Limits Bar */}
        <div className="mb-6 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 flex flex-wrap gap-4 text-[10px]">
          <span className="text-slate-500">RISK LIMITS:</span>
          <span className="text-slate-400">Max Drawdown: <span className="text-amber-400">5%</span></span>
          <span className="text-slate-400">Max Position: <span className="text-amber-400">20%</span></span>
          <span className="text-slate-400">Daily Loss: <span className="text-amber-400">$500</span></span>
          <span className="text-slate-400">Leverage: <span className="text-amber-400">1x</span></span>
          <span className="text-slate-400">Required Consensus: <span className="text-amber-400">3/5</span></span>
        </div>

        {/* Agent Tiers */}
        {Object.entries(TIERS).map(([tier, agents], tierIdx) => (
          <div key={tier} className="mb-6 animate-fadeIn" style={{ animationDelay: `${tierIdx * 100}ms` }}>
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-4 h-4"
                style={{ color: TIER_COLORS[tier] }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={TIER_ICONS[tier]} />
              </svg>
              <h2
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: TIER_COLORS[tier] }}
              >
                {tier} Layer
              </h2>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${TIER_COLORS[tier]}33, transparent)` }} />
              <span className="text-[9px] text-slate-600">
                {agents.filter((n) => state.agents[n]?.status === "active").length}/{agents.length} active
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {agents.map((name) => (
                <AgentCard
                  key={name}
                  name={name}
                  report={state.agents[name]}
                  tierColor={TIER_COLORS[tier]}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Bloomberg Terminal Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Sector Heat Map */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700/30 flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">BBG</span>
              <span className="text-xs font-bold text-slate-300">Sector Heat Map</span>
            </div>
            <div className="p-3 space-y-1.5">
              {getSectorHeatMap(tick).map((sector) => (
                <div key={sector.name} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 w-20">{sector.name}</span>
                  <div className="flex-1 mx-2 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${sector.change >= 0 ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(Math.abs(sector.change) * 10, 100)}%`, marginLeft: sector.change < 0 ? "auto" : 0 }}
                    />
                  </div>
                  <span className={`w-14 text-right font-medium ${sector.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {sector.change >= 0 ? "+" : ""}{sector.change}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation Matrix */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700/30 flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">BBG</span>
              <span className="text-xs font-bold text-slate-300">Correlation Matrix</span>
            </div>
            <div className="p-3 overflow-x-auto">
              {(() => {
                const { pairs, matrix } = getCorrelationMatrix(tick);
                return (
                  <table className="text-[9px] w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-slate-500 px-1"></th>
                        {pairs.map((p) => <th key={p} className="text-center text-slate-500 px-1">{p}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {pairs.map((p, i) => (
                        <tr key={p}>
                          <td className="text-slate-400 px-1 font-medium">{p}</td>
                          {matrix[i].map((val, j) => (
                            <td key={j} className="text-center px-1 py-0.5">
                              <span className={`px-1 py-0.5 rounded ${
                                val >= 0.8 ? "bg-green-500/30 text-green-400" :
                                val >= 0.5 ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-slate-700/50 text-slate-400"
                              }`}>
                                {val.toFixed(2)}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* Economic Calendar */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700/30 flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">BBG</span>
              <span className="text-xs font-bold text-slate-300">Economic Calendar</span>
            </div>
            <div className="divide-y divide-slate-800/50">
              {getEconomicCalendar(tick).slice(0, 6).map((event, i) => (
                <div key={i} className="px-3 py-1.5 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      event.impact === "high" ? "bg-red-500" : event.impact === "medium" ? "bg-yellow-500" : "bg-slate-500"
                    }`} />
                    <span className="text-slate-400">{event.indicator}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 font-medium">{event.actual}</span>
                    <span className="text-slate-600 text-[9px]">exp {event.forecast}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Architecture Overview */}
        <div className="mb-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Agent Architecture — Claw Code Pattern</h3>
            <div className="flex gap-3 text-[9px]">
              <span className="text-slate-500">{AGENT_TOOLS.length} Tools</span>
              <span className="text-slate-500">{AGENT_HOOKS.length} Hooks</span>
              <span className="text-slate-500">5 Decision Phases</span>
            </div>
          </div>
          <div className="flex gap-2 text-[10px] overflow-x-auto pb-1">
            {["Observe", "Analyze", "Decide", "Execute", "Learn"].map((phase, i) => (
              <div key={phase} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`px-3 py-1.5 rounded-lg border ${
                  i === 0 ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                  i === 1 ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
                  i === 2 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                  i === 3 ? "bg-green-500/10 border-green-500/30 text-green-400" :
                  "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                }`}>
                  {phase}
                </div>
                {i < 4 && <span className="text-slate-600">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 px-4 py-3 bg-slate-800/30 rounded-xl border border-slate-700/20 text-[11px] text-slate-400 flex items-center gap-5 flex-wrap">
          <span className="text-slate-500 font-medium">Smart Score:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-gradient-to-r from-green-500 to-emerald-600" />
            <span className="text-green-400">70+ Strong</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-gradient-to-r from-yellow-500 to-amber-600" />
            <span className="text-yellow-400">45-69 Learning</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-gradient-to-r from-red-500 to-rose-600" />
            <span className="text-red-400">0-44 Improving</span>
          </span>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          CryptoBot v3.0 | 25 Agents | Bloomberg Integration | Claw Code Architecture | For educational purposes only
        </div>
      </div>
    </div>
  );
}
