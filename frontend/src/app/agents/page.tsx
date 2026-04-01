"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import ScoreBadge from "@/components/ScoreBadge";
import { generateAgentReports, type AgentReport } from "@/lib/mockData";

const ALL_AGENTS = [
  { name: "trend", tier: "Strategy", desc: "EMA9/EMA21 crossover + MACD signal detection", libs: "ccxt, pandas_ta" },
  { name: "momentum", tier: "Strategy", desc: "RSI + Stochastic RSI momentum signals", libs: "ccxt, pandas_ta" },
  { name: "mean_reversion", tier: "Strategy", desc: "Bollinger Bands + Z-score mean reversion", libs: "ccxt, pandas, numpy" },
  { name: "arbitrage", tier: "Strategy", desc: "Cross-exchange spread detection (Binance vs Kraken)", libs: "ccxt" },
  { name: "breakout", tier: "Strategy", desc: "Volume-confirmed breakouts with support/resistance", libs: "ccxt, pandas" },
  { name: "sentiment", tier: "Data+Risk", desc: "Fear & Greed index + social sentiment analysis", libs: "aiohttp" },
  { name: "onchain", tier: "Data+Risk", desc: "Exchange netflow + whale tracking via Glassnode", libs: "aiohttp" },
  { name: "risk", tier: "Data+Risk", desc: "VaR(99%) + maximum drawdown calculation", libs: "numpy, scipy" },
  { name: "portfolio", tier: "Data+Risk", desc: "Kelly criterion half-Kelly position sizing", libs: "numpy" },
  { name: "orderbook", tier: "Data+Risk", desc: "Bid-ask depth imbalance analysis", libs: "ccxt" },
  { name: "order", tier: "Execution", desc: "Limit/market/TWAP order placement engine", libs: "ccxt" },
  { name: "slippage", tier: "Execution", desc: "Smart order routing across exchanges", libs: "ccxt" },
  { name: "stoploss", tier: "Execution", desc: "Trailing stop-loss + take-profit management", libs: "ccxt" },
  { name: "fee", tier: "Execution", desc: "Gas estimation + maker/taker fee optimization", libs: "aiohttp, ccxt" },
  { name: "defi", tier: "Execution", desc: "DeFi pool yield monitoring from DefiLlama", libs: "aiohttp" },
  { name: "ml", tier: "Intelligence", desc: "LSTM model retraining per-agent every 20 trades", libs: "torch, sklearn" },
  { name: "backtest", tier: "Intelligence", desc: "Sharpe ratio, max drawdown, win rate evaluation", libs: "numpy" },
  { name: "alert", tier: "Intelligence", desc: "Telegram + Discord real-time notifications", libs: "aiohttp" },
  { name: "audit", tier: "Intelligence", desc: "PostgreSQL trade logging + anomaly detection", libs: "asyncpg" },
  { name: "rebalance", tier: "Intelligence", desc: "Portfolio drift correction with target allocations", libs: "numpy" },
  { name: "npm_security", tier: "Security", desc: "NPM audit + lockfile integrity + typosquatting detection", libs: "subprocess, hashlib" },
  { name: "db_security", tier: "Security", desc: "SQL injection monitoring + query anomaly baselines", libs: "asyncpg, re" },
  { name: "code_security", tier: "Security", desc: "Secret scanning + OWASP checks + file integrity", libs: "hashlib, re" },
];

const TIER_COLORS: Record<string, string> = {
  Strategy: "#3B82F6",
  "Data+Risk": "#14B8A6",
  Execution: "#F97316",
  Intelligence: "#8B5CF6",
  Security: "#EF4444",
};

function smartScore(r?: AgentReport): number {
  if (!r || r.trade_count === 0) return 50;
  const wr = (r.win_rate ?? 0.5) * 40;
  const wt = Math.min((r.weight ?? 1.0) / 2.0, 1.0) * 30;
  const pnlS = Math.min(Math.max((r.pnl + 0.05) / 0.1, 0), 1) * 30;
  return Math.round(wr + wt + pnlS);
}

export default function AgentsPage() {
  const [reports, setReports] = useState<Record<string, AgentReport>>({});
  const [filterTier, setFilterTier] = useState<string>("All");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setReports(generateAgentReports(0));
    const interval = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        setReports(generateAgentReports(next));
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const tiers = ["All", "Strategy", "Data+Risk", "Execution", "Intelligence", "Security"];
  const filtered = filterTier === "All" ? ALL_AGENTS : ALL_AGENTS.filter((a) => a.tier === filterTier);

  const totalActive = Object.values(reports).filter((r) => r.status === "active").length;
  const avgWinRate = Object.values(reports).length > 0
    ? Object.values(reports).reduce((sum, r) => sum + r.win_rate, 0) / Object.values(reports).length
    : 0;

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Agent Registry
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            All 23 autonomous agents across 5 operational layers
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card-hover bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Active</div>
            <div className="text-2xl font-bold text-green-400">{totalActive}/23</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Avg Win Rate</div>
            <div className="text-2xl font-bold text-blue-400">{(avgWinRate * 100).toFixed(1)}%</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Layers</div>
            <div className="text-2xl font-bold text-purple-400">5</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                filterTier === tier
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800"
              }`}
              style={
                filterTier === tier && tier !== "All"
                  ? { background: `${TIER_COLORS[tier]}15`, color: TIER_COLORS[tier], borderColor: `${TIER_COLORS[tier]}40` }
                  : {}
              }
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Agent Table */}
        <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/20">
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Layer</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Score</th>
                <th className="text-center px-4 py-3 font-medium">Signal</th>
                <th className="text-right px-4 py-3 font-medium">P&L</th>
                <th className="text-right px-4 py-3 font-medium">Win Rate</th>
                <th className="text-right px-4 py-3 font-medium">Trades</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Libraries</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent, i) => {
                const report = reports[agent.name];
                const score = smartScore(report);
                const tierColor = TIER_COLORS[agent.tier];

                return (
                  <tr
                    key={agent.name}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 animate-fadeIn"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-bold uppercase" style={{ color: tierColor }}>
                          {agent.name.replace(/_/g, " ")}
                        </span>
                        <div className="text-[9px] text-slate-600 mt-0.5">{agent.desc}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${tierColor}15`, color: tierColor }}>
                        {agent.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${report?.status === "active" ? "bg-green-500" : report?.status === "halted" ? "bg-red-500" : "bg-gray-500"}`} />
                        <span className="text-[9px] text-slate-400">{report?.status ?? "offline"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={score} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        report?.signal === "BUY" ? "bg-green-500/20 text-green-400" :
                        report?.signal === "SELL" ? "bg-red-500/20 text-red-400" :
                        "bg-slate-700/30 text-slate-500"
                      }`}>
                        {report?.signal ?? "\u2014"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right ${(report?.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(report?.pnl ?? 0) >= 0 ? "+" : ""}{(report?.pnl ?? 0).toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {((report?.win_rate ?? 0.5) * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {report?.trade_count ?? 0}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[9px] text-slate-600">{agent.libs}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          All agents inherit from BaseAgent ABC with Redis pub/sub, heartbeat, and command listening.
        </div>
      </div>
    </div>
  );
}
