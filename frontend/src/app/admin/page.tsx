"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { AGENTS, getLevelColor, AGENT_TOOLS, AGENT_HOOKS } from "@/lib/agents";
import { TRADEABLE_ASSETS } from "@/lib/wallet";
import { loadApiKeys, saveApiKeys, type ApiKeyConfig } from "@/lib/api";
import {
  calculateRiskMetrics,
  runScenarioAnalysis,
  runStressTests,
  loadGoals,
  saveGoals,
  type AladdinGoal,
} from "@/lib/aladdin";

type Tab = "agents" | "risk" | "goals" | "api" | "tools";

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({});
  const [goals, setGoals] = useState<AladdinGoal[]>([]);
  const [agentEnabled, setAgentEnabled] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalReturn, setNewGoalReturn] = useState("50");
  const [newGoalDD, setNewGoalDD] = useState("15");
  const [tradingMode, setTradingMode] = useState<"demo" | "live">("demo");

  useEffect(() => {
    setMounted(true);
    setApiKeys(loadApiKeys());
    setGoals(loadGoals());
    const enabled: Record<string, boolean> = {};
    AGENTS.forEach((a) => { enabled[a.name] = true; });
    setAgentEnabled(enabled);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveApiKeys = () => {
    saveApiKeys(apiKeys);
  };

  const handleAddGoal = () => {
    if (!newGoalName) return;
    const goal: AladdinGoal = {
      id: `G${Date.now()}`,
      name: newGoalName,
      targetReturn: parseFloat(newGoalReturn) || 50,
      maxDrawdown: parseFloat(newGoalDD) || 15,
      riskBudget: 100,
      timeHorizon: "1 year",
      currentProgress: 0,
      onTrack: true,
      createdAt: new Date().toISOString().split("T")[0],
    };
    const updated = [...goals, goal];
    setGoals(updated);
    saveGoals(updated);
    setNewGoalName("");
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    saveGoals(updated);
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading admin...</div>;

  const riskMetrics = calculateRiskMetrics(tick);
  const scenarios = runScenarioAnalysis(tick);
  const stressTests = runStressTests(tick);
  const enabledCount = Object.values(agentEnabled).filter(Boolean).length;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "agents", label: "Agents", icon: "👥" },
    { id: "risk", label: "Aladdin Risk", icon: "🏛️" },
    { id: "goals", label: "Goals", icon: "🎯" },
    { id: "api", label: "API Keys", icon: "🔑" },
    { id: "tools", label: "Tools & Hooks", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Admin Controls
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">BlackRock Aladdin-style risk management & system configuration</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Demo/Live Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-700/30">
              <button
                onClick={() => setTradingMode("demo")}
                className={`px-3 py-1.5 text-[11px] font-bold ${tradingMode === "demo" ? "bg-amber-500/20 text-amber-400" : "text-slate-500"}`}
              >
                DEMO
              </button>
              <button
                onClick={() => setTradingMode("live")}
                className={`px-3 py-1.5 text-[11px] font-bold ${tradingMode === "live" ? "bg-green-500/20 text-green-400" : "text-slate-500"}`}
              >
                LIVE
              </button>
            </div>
            <button
              onClick={() => setEmergencyMode(!emergencyMode)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                emergencyMode ? "bg-red-500 text-white animate-pulse" : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {emergencyMode ? "EMERGENCY STOP ACTIVE" : "Emergency Stop"}
            </button>
          </div>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase">Active Agents</div>
            <div className="text-lg font-bold text-white">{enabledCount}/25</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase">Risk Score</div>
            <div className={`text-lg font-bold ${riskMetrics.riskScore >= 60 ? "text-green-400" : riskMetrics.riskScore >= 40 ? "text-yellow-400" : "text-red-400"}`}>
              {riskMetrics.riskScore}/100
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase">VaR (99%)</div>
            <div className="text-lg font-bold text-amber-400">{riskMetrics.portfolioVaR}%</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase">Sharpe Ratio</div>
            <div className="text-lg font-bold text-purple-400">{riskMetrics.sharpeRatio}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase">Mode</div>
            <div className={`text-lg font-bold ${tradingMode === "live" ? "text-green-400" : "text-amber-400"}`}>
              {tradingMode.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "agents" && (
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700/20">
                    <th className="text-left px-3 py-2 font-medium">Agent</th>
                    <th className="text-left px-3 py-2 font-medium">Tier</th>
                    <th className="text-right px-3 py-2 font-medium">Level</th>
                    <th className="text-right px-3 py-2 font-medium">Win Rate</th>
                    <th className="text-right px-3 py-2 font-medium">Budget</th>
                    <th className="text-center px-3 py-2 font-medium">Risk</th>
                    <th className="text-center px-3 py-2 font-medium">Permission</th>
                    <th className="text-center px-3 py-2 font-medium">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((agent) => (
                    <tr key={agent.name} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{agent.avatar}</span>
                          <div>
                            <div className="text-slate-200 font-medium">{agent.displayName}</div>
                            <div className="text-[9px] text-slate-500">{agent.specialty}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{agent.tier}</td>
                      <td className={`px-3 py-2 text-right font-bold ${getLevelColor(agent.level)}`}>{agent.level}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{(agent.winRate * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right text-slate-300">${agent.dailyBudget}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          agent.riskTolerance === "Aggressive" ? "bg-red-500/20 text-red-400" :
                          agent.riskTolerance === "Moderate" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>{agent.riskTolerance}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                          agent.permissionTier === "DangerFullAccess" ? "bg-red-500/10 text-red-400" :
                          agent.permissionTier === "WorkspaceWrite" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-green-500/10 text-green-400"
                        }`}>{agent.permissionTier}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setAgentEnabled((prev) => ({ ...prev, [agent.name]: !prev[agent.name] }))}
                          className={`w-8 h-4 rounded-full transition-colors relative ${agentEnabled[agent.name] ? "bg-green-500" : "bg-slate-600"}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${agentEnabled[agent.name] ? "left-4" : "left-0.5"}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "risk" && (
          <div className="space-y-4">
            {/* Aladdin Risk Metrics */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-amber-500/20">
              <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                <span>🏛️</span> Aladdin Risk Analytics
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Portfolio VaR (99%)", value: `${riskMetrics.portfolioVaR}%`, color: "text-red-400" },
                  { label: "CVaR / Expected Shortfall", value: `${riskMetrics.conditionalVaR}%`, color: "text-red-400" },
                  { label: "Max Drawdown", value: `${riskMetrics.maxDrawdown}%`, color: "text-orange-400" },
                  { label: "Current Drawdown", value: `${riskMetrics.currentDrawdown}%`, color: riskMetrics.currentDrawdown > 3 ? "text-red-400" : "text-green-400" },
                  { label: "Sharpe Ratio", value: riskMetrics.sharpeRatio.toString(), color: riskMetrics.sharpeRatio > 1.5 ? "text-green-400" : "text-yellow-400" },
                  { label: "Sortino Ratio", value: riskMetrics.sortinoRatio.toString(), color: "text-purple-400" },
                  { label: "Beta (vs BTC)", value: riskMetrics.beta.toString(), color: "text-blue-400" },
                  { label: "Alpha", value: `${riskMetrics.alpha > 0 ? "+" : ""}${riskMetrics.alpha}%`, color: riskMetrics.alpha > 0 ? "text-green-400" : "text-red-400" },
                  { label: "30d Volatility", value: `${riskMetrics.volatility30d}%`, color: "text-amber-400" },
                  { label: "7d Volatility", value: `${riskMetrics.volatility7d}%`, color: "text-amber-400" },
                  { label: "Information Ratio", value: riskMetrics.informationRatio.toString(), color: "text-cyan-400" },
                  { label: "Calmar Ratio", value: riskMetrics.calmarRatio.toString(), color: "text-purple-400" },
                ].map((m) => (
                  <div key={m.label} className="p-2 rounded-lg bg-slate-900/50">
                    <div className="text-[9px] text-slate-500">{m.label}</div>
                    <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario Analysis */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300">Scenario Analysis</h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {scenarios.map((s) => (
                  <div key={s.name} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-bold text-slate-200">{s.name}</span>
                        <span className="text-[9px] text-slate-500 ml-2">({s.probability}% probability)</span>
                      </div>
                      <span className={`text-sm font-bold ${s.portfolioImpact >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.portfolioImpact >= 0 ? "+" : ""}${s.portfolioImpact} ({s.portfolioImpactPct}%)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-1">{s.description}</p>
                    <div className="flex gap-4 text-[9px]">
                      <span className="text-red-400">Worst: {s.worstAsset}</span>
                      <span className="text-green-400">Best: {s.bestAsset}</span>
                      {s.recoveryDays > 0 && <span className="text-slate-500">Recovery: ~{s.recoveryDays}d</span>}
                    </div>
                    <div className="mt-1 text-[10px] text-cyan-400">{s.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress Tests */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300">Stress Test Matrix</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/20">
                      <th className="text-left px-3 py-2">Scenario</th>
                      <th className="text-right px-3 py-2">BTC</th>
                      <th className="text-right px-3 py-2">ETH</th>
                      <th className="text-right px-3 py-2">SOL</th>
                      <th className="text-right px-3 py-2">Portfolio</th>
                      <th className="text-center px-3 py-2">Margin Call</th>
                      <th className="text-center px-3 py-2">Liquidation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stressTests.map((t) => (
                      <tr key={t.scenario} className="border-b border-slate-800/50">
                        <td className="px-3 py-2 text-slate-300 font-medium">{t.scenario}</td>
                        <td className={`px-3 py-2 text-right ${t.btcChange >= 0 ? "text-green-400" : "text-red-400"}`}>{t.btcChange}%</td>
                        <td className={`px-3 py-2 text-right ${t.ethChange >= 0 ? "text-green-400" : "text-red-400"}`}>{t.ethChange}%</td>
                        <td className={`px-3 py-2 text-right ${t.solChange >= 0 ? "text-green-400" : "text-red-400"}`}>{t.solChange}%</td>
                        <td className={`px-3 py-2 text-right font-bold ${t.portfolioChange >= 0 ? "text-green-400" : "text-red-400"}`}>{t.portfolioChange}%</td>
                        <td className="px-3 py-2 text-center">{t.marginCall ? "⚠️" : "✅"}</td>
                        <td className="px-3 py-2 text-center">{t.liquidationRisk ? "🔴" : "✅"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "goals" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h3 className="text-sm font-bold text-slate-300 mb-3">Investment Goals</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                <input
                  type="text"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="Goal name (e.g., Retirement Fund)"
                  className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  type="number"
                  value={newGoalReturn}
                  onChange={(e) => setNewGoalReturn(e.target.value)}
                  placeholder="Target return %"
                  className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                />
                <button onClick={handleAddGoal} className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/30">
                  Add Goal
                </button>
              </div>
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="p-4 rounded-lg bg-slate-900/30 border border-slate-700/20">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-bold text-slate-200">{goal.name}</span>
                        <span className={`text-[9px] ml-2 px-1.5 py-0.5 rounded ${goal.onTrack ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {goal.onTrack ? "ON TRACK" : "BEHIND"}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteGoal(goal.id)} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2 text-[10px]">
                      <div><span className="text-slate-500">Target:</span> <span className="text-amber-400">{goal.targetReturn}% annual</span></div>
                      <div><span className="text-slate-500">Max DD:</span> <span className="text-red-400">{goal.maxDrawdown}%</span></div>
                      <div><span className="text-slate-500">Horizon:</span> <span className="text-slate-300">{goal.timeHorizon}</span></div>
                      <div><span className="text-slate-500">Created:</span> <span className="text-slate-400">{goal.createdAt}</span></div>
                    </div>
                    <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${goal.onTrack ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(goal.currentProgress, 100)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1">{goal.currentProgress}% progress</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/30 border border-amber-500/20">
              <h3 className="text-sm font-bold text-amber-400 mb-1">Connect Your APIs</h3>
              <p className="text-[10px] text-slate-500 mb-4">Connect real exchange APIs to switch from demo to live trading. Keys are stored locally in your browser.</p>

              <div className="space-y-4">
                {/* Exchange APIs */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Exchange APIs (for live trading)</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Binance API Key</label>
                      <input type="password" value={apiKeys.binanceApiKey || ""} onChange={(e) => setApiKeys({ ...apiKeys, binanceApiKey: e.target.value })}
                        placeholder="Enter Binance API key" className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Binance Secret</label>
                      <input type="password" value={apiKeys.binanceSecret || ""} onChange={(e) => setApiKeys({ ...apiKeys, binanceSecret: e.target.value })}
                        placeholder="Enter Binance secret" className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                </div>

                {/* Data APIs */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Data APIs (free tiers available)</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">CryptoPanic API Key <span className="text-green-400">(free)</span></label>
                      <input type="text" value={apiKeys.cryptopanic || ""} onChange={(e) => setApiKeys({ ...apiKeys, cryptopanic: e.target.value })}
                        placeholder="Get free key at cryptopanic.com/developers/api" className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">CryptoCompare API Key <span className="text-green-400">(free)</span></label>
                      <input type="text" value={apiKeys.cryptocompare || ""} onChange={(e) => setApiKeys({ ...apiKeys, cryptocompare: e.target.value })}
                        placeholder="Get free key at cryptocompare.com" className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                </div>

                {/* Alert APIs */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Notifications</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Telegram Bot Token</label>
                      <input type="password" value={apiKeys.telegramBotToken || ""} onChange={(e) => setApiKeys({ ...apiKeys, telegramBotToken: e.target.value })}
                        placeholder="Bot token from @BotFather" className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Discord Webhook URL</label>
                      <input type="password" value={apiKeys.discordWebhook || ""} onChange={(e) => setApiKeys({ ...apiKeys, discordWebhook: e.target.value })}
                        placeholder="Discord channel webhook URL" className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveApiKeys}
                  className="px-6 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/30">
                  Save API Keys
                </button>

                <div className="p-3 rounded-lg bg-slate-900/50 text-[10px] text-slate-500">
                  <strong className="text-slate-400">CoinGecko API</strong>: Already connected (free, no key needed). Provides real-time prices, trending coins, market data.<br/>
                  <strong className="text-slate-400">Fear & Greed Index</strong>: Already connected (free, no key needed). Provides market sentiment data.<br/>
                  <strong className="text-slate-400">Security</strong>: All API keys are stored locally in your browser (localStorage). They are never sent to any server.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300">Tool Registry ({AGENT_TOOLS.length} tools)</h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {AGENT_TOOLS.map((tool) => (
                  <div key={tool.name} className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-200 font-medium">{tool.name}</div>
                      <div className="text-[9px] text-slate-500">{tool.description}</div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      tool.permission === "DangerFullAccess" ? "bg-red-500/20 text-red-400" :
                      tool.permission === "WorkspaceWrite" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>{tool.permission}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300">Hook System ({AGENT_HOOKS.length} hooks)</h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {AGENT_HOOKS.map((hook) => (
                  <div key={hook.name} className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-200 font-medium">{hook.name}</div>
                      <div className="text-[9px] text-slate-500">{hook.description}</div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                      hook.type.startsWith("Pre") ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                    }`}>{hook.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Aladdin Risk System v1.0 | Inspired by BlackRock&apos;s $21.6T platform | All data processed locally
        </div>
      </div>
    </div>
  );
}
