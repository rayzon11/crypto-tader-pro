"use client";

import { useEffect, useState, useCallback } from "react";
import AgentCard, { type AgentReport } from "./AgentCard";
import MasterStats from "./MasterStats";

interface MasterState {
  masterPnl: number;
  activeAgents: number;
  killSwitch: boolean;
  consensus: string;
  confidence: number;
  agents: Record<string, AgentReport>;
  cycleTs: string;
}

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

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8765/supervisor";

export default function Dashboard() {
  const [state, setState] = useState<MasterState>({
    masterPnl: 0,
    activeAgents: 0,
    killSwitch: false,
    consensus: "HOLD",
    confidence: 0,
    agents: {},
    cycleTs: "",
  });
  const [connected, setConnected] = useState(false);

  const connectWS = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          setState(JSON.parse(e.data));
        } catch {
          // ignore parse errors
        }
      };
      ws.onerror = () => {
        console.error("WS error");
        setConnected(false);
      };
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connectWS, 3000);
      };
    } catch {
      setTimeout(connectWS, 3000);
    }
  }, []);

  useEffect(() => {
    connectWS();
  }, [connectWS]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-amber-400">
          CRYPTO BOT &mdash; 23 AGENT COMMAND CENTER
        </h1>
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-[11px] text-slate-500">
            {state.cycleTs
              ? new Date(state.cycleTs).toLocaleString()
              : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Master Stats */}
      <MasterStats
        masterPnl={state.masterPnl}
        activeAgents={state.activeAgents}
        consensus={state.consensus}
        killSwitch={state.killSwitch}
      />

      {/* Agent Tiers */}
      {Object.entries(TIERS).map(([tier, agents]) => (
        <div key={tier} className="mb-5">
          <h2
            className="text-xs font-bold uppercase mb-2 tracking-wider"
            style={{ color: TIER_COLORS[tier] }}
          >
            {tier} LAYER
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
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
      <div className="mt-4 px-4 py-2.5 bg-slate-800 rounded-lg text-[11px] text-slate-400 flex gap-5 flex-wrap">
        <span>Smart Score:</span>
        <span className="text-green-400">70+ = Strong Agent</span>
        <span className="text-yellow-400">45-69 = Learning</span>
        <span className="text-red-400">0-44 = Needs Improvement</span>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-[10px] text-slate-600">
        For educational purposes only. Not financial advice. Test thoroughly
        before live trading.
      </div>
    </div>
  );
}
