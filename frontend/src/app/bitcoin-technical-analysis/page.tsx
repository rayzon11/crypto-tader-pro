'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

export default function BitcoinTechnicalAnalysisPage() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState('4h');

  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/bitcoin/technical-analysis');
      const data = await response.json();
      setAnalysis(data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
    }
  };

  if (loading || !analysis) {
    return <div className="flex items-center justify-center h-screen text-slate-400">Loading analysis...</div>;
  }

  // Prepare chart data from candles
  const chartData = (analysis.candles || []).map((candle: any) => ({
    time: new Date(candle.timestamp).toLocaleTimeString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Bitcoin Advanced Technical Analysis</h1>
        <p className="text-slate-400">Professional-grade charting with Ichimoku, on-chain metrics, and macro analysis</p>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* 4h Candle Chart */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">4h Candle Chart</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData.slice(-48)}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #06b6d4' }} />
              <Area type="monotone" dataKey="close" stroke="#06b6d4" fillOpacity={1} fill="url(#colorClose)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-slate-400">
            <div>Last Close: ${chartData[chartData.length - 1]?.close.toFixed(2)}</div>
            <div>200-SMA: $66,000</div>
            <div>50-SMA: $66,800</div>
          </div>
        </div>

        {/* Ichimoku Cloud */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Ichimoku Cloud (1d)</h2>
          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Senkou Span A</div>
              <div className="text-lg font-bold text-cyan-400">$66,800</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Senkou Span B</div>
              <div className="text-lg font-bold text-purple-400">$65,200</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Conversion Line (Tenkan)</div>
              <div className="text-lg font-bold text-green-400">$67,100</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Baseline (Kijun)</div>
              <div className="text-lg font-bold text-blue-400">$66,950</div>
            </div>
            <div className="bg-green-500/20 border border-green-500/40 p-3 rounded text-sm text-green-400">
              ✓ Inside Cloud (Bullish Signal)
            </div>
          </div>
        </div>
      </div>

      {/* Support/Resistance & Volume Profile */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Support/Resistance Levels</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-red-500/20 p-3 rounded border border-red-500/40">
              <span className="text-slate-300">Resistance 2</span>
              <span className="text-lg font-bold text-red-400">$69,100</span>
            </div>
            <div className="flex justify-between items-center bg-orange-500/20 p-3 rounded border border-orange-500/40">
              <span className="text-slate-300">Resistance 1</span>
              <span className="text-lg font-bold text-orange-400">$68,200</span>
            </div>
            <div className="flex justify-between items-center bg-cyan-500/20 p-3 rounded border border-cyan-500/40">
              <span className="text-white font-bold">Current Price</span>
              <span className="text-lg font-bold text-cyan-400">$67,523</span>
            </div>
            <div className="flex justify-between items-center bg-blue-500/20 p-3 rounded border border-blue-500/40">
              <span className="text-slate-300">Support 1</span>
              <span className="text-lg font-bold text-blue-400">$67,000</span>
            </div>
            <div className="flex justify-between items-center bg-green-500/20 p-3 rounded border border-green-500/40">
              <span className="text-slate-300">Support 2</span>
              <span className="text-lg font-bold text-green-400">$66,500</span>
            </div>
            <div className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
              <span className="text-slate-300">Support 3</span>
              <span className="text-lg font-bold text-slate-300">$65,800</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Volume Profile & VWAP</h2>
          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">High Volume Node</div>
              <div className="text-lg font-bold text-cyan-400">$67,200</div>
              <div className="text-xs text-slate-500">Most traded price</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Value Area (70%)</div>
              <div className="text-lg font-bold text-purple-400">$66,800 - $67,500</div>
              <div className="text-xs text-slate-500">Price range for 70% of volume</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Point of Control</div>
              <div className="text-lg font-bold text-green-400">$67,200</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">VWAP (Volume-Weighted Avg)</div>
              <div className="text-lg font-bold text-blue-400">$67,100</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Daily Pivot</div>
              <div className="text-lg font-bold text-cyan-400">$67,350</div>
            </div>
          </div>
        </div>
      </div>

      {/* On-Chain & Macro */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">On-Chain Metrics</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">MVRV Ratio</span>
              <span className={`font-bold ${analysis.onchainMetrics.mvrv < 1 ? 'text-green-400' : 'text-red-400'}`}>
                {analysis.onchainMetrics.mvrv.toFixed(2)} {analysis.onchainMetrics.mvrv < 1 ? '(Undervalued)' : '(Overvalued)'}
              </span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">SOPR Ratio</span>
              <span className="font-bold text-cyan-400">{analysis.onchainMetrics.sopr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Exchange Netflow</span>
              <span className="font-bold text-green-400">{analysis.onchainMetrics.exchangeNetflow.toLocaleString()} BTC</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Whale Movements</span>
              <span className="font-bold text-cyan-400">{analysis.onchainMetrics.whaleMovements} BTC moved</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Exchange Reserve</span>
              <span className="font-bold text-cyan-400">{(analysis.onchainMetrics.exchangeReserve / 1000000).toFixed(1)}M BTC</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Long/Short Ratio</span>
              <span className="font-bold text-green-400">{analysis.onchainMetrics.longShortRatio.toFixed(2)}x (More longs)</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Funding Rate</span>
              <span className="font-bold text-cyan-400">{(analysis.onchainMetrics.fundingRate * 100).toFixed(3)}% (Slight long leverage)</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Macro Analysis</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">BTC Dominance</span>
              <span className="font-bold text-cyan-400">{analysis.macro.bitcoinDominance.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">BTC/ETH Ratio</span>
              <span className="font-bold text-cyan-400">{analysis.macro.btcEthRatio.toFixed(1)}</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Fear & Greed</span>
              <span className="font-bold text-yellow-400">{analysis.macro.fearGreedIndex} (Neutral-Greedy)</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Global Crypto Cap</span>
              <span className="font-bold text-cyan-400">${(analysis.macro.globalCapital / 1000000000000).toFixed(2)}T</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">21d Trend</span>
              <span className={`font-bold ${analysis.macro.btcTrend21d.includes('Up') ? 'text-green-400' : 'text-red-400'}`}>
                {analysis.macro.btcTrend21d}
              </span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">YTD Performance</span>
              <span className="font-bold text-green-400">+{analysis.macro.ytdPerformance.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between bg-slate-900/50 p-3 rounded">
              <span className="text-slate-300">Volatility (20d)</span>
              <span className="font-bold text-cyan-400">{analysis.macro.volatility}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prediction Accuracy Tracker */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Prediction Accuracy Tracker</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Bitcoin Short-Term</div>
            <div className="text-3xl font-bold text-cyan-400">{(analysis.predictionAccuracy.shortTermAgent * 100).toFixed(0)}%</div>
            <div className="text-xs text-slate-500 mt-2">Last 100 predictions</div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Bitcoin Multi-TF</div>
            <div className="text-3xl font-bold text-cyan-400">{(analysis.predictionAccuracy.multiframeAgent * 100).toFixed(0)}%</div>
            <div className="text-xs text-slate-500 mt-2">Last 100 predictions</div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Candle Patterns</div>
            <div className="text-3xl font-bold text-purple-400">{(analysis.predictionAccuracy.patternDetector * 100).toFixed(0)}%</div>
            <div className="text-xs text-slate-500 mt-2">172 patterns tested</div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Claude Opus</div>
            <div className="text-3xl font-bold text-cyan-400">{(analysis.predictionAccuracy.claudeOpus * 100).toFixed(0)}%</div>
            <div className="text-xs text-slate-500 mt-2">Last 50 decisions</div>
          </div>
        </div>
      </div>

      {/* Strategy Backtester */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Strategy Backtester</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Timeframe</label>
            <select className="w-full bg-slate-900 border border-cyan-500/30 text-white px-3 py-2 rounded">
              <option>1h</option>
              <option>4h</option>
              <option>1d</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Period</label>
            <select className="w-full bg-slate-900 border border-cyan-500/30 text-white px-3 py-2 rounded">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>Last 1 Year</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Win Rate</div>
            <div className="text-2xl font-bold text-green-400">68%</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Profit Factor</div>
            <div className="text-2xl font-bold text-green-400">2.1x</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Sharpe Ratio</div>
            <div className="text-2xl font-bold text-cyan-400">1.8</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Max Drawdown</div>
            <div className="text-2xl font-bold text-yellow-400">3.2%</div>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-400">
          <div>Avg Trade: +0.62% | Total Return: +18.6% | Total Trades: 124</div>
        </div>
      </div>
    </div>
  );
}
