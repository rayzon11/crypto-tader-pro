"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { AGENTS, getLevelColor, type AgentProfile } from "@/lib/agents";
import { TRADEABLE_ASSETS } from "@/lib/wallet";

interface AgentConfig {
  agent: AgentProfile;
  budget: number;
  maxPositionSize: number;
  riskTolerance: "low" | "medium" | "high";
  maxTradesPerDay: number;
  enabled: boolean;
  allowedAssets: string[];
}

export default function AdminPage() {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [globalBudget, setGlobalBudget] = useState("10000");
  const [emergencyMode, setEmergencyMode] = useState(false);

  useEffect(() => {
    setConfigs(
      AGENTS.map((agent) => ({
        agent,
        budget: agent.dailyBudget,
        maxPositionSize: agent.maxPositionSize * 100,
        riskTolerance: agent.riskTolerance as "low" | "medium" | "high",
        maxTradesPerDay: Math.floor(10 + Math.random() * 40),
        enabled: true,
        allowedAssets: agent.allowedAssets,
      }))
    );
  }, []);

  const updateConfig = (name: string, updates: Partial<AgentConfig>) => {
    setConfigs((prev) =>
      prev.map((c) => (c.agent.name === name ? { ...c, ...updates } : c))
    );
  };

  const enabledCount = configs.filter((c) => c.enabled).length;
  const totalBudget = configs.reduce((s, c) => s + (c.enabled ? c.budget : 0), 0);
  const selected = configs.find((c) => c.agent.name === selectedAgent);

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Admin Controls
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">Configure agent budgets, risk limits, and system controls</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEmergencyMode(!emergencyMode)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                emergencyMode
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {emergencyMode ? "⚠ EMERGENCY STOP ACTIVE" : "Emergency Stop"}
            </button>
          </div>
        </div>

        {/* System Controls */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active Agents</div>
            <div className="text-xl font-bold text-white mt-1">{enabledCount}/{configs.length}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Budget</div>
            <div className="text-xl font-bold text-white mt-1">${totalBudget.toLocaleString()}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Kill Switch</div>
            <button
              onClick={() => setKillSwitchActive(!killSwitchActive)}
              className={`mt-1 px-3 py-1 rounded text-xs font-bold ${
                killSwitchActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              }`}
            >
              {killSwitchActive ? "TRIGGERED" : "ARMED (5%)"}
            </button>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Global Budget Cap</div>
            <input
              type="number"
              value={globalBudget}
              onChange={(e) => setGlobalBudget(e.target.value)}
              className="mt-1 w-full bg-slate-900/50 border border-slate-700/30 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="lg:col-span-2 rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h3 className="text-sm font-bold text-slate-300">Agent Configuration</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700/20">
                    <th className="text-left px-3 py-2 font-medium">Agent</th>
                    <th className="text-left px-3 py-2 font-medium">Tier</th>
                    <th className="text-right px-3 py-2 font-medium">Level</th>
                    <th className="text-right px-3 py-2 font-medium">Budget</th>
                    <th className="text-center px-3 py-2 font-medium">Risk</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                    <th className="text-center px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((config) => (
                    <tr
                      key={config.agent.name}
                      onClick={() => setSelectedAgent(config.agent.name)}
                      className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                        selectedAgent === config.agent.name ? "bg-slate-800/50" : "hover:bg-slate-800/20"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{config.agent.avatar}</span>
                          <div>
                            <div className="text-slate-200 font-medium">{config.agent.displayName}</div>
                            <div className="text-[9px] text-slate-500">{config.agent.specialty}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{config.agent.tier}</td>
                      <td className={`px-3 py-2 text-right font-bold ${getLevelColor(config.agent.level)}`}>
                        {config.agent.level}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">${config.budget.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            config.riskTolerance === "high"
                              ? "bg-red-500/20 text-red-400"
                              : config.riskTolerance === "medium"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-green-500/20 text-green-400"
                          }`}
                        >
                          {config.riskTolerance.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateConfig(config.agent.name, { enabled: !config.enabled });
                          }}
                          className={`w-8 h-4 rounded-full transition-colors relative ${
                            config.enabled ? "bg-green-500" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              config.enabled ? "left-4" : "left-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newLevel = config.agent.level < 10 ? config.agent.level + 1 : config.agent.level;
                            // Note: In a real app this would update the agent state
                          }}
                          className="text-[9px] text-amber-400 hover:text-amber-300"
                        >
                          Promote
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agent Detail Panel */}
          <div className="space-y-4">
            {selected ? (
              <>
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{selected.agent.avatar}</span>
                    <div>
                      <div className="text-lg font-bold text-white">{selected.agent.displayName}</div>
                      <div className="text-xs text-slate-500">{selected.agent.description}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Daily Budget ($)</label>
                      <input
                        type="number"
                        value={selected.budget}
                        onChange={(e) => updateConfig(selected.agent.name, { budget: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Max Position Size (%)</label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={selected.maxPositionSize}
                        onChange={(e) => updateConfig(selected.agent.name, { maxPositionSize: parseInt(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                      <div className="text-[10px] text-slate-400 text-right">{selected.maxPositionSize}%</div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Risk Tolerance</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["low", "medium", "high"] as const).map((risk) => (
                          <button
                            key={risk}
                            onClick={() => updateConfig(selected.agent.name, { riskTolerance: risk })}
                            className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                              selected.riskTolerance === risk
                                ? risk === "high"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : risk === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                  : "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "bg-slate-900/50 text-slate-500 border border-slate-700/30"
                            }`}
                          >
                            {risk}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Max Trades/Day</label>
                      <input
                        type="number"
                        value={selected.maxTradesPerDay}
                        onChange={(e) => updateConfig(selected.agent.name, { maxTradesPerDay: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Allowed Assets</label>
                      <div className="flex flex-wrap gap-1">
                        {TRADEABLE_ASSETS.map((asset) => {
                          const allowed = selected.allowedAssets.includes(asset.pair);
                          return (
                            <button
                              key={asset.pair}
                              onClick={() => {
                                const newAssets = allowed
                                  ? selected.allowedAssets.filter((a) => a !== asset.pair)
                                  : [...selected.allowedAssets, asset.pair];
                                updateConfig(selected.agent.name, { allowedAssets: newAssets });
                              }}
                              className={`px-2 py-1 rounded text-[9px] font-medium transition-all ${
                                allowed
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-slate-900/50 text-slate-600 border border-slate-700/30"
                              }`}
                            >
                              {asset.icon} {asset.pair}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent Stats */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <h3 className="text-xs font-bold text-slate-400 mb-3">Agent Performance</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-slate-900/50">
                      <div className="text-[9px] text-slate-500">Win Rate</div>
                      <div className="text-sm font-bold text-amber-400">{(selected.agent.winRate * 100).toFixed(0)}%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/50">
                      <div className="text-[9px] text-slate-500">Level</div>
                      <div className={`text-sm font-bold ${getLevelColor(selected.agent.level)}`}>{selected.agent.level}/10</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/50">
                      <div className="text-[9px] text-slate-500">Style</div>
                      <div className="text-sm font-bold text-slate-300 capitalize">{selected.agent.style}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/50">
                      <div className="text-[9px] text-slate-500">Stop Loss</div>
                      <div className="text-sm font-bold text-slate-300">{(selected.agent.stopLoss * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 rounded-xl bg-slate-800/30 border border-slate-700/30 text-center text-slate-600 text-xs">
                Select an agent to configure
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Admin controls are for demo mode. Changes are applied in real-time to the agent simulation.
        </div>
      </div>
    </div>
  );
}
