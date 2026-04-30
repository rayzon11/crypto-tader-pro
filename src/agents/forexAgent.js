// FOREX AGENT
// Scalping strategies on 1m, 5m, 15m timeframes
// Handles EUR/USD, GBP/USD, USD/JPY, and crypto pairs on Forex

const BaseAgent = require('./baseAgent');

class ForexAgent extends BaseAgent {
  constructor(name = 'ForexAgent', timeframe = '5m') {
    super(name, 'forex');
    this.timeframe = timeframe; // 1m, 5m, 15m
    this.minWinRate = 0.55; // Min 55% win rate for forex
    this.maxLeverage = 2; // 2:1 max leverage for forex
    this.scalping = true;
    this.targets = {
      '1m': { profitTarget: 0.005, stopLoss: 0.003 }, // 5-10 pips
      '5m': { profitTarget: 0.01, stopLoss: 0.005 },  // 10-20 pips
      '15m': { profitTarget: 0.02, stopLoss: 0.01 }   // 20-30 pips
    };
  }

  /**
   * Analyze forex pair for trading opportunity
   */
  async analyzeForexPair(symbol, klines, currentQuote) {
    const analysis = {
      symbol,
      timeframe: this.timeframe,
      timestamp: new Date().toISOString(),
      signals: []
    };

    if (!klines || klines.length < 20) {
      return { ...analysis, decision: 'HOLD', reason: 'Insufficient data' };
    }

    // 1m Timeframe: Ultra-tight scalping (30-50 pips per trade)
    if (this.timeframe === '1m') {
      const signal1m = this.analyze1mScalp(klines, currentQuote);
      analysis.signals.push(signal1m);
    }

    // 5m Timeframe: Quick scalping (50-100 pips per trade)
    if (this.timeframe === '5m') {
      const signal5m = this.analyze5mScalp(klines, currentQuote);
      analysis.signals.push(signal5m);
    }

    // 15m Timeframe: Swing scalping (100-300 pips per trade)
    if (this.timeframe === '15m') {
      const signal15m = this.analyze15mSwing(klines, currentQuote);
      analysis.signals.push(signal15m);
    }

    // Aggregate signals
    const decision = this.aggregateSignals(analysis.signals);

    return {
      ...analysis,
      decision: decision.type,
      confidence: decision.confidence,
      entry: decision.entry,
      stopLoss: decision.stopLoss,
      takeProfit: decision.takeProfit,
      reason: decision.reason
    };
  }

  /**
   * 1-MINUTE SCALPING
   * Ultra-fast entry/exit, tight stops, 30-50 pips per trade
   * Uses: Bollinger Bands, RSI, MACD
   */
  analyze1mScalp(klines, currentQuote) {
    const closes = klines.map(k => k.close);
    const opens = klines.map(k => k.open);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);

    // BB on 1m (20, 2)
    const bb = this.bollingerBands(closes, 20, 2);
    const upperBand = bb[bb.length - 1].upper;
    const lowerBand = bb[bb.length - 1].lower;
    const midBand = bb[bb.length - 1].middle;

    // RSI(14) on 1m
    const rsi = this.calculateRSI(closes, 14);
    const currentRsi = rsi[rsi.length - 1];

    // MACD on 1m
    const macd = this.calculateMACD(closes, 12, 26, 9);
    const currentMacd = macd[macd.length - 1];
    const signal = currentMacd.signal;
    const histogram = currentMacd.macd - signal;

    const price = currentQuote.price;

    // BULLISH 1m SIGNAL
    if (
      price <= lowerBand && // Price at lower band
      currentRsi < 30 && // RSI oversold
      histogram > 0 && // MACD histogram positive
      currentMacd.macd > signal // MACD above signal line
    ) {
      return {
        type: 'BUY',
        confidence: 0.72,
        entry: price,
        stopLoss: price - (price * 0.003), // 30 pips stop
        takeProfit: price + (price * 0.005), // 50 pips target
        reason: '1m: BB squeeze + RSI oversold + MACD bullish',
        riskReward: 1.67
      };
    }

    // BEARISH 1m SIGNAL
    if (
      price >= upperBand && // Price at upper band
      currentRsi > 70 && // RSI overbought
      histogram < 0 && // MACD histogram negative
      currentMacd.macd < signal // MACD below signal line
    ) {
      return {
        type: 'SELL',
        confidence: 0.72,
        entry: price,
        stopLoss: price + (price * 0.003),
        takeProfit: price - (price * 0.005),
        reason: '1m: BB squeeze + RSI overbought + MACD bearish',
        riskReward: 1.67
      };
    }

    return { type: 'HOLD', confidence: 0, reason: '1m: No setup detected' };
  }

  /**
   * 5-MINUTE SCALPING
   * Quick entry/exit, 50-100 pips per trade
   * Uses: EMA crossover, Stochastic RSI, ATR
   */
  analyze5mScalp(klines, currentQuote) {
    const closes = klines.map(k => k.close);
    const volumes = klines.map(k => k.volume);

    // EMA 9 vs EMA 21
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    const prevEma9 = ema9[ema9.length - 2];
    const prevEma21 = ema21[ema21.length - 2];

    // ATR(14) for stop sizing
    const atr = this.calculateATR(klines, 14);
    const currentAtr = atr[atr.length - 1];

    // Stochastic RSI
    const stochRsi = this.calculateStochasticRSI(closes, 14, 3, 3);
    const currentStochRsi = stochRsi[stochRsi.length - 1];

    const price = currentQuote.price;
    const volume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;

    // BULLISH 5m EMA CROSSOVER
    if (
      prevEma9 <= prevEma21 && // EMA9 crosses above EMA21
      currentEma9 > currentEma21 &&
      currentStochRsi.k < 20 && // Oversold stochastic
      volume > avgVolume * 1.2 // Volume confirmation
    ) {
      return {
        type: 'BUY',
        confidence: 0.68,
        entry: price,
        stopLoss: price - currentAtr,
        takeProfit: price + (currentAtr * 2),
        reason: '5m: EMA9 > EMA21 + Stoch oversold + vol confirm',
        riskReward: 2.0
      };
    }

    // BEARISH 5m EMA CROSSOVER
    if (
      prevEma9 >= prevEma21 && // EMA9 crosses below EMA21
      currentEma9 < currentEma21 &&
      currentStochRsi.k > 80 && // Overbought stochastic
      volume > avgVolume * 1.2
    ) {
      return {
        type: 'SELL',
        confidence: 0.68,
        entry: price,
        stopLoss: price + currentAtr,
        takeProfit: price - (currentAtr * 2),
        reason: '5m: EMA9 < EMA21 + Stoch overbought + vol confirm',
        riskReward: 2.0
      };
    }

    return { type: 'HOLD', confidence: 0, reason: '5m: No crossover detected' };
  }

  /**
   * 15-MINUTE SWING
   * Higher probability, 100-300 pips per trade
   * Uses: Support/Resistance, Trend confirmation, RSI
   */
  analyze15mSwing(klines, currentQuote) {
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);

    // Identify support/resistance
    const support = Math.min(...lows.slice(-14));
    const resistance = Math.max(...highs.slice(-14));

    // RSI(14)
    const rsi = this.calculateRSI(closes, 14);
    const currentRsi = rsi[rsi.length - 1];

    // Trend (SMA50 > SMA200 = uptrend)
    const sma50 = this.calculateSMA(closes, 50);
    const sma200 = this.calculateSMA(closes, 200);
    const currentSma50 = sma50[sma50.length - 1];
    const currentSma200 = sma200[sma200.length - 1];
    const uptrend = currentSma50 > currentSma200;

    const price = currentQuote.price;
    const range = resistance - support;

    // BULLISH 15m at support + uptrend
    if (
      Math.abs(price - support) < (range * 0.05) && // Price near support (within 5%)
      uptrend && // Uptrend
      currentRsi > 40 && currentRsi < 60 // RSI neutral
    ) {
      return {
        type: 'BUY',
        confidence: 0.75,
        entry: price,
        stopLoss: support - (range * 0.05),
        takeProfit: resistance + (range * 0.1),
        reason: '15m: Bounce at support + uptrend + neutral RSI',
        riskReward: 2.5
      };
    }

    // BEARISH 15m at resistance + downtrend
    if (
      Math.abs(price - resistance) < (range * 0.05) && // Price near resistance
      !uptrend && // Downtrend
      currentRsi > 40 && currentRsi < 60
    ) {
      return {
        type: 'SELL',
        confidence: 0.75,
        entry: price,
        stopLoss: resistance + (range * 0.05),
        takeProfit: support - (range * 0.1),
        reason: '15m: Rejection at resistance + downtrend + neutral RSI',
        riskReward: 2.5
      };
    }

    return { type: 'HOLD', confidence: 0, reason: '15m: No setup detected' };
  }

  /**
   * Aggregate signals from all timeframes
   */
  aggregateSignals(signals) {
    const buys = signals.filter(s => s.type === 'BUY').length;
    const sells = signals.filter(s => s.type === 'SELL').length;
    const holds = signals.filter(s => s.type === 'HOLD').length;

    // Majority vote
    if (buys > sells && buys > holds) {
      const buySignals = signals.filter(s => s.type === 'BUY');
      const avgConfidence = buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length;

      return {
        type: 'BUY',
        confidence: Math.min(0.95, avgConfidence * 1.1),
        entry: buySignals[0].entry,
        stopLoss: Math.min(...buySignals.map(s => s.stopLoss)),
        takeProfit: Math.max(...buySignals.map(s => s.takeProfit)),
        reason: `Consensus BUY: ${buys} timeframes aligned`
      };
    }

    if (sells > buys && sells > holds) {
      const sellSignals = signals.filter(s => s.type === 'SELL');
      const avgConfidence = sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length;

      return {
        type: 'SELL',
        confidence: Math.min(0.95, avgConfidence * 1.1),
        entry: sellSignals[0].entry,
        stopLoss: Math.max(...sellSignals.map(s => s.stopLoss)),
        takeProfit: Math.min(...sellSignals.map(s => s.takeProfit)),
        reason: `Consensus SELL: ${sells} timeframes aligned`
      };
    }

    return {
      type: 'HOLD',
      confidence: 0,
      reason: 'No consensus across timeframes'
    };
  }

  // ─── INDICATOR CALCULATIONS ───

  calculateSMA(values, period) {
    return values.map((val, i, arr) => {
      if (i < period - 1) return null;
      const sum = arr.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
      return sum / period;
    });
  }

  calculateEMA(values, period) {
    const k = 2 / (period + 1);
    return values.reduce((ema, val, i) => {
      if (i === 0) return [...ema, val];
      const prevEMA = ema[ema.length - 1];
      return [...ema, val * k + prevEMA * (1 - k)];
    }, []);
  }

  calculateRSI(values, period) {
    const changes = values.slice(1).map((val, i) => val - values[i]);
    const gains = changes.map(c => (c > 0 ? c : 0));
    const losses = changes.map(c => (c < 0 ? -c : 0));

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    return changes.map((change, i) => {
      if (i < period) return 50;
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgGain / (avgLoss || 0.0001);
      return 100 - (100 / (1 + rs));
    });
  }

  calculateMACD(values, fastPeriod, slowPeriod, signalPeriod) {
    const emaFast = this.calculateEMA(values, fastPeriod);
    const emaSlow = this.calculateEMA(values, slowPeriod);

    const macdLine = emaFast.map((fast, i) => (fast && emaSlow[i] ? fast - emaSlow[i] : 0));
    const signalLine = this.calculateEMA(macdLine, signalPeriod);

    return macdLine.map((macd, i) => ({
      macd,
      signal: signalLine[i],
      histogram: macd - signalLine[i]
    }));
  }

  bollingerBands(values, period, stdDev) {
    const sma = this.calculateSMA(values, period);

    return sma.map((middle, i) => {
      if (!middle) return null;
      const slice = values.slice(Math.max(0, i - period + 1), i + 1);
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / slice.length;
      const std = Math.sqrt(variance);

      return {
        middle,
        upper: middle + (std * stdDev),
        lower: middle - (std * stdDev)
      };
    });
  }

  calculateATR(klines, period) {
    const tr = klines.map((k, i) => {
      if (i === 0) return k.high - k.low;
      const prev = klines[i - 1];
      return Math.max(
        k.high - k.low,
        Math.abs(k.high - prev.close),
        Math.abs(k.low - prev.close)
      );
    });

    return tr.map((val, i, arr) => {
      if (i < period - 1) return null;
      return arr.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
    });
  }

  calculateStochasticRSI(values, rsiPeriod, kPeriod, dPeriod) {
    const rsi = this.calculateRSI(values, rsiPeriod);
    const minRsi = Math.min(...rsi.filter(v => v).slice(-kPeriod));
    const maxRsi = Math.max(...rsi.filter(v => v).slice(-kPeriod));

    const stochRsiK = rsi.map(r => (r ? ((r - minRsi) / (maxRsi - minRsi)) * 100 : null));
    const stochRsiD = this.calculateSMA(stochRsiK.filter(v => v), dPeriod);

    return stochRsiK.map((k, i) => ({
      k: k || 50,
      d: stochRsiD[i] || 50
    }));
  }
}

module.exports = ForexAgent;
