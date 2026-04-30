'use client';

import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Zap, Clock, Grid2x2, AlertCircle } from 'lucide-react';

export default function MultiTimeframeTrading() {
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [selectedCategory, setSelectedCategory] = useState('crypto');

  // Timeframe data
  const timeframes = ['1m', '5m', '15m', '30m'];
  const categories = {
    crypto: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'AVAX/USDT', 'XRP/USDT', 'DOGE/USDT'],
    forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD'],
    equity: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA']
  };

  const timeframeSignals = {
    '1m': { signal: 'BUY', confidence: 78, color: 'text-green-400' },
    '5m': { signal: 'BUY', confidence: 72, color: 'text-green-400' },
    '15m': { signal: 'HOLD', confidence: 65, color: 'text-yellow-400' },
    '30m': { signal: 'HOLD', confidence: 68, color: 'text-yellow-400' }
  };

  const indicators = {
    rsi: 35,
    macd: { value: 0.024, signal: 0.018, histogram: 0.006 },
    bb: { upper: 67800, middle: 67200, lower: 66600 },
    atr: 285,
    stochastic: 32,
    adx: 28,
    obv: 125000000,
    ema: { '7': 67450, '21': 67100, '50': 66800 },
    sma: { '50': 66900, '200': 65200 }
  };

  const candleData = [
    { time: '08:00', open: 67100, high: 67300, low: 67000, close: 67250, volume: 1200 },
    { time: '08:05', open: 67250, high: 67450, low: 67200, close: 67400, volume: 1500 },
    { time: '08:10', open: 67400, high: 67600, low: 67350, close: 67550, volume: 1800 },
    { time: '08:15', open: 67550, high: 67750, low: 67500, close: 67700, volume: 2100 },
    { time: '08:20', open: 67700, high: 67900, low: 67650, close: 67820, volume: 1900 },
    { time: '08:25', open: 67820, high: 68000, low: 67750, close: 67950, volume: 2300 },
  ];

  const equityData = [
    { time: '08:00', balance: 10000, equity: 10000 },
    { time: '08:05', balance: 10000, equity: 10050 },
    { time: '08:10', balance: 10000, equity: 10120 },
    { time: '08:15', balance: 10000, equity: 10180 },
    { time: '08:20', balance: 10100, equity: 10250 },
    { time: '08:25', balance: 10100, equity: 10320 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                Multi-Timeframe Global Trading
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                1m, 5m, 15m, 30m • 75+ Crypto • 45+ Forex • 30+ Equities • ALL Indicators
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Global Coverage</div>
              <div className="text-2xl font-bold text-cyan-400">24/7 Live</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Market Summary Stats */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-4">
            <div className="text-cyan-400 text-xs font-bold">CRYPTO PAIRS</div>
            <div className="text-2xl font-bold text-white mt-1">75+</div>
            <div className="text-[10px] text-slate-500 mt-1">All major cryptocurrencies</div>
          </div>
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-4">
            <div className="text-blue-400 text-xs font-bold">FOREX PAIRS</div>
            <div className="text-2xl font-bold text-white mt-1">45+</div>
            <div className="text-[10px] text-slate-500 mt-1">Major, minor & exotic</div>
          </div>
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-4">
            <div className="text-green-400 text-xs font-bold">EQUITIES</div>
            <div className="text-2xl font-bold text-white mt-1">30+</div>
            <div className="text-[10px] text-slate-500 mt-1">US & Global stocks</div>
          </div>
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-4">
            <div className="text-yellow-400 text-xs font-bold">TIMEFRAMES</div>
            <div className="text-2xl font-bold text-white mt-1">4</div>
            <div className="text-[10px] text-slate-500 mt-1">1m, 5m, 15m, 30m</div>
          </div>
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-4">
            <div className="text-purple-400 text-xs font-bold">INDICATORS</div>
            <div className="text-2xl font-bold text-white mt-1">15+</div>
            <div className="text-[10px] text-slate-500 mt-1">Full technical suite</div>
          </div>
        </div>

        {/* Pair Selector & Consensus */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {/* Category & Pair Selection */}
          <div className="col-span-1">
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Market Category</h3>
              <div className="space-y-2">
                {Object.keys(categories).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-4 py-2 rounded transition ${
                      selectedCategory === cat
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        : 'bg-slate-700/30 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    <span className="text-xs ml-2 opacity-60">({categories[cat as keyof typeof categories].length})</span>
                  </button>
                ))}
              </div>

              <h3 className="text-lg font-bold text-white mt-6 mb-3">Trading Pair</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {categories[selectedCategory as keyof typeof categories].map(pair => (
                  <button
                    key={pair}
                    onClick={() => setSelectedPair(pair)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      selectedPair === pair
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-slate-300 hover:bg-slate-700/30'
                    }`}
                  >
                    {pair}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timeframe Signals */}
          <div className="col-span-3">
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Multi-Timeframe Consensus for {selectedPair}
              </h3>

              <div className="grid grid-cols-4 gap-4">
                {timeframes.map(tf => {
                  const sig = timeframeSignals[tf as keyof typeof timeframeSignals];
                  return (
                    <div key={tf} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                      <div className="text-cyan-400 font-bold mb-3">{tf} Chart</div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Signal</div>
                          <div className={`text-2xl font-bold ${sig.color}`}>
                            {sig.signal}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Confidence</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-700 rounded h-2">
                              <div
                                className={`h-2 rounded ${sig.signal === 'BUY' ? 'bg-green-500' : 'bg-yellow-500'}`}
                                style={{ width: `${sig.confidence}%` }}
                              />
                            </div>
                            <span className="text-white font-bold text-sm">{sig.confidence}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-400">Overall Consensus</div>
                    <div className="text-2xl font-bold text-green-400 mt-1">BUY (73% avg)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">Optimal Timeframe</div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">1m & 5m</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Candle Chart */}
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Price Action (5m)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={candleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4' }} />
                <Legend />
                <Line type="monotone" dataKey="close" stroke="#06b6d4" name="Close" />
                <Line type="monotone" dataKey="open" stroke="#9333ea" name="Open" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Equity Curve */}
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Account Equity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4' }} />
                <Area type="monotone" dataKey="equity" stroke="#06b6d4" fillOpacity={1} fill="url(#colorEquity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Indicators Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* RSI & Stochastic */}
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Momentum Indicators</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300">RSI(14)</span>
                  <span className="font-bold text-green-400">{indicators.rsi}</span>
                </div>
                <div className="w-full bg-slate-700 rounded h-2">
                  <div className="bg-green-500 h-2 rounded" style={{ width: '35%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300">Stochastic K</span>
                  <span className="font-bold text-yellow-400">{indicators.stochastic}</span>
                </div>
                <div className="w-full bg-slate-700 rounded h-2">
                  <div className="bg-yellow-500 h-2 rounded" style={{ width: '32%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300">ADX</span>
                  <span className="font-bold text-cyan-400">{indicators.adx}</span>
                </div>
                <div className="w-full bg-slate-700 rounded h-2">
                  <div className="bg-cyan-500 h-2 rounded" style={{ width: '28%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* MACD */}
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">MACD Indicator</h3>
            <div className="space-y-3">
              <div className="bg-slate-700/30 p-3 rounded">
                <div className="text-xs text-slate-400">MACD Line</div>
                <div className="text-xl font-bold text-cyan-400">{indicators.macd.value.toFixed(3)}</div>
              </div>
              <div className="bg-slate-700/30 p-3 rounded">
                <div className="text-xs text-slate-400">Signal Line</div>
                <div className="text-xl font-bold text-blue-400">{indicators.macd.signal.toFixed(3)}</div>
              </div>
              <div className="bg-slate-700/30 p-3 rounded">
                <div className="text-xs text-slate-400">Histogram</div>
                <div className="text-xl font-bold text-green-400">{indicators.macd.histogram.toFixed(3)}</div>
              </div>
            </div>
          </div>

          {/* Bollinger Bands */}
          <div className="bg-slate-800/80 border border-cyan-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Bollinger Bands</h3>
            <div className="space-y-3">
              <div className="bg-slate-700/30 p-3 rounded">
                <div className="text-xs text-slate-400">Upper Band</div>
                <div className="text-lg font-bold text-red-400">${indicators.bb.upper.toLocaleString()}</div>
              </div>
              <div className="bg-slate-700/30 p-3 rounded">
                <div className="text-xs text-slate-400">Middle (SMA 20)</div>
                <div className="text-lg font-bold text-white">${indicators.bb.middle.toLocaleString()}</div>
              </div>
              <div className="bg-slate-700/30 p-3 rounded">
                <div className="text-xs text-slate-400">Lower Band</div>
                <div className="text-lg font-bold text-green-400">${indicators.bb.lower.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
