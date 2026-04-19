'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Target, Zap } from 'lucide-react';
import HedgeFundAnalyst from '@/components/HedgeFundAnalyst';

export default function ProfessionalTradingPage() {
  const [account, setAccount] = useState({
    balance: 10000,
    equity: 10000,
    margin: 0,
    freeMargin: 10000,
    marginLevel: 0,
  });

  const [positions, setPositions] = useState([
    {
      id: 'POS_001',
      symbol: 'BTC/USD',
      side: 'BUY',
      volume: 0.5,
      entryPrice: 67450,
      currentPrice: 67580,
      pnl: 65,
      pnlPercent: 0.19,
      stopLoss: 67000,
      takeProfit: 68500,
      opened: '2 hours ago',
    },
  ]);

  const [trades, setTrades] = useState([
    {
      id: 1,
      symbol: 'ETH/USD',
      side: 'BUY',
      volume: 2,
      entry: 3420,
      exit: 3450,
      pnl: 60,
      reason: 'TAKE_PROFIT',
      time: '30 min ago',
    },
    {
      id: 2,
      symbol: 'SOL/USD',
      side: 'SELL',
      volume: 10,
      entry: 180,
      exit: 178.5,
      pnl: 15,
      reason: 'MANUAL',
      time: '1 hour ago',
    },
  ]);

  const [selectedTab, setSelectedTab] = useState('overview');
  const [equityChart, setEquityChart] = useState([
    { time: '09:00', equity: 10000, balance: 10000 },
    { time: '10:30', equity: 10150, balance: 10050 },
    { time: '12:00', equity: 10320, balance: 10200 },
    { time: '14:00', equity: 10580, balance: 10450 },
    { time: '16:00', equity: 10720, balance: 10620 },
  ]);

  const stats = {
    totalTrades: 147,
    winRate: 67.3,
    profitFactor: 2.45,
    avgWin: 125.50,
    avgLoss: 51.20,
    maxDrawdown: 4.2,
    sharpeRatio: 1.82,
  };

  const riskStatus = {
    dailyLoss: 45,
    drawdown: 3.8,
    status: 'SAFE',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                Professional Trading Terminal
              </h1>
              <p className="text-slate-400 mt-1">Live Demo Account - Real Market Conditions</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Account Status</div>
              <div className="text-2xl font-bold text-green-400">● ACTIVE</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* JP Morgan / Bloomberg-grade analyst console — real live data */}
        <div className="mb-8">
          <HedgeFundAnalyst />
        </div>

        {/* Account Overview */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Account Balance</p>
                <p className="text-2xl font-bold text-white mt-2">
                  ${account.balance.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-cyan-400 opacity-20" />
            </div>
          </div>

          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Equity</p>
                <p className="text-2xl font-bold text-green-400 mt-2">
                  ${account.equity.toLocaleString()}
                </p>
                <p className="text-xs text-green-400/60 mt-1">
                  +${(account.equity - account.balance).toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-400 opacity-20" />
            </div>
          </div>

          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Free Margin</p>
                <p className="text-2xl font-bold text-blue-400 mt-2">
                  ${account.freeMargin.toLocaleString()}
                </p>
                <div className="w-full bg-slate-700 rounded h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded"
                    style={{ width: `${(account.freeMargin / account.balance) * 100}%` }}
                  />
                </div>
              </div>
              <Zap className="w-10 h-10 text-blue-400 opacity-20" />
            </div>
          </div>

          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Margin Level</p>
                <p className="text-2xl font-bold text-yellow-400 mt-2">
                  {(account.marginLevel || 0).toFixed(0)}%
                </p>
                <p className={`text-xs mt-1 ${
                  (account.marginLevel || 0) > 100 ? 'text-green-400/60' : 'text-yellow-400/60'
                }`}>
                  {account.marginLevel > 0 ? 'Adequate' : 'No positions'}
                </p>
              </div>
              <Target className="w-10 h-10 text-yellow-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Equity Curve */}
        <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Equity Curve</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={equityChart}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4' }}
                labelStyle={{ color: '#06b6d4' }}
              />
              <Area type="monotone" dataKey="equity" stroke="#06b6d4" fillOpacity={1} fill="url(#colorEquity)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-8">
          {/* Open Positions */}
          <div className="col-span-2">
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                Open Positions ({positions.length})
              </h2>

              <div className="space-y-4">
                {positions.map((pos) => (
                  <div key={pos.id} className="bg-slate-700/50 border border-cyan-500/10 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{pos.symbol}</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            pos.side === 'BUY'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {pos.side}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mt-1">Opened {pos.opened}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${pos.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${pos.pnl.toFixed(2)}
                        </div>
                        <div className={`text-sm ${pos.pnl > 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                          {pos.pnl > 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm mb-4">
                      <div>
                        <p className="text-slate-400 text-xs">Entry</p>
                        <p className="text-white font-mono">${pos.entryPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Current</p>
                        <p className="text-white font-mono">${pos.currentPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Volume</p>
                        <p className="text-white font-mono">{pos.volume} lot</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">S/L</p>
                        <p className="text-red-400 font-mono">${pos.stopLoss.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm font-bold transition">
                        Close Position
                      </button>
                      <button className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 rounded text-sm font-bold transition">
                        Modify SL/TP
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {positions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-400">No open positions</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Stats */}
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Win Rate</span>
                  <span className="text-green-400 font-bold">{stats.winRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Profit Factor</span>
                  <span className="text-cyan-400 font-bold">{stats.profitFactor.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Avg Win</span>
                  <span className="text-green-400 font-bold">${stats.avgWin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Avg Loss</span>
                  <span className="text-red-400 font-bold">-${stats.avgLoss.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
                  <span className="text-slate-400">Max Drawdown</span>
                  <span className="text-yellow-400 font-bold">{stats.maxDrawdown}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Sharpe Ratio</span>
                  <span className="text-blue-400 font-bold">{stats.sharpeRatio.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Risk Status */}
            <div className={`bg-slate-800/80 border rounded-lg p-6 ${
              riskStatus.status === 'SAFE'
                ? 'border-green-500/20'
                : 'border-yellow-500/20'
            }`}>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Risk Status
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 text-sm">Daily Loss</span>
                    <span className="text-red-400 text-sm">-${riskStatus.dailyLoss}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded h-2">
                    <div className="bg-red-500 h-2 rounded" style={{ width: '9%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 text-sm">Drawdown</span>
                    <span className="text-yellow-400 text-sm">{riskStatus.drawdown}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded h-2">
                    <div className="bg-yellow-500 h-2 rounded" style={{ width: '38%' }} />
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-700">
                  <div className={`px-4 py-2 rounded text-center font-bold ${
                    riskStatus.status === 'SAFE'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    Status: {riskStatus.status}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="mt-8 bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">Recent Closed Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400">Symbol</th>
                  <th className="text-left py-3 px-4 text-slate-400">Side</th>
                  <th className="text-right py-3 px-4 text-slate-400">Entry</th>
                  <th className="text-right py-3 px-4 text-slate-400">Exit</th>
                  <th className="text-right py-3 px-4 text-slate-400">P&L</th>
                  <th className="text-left py-3 px-4 text-slate-400">Reason</th>
                  <th className="text-left py-3 px-4 text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{trade.symbol}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.side === 'BUY'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${trade.entry.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${trade.exit.toLocaleString()}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${
                      trade.pnl > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{trade.reason}</td>
                    <td className="py-3 px-4 text-slate-400">{trade.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
