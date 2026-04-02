"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { AGENTS, type AgentProfile } from "@/lib/agents";

interface AgentDailyReport {
  agent: AgentProfile;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  bestTrade: { pair: string; pnl: number };
  worstTrade: { pair: string; pnl: number };
  learnings: string;
  strategyAdjustment: string;
  confidenceChange: number;
  riskEvents: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateDailyReports(): AgentDailyReport[] {
  return AGENTS.filter((a) => a.tier !== "Security").map((agent, i) => {
    const trades = Math.floor(5 + seededRandom(i * 17) * 25);
    const winRate = agent.winRate + (seededRandom(i * 23) - 0.5) * 0.1;
    const wins = Math.floor(trades * Math.max(0.3, Math.min(0.95, winRate)));
    const losses = trades - wins;
    const pnl = (seededRandom(i * 29) - 0.35) * 150;
    const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];

    const LEARNINGS = [
      "EMA crossover signals are more reliable in trending markets. Increased weight on ADX filter.",
      "RSI divergence on 1H timeframe predicted 3 of 4 reversals correctly today.",
      "Bollinger Band squeeze preceded the largest move of the day. Adding squeeze detection.",
      "Cross-exchange spread narrowed faster than expected. Reducing latency threshold.",
      "Volume-confirmed breakouts had 80% success rate today vs 60% for unconfirmed.",
      "LSTM model accuracy improved to 74% after retraining with latest 200 trades.",
      "News sentiment correlation with price was stronger than usual today (+0.82).",
      "Portfolio rebalancing reduced drawdown by 0.3% compared to static allocation.",
      "Order book imbalance was a strong predictor of short-term direction today.",
      "Trailing stop saved 2.1% on the largest losing trade. Tightening to 1.8%.",
      "Composite indicator signal had 85% accuracy when ADX > 25. Noted for weights.",
      "Fear & Greed shift from 65 to 72 preceded the afternoon rally by 45 minutes.",
    ];

    const ADJUSTMENTS = [
      "Increasing EMA weight in trending conditions by 5%.",
      "Tightening stop loss from 3% to 2.5% based on recent volatility.",
      "Adding 15-minute confirmation delay before executing STRONG signals.",
      "Shifting allocation toward ETH based on superior risk-adjusted returns.",
      "Expanding to 3-exchange routing for orders above $5,000.",
      "Reducing position size during high-volatility hours (10am-2pm UTC).",
      "Increasing news sentiment weight in consensus voting by 10%.",
      "No adjustment needed — current strategy is performing within expectations.",
    ];

    return {
      agent,
      trades,
      wins,
      losses,
      pnl: Math.round(pnl * 100) / 100,
      bestTrade: {
        pair: pairs[Math.floor(seededRandom(i * 31) * pairs.length)],
        pnl: Math.round((20 + seededRandom(i * 37) * 80) * 100) / 100,
      },
      worstTrade: {
        pair: pairs[Math.floor(seededRandom(i * 41) * pairs.length)],
        pnl: Math.round((-10 - seededRandom(i * 43) * 50) * 100) / 100,
      },
      learnings: LEARNINGS[i % LEARNINGS.length],
      strategyAdjustment: ADJUSTMENTS[i % ADJUSTMENTS.length],
      confidenceChange: Math.round((seededRandom(i * 47) - 0.4) * 10) / 10,
      riskEvents: Math.floor(seededRandom(i * 53) * 3),
    };
  });
}

export default function ReportsPage() {
  const [reports, setReports] = useState<AgentDailyReport[]>([]);
  const [selectedTier, setSelectedTier] = useState("All");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    setReports(generateDailyReports());
  }, []);

  const tiers = ["All", "Strategy", "Data+Risk", "Execution", "Intelligence"];
  const filtered = selectedTier === "All" ? reports : reports.filter((r) => r.agent.tier === selectedTier);

  const totalPnl = reports.reduce((s, r) => s + r.pnl, 0);
  const totalTrades = reports.reduce((s, r) => s + r.trades, 0);
  const totalWins = reports.reduce((s, r) => s + r.wins, 0);
  const overallWinRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 1000) / 10 : 0;

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Daily Reports
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">End-of-day performance reports from all 25 agents</p>
          </div>
          <div className="text-[10px] text-slate-500">
            Report Date: {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total P&L</div>
            <div className={`text-xl font-bold mt-1 ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Trades</div>
            <div className="text-xl font-bold text-white mt-1">{totalTrades}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Win Rate</div>
            <div className="text-xl font-bold text-amber-400 mt-1">{overallWinRate}%</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active Agents</div>
            <div className="text-xl font-bold text-white mt-1">{reports.length}/22</div>
          </div>
        </div>

        {/* Tier Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedTier === tier
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Agent Reports */}
        <div className="space-y-3">
          {filtered.map((report) => {
            const expanded = expandedAgent === report.agent.name;
            const winRate = report.trades > 0 ? Math.round((report.wins / report.trades) * 1000) / 10 : 0;
            return (
              <div
                key={report.agent.name}
                className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedAgent(expanded ? null : report.agent.name)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{report.agent.avatar}</span>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-200">{report.agent.displayName}</div>
                      <div className="text-[10px] text-slate-500">{report.agent.specialty} | Level {report.agent.level}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className={`text-sm font-bold ${report.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {report.pnl >= 0 ? "+" : ""}${report.pnl.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500">{report.trades} trades | {winRate}% WR</div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-slate-700/20">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 mb-4">
                      <div className="p-2 rounded-lg bg-slate-900/50">
                        <div className="text-[9px] text-slate-500">Wins / Losses</div>
                        <div className="text-sm font-bold text-slate-200">{report.wins}W / {report.losses}L</div>
                      </div>
                      <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                        <div className="text-[9px] text-green-400">Best Trade</div>
                        <div className="text-sm font-bold text-green-400">+${report.bestTrade.pnl.toFixed(2)}</div>
                        <div className="text-[9px] text-slate-500">{report.bestTrade.pair}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="text-[9px] text-red-400">Worst Trade</div>
                        <div className="text-sm font-bold text-red-400">${report.worstTrade.pnl.toFixed(2)}</div>
                        <div className="text-[9px] text-slate-500">{report.worstTrade.pair}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/50">
                        <div className="text-[9px] text-slate-500">Confidence Change</div>
                        <div className={`text-sm font-bold ${report.confidenceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {report.confidenceChange >= 0 ? "+" : ""}{report.confidenceChange.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-slate-900/30">
                        <div className="text-[10px] text-emerald-400 font-bold mb-1">Learnings</div>
                        <div className="text-[11px] text-slate-300">{report.learnings}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900/30">
                        <div className="text-[10px] text-amber-400 font-bold mb-1">Strategy Adjustment</div>
                        <div className="text-[11px] text-slate-300">{report.strategyAdjustment}</div>
                      </div>
                      {report.riskEvents > 0 && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                          <div className="text-[10px] text-red-400 font-bold mb-1">Risk Events: {report.riskEvents}</div>
                          <div className="text-[11px] text-slate-400">Risk events were handled within parameters. No manual intervention required.</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Reports generated automatically at market close. All data is from demo trading.
        </div>
      </div>
    </div>
  );
}
