"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import {
  generatePriceHistory,
  generateTradeHistory,
  type TradeRecord,
  type PricePoint,
} from "@/lib/mockData";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];

export default function TradingPage() {
  const [selectedPair, setSelectedPair] = useState("BTC/USDT");
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [timeframe, setTimeframe] = useState("24h");

  useEffect(() => {
    const hours = timeframe === "1h" ? 1 : timeframe === "4h" ? 4 : timeframe === "24h" ? 24 : 168;
    setPriceData(generatePriceHistory(selectedPair, hours));
    setTrades(generateTradeHistory(50));
  }, [selectedPair, timeframe]);

  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceData((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const change = (Math.random() - 0.48) * last.price * 0.001;
        const newPoint: PricePoint = {
          time: new Date().toISOString(),
          price: Math.round((last.price + change) * 100) / 100,
          volume: Math.floor(50000 + Math.random() * 500000),
        };
        return [...prev.slice(1), newPoint];
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentPrice = priceData.length > 0 ? priceData[priceData.length - 1].price : 0;
  const firstPrice = priceData.length > 0 ? priceData[0].price : 0;
  const priceChange = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;

  const pairTrades = trades.filter((t) => t.pair === selectedPair);

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Trading Terminal
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">Live price charts and trade execution history</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400">
              Paper Trading
            </span>
          </div>
        </div>

        {/* Pair Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {PAIRS.map((pair) => (
            <button
              key={pair}
              onClick={() => setSelectedPair(pair)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedPair === pair
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800"
              }`}
            >
              {pair}
            </button>
          ))}
        </div>

        {/* Price Header */}
        <div className="mb-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-bold text-white">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-sm font-medium ${priceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
              </div>
            </div>
            <div className="flex gap-1 ml-auto">
              {["1h", "4h", "24h", "7d"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded text-[10px] font-medium ${
                    timeframe === tf
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceData}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={priceChange >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={priceChange >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  stroke="#334155"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  stroke="#334155"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Price"]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={priceChange >= 0 ? "#22c55e" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#priceGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Volume */}
          <div className="h-[80px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceData}>
                <XAxis dataKey="time" hide />
                <Bar dataKey="volume" fill="#3b82f633" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trade History */}
        <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Recent Trades</h3>
            <span className="text-[10px] text-slate-500">{pairTrades.length} trades for {selectedPair}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/20">
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">Side</th>
                  <th className="text-right px-4 py-2 font-medium">Price</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium">P&L</th>
                  <th className="text-left px-4 py-2 font-medium">Agent</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pairTrades.slice(0, 15).map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          trade.side === "BUY"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">{trade.amount.toFixed(4)}</td>
                    <td className={`px-4 py-2 text-right ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{trade.agent}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded ${
                          trade.status === "filled"
                            ? "bg-green-500/10 text-green-400"
                            : trade.status === "pending"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Paper trading mode active. No real funds at risk.
        </div>
      </div>
    </div>
  );
}
