"use client";

import { useState, useEffect, useCallback } from "react";
import LiveTicker from "@/components/LiveTicker";
import {
  loadWallet,
  saveWallet,
  resetWallet,
  openPosition,
  closePosition,
  updatePositionPrices,
  getWinRate,
  getWinRateBadge,
  projectReturns,
  calculateFees,
  getPrice,
  TRADEABLE_ASSETS,
  type WalletState,
} from "@/lib/wallet";
import { AGENTS, getAgent } from "@/lib/agents";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DemoTradingPage() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState("BTC/USDT");
  const [tradeAmount, setTradeAmount] = useState("0.01");
  const [tradeSide, setTradeSide] = useState<"LONG" | "SHORT">("LONG");
  const [showProjection, setShowProjection] = useState(false);
  const [projectionCapital, setProjectionCapital] = useState("10000");
  const [equityHistory, setEquityHistory] = useState<{ time: string; equity: number }[]>([]);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Load wallet on mount
  useEffect(() => {
    setWallet(loadWallet());
  }, []);

  // Tick & price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update positions with new prices
  useEffect(() => {
    if (!wallet) return;
    const updated = updatePositionPrices(wallet, tick);
    setWallet(updated);
    setEquityHistory((prev) => {
      const point = { time: new Date().toLocaleTimeString(), equity: updated.equity };
      const next = [...prev, point];
      return next.length > 100 ? next.slice(-100) : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Auto-trading by agents
  useEffect(() => {
    if (!wallet || tick === 0 || tick % 5 !== 0) return;
    const tradingAgents = AGENTS.filter((a) => a.tier === "Strategy" || a.tier === "Intelligence");
    const agent = tradingAgents[tick % tradingAgents.length];
    const assets = TRADEABLE_ASSETS.filter((a) => agent.allowedAssets.includes(a.pair));
    if (assets.length === 0) return;
    const asset = assets[tick % assets.length];
    const side = Math.random() > 0.45 ? "LONG" as const : "SHORT" as const;
    const price = getPrice(asset.pair, tick);
    const maxAmount = Math.min(wallet.balance * 0.1, agent.dailyBudget) / price;
    if (maxAmount < 0.001) return;
    const amount = Math.round(maxAmount * 0.5 * 1000) / 1000;
    const updated = openPosition(wallet, asset.pair, side, amount, agent.name, tick);
    setWallet({ ...updated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Auto-close positions (stop loss / take profit)
  useEffect(() => {
    if (!wallet || wallet.openPositions.length === 0) return;
    let w = { ...wallet };
    for (const pos of wallet.openPositions) {
      if (pos.stopLoss && pos.side === "LONG" && pos.currentPrice <= pos.stopLoss) {
        w = closePosition(w, pos.id, tick, "Stop Loss triggered");
      } else if (pos.stopLoss && pos.side === "SHORT" && pos.currentPrice >= pos.stopLoss) {
        w = closePosition(w, pos.id, tick, "Stop Loss triggered");
      } else if (pos.takeProfit && pos.side === "LONG" && pos.currentPrice >= pos.takeProfit) {
        w = closePosition(w, pos.id, tick, "Take Profit hit");
      } else if (pos.takeProfit && pos.side === "SHORT" && pos.currentPrice <= pos.takeProfit) {
        w = closePosition(w, pos.id, tick, "Take Profit hit");
      }
    }
    if (w !== wallet) setWallet({ ...w });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const handleManualTrade = useCallback(() => {
    if (!wallet) return;
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return;
    const updated = openPosition(wallet, selectedAsset, tradeSide, amount, "Manual", tick);
    setWallet({ ...updated });
  }, [wallet, tradeAmount, selectedAsset, tradeSide, tick]);

  const handleClosePosition = useCallback(
    (posId: string) => {
      if (!wallet) return;
      const updated = closePosition(wallet, posId, tick, "Manual close");
      setWallet({ ...updated });
    },
    [wallet, tick]
  );

  const handleReset = useCallback(() => {
    const fresh = resetWallet();
    setWallet(fresh);
    setEquityHistory([]);
  }, []);

  if (!wallet) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading wallet...</div>;

  const winRate = getWinRate(wallet);
  const badge = getWinRateBadge(winRate);
  const currentPrice = getPrice(selectedAsset, tick);
  const tradeValue = parseFloat(tradeAmount) * currentPrice || 0;
  const fees = calculateFees(tradeValue);
  const projection = projectReturns(wallet.dailyReturn, parseFloat(projectionCapital) || 10000);
  const totalReturn = ((wallet.equity - wallet.startingBalance) / wallet.startingBalance) * 100;

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Demo Trading
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">$1,000 demo wallet — agents trade autonomously</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold ${badge.bg} ${badge.color}`}>
              {badge.label} — {winRate}% Win Rate
            </span>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Reset Wallet
            </button>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Balance</div>
            <div className="text-xl font-bold text-white mt-1">${wallet.balance.toFixed(2)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Equity</div>
            <div className="text-xl font-bold text-white mt-1">${wallet.equity.toFixed(2)}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Daily P&L</div>
            <div className={`text-xl font-bold mt-1 ${wallet.dailyPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {wallet.dailyPnl >= 0 ? "+" : ""}${wallet.dailyPnl.toFixed(2)}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Return</div>
            <div className={`text-xl font-bold mt-1 ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Trades Today</div>
            <div className="text-xl font-bold text-white mt-1">
              {wallet.tradesToday}
              <span className="text-xs text-slate-500 ml-1">({wallet.wins}W / {wallet.losses}L)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Chart + Positions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Equity Chart */}
            {equityHistory.length > 2 && (
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Live Equity Curve</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityHistory}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#334155" tick={{ fontSize: 9, fill: "#64748b" }} interval="preserveStartEnd" />
                      <YAxis domain={["auto", "auto"]} stroke="#334155" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, "Equity"]}
                      />
                      <Area type="monotone" dataKey="equity" stroke="#f59e0b" strokeWidth={2} fill="url(#eqGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Open Positions */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300">Open Positions ({wallet.openPositions.length})</h3>
              </div>
              {wallet.openPositions.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs">No open positions — agents will start trading automatically</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700/20">
                        <th className="text-left px-3 py-2 font-medium">Pair</th>
                        <th className="text-left px-3 py-2 font-medium">Side</th>
                        <th className="text-right px-3 py-2 font-medium">Entry</th>
                        <th className="text-right px-3 py-2 font-medium">Current</th>
                        <th className="text-right px-3 py-2 font-medium">P&L</th>
                        <th className="text-left px-3 py-2 font-medium">Agent</th>
                        <th className="text-right px-3 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.openPositions.map((pos) => {
                        const agentInfo = getAgent(pos.agent);
                        return (
                          <tr key={pos.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-slate-300 font-medium">{pos.pair}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                pos.side === "LONG" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              }`}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-400">${pos.entryPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-slate-300">${pos.currentPrice.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${pos.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(2)}
                              <span className="text-[9px] ml-1">({pos.unrealizedPnlPct.toFixed(1)}%)</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {agentInfo ? `${agentInfo.avatar} ${agentInfo.displayName}` : pos.agent}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleClosePosition(pos.id)}
                                className="px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Closed Trades */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300">Recent Closed Trades</h3>
              </div>
              {wallet.closedTrades.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs">No closed trades yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700/20">
                        <th className="text-left px-3 py-2 font-medium">Pair</th>
                        <th className="text-left px-3 py-2 font-medium">Side</th>
                        <th className="text-right px-3 py-2 font-medium">Entry</th>
                        <th className="text-right px-3 py-2 font-medium">Exit</th>
                        <th className="text-right px-3 py-2 font-medium">P&L</th>
                        <th className="text-right px-3 py-2 font-medium">Fees</th>
                        <th className="text-left px-3 py-2 font-medium">Agent</th>
                        <th className="text-left px-3 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.closedTrades.slice(0, 20).map((trade) => (
                        <tr key={trade.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-300">{trade.pair}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              trade.side === "LONG" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">${trade.entryPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-slate-300">${trade.exitPrice.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">${trade.fees.toFixed(2)}</td>
                          <td className="px-3 py-2 text-slate-500">{trade.agent}</td>
                          <td className="px-3 py-2 text-slate-600 text-[10px]">{trade.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right: Manual Trade + Projections */}
          <div className="space-y-4">
            {/* Manual Trade Panel */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h3 className="text-sm font-bold text-slate-300 mb-3">Manual Trade</h3>

              {/* Asset selector */}
              <div className="mb-3">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Asset</label>
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                >
                  {TRADEABLE_ASSETS.map((a) => (
                    <option key={a.pair} value={a.pair}>
                      {a.icon} {a.pair} — {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current price */}
              <div className="mb-3 p-2 rounded-lg bg-slate-900/50 text-center">
                <div className="text-[10px] text-slate-500">Current Price</div>
                <div className="text-lg font-bold text-white">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>

              {/* Side */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTradeSide("LONG")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    tradeSide === "LONG"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-slate-900/50 text-slate-500 border border-slate-700/30"
                  }`}
                >
                  LONG
                </button>
                <button
                  onClick={() => setTradeSide("SHORT")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    tradeSide === "SHORT"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-slate-900/50 text-slate-500 border border-slate-700/30"
                  }`}
                >
                  SHORT
                </button>
              </div>

              {/* Amount */}
              <div className="mb-3">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Amount</label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  step="0.001"
                  min="0.001"
                  className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                />
                <div className="text-[10px] text-slate-600 mt-1">
                  Value: ${tradeValue.toFixed(2)} | Fees: ${fees.total.toFixed(2)}
                </div>
              </div>

              {/* Cost breakdown toggle */}
              <button
                onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                className="text-[10px] text-amber-400 hover:text-amber-300 mb-2"
              >
                {showCostBreakdown ? "Hide" : "Show"} cost breakdown
              </button>
              {showCostBreakdown && (
                <div className="mb-3 p-2 rounded-lg bg-slate-900/50 text-[10px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Spread (0.05%)</span><span>${fees.spread.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Slippage (0.02%)</span><span>${fees.slippage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform Fee (0.1%)</span><span>${fees.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 font-medium border-t border-slate-700/30 pt-1">
                    <span>Total Fees</span><span>${fees.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleManualTrade}
                disabled={tradeValue + fees.total > wallet.balance}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                  tradeSide === "LONG"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {tradeSide === "LONG" ? "Open Long" : "Open Short"} — ${tradeValue.toFixed(2)}
              </button>
            </div>

            {/* Projection Calculator */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-amber-500/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-amber-400">If This Were Real Money</h3>
                <button
                  onClick={() => setShowProjection(!showProjection)}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  {showProjection ? "Hide" : "Show"}
                </button>
              </div>
              {showProjection && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Capital ($)</label>
                    <input
                      type="number"
                      value={projectionCapital}
                      onChange={(e) => setProjectionCapital(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    Based on today&apos;s {wallet.dailyReturn.toFixed(2)}% return:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Daily", value: projection.daily },
                      { label: "Weekly", value: projection.weekly },
                      { label: "Monthly", value: projection.monthly },
                      { label: "Yearly", value: projection.yearly },
                    ].map((p) => (
                      <div key={p.label} className="p-2 rounded-lg bg-slate-900/50">
                        <div className="text-[9px] text-slate-500">{p.label}</div>
                        <div className={`text-sm font-bold ${p.value >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {p.value >= 0 ? "+" : ""}${p.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-slate-600 italic">
                    * Projections assume consistent daily performance. Past results do not guarantee future returns.
                  </div>
                </div>
              )}
            </div>

            {/* Best / Worst Trade */}
            <div className="grid grid-cols-1 gap-3">
              {wallet.bestTradeToday && (
                <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                  <div className="text-[10px] text-green-400 font-bold mb-1">Best Trade Today</div>
                  <div className="text-sm text-green-400 font-bold">+${wallet.bestTradeToday.pnl.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">
                    {wallet.bestTradeToday.pair} {wallet.bestTradeToday.side} by {wallet.bestTradeToday.agent}
                  </div>
                </div>
              )}
              {wallet.worstTradeToday && (
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                  <div className="text-[10px] text-red-400 font-bold mb-1">Worst Trade Today</div>
                  <div className="text-sm text-red-400 font-bold">${wallet.worstTradeToday.pnl.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">
                    {wallet.worstTradeToday.pair} {wallet.worstTradeToday.side} by {wallet.worstTradeToday.agent}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Demo mode — $1,000 simulated balance. No real funds at risk. Agents trade autonomously.
        </div>
      </div>
    </div>
  );
}
