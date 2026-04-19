// AUTONOMOUS PREDICTION AGENT
// Consensus-scored BUY/SELL/HOLD decisions across multiple timeframes.
// Produces Bloomberg-format output: "BTC will reach $X in N minutes (Confidence: YY%)"

'use strict';

const ind = require('./indicators');
const mte = require('./multiTimeframeTradingEngine');

// Minutes-ahead horizon for each timeframe (prediction reach forward)
const HORIZON_MIN = { '1m': 5, '5m': 15, '15m': 30, '30m': 60, '1h': 120, '4h': 360, '1d': 1440, '1w': 10080 };

function scoreSignals(ana) {
  if (!ana) return { buy: 0, sell: 0, notes: [] };
  let buy = 0, sell = 0;
  const notes = [];
  const { price, trend, momentum, volatility, volume } = ana;

  // RSI
  if (momentum.rsi != null) {
    if (momentum.rsi < 30) { buy += 2; notes.push(`RSI oversold (${momentum.rsi.toFixed(1)})`); }
    else if (momentum.rsi > 70) { sell += 2; notes.push(`RSI overbought (${momentum.rsi.toFixed(1)})`); }
    else if (momentum.rsi > 50) { buy += 0.5; }
    else if (momentum.rsi < 50) { sell += 0.5; }
  }

  // Stochastic RSI
  if (momentum.stochRsi) {
    if (momentum.stochRsi.k < 20 && momentum.stochRsi.k > momentum.stochRsi.d) { buy += 1; notes.push("StochRSI bullish reversal"); }
    if (momentum.stochRsi.k > 80 && momentum.stochRsi.k < momentum.stochRsi.d) { sell += 1; notes.push("StochRSI bearish reversal"); }
  }

  // MACD
  if (trend.macd) {
    if (trend.macd.histogram > 0 && trend.macd.line > trend.macd.signal) { buy += 2; notes.push("MACD bullish crossover"); }
    if (trend.macd.histogram < 0 && trend.macd.line < trend.macd.signal) { sell += 2; notes.push("MACD bearish crossover"); }
  }

  // ADX — trend strength amplifies directional signals
  const strongTrend = trend.adx && trend.adx.adx > 25;
  if (trend.adx) {
    if (strongTrend && trend.adx.plusDI > trend.adx.minusDI) { buy += 1.5; notes.push(`ADX strong uptrend (${trend.adx.adx.toFixed(1)})`); }
    if (strongTrend && trend.adx.minusDI > trend.adx.plusDI) { sell += 1.5; notes.push(`ADX strong downtrend (${trend.adx.adx.toFixed(1)})`); }
  }

  // Supertrend
  if (trend.supertrend) {
    if (trend.supertrend.trend === "UP") { buy += 1.5; notes.push("Supertrend UP"); }
    else { sell += 1.5; notes.push("Supertrend DOWN"); }
  }

  // EMA stack
  if (trend.ema?.[21] && trend.ema?.[50]) {
    if (price > trend.ema[21] && trend.ema[21] > trend.ema[50]) { buy += 1; notes.push("Price > EMA21 > EMA50"); }
    if (price < trend.ema[21] && trend.ema[21] < trend.ema[50]) { sell += 1; notes.push("Price < EMA21 < EMA50"); }
  }

  // Bollinger Bands
  if (volatility.bb) {
    if (price < volatility.bb.lower) { buy += 1; notes.push("Price at/below BB lower"); }
    if (price > volatility.bb.upper) { sell += 1; notes.push("Price at/above BB upper"); }
    if (volatility.bb.squeeze) notes.push("BB squeeze — breakout imminent");
  }

  // Ichimoku cloud
  if (trend.ichimoku) {
    if (trend.ichimoku.aboveCloud) { buy += 1; notes.push("Ichimoku: above cloud"); }
    if (trend.ichimoku.belowCloud) { sell += 1; notes.push("Ichimoku: below cloud"); }
  }

  // CCI
  if (momentum.cci != null) {
    if (momentum.cci < -100) { buy += 0.5; notes.push(`CCI oversold (${momentum.cci.toFixed(0)})`); }
    if (momentum.cci > 100)  { sell += 0.5; notes.push(`CCI overbought (${momentum.cci.toFixed(0)})`); }
  }

  // Williams %R
  if (momentum.williamsR != null) {
    if (momentum.williamsR < -80) { buy += 0.5; notes.push("Williams %R oversold"); }
    if (momentum.williamsR > -20) { sell += 0.5; notes.push("Williams %R overbought"); }
  }

  // MFI
  if (volume.mfi != null) {
    if (volume.mfi < 20) { buy += 1; notes.push(`MFI oversold (${volume.mfi.toFixed(0)})`); }
    if (volume.mfi > 80) { sell += 1; notes.push(`MFI overbought (${volume.mfi.toFixed(0)})`); }
  }

  // OBV trend
  if (volume.obvTrend === "INCREASING") { buy += 0.5; notes.push("OBV increasing"); }
  if (volume.obvTrend === "DECREASING") { sell += 0.5; notes.push("OBV decreasing"); }

  // Volume spike
  if (volume.volumeRatio != null && volume.volumeRatio > 1.5) notes.push(`Volume surge (${volume.volumeRatio.toFixed(2)}x)`);

  // Awesome Oscillator
  if (momentum.awesome != null) {
    if (momentum.awesome > 0) buy += 0.5;
    else sell += 0.5;
  }

  return { buy, sell, notes };
}

function classify(buy, sell) {
  const total = buy + sell;
  if (total === 0) return { signal: "HOLD", confidence: 50 };
  const dominant = Math.max(buy, sell);
  const confidence = Math.round((dominant / total) * 100);

  if (buy > sell * 1.5 && confidence >= 75 && buy >= 6) return { signal: "STRONG BUY", confidence };
  if (buy > sell && confidence >= 60) return { signal: "BUY", confidence };
  if (sell > buy * 1.5 && confidence >= 75 && sell >= 6) return { signal: "STRONG SELL", confidence };
  if (sell > buy && confidence >= 60) return { signal: "SELL", confidence };
  return { signal: "HOLD", confidence };
}

function predictPrice(signal, price, atr, confidence) {
  const multHi = confidence >= 80 ? 3 : confidence >= 70 ? 2 : 1.5;
  const multLo = 1.5;
  const slPad = atr * 1.5;
  if (signal.includes("BUY")) {
    return {
      direction: "UP",
      target: price + atr * multHi,
      tp1: price + atr * multLo,
      tp2: price + atr * multHi,
      stopLoss: price - slPad,
    };
  }
  if (signal.includes("SELL")) {
    return {
      direction: "DOWN",
      target: price - atr * multHi,
      tp1: price - atr * multLo,
      tp2: price - atr * multHi,
      stopLoss: price + slPad,
    };
  }
  return { direction: "FLAT", target: price, tp1: price, tp2: price, stopLoss: price };
}

function formatPrediction(symbol, signal, target, minutes, confidence) {
  return `${symbol} will reach $${target.toLocaleString(undefined, { maximumFractionDigits: 2 })} in ${minutes} minutes (Confidence: ${confidence}%)`;
}

function analyzePair(pair, timeframe = '5m') {
  const candles = mte.getCandles(pair, timeframe);
  if (!candles || candles.length < 50) return null;
  const analysis = ind.computeAll(candles);
  if (!analysis) return null;

  const { buy, sell, notes } = scoreSignals(analysis);
  const { signal, confidence } = classify(buy, sell);
  const atr = analysis.volatility.atr || (analysis.price * 0.002);
  const prices = predictPrice(signal, analysis.price, atr, confidence);
  const minutes = HORIZON_MIN[timeframe] || 5;

  return {
    symbol: pair,
    timeframe,
    horizonMinutes: minutes,
    currentPrice: analysis.price,
    signal,
    confidence,
    prediction: formatPrediction(pair, signal, prices.target, minutes, confidence),
    targetPrice: prices.target,
    tp1: prices.tp1,
    tp2: prices.tp2,
    stopLoss: prices.stopLoss,
    riskReward: Math.abs((prices.tp1 - analysis.price) / (analysis.price - prices.stopLoss || 1)),
    supportingSignals: notes,
    scores: { buy: Math.round(buy * 10) / 10, sell: Math.round(sell * 10) / 10 },
    indicators: analysis,
    timestamp: new Date().toISOString(),
  };
}

// Multi-timeframe consensus — aggregates signals across 1m, 5m, 15m, 1h, 4h, 1d
function consensus(pair) {
  const tfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  const breakdown = {};
  let buyCount = 0, sellCount = 0, holdCount = 0;
  let totalConf = 0, validCount = 0;

  for (const tf of tfs) {
    const a = analyzePair(pair, tf);
    if (!a) { breakdown[tf] = null; continue; }
    breakdown[tf] = { signal: a.signal, confidence: a.confidence, target: a.targetPrice };
    if (a.signal.includes("BUY")) buyCount++;
    else if (a.signal.includes("SELL")) sellCount++;
    else holdCount++;
    totalConf += a.confidence;
    validCount++;
  }

  let overall = "HOLD";
  if (buyCount > sellCount && buyCount >= 4) overall = buyCount >= 6 ? "STRONG BUY" : "BUY";
  else if (sellCount > buyCount && sellCount >= 4) overall = sellCount >= 6 ? "STRONG SELL" : "SELL";

  return {
    overallSignal: overall,
    avgConfidence: validCount ? Math.round(totalConf / validCount) : 0,
    agreedTimeframes: Object.entries(breakdown).filter(([, v]) => v?.signal?.includes(overall.split(' ')[0] === 'STRONG' ? overall.split(' ')[1] : overall)).map(([k]) => k),
    breakdown,
  };
}

module.exports = { analyzePair, consensus, scoreSignals, classify, formatPrediction };
