"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { PORTFOLIO_ALLOCATION, generateEquityCurve } from "@/lib/mockData";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

export default function PortfolioPage() {
  const [equityCurve, setEquityCurve] = useState<{ date: string; equity: number; drawdown: number }[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setEquityCurve(generateEquityCurve(days));
  }, [days]);

  const totalValue = PORTFOLIO_ALLOCATION.reduce((sum, a) => sum + a.value, 0);
  const currentEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 50000;
  const startEquity = equityCurve.length > 0 ? equityCurve[0].equity : 50000;
  const totalReturn = ((currentEquity - startEquity) / startEquity) * 100;
  const maxDrawdown = equityCurve.length > 0 ? Math.max(...equityCurve.map((p) => p.drawdown)) : 0;

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Portfolio Overview
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Asset allocation, equity curve, and performance metrics</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Portfolio", value: `$${totalValue.toLocaleString()}`, color: "text-white", bg: "from-blue-500/10" },
            { label: "Current Equity", value: `$${currentEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-blue-400", bg: "from-blue-500/10" },
            { label: `${days}d Return`, value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`, color: totalReturn >= 0 ? "text-green-400" : "text-red-400", bg: totalReturn >= 0 ? "from-green-500/10" : "from-red-500/10" },
            { label: "Max Drawdown", value: `-${maxDrawdown.toFixed(2)}%`, color: "text-red-400", bg: "from-red-500/10" },
          ].map((stat, i) => (
            <div key={stat.label} className={`animate-fadeIn delay-${i + 1} card-hover bg-gradient-to-br ${stat.bg} to-transparent rounded-xl border border-slate-800/50 px-4 py-4`}>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Allocation + Equity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Pie Chart */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Asset Allocation</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PORTFOLIO_ALLOCATION}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="allocation"
                  >
                    {PORTFOLIO_ALLOCATION.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {PORTFOLIO_ALLOCATION.map((a) => (
                <span key={a.name} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                  <span className="text-slate-400">{a.name} {a.allocation}%</span>
                </span>
              ))}
            </div>
          </div>

          {/* Equity Curve */}
          <div className="lg:col-span-2 rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-300">Equity Curve</h3>
              <div className="flex gap-1">
                {[7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      days === d ? "bg-purple-500/20 text-purple-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#334155"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#334155"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fill="url(#equityGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Drawdown Chart */}
        <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 mb-6">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Drawdown</h3>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <XAxis dataKey="date" stroke="#334155" tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" />
                <YAxis stroke="#334155" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `-${v}%`} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(value: number) => [`-${value.toFixed(2)}%`, "Drawdown"]}
                />
                <Line type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/30">
            <h3 className="text-sm font-bold text-slate-300">Holdings</h3>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/20">
                <th className="text-left px-4 py-2 font-medium">Asset</th>
                <th className="text-right px-4 py-2 font-medium">Allocation</th>
                <th className="text-right px-4 py-2 font-medium">Value</th>
                <th className="text-right px-4 py-2 font-medium">Target</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {PORTFOLIO_ALLOCATION.map((asset) => {
                const drift = Math.abs(asset.allocation - asset.allocation) < 2;
                return (
                  <tr key={asset.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: asset.color }} />
                        <span className="font-medium text-slate-300">{asset.name}/USDT</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{asset.allocation}%</td>
                    <td className="px-4 py-3 text-right text-slate-300">${asset.value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{asset.allocation}%</td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/10 text-green-400">
                        On Target
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Portfolio values are simulated for demo purposes. Paper trading mode active.
        </div>
      </div>
    </div>
  );
}
