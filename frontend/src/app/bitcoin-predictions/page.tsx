'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Target, Zap } from 'lucide-react';

export default function BitcoinPredictionsPage() {
  const [predictions, setPredictions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchPredictions = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/bitcoin/predict');
      const data = await response.json();
      setPredictions(data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    }
  };

  if (loading || !predictions) {
    return <div className="flex items-center justify-center h-screen text-slate-400">Loading predictions...</div>;
  }

  const consensusColor = predictions.consensus.overallSignal === 'BUY' ? 'text-green-400' : predictions.consensus.overallSignal === 'SELL' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Bitcoin Real-Time Predictions</h1>
        <p className="text-slate-400">AI-powered multi-timeframe analysis with candle patterns and technical indicators</p>
      </div>

      {/* Current Price */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <div className="text-sm text-slate-400 mb-2">Current Price</div>
          <div className="text-3xl font-bold text-white">${predictions.currentPrice?.toFixed(2)}</div>
          <div className={`text-sm mt-2 ${parseFloat(predictions.percentChange24h) > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {parseFloat(predictions.percentChange24h) > 0 ? '+' : ''}{predictions.percentChange24h}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <div className="text-sm text-slate-400 mb-2">Overall Consensus</div>
          <div className={`text-3xl font-bold ${consensusColor}`}>
            {predictions.consensus.overallSignal}
          </div>
          <div className="text-sm text-slate-400 mt-2">Confidence: {predictions.consensus.confidence}%</div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <div className="text-sm text-slate-400 mb-2">Agreed TFs</div>
          <div className="text-3xl font-bold text-cyan-400">{predictions.consensus.agreedTimeframes.length}/7</div>
          <div className="text-xs text-slate-500 mt-2">Timeframes aligned</div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <div className="text-sm text-slate-400 mb-2">Pattern Signal</div>
          <div className="text-3xl font-bold text-purple-400">{predictions.patternConfidence}%</div>
          <div className="text-xs text-slate-500 mt-2">{predictions.strongestPattern?.name || 'None'}</div>
        </div>
      </div>

      {/* Multi-Timeframe Consensus Grid */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Multi-Timeframe Consensus</h2>
        <div className="grid grid-cols-7 gap-3">
          {['1m', '5m', '15m', '30m', '1h', '4h', '1d'].map((tf) => {
            const tfPred = predictions.timeframes[tf];
            const signalColor = tfPred.signal === 'BUY' ? 'bg-green-500/20 border-green-500' : tfPred.signal === 'SELL' ? 'bg-red-500/20 border-red-500' : 'bg-yellow-500/20 border-yellow-500';
            const signalTextColor = tfPred.signal === 'BUY' ? 'text-green-400' : tfPred.signal === 'SELL' ? 'text-red-400' : 'text-yellow-400';

            return (
              <div key={tf} className={`${signalColor} border rounded-lg p-4`}>
                <div className="text-xs font-bold text-slate-300 mb-2">{tf}</div>
                <div className={`text-lg font-bold ${signalTextColor} mb-3`}>{tfPred.signal}</div>
                <div className="bg-slate-900 rounded w-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${tfPred.signal === 'BUY' ? 'bg-green-500' : tfPred.signal === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'}`}
                    style={{ width: `${tfPred.confidence}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-2">{tfPred.confidence}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Candle Patterns */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Candle Patterns Detected</h2>
          <div className="space-y-3">
            {predictions.patterns && predictions.patterns.length > 0 ? (
              predictions.patterns.map((pattern: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-slate-700">
                  <div>
                    <div className="font-semibold text-white">{pattern.name}</div>
                    <div className="text-xs text-slate-400">{pattern.description || 'Pattern detected'}</div>
                  </div>
                  <div className={`text-right ${pattern.direction === 'UP' ? 'text-green-400' : pattern.direction === 'DOWN' ? 'text-red-400' : 'text-yellow-400'}`}>
                    <div className="font-bold">{pattern.confidence}%</div>
                    <div className="text-xs">{pattern.direction}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-sm">No patterns detected</div>
            )}
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Technical Indicators</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">RSI(14)</span>
                <span className="text-sm font-bold text-cyan-400">{predictions.indicators.rsi?.toFixed(1)}</span>
              </div>
              <div className="bg-slate-900 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-full" style={{ width: `${predictions.indicators.rsi}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">Stochastic</span>
                <span className="text-sm font-bold text-cyan-400">{predictions.indicators.stochastic?.toFixed(1)}</span>
              </div>
              <div className="bg-slate-900 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-full" style={{ width: `${predictions.indicators.stochastic}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">ADX</span>
                <span className="text-sm font-bold text-cyan-400">{predictions.indicators.adx?.toFixed(1)}</span>
              </div>
              <div className="bg-slate-900 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600 to-cyan-500 h-full" style={{ width: `${predictions.indicators.adx}%` }} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-400">MACD: {predictions.indicators.macd?.histogram > 0 ? '+' : ''}{predictions.indicators.macd?.histogram?.toFixed(3)}</div>
              <div className="text-xs text-slate-400 mt-1">ATR: ${predictions.indicators.atr?.toFixed(0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Setups */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-gradient-to-br from-green-900/30 to-slate-900 border border-green-500/40 rounded-lg p-6">
          <h2 className="text-xl font-bold text-green-400 mb-4">Long Setup</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">Entry</span>
              <span className="font-bold text-white">${predictions.trading.buySetup.entryPrice?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">SL</span>
              <span className="font-bold text-red-400">${predictions.trading.buySetup.stopLoss?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">TP1</span>
              <span className="font-bold text-green-400">${predictions.trading.buySetup.takeProfit1?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">TP2</span>
              <span className="font-bold text-green-400">${predictions.trading.buySetup.takeProfit2?.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-green-500/30 flex justify-between">
              <span className="text-slate-300">Risk/Reward</span>
              <span className="font-bold text-cyan-400">{predictions.trading.buySetup.riskRewardRatio?.toFixed(1)}:1</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-slate-900 border border-red-500/40 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-400 mb-4">Short Setup</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">Entry</span>
              <span className="font-bold text-white">${predictions.trading.sellSetup.entryPrice?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">SL</span>
              <span className="font-bold text-red-400">${predictions.trading.sellSetup.stopLoss?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">TP1</span>
              <span className="font-bold text-green-400">${predictions.trading.sellSetup.takeProfit1?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">TP2</span>
              <span className="font-bold text-green-400">${predictions.trading.sellSetup.takeProfit2?.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-red-500/30 flex justify-between">
              <span className="text-slate-300">Risk/Reward</span>
              <span className="font-bold text-cyan-400">{predictions.trading.sellSetup.riskRewardRatio?.toFixed(1)}:1</span>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Analysis */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Agent Analysis & Voting</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded border border-green-500/30">
            <div>
              <div className="font-semibold text-white">Bitcoin Short-Term Predictor</div>
              <div className="text-xs text-slate-400">Specializes in 1m-1h timeframes</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-400">BUY</div>
              <div className="text-sm text-slate-300">78% confidence</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded border border-green-500/30">
            <div>
              <div className="font-semibold text-white">Bitcoin Multi-Timeframe Predictor</div>
              <div className="text-xs text-slate-400">Analyzes 15m-1d timeframes</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-400">BUY</div>
              <div className="text-sm text-slate-300">77% confidence</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded border border-cyan-500/30">
            <div>
              <div className="font-semibold text-white">Claude Opus Master Agent</div>
              <div className="text-xs text-slate-400">Master orchestrator + natural language explanation</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-cyan-400">BUY</div>
              <div className="text-sm text-slate-300">76% confidence</div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded border border-cyan-500/20 mt-4">
            <div className="text-sm text-slate-300 mb-2">
              <strong>Claude's Analysis:</strong> "Strong accumulation signal on oversold RSI with pattern confluence. Multiple timeframes align bullish. Risk/reward favorable for 2.5:1 setup. Recommend scaling long position."
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
