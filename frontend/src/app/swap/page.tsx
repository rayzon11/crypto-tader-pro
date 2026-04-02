"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { getPrice, calculateFees, TRADEABLE_ASSETS } from "@/lib/wallet";

export default function SwapPage() {
  const [fromAsset, setFromAsset] = useState("USDT");
  const [toAsset, setToAsset] = useState("BTC/USDT");
  const [amount, setAmount] = useState("100");
  const [tick, setTick] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop-loss" | "take-profit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [recentSwaps, setRecentSwaps] = useState<
    { id: string; from: string; to: string; amountIn: number; amountOut: number; fee: number; time: string }[]
  >([]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const toPrice = getPrice(toAsset, tick);
  const amountNum = parseFloat(amount) || 0;
  const outputAmount = toPrice > 0 ? amountNum / toPrice : 0;
  const fees = calculateFees(amountNum);
  const netOutput = toPrice > 0 ? (amountNum - fees.total) / toPrice : 0;
  const priceImpact = amountNum > 10000 ? 0.15 : amountNum > 5000 ? 0.08 : 0.02;
  const toInfo = TRADEABLE_ASSETS.find((a) => a.pair === toAsset);

  const handleSwap = () => {
    if (amountNum <= 0) return;
    const swap = {
      id: `SW${Date.now()}`,
      from: fromAsset,
      to: toAsset,
      amountIn: amountNum,
      amountOut: Math.round(netOutput * 100000) / 100000,
      fee: fees.total,
      time: new Date().toLocaleTimeString(),
    };
    setRecentSwaps((prev) => [swap, ...prev].slice(0, 10));
    setAmount("");
  };

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Swap & Trade
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Swap crypto with smart routing and full cost transparency</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Swap Card */}
          <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/30">
            {/* Order Type */}
            <div className="flex gap-2 mb-5">
              {(["market", "limit", "stop-loss", "take-profit"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-all ${
                    orderType === type
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "text-slate-500 hover:text-slate-300 border border-transparent"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* From */}
            <div className="mb-4">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">From</label>
              <div className="flex gap-2">
                <select
                  value={fromAsset}
                  onChange={(e) => setFromAsset(e.target.value)}
                  className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
                >
                  <option value="USDT">USDT</option>
                  <option value="USD">USD</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </select>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/30 flex items-center justify-center text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className="mb-4">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">To</label>
              <div className="flex gap-2">
                <select
                  value={toAsset}
                  onChange={(e) => setToAsset(e.target.value)}
                  className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
                >
                  {TRADEABLE_ASSETS.map((a) => (
                    <option key={a.pair} value={a.pair}>{a.icon} {a.pair}</option>
                  ))}
                </select>
                <div className="flex-1 bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-white font-medium">
                  {netOutput.toFixed(6)} {toInfo?.name || toAsset}
                </div>
              </div>
            </div>

            {/* Limit price input */}
            {(orderType === "limit" || orderType === "stop-loss" || orderType === "take-profit") && (
              <div className="mb-4">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                  {orderType === "limit" ? "Limit Price" : orderType === "stop-loss" ? "Stop Price" : "Take Profit Price"}
                </label>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={`$${toPrice.toFixed(2)}`}
                  className="w-full bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            )}

            {/* Rate */}
            <div className="mb-4 p-3 rounded-lg bg-slate-900/50 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Rate</span>
                <span>1 {toInfo?.name || toAsset} = ${toPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Price Impact</span>
                <span className={priceImpact > 0.1 ? "text-yellow-400" : "text-green-400"}>~{priceImpact}%</span>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Route</span>
                <span className="text-purple-400">Smart Order Router (3 exchanges)</span>
              </div>
            </div>

            {/* Cost Breakdown */}
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-[10px] text-purple-400 hover:text-purple-300 mb-3 block"
            >
              {showBreakdown ? "Hide" : "Show"} cost breakdown
            </button>
            {showBreakdown && (
              <div className="mb-4 p-3 rounded-lg bg-slate-900/50 text-[10px] space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Spread (0.05%)</span><span>${fees.spread.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Slippage (0.02%)</span><span>${fees.slippage.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Platform Fee (0.1%)</span><span>${fees.platformFee.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Est. Gas</span><span>$0.12</span>
                </div>
                <div className="flex justify-between text-slate-200 font-medium border-t border-slate-700/30 pt-1.5">
                  <span>Total Cost</span><span>${(fees.total + 0.12).toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-slate-200 font-medium">
                  <span>You Receive</span><span>{netOutput.toFixed(6)} {toInfo?.name || ""}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSwap}
              disabled={amountNum <= 0}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 font-bold text-sm hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {orderType === "market" ? "Swap Now" : `Place ${orderType} Order`}
            </button>
          </div>

          {/* Right: Recent Swaps + Info */}
          <div className="space-y-4">
            {/* Smart Routing Info */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-purple-500/20">
              <h3 className="text-sm font-bold text-purple-400 mb-3">Smart Order Routing</h3>
              <div className="space-y-2 text-[11px]">
                {[
                  { exchange: "Binance", share: "45%", price: `$${(toPrice * 0.9998).toFixed(2)}`, latency: "12ms" },
                  { exchange: "Kraken", share: "35%", price: `$${(toPrice * 1.0001).toFixed(2)}`, latency: "18ms" },
                  { exchange: "Coinbase", share: "20%", price: `$${(toPrice * 1.0003).toFixed(2)}`, latency: "22ms" },
                ].map((route) => (
                  <div key={route.exchange} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50">
                    <span className="text-slate-300 font-medium">{route.exchange}</span>
                    <span className="text-slate-400">{route.share}</span>
                    <span className="text-slate-400">{route.price}</span>
                    <span className="text-green-400">{route.latency}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Swaps */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-300">Recent Swaps</h3>
              </div>
              {recentSwaps.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs">No swaps yet</div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {recentSwaps.map((swap) => (
                    <div key={swap.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-300">
                          ${swap.amountIn.toFixed(2)} {swap.from} → {swap.amountOut} {swap.to}
                        </div>
                        <div className="text-[10px] text-slate-500">Fee: ${swap.fee.toFixed(2)} | {swap.time}</div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400">Filled</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supported Assets */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h3 className="text-sm font-bold text-slate-300 mb-3">Supported Assets</h3>
              <div className="grid grid-cols-2 gap-2">
                {TRADEABLE_ASSETS.map((asset) => (
                  <div key={asset.pair} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/30 text-[11px]">
                    <span className="text-lg">{asset.icon}</span>
                    <div>
                      <div className="text-slate-300 font-medium">{asset.pair}</div>
                      <div className="text-[9px] text-slate-500">{asset.name}</div>
                    </div>
                    <div className="ml-auto text-slate-400 text-[10px]">
                      ${getPrice(asset.pair, tick).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
