"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { AGENTS, getLevelColor, AGENT_TOOLS, AGENT_HOOKS } from "@/lib/agents";
import { loadApiKeys, saveApiKeys, type ApiKeyConfig } from "@/lib/api";
import {
  calculateRiskMetrics,
  runScenarioAnalysis,
  runStressTests,
  loadGoals,
  saveGoals,
  type AladdinGoal,
} from "@/lib/aladdin";
import {
  API_REGISTRY,
  getApiStats,
  getApisByCategory,
  loadApiKeyRegistry,
  saveApiKeyEntry,
  removeApiKeyEntry,
  isApiConnected,
  type ApiEntry,
} from "@/lib/apiRegistry";
import {
  generateCoordinationEvents,
  getHedgeFundMetrics,
  generateAlphaSignals,
  getOrderFlowData,
  runConsensusVoting,
  detectMarketRegime,
  getRiskPnlSnapshot,
  type AgentCoordinationEvent,
} from "@/lib/agentBrain";

type Tab = "agents" | "risk" | "goals" | "api" | "coordination" | "hedge" | "tools";

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

  // API tab state
  const [apiSearch, setApiSearch] = useState("");
  const [apiCategory, setApiCategory] = useState<string>("All");
  const [apiPriority, setApiPriority] = useState<string>("All");
  const [addingKeyForId, setAddingKeyForId] = useState<number | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");

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

  const handleAddApiKey = (apiId: number) => {
    if (!newKeyValue.trim()) return;
    saveApiKeyEntry({ apiId, key: newKeyValue.trim(), addedAt: new Date().toISOString() });
    setAddingKeyForId(null);
    setNewKeyValue("");
  };

  const handleRemoveApiKey = (apiId: number) => {
    removeApiKeyEntry(apiId);
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading admin...</div>;

  const riskMetrics = calculateRiskMetrics(tick);
  const scenarios = runScenarioAnalysis(tick);
  const stressTests = runStressTests(tick);
  const enabledCount = Object.values(agentEnabled).filter(Boolean).length;
  const apiStatsData = getApiStats();
  const hedgeMetrics = getHedgeFundMetrics(tick);
  const coordinationEvents = generateCoordinationEvents(tick);
  const alphaSignals = generateAlphaSignals(tick);
  const orderFlow = getOrderFlowData(tick);
  const consensus = runConsensusVoting(tick);
  const regime = detectMarketRegime(tick);
  const riskPnl = getRiskPnlSnapshot(tick);

  // Filter APIs
  const filteredApis = API_REGISTRY.filter((api) => {
    if (apiCategory !== "All" && api.category !== apiCategory) return false;
    if (apiPriority !== "All" && api.priority !== apiPriority) return false;
    if (apiSearch && !api.name.toLowerCase().includes(apiSearch.toLowerCase()) && !api.description.toLowerCase().includes(apiSearch.toLowerCase())) return false;
    return true;
  });

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "agents", label: "Agents", icon: "👥" },
    { id: "risk", label: "Aladdin Risk", icon: "🏛️" },
    { id: "goals", label: "Goals", icon: "🎯" },
    { id: "api", label: "API Keys", icon: "🔑" },
    { id: "coordination", label: "Coordination", icon: "🔗" },
    { id: "hedge", label: "Hedge Fund", icon: "📊" },
    { id: "tools", label: "Tools & Hooks", icon: "⚙️" },
  ];

  const statusBadge = (status: ApiEntry["status"]) => {
    const colors: Record<string, string> = {
      connected: "bg-green-500/20 text-green-400 border-green-500/30",
      needs_key: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      premium: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      available: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    const labels: Record<string, string> = {
      connected: "CONNECTED",
      needs_key: "NEEDS KEY",
      premium: "PREMIUM",
      available: "AVAILABLE",
    };
    return <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${colors[status] || colors.available}`}>{labels[status] || "AVAILABLE"}</span>;
  };

  const priorityBadge = (priority: ApiEntry["priority"]) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400",
      high: "bg-amber-500/20 text-amber-400",
      medium: "bg-blue-500/20 text-blue-400",
      low: "bg-slate-500/20 text-slate-400",
    };
    return <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${colors[priority]}`}>{priority.toUpperCase()}</span>;
  };

  const eventTypeBadge = (type: AgentCoordinationEvent["type"]) => {
    const colors: Record<string, string> = {
      signal: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      alert: "bg-red-500/20 text-red-400 border-red-500/30",
      data: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      execution: "bg-green-500/20 text-green-400 border-green-500/30",
      risk_check: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      request: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      consensus: "bg-white/10 text-white border-white/20",
    };
    return <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${colors[type] || colors.data}`}>{type.toUpperCase().replace("_", " ")}</span>;
  };

  const coordPriorityBadge = (priority: AgentCoordinationEvent["priority"]) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-300",
      high: "bg-amber-500/20 text-amber-300",
      normal: "bg-slate-500/20 text-slate-300",
      low: "bg-slate-700/30 text-slate-500",
    };
    return <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${colors[priority]}`}>{priority.toUpperCase()}</span>;
  };

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
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] text-green-400 font-bold">
                167 APIs Connected
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-400 font-bold">
                AUM ${(hedgeMetrics.aum / 1000).toFixed(1)}K
              </span>
            </div>
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

        {/* ============================================================ */}
        {/* AGENTS TAB */}
        {/* ============================================================ */}
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

        {/* ============================================================ */}
        {/* RISK TAB */}
        {/* ============================================================ */}
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

        {/* ============================================================ */}
        {/* GOALS TAB */}
        {/* ============================================================ */}
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

        {/* ============================================================ */}
        {/* API TAB — COMPLETELY REBUILT */}
        {/* ============================================================ */}
        {activeTab === "api" && (
          <div className="space-y-4">
            {/* API Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="text-[9px] text-slate-500 uppercase">Total APIs</div>
                <div className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{apiStatsData.total}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/30 border border-green-500/20">
                <div className="text-[9px] text-slate-500 uppercase">Connected</div>
                <div className="text-lg font-bold text-green-400">{apiStatsData.connected}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/30 border border-amber-500/20">
                <div className="text-[9px] text-slate-500 uppercase">Needs Key</div>
                <div className="text-lg font-bold text-amber-400">{apiStatsData.needsKey}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/30 border border-purple-500/20">
                <div className="text-[9px] text-slate-500 uppercase">Premium</div>
                <div className="text-lg font-bold text-purple-400">{apiStatsData.premium}</div>
              </div>
              {Object.entries(apiStatsData.byCategory).map(([cat, count]) => (
                <div key={cat} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="text-[9px] text-slate-500 uppercase">{cat.replace("_", " ")}</div>
                  <div className="text-lg font-bold text-slate-300">{count}</div>
                </div>
              ))}
            </div>

            {/* Quick Connect — existing manual API key inputs */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-amber-500/20">
              <h3 className="text-sm font-bold text-amber-400 mb-1">Quick Connect</h3>
              <p className="text-[10px] text-slate-500 mb-4">Connect core exchange and data APIs. Keys are stored locally in your browser.</p>

              <div className="space-y-4">
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

                <div className="flex items-center gap-3">
                  <button onClick={handleSaveApiKeys}
                    className="px-6 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/30">
                    Save API Keys
                  </button>
                  <div className="text-[10px] text-slate-600">
                    CoinGecko & Fear/Greed Index already connected (no key needed)
                  </div>
                </div>
              </div>
            </div>

            {/* Full API Registry */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Full API Registry ({API_REGISTRY.length} APIs)</h3>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Category filters */}
                  {["All", "Finance", "Cryptocurrency", "Data_Access"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setApiCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        apiCategory === cat
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "bg-slate-900/50 text-slate-500 border border-slate-700/30 hover:text-slate-300"
                      }`}
                    >
                      {cat === "Data_Access" ? "Data Access" : cat}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Search */}
                  <input
                    type="text"
                    value={apiSearch}
                    onChange={(e) => setApiSearch(e.target.value)}
                    placeholder="Search APIs by name..."
                    className="flex-1 min-w-[200px] bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500/50"
                  />

                  {/* Priority filter */}
                  {["All", "critical", "high", "medium", "low"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setApiPriority(p === "All" ? "All" : p)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        apiPriority === p
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-slate-900/50 text-slate-500 border border-slate-700/30 hover:text-slate-300"
                      }`}
                    >
                      {p === "All" ? "All Priority" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="text-[9px] text-slate-600 mt-2">Showing {filteredApis.length} of {API_REGISTRY.length} APIs</div>
              </div>

              {/* Scrollable API Grid */}
              <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-800/30">
                {filteredApis.map((api) => {
                  const connected = isApiConnected(api.id) || api.status === "connected";
                  const effectiveStatus = connected ? "connected" : api.status;
                  return (
                    <div key={api.id} className="px-4 py-3 hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-200">{api.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-700/40 text-slate-400">
                              {api.category.replace("_", " ")}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] text-slate-500 bg-slate-800/60">
                              {api.auth === "No" ? "No Auth" : api.auth}
                            </span>
                            {statusBadge(effectiveStatus)}
                            {priorityBadge(api.priority)}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">{api.description}</p>
                          {api.usedBy.length > 0 && (
                            <div className="text-[9px] text-slate-600 mt-1">
                              <span className="text-slate-500">Used by:</span>{" "}
                              {api.usedBy.map((agent, i) => (
                                <span key={agent}>
                                  <span className="text-cyan-500/70">{agent}</span>
                                  {i < api.usedBy.length - 1 && ", "}
                                </span>
                              ))}
                            </div>
                          )}
                          <a href={api.docs} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400/60 hover:text-blue-400 mt-0.5 inline-block">
                            Docs &rarr;
                          </a>
                        </div>

                        <div className="flex-shrink-0">
                          {effectiveStatus === "needs_key" && addingKeyForId !== api.id && (
                            <button
                              onClick={() => { setAddingKeyForId(api.id); setNewKeyValue(""); }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-all"
                            >
                              Add Key
                            </button>
                          )}
                          {effectiveStatus === "connected" && (
                            <span className="text-[10px] text-green-400 font-bold">Connected</span>
                          )}
                          {effectiveStatus === "premium" && (
                            <span className="text-[10px] text-purple-400 font-bold">Premium</span>
                          )}
                        </div>
                      </div>

                      {/* Inline key input */}
                      {addingKeyForId === api.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="password"
                            value={newKeyValue}
                            onChange={(e) => setNewKeyValue(e.target.value)}
                            placeholder={`Enter API key for ${api.name}`}
                            className="flex-1 bg-slate-900/70 border border-amber-500/30 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-400"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddApiKey(api.id)}
                            className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold hover:bg-green-500/30"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setAddingKeyForId(null); setNewKeyValue(""); }}
                            className="px-3 py-1.5 rounded-lg bg-slate-700/30 border border-slate-600/30 text-slate-400 text-[10px] font-bold hover:bg-slate-700/50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* COORDINATION TAB — NEW */}
        {/* ============================================================ */}
        {activeTab === "coordination" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/30 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                  <span>🔗</span> Agent Coordination Log
                </h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[9px] text-green-400 font-bold">LIVE</span>
                  <span className="text-[9px] text-slate-600">Tick #{tick}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mb-4">Real-time inter-agent communication and signal routing</p>

              {/* Event type legend */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(["signal", "alert", "data", "execution", "risk_check", "request", "consensus"] as const).map((t) => (
                  <span key={t}>{eventTypeBadge(t)}</span>
                ))}
              </div>

              {/* Events list */}
              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {coordinationEvents.map((event, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/20 hover:border-slate-600/30 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-slate-600 font-mono">{event.timestamp}</span>
                        {eventTypeBadge(event.type)}
                        {coordPriorityBadge(event.priority)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] mb-1">
                      <span className="font-bold text-amber-400">{event.fromAgent}</span>
                      <span className="text-slate-600">&rarr;</span>
                      <span className="font-bold text-cyan-400">{event.toAgent === "all" ? "ALL AGENTS" : event.toAgent}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{event.payload}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* HEDGE FUND TAB — NEW */}
        {/* ============================================================ */}
        {activeTab === "hedge" && (
          <div className="space-y-4">
            {/* Top Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "AUM", value: `$${(hedgeMetrics.aum / 1000).toFixed(1)}K`, color: "text-white", border: "border-slate-700/30" },
                { label: "Daily Return", value: `${hedgeMetrics.dailyReturn > 0 ? "+" : ""}${hedgeMetrics.dailyReturn.toFixed(2)}%`, color: hedgeMetrics.dailyReturn >= 0 ? "text-green-400" : "text-red-400", border: hedgeMetrics.dailyReturn >= 0 ? "border-green-500/20" : "border-red-500/20" },
                { label: "MTD Return", value: `${hedgeMetrics.mtdReturn > 0 ? "+" : ""}${hedgeMetrics.mtdReturn.toFixed(1)}%`, color: hedgeMetrics.mtdReturn >= 0 ? "text-green-400" : "text-red-400", border: "border-slate-700/30" },
                { label: "YTD Return", value: `${hedgeMetrics.ytdReturn > 0 ? "+" : ""}${hedgeMetrics.ytdReturn.toFixed(1)}%`, color: hedgeMetrics.ytdReturn >= 0 ? "text-green-400" : "text-red-400", border: "border-slate-700/30" },
                { label: "Alpha", value: `+${hedgeMetrics.alpha.toFixed(1)}%`, color: "text-green-400", border: "border-green-500/20" },
                { label: "Beta", value: hedgeMetrics.beta.toFixed(2), color: "text-blue-400", border: "border-blue-500/20" },
                { label: "Sharpe Ratio", value: riskPnl.sharpeRatio.toFixed(2), color: "text-purple-400", border: "border-purple-500/20" },
                { label: "Profit Factor", value: hedgeMetrics.profitFactor.toFixed(2), color: "text-amber-400", border: "border-amber-500/20" },
              ].map((m) => (
                <div key={m.label} className={`p-3 rounded-xl bg-slate-800/30 border ${m.border}`}>
                  <div className="text-[9px] text-slate-500 uppercase">{m.label}</div>
                  <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Market Regime & Consensus — side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Market Regime */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <span>🌊</span> Market Regime Detection
                </h3>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/20 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold ${
                      regime.type.includes("bull") || regime.type === "breakout" || regime.type === "recovery" ? "text-green-400" :
                      regime.type.includes("bear") || regime.type === "crash" ? "text-red-400" :
                      regime.type === "euphoria" ? "text-yellow-400" : "text-blue-400"
                    }`}>
                      {regime.type.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500">Since {regime.since}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] text-slate-500">Confidence</span>
                    <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${regime.confidence >= 70 ? "bg-green-500" : regime.confidence >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${regime.confidence}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300">{regime.confidence}%</span>
                  </div>
                  <div className="space-y-1">
                    {regime.indicators.map((ind, i) => (
                      <div key={i} className="text-[9px] text-slate-500 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
                        {ind}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Consensus Voting */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <span>🗳️</span> Consensus Voting
                </h3>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/20 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase">Final Signal</span>
                      <div className={`text-xl font-black ${
                        consensus.finalSignal.includes("BUY") ? "text-green-400" :
                        consensus.finalSignal.includes("SELL") ? "text-red-400" : "text-slate-400"
                      }`}>
                        {consensus.finalSignal}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 uppercase">Confidence</span>
                      <div className="text-xl font-bold text-white">{consensus.confidence}%</div>
                    </div>
                  </div>

                  {/* Vote breakdown */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-3 bg-slate-700/50 rounded-full overflow-hidden flex">
                      <div className="bg-green-500 h-full" style={{ width: `${(consensus.voteSummary.buy / (consensus.voteSummary.buy + consensus.voteSummary.hold + consensus.voteSummary.sell)) * 100}%` }} />
                      <div className="bg-slate-400 h-full" style={{ width: `${(consensus.voteSummary.hold / (consensus.voteSummary.buy + consensus.voteSummary.hold + consensus.voteSummary.sell)) * 100}%` }} />
                      <div className="bg-red-500 h-full" style={{ width: `${(consensus.voteSummary.sell / (consensus.voteSummary.buy + consensus.voteSummary.hold + consensus.voteSummary.sell)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[9px] mb-3">
                    <span className="text-green-400">Buy: {consensus.voteSummary.buy}</span>
                    <span className="text-slate-400">Hold: {consensus.voteSummary.hold}</span>
                    <span className="text-red-400">Sell: {consensus.voteSummary.sell}</span>
                    <span className={`ml-auto font-bold ${consensus.riskApproved ? "text-green-400" : "text-red-400"}`}>
                      Risk: {consensus.riskApproved ? "APPROVED" : "REJECTED"}
                    </span>
                  </div>

                  {/* Top reasons */}
                  <div className="mb-2">
                    <span className="text-[9px] text-slate-500 font-bold">Top Reasons:</span>
                    {consensus.topReasons.map((r, i) => (
                      <div key={i} className="text-[9px] text-slate-400 ml-2 mt-0.5 flex items-start gap-1">
                        <span className="text-cyan-400 mt-0.5">&#x2022;</span> {r}
                      </div>
                    ))}
                  </div>

                  {/* Dissenters */}
                  {consensus.dissenters.length > 0 && (
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold">Dissenters:</span>
                      <span className="text-[9px] text-red-400/70 ml-1">{consensus.dissenters.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alpha Signals */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <span>🎯</span> Alpha Signals
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/20">
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Asset</th>
                      <th className="text-center px-3 py-2 font-medium">Direction</th>
                      <th className="text-center px-3 py-2 font-medium">Strength</th>
                      <th className="text-right px-3 py-2 font-medium">Exp. Return</th>
                      <th className="text-right px-3 py-2 font-medium">Max DD</th>
                      <th className="text-left px-3 py-2 font-medium">Confluence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alphaSignals.map((sig) => (
                      <tr key={sig.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                        <td className="px-3 py-2 text-slate-300 font-medium">{sig.source}</td>
                        <td className="px-3 py-2 text-white font-bold">{sig.asset}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            sig.direction === "long" ? "bg-green-500/20 text-green-400" :
                            sig.direction === "short" ? "bg-red-500/20 text-red-400" :
                            "bg-slate-500/20 text-slate-400"
                          }`}>
                            {sig.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${sig.strength >= 70 ? "bg-green-500" : sig.strength >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${sig.strength}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400">{sig.strength}</span>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${sig.expectedReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {sig.expectedReturn > 0 ? "+" : ""}{sig.expectedReturn}%
                        </td>
                        <td className="px-3 py-2 text-right text-red-400">{sig.maxDrawdown}%</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {sig.confluenceFactors.slice(0, 3).map((f, i) => (
                              <span key={i} className="px-1 py-0.5 rounded text-[7px] bg-slate-700/40 text-slate-500">{f}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Order Flow */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <span>📈</span> Order Flow Analysis
                </h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/20">
                {orderFlow.map((of) => (
                  <div key={of.asset} className="p-4">
                    <div className="text-xs font-bold text-white mb-3">{of.asset}</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Bid Depth</span>
                        <span className="text-green-400 font-bold">${(of.bidDepth / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Ask Depth</span>
                        <span className="text-red-400 font-bold">${(of.askDepth / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Imbalance Ratio</span>
                        <span className={`font-bold ${of.imbalanceRatio >= 1 ? "text-green-400" : "text-red-400"}`}>
                          {of.imbalanceRatio.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">VWAP</span>
                        <span className="text-slate-300 font-bold">${of.vwap.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Dark Pool Activity</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-purple-500" style={{ width: `${of.darkPoolActivity}%` }} />
                          </div>
                          <span className="text-purple-400 font-bold">{of.darkPoolActivity}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Smart Money</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          of.smartMoneyFlow === "accumulating" ? "bg-green-500/20 text-green-400" :
                          of.smartMoneyFlow === "distributing" ? "bg-red-500/20 text-red-400" :
                          "bg-slate-500/20 text-slate-400"
                        }`}>
                          {of.smartMoneyFlow.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Stats */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <span>🏆</span> Performance Statistics
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Winning Days", value: `${hedgeMetrics.winningDays}/${hedgeMetrics.totalDays} (${((hedgeMetrics.winningDays / hedgeMetrics.totalDays) * 100).toFixed(0)}%)`, color: "text-green-400" },
                  { label: "Best Day", value: `+${hedgeMetrics.bestDay.toFixed(1)}%`, color: "text-green-400" },
                  { label: "Worst Day", value: `${hedgeMetrics.worstDay.toFixed(1)}%`, color: "text-red-400" },
                  { label: "Avg Win", value: `+${hedgeMetrics.avgWin.toFixed(1)}%`, color: "text-green-400" },
                  { label: "Avg Loss", value: `${hedgeMetrics.avgLoss.toFixed(1)}%`, color: "text-red-400" },
                  { label: "Information Ratio", value: hedgeMetrics.informationRatio.toFixed(2), color: "text-cyan-400" },
                  { label: "Calmar Ratio", value: hedgeMetrics.calmarRatio.toFixed(2), color: "text-purple-400" },
                  { label: "Max DD Duration", value: hedgeMetrics.maxDrawdownDuration, color: "text-amber-400" },
                ].map((m) => (
                  <div key={m.label} className="p-2 rounded-lg bg-slate-900/50">
                    <div className="text-[9px] text-slate-500">{m.label}</div>
                    <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TOOLS TAB */}
        {/* ============================================================ */}
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
          Aladdin Risk System v2.0 | 167 APIs | 25 Agents | Hedge Fund Analytics | All data processed locally
        </div>
      </div>
    </div>
  );
}
