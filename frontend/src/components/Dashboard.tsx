"use client";

import { useEffect, useState } from "react";
import AgentCard from "./AgentCard";
import MasterStats from "./MasterStats";
import LiveTicker from "./LiveTicker";
import { generateMasterState } from "@/lib/mockData";

const TIERS: Record<string, string[]> = {
  Strategy: ["trend", "momentum", "mean_reversion", "arbitrage", "breakout"],
  "Data+Risk": ["sentiment", "onchain", "risk", "portfolio", "orderbook"],
  Execution: ["order", "slippage", "stoploss", "fee", "defi"],
  Intelligence: ["ml", "backtest", "alert", "audit", "rebalance"],
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
  const [state, setState] = useState(() => generateMasterState(0));

  useEffect(() => {
    // Update every 4 seconds to simulate live data
    const interval = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        setState(generateMasterState(next));
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
                23 AGENT COMMAND CENTER
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
          CryptoBot v2.0 | 23 Agents | 5 Layers | Self-Learning Security | For educational purposes only
        </div>
      </div>
    </div>
  );
}
