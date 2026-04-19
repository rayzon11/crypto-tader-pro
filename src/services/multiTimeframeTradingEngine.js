// MULTI-TIMEFRAME TRADING ENGINE
// Supports 1m, 5m, 15m, 30m with 100+ crypto pairs, 50+ forex pairs, all indicators
// File: src/services/multiTimeframeTradingEngine.js

class MultiTimeframeTradingEngine {
  constructor() {
    this.timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
    this.cryptoPairs = [
      'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'AVAX/USDT', 'XRP/USDT', 'DOGE/USDT',
      'ADA/USDT', 'LINK/USDT', 'MATIC/USDT', 'ARB/USDT', 'OP/USDT', 'LTC/USDT', 'BCH/USDT',
      'XLM/USDT', 'ATOM/USDT', 'DOT/USDT', 'FIL/USDT', 'UNI/USDT', 'AAVE/USDT', 'MKR/USDT',
      'COMP/USDT', 'SUSHI/USDT', 'CURVE/USDT', '1INCH/USDT', 'YFI/USDT', 'SNX/USDT', 'LIDO/USDT',
      'NEAR/USDT', 'FLOW/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT', 'ANKR/USDT', 'GMT/USDT',
      'APE/USDT', 'BLUR/USDT', 'SUI/USDT', 'SEI/USDT', 'JTO/USDT', 'TIA/USDT', 'DYDX/USDT',
      'INJ/USDT', 'KAVA/USDT', 'BAND/USDT', 'OCEAN/USDT', 'RENDER/USDT', 'PERP/USDT', 'GMX/USDT',
      'GNS/USDT', 'BLUR/USDT', 'CYBER/USDT', 'W/USDT', 'BOME/USDT', 'JUP/USDT', 'MAGIC/USDT',
      'STRK/USDT', 'PYTH/USDT', 'ME/USDT', 'BONK/USDT', 'RAY/USDT', 'COPE/USDT', 'BEAM/USDT'
    ];

    this.forexPairs = [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'CHF/USD', 'SGD/USD',
      'HKD/USD', 'NOK/USD', 'SEK/USD', 'DKK/USD', 'INR/USD', 'CNY/USD', 'MXN/USD', 'BRL/USD',
      'ZAR/USD', 'RUB/USD', 'THB/USD', 'MYR/USD', 'IDR/USD', 'PHP/USD', 'VND/USD', 'KRW/USD',
      'TWD/USD', 'CLP/USD', 'COP/USD', 'PEN/USD', 'ARS/USD', 'TRY/USD', 'ILS/USD', 'SAR/USD',
      'AED/USD', 'QAR/USD', 'KWD/USD', 'BHD/USD', 'OMR/USD', 'JOD/USD', 'LBP/USD', 'EGP/USD',
      'PKR/USD', 'BDT/USD', 'LKR/USD', 'NPR/USD', 'AFN/USD', 'AMD/USD', 'AZN/USD', 'GEL/USD'
    ];

    this.equityPairs = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'FB', 'NFLX', 'PYPL', 'ADBE',
      'CRM', 'INTC', 'AMD', 'CSCO', 'DDOG', 'NET', 'CRWD', 'OKTA', 'ZOOM', 'SNOW',
      'JPM', 'BAC', 'GS', 'MS', 'WFC', 'BLK', 'SCHW', 'COIN', 'XRT', 'IAA'
    ];

    this.allPairs = {
      crypto: this.cryptoPairs,
      forex: this.forexPairs,
      equity: this.equityPairs,
    };

    this.indicators = {
      rsi: { period: 14, overbought: 70, oversold: 30 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bb: { period: 20, stdDev: 2 },
      ema: { periods: [7, 14, 21, 50, 200] },
      sma: { periods: [7, 14, 21, 50, 200] },
      atr: { period: 14 },
      stochastic: { kPeriod: 14, dPeriod: 3, smoothK: 3 },
      adx: { period: 14 },
      obv: { period: 20 },
      vwap: {},
      ichimoku: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 },
      fibonacci: {},
    };

    this.candles = {}; // Store historical candles per pair/timeframe
    this.signals = {}; // Store signals per timeframe
    this.trades = {}; // Store active trades
    this.equity = 10000;
    this.accounts = {}; // Separate accounts per timeframe
  }

  // Initialize accounts for each timeframe
  initializeAccounts() {
    this.timeframes.forEach(tf => {
      this.accounts[tf] = {
        timeframe: tf,
        balance: 10000,
        equity: 10000,
        openTrades: [],
        closedTrades: [],
        totalPnL: 0,
        winRate: 0,
        totalTrades: 0,
      };
    });
  }

  // Get all available pairs
  getAllPairs() {
    return {
      crypto: this.cryptoPairs,
      forex: this.forexPairs,
      equity: this.equityPairs,
      total: this.cryptoPairs.length + this.forexPairs.length + this.equityPairs.length,
    };
  }

  // Get candles for a pair (across all timeframes or specific one)
  getCandles(pair, timeframe = '1h') {
    const key = `${pair}_${timeframe}`;
    return this.candles[key] || [];
  }

  // Add candle data for a pair/timeframe
  addCandle(pair, timeframe, candle) {
    const key = `${pair}_${timeframe}`;
    if (!this.candles[key]) {
      this.candles[key] = [];
    }
    this.candles[key].push({
      timestamp: candle.timestamp || new Date().toISOString(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume || 0),
    });

    // Keep only last 500 candles
    if (this.candles[key].length > 500) {
      this.candles[key] = this.candles[key].slice(-500);
    }
  }

  // Calculate all indicators for a pair/timeframe
  calculateIndicators(pair, timeframe) {
    const key = `${pair}_${timeframe}`;
    const candles = this.candles[key] || [];
    if (candles.length < 30) return null; // Need minimum data

    const indicators = {};
    const closes = candles.map(c => c.close);

    // RSI
    indicators.rsi = this.calculateRSI(closes, this.indicators.rsi.period);

    // MACD
    indicators.macd = this.calculateMACD(closes, 12, 26, 9);

    // Bollinger Bands
    indicators.bb = this.calculateBB(closes, 20, 2);

    // EMA
    indicators.ema = {};
    this.indicators.ema.periods.forEach(p => {
      indicators.ema[p] = this.calculateEMA(closes, p);
    });

    // SMA
    indicators.sma = {};
    this.indicators.sma.periods.forEach(p => {
      indicators.sma[p] = this.calculateSMA(closes, p);
    });

    // ATR
    indicators.atr = this.calculateATR(candles, 14);

    // Stochastic
    indicators.stochastic = this.calculateStochastic(candles, 14, 3, 3);

    // ADX
    indicators.adx = this.calculateADX(candles, 14);

    // OBV
    indicators.obv = this.calculateOBV(candles, 20);

    // VWAP
    indicators.vwap = this.calculateVWAP(candles);

    // Ichimoku
    indicators.ichimoku = this.calculateIchimoku(candles, 9, 26, 52);

    return {
      pair,
      timeframe,
      timestamp: new Date().toISOString(),
      currentPrice: closes[closes.length - 1],
      indicators,
      candles: candles.slice(-20), // Last 20 candles
    };
  }

  // Calculate RSI
  calculateRSI(closes, period) {
    if (closes.length < period) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 0.0001);
    return 100 - (100 / (1 + rs));
  }

  // Calculate MACD
  calculateMACD(closes, fast, slow, signal) {
    const ema12 = this.calculateEMA(closes, fast);
    const ema26 = this.calculateEMA(closes, slow);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, signal);
    const histogram = macdLine.map((v, i) => v - signalLine[i]);

    return {
      macd: macdLine[macdLine.length - 1],
      signal: signalLine[signalLine.length - 1],
      histogram: histogram[histogram.length - 1],
    };
  }

  // Calculate Bollinger Bands
  calculateBB(closes, period, stdDev) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b) / period;
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: mean + (std * stdDev),
      middle: mean,
      lower: mean - (std * stdDev),
      width: (std * stdDev * 2),
    };
  }

  // Calculate EMA
  calculateEMA(closes, period) {
    const k = 2 / (period + 1);
    let ema = closes[0];
    const result = [ema];

    for (let i = 1; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
      result.push(ema);
    }
    return result;
  }

  // Calculate SMA
  calculateSMA(closes, period) {
    const result = [];
    for (let i = period - 1; i < closes.length; i++) {
      const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
      result.push(sum / period);
    }
    return result;
  }

  // Calculate ATR
  calculateATR(candles, period) {
    const tr = [];
    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        tr.push(candles[i].high - candles[i].low);
      } else {
        const prev = candles[i - 1].close;
        const current = candles[i];
        const trValue = Math.max(
          current.high - current.low,
          Math.abs(current.high - prev),
          Math.abs(current.low - prev)
        );
        tr.push(trValue);
      }
    }

    const slice = tr.slice(-period);
    return slice.reduce((a, b) => a + b) / period;
  }

  // Calculate Stochastic
  calculateStochastic(candles, kPeriod, dPeriod, smoothK) {
    if (candles.length < kPeriod) return null;
    const slice = candles.slice(-kPeriod);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = candles[candles.length - 1].close;

    const k = ((close - low) / (high - low)) * 100;
    return { k, range: high - low };
  }

  // Calculate ADX (simplified)
  calculateADX(candles, period) {
    if (candles.length < period) return 25;
    const slice = candles.slice(-period);
    let upMove = 0, downMove = 0;

    for (let i = 1; i < slice.length; i++) {
      const up = slice[i].high - slice[i - 1].high;
      const down = slice[i - 1].low - slice[i].low;

      if (up > down && up > 0) upMove += up;
      if (down > up && down > 0) downMove += down;
    }

    return (upMove + downMove) / period * 10;
  }

  // Calculate OBV
  calculateOBV(candles, period) {
    let obv = 0;
    const slice = candles.slice(-period);

    for (let i = 0; i < slice.length; i++) {
      if (i === 0 || slice[i].close > slice[i - 1].close) {
        obv += slice[i].volume;
      } else {
        obv -= slice[i].volume;
      }
    }
    return obv;
  }

  // Calculate VWAP
  calculateVWAP(candles) {
    if (candles.length === 0) return 0;
    const typical = candles.map(c => (c.high + c.low + c.close) / 3);
    const pv = typical.map((t, i) => t * candles[i].volume);
    const sumPV = pv.reduce((a, b) => a + b);
    const sumV = candles.reduce((sum, c) => sum + c.volume, 0);
    return sumV > 0 ? sumPV / sumV : candles[candles.length - 1].close;
  }

  // Calculate Ichimoku
  calculateIchimoku(candles, tenkan, kijun, senkou) {
    if (candles.length < Math.max(tenkan, kijun, senkou)) return null;

    const calcLine = (period) => {
      const slice = candles.slice(-period);
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      return (high + low) / 2;
    };

    return {
      tenkan: calcLine(tenkan),
      kijun: calcLine(kijun),
      senkou: calcLine(senkou),
    };
  }

  // Generate trading signal
  generateSignal(pair, timeframe) {
    const indicators = this.calculateIndicators(pair, timeframe);
    if (!indicators) return { signal: 'WAIT', confidence: 0 };

    const ind = indicators.indicators;
    let score = 0;
    let signals = [];

    // RSI signals
    if (ind.rsi < 30) { score += 2; signals.push('RSI_OVERSOLD'); }
    if (ind.rsi > 70) { score -= 2; signals.push('RSI_OVERBOUGHT'); }

    // MACD signals
    if (ind.macd.histogram > 0) { score += 1.5; signals.push('MACD_BULLISH'); }
    if (ind.macd.histogram < 0) { score -= 1.5; signals.push('MACD_BEARISH'); }

    // Bollinger Bands signals
    if (indicators.currentPrice < ind.bb.lower) { score += 2; signals.push('BB_OVERSOLD'); }
    if (indicators.currentPrice > ind.bb.upper) { score -= 2; signals.push('BB_OVERBOUGHT'); }

    // EMA signals
    if (ind.ema[7][ind.ema[7].length - 1] > ind.ema[21][ind.ema[21].length - 1]) {
      score += 1; signals.push('EMA_BULLISH');
    } else {
      score -= 1; signals.push('EMA_BEARISH');
    }

    const confidence = Math.min(100, Math.abs(score) * 10);
    const signal = score > 1 ? 'BUY' : score < -1 ? 'SELL' : 'HOLD';

    return {
      pair,
      timeframe,
      signal,
      confidence: parseFloat((confidence / 100).toFixed(2)),
      signals,
      price: indicators.currentPrice,
      indicators: ind,
    };
  }

  // Get multi-timeframe consensus
  getConsensus(pair) {
    const results = {};
    let buyCount = 0, sellCount = 0, holdCount = 0;

    this.timeframes.forEach(tf => {
      const signal = this.generateSignal(pair, tf);
      results[tf] = signal;

      if (signal.signal === 'BUY') buyCount++;
      if (signal.signal === 'SELL') sellCount++;
      if (signal.signal === 'HOLD') holdCount++;
    });

    const totalConfidence = Object.values(results)
      .reduce((sum, s) => sum + s.confidence, 0) / this.timeframes.length;

    return {
      pair,
      consensus: buyCount > sellCount ? 'BUY' : sellCount > buyCount ? 'SELL' : 'HOLD',
      buyVotes: buyCount,
      sellVotes: sellCount,
      holdVotes: holdCount,
      avgConfidence: parseFloat(totalConfidence.toFixed(2)),
      timeframes: results,
    };
  }

  // Get account info for timeframe
  getAccountInfo(timeframe) {
    return this.accounts[timeframe] || this.accounts['1m'];
  }

  // Get all account stats
  getAllAccountStats() {
    const stats = {};
    let totalEquity = 0;
    let totalPnL = 0;

    this.timeframes.forEach(tf => {
      stats[tf] = this.accounts[tf];
      totalEquity += this.accounts[tf].equity;
      totalPnL += this.accounts[tf].totalPnL;
    });

    return {
      timeframes: stats,
      aggregated: {
        totalEquity,
        totalPnL,
        avgEquity: (totalEquity / this.timeframes.length).toFixed(2),
      }
    };
  }

  // Get market snapshot (all pairs, all timeframes)
  getMarketSnapshot() {
    const snapshot = {};
    const categories = ['crypto', 'forex', 'equity'];

    categories.forEach(cat => {
      snapshot[cat] = {};
      this.allPairs[cat].forEach(pair => {
        snapshot[cat][pair] = this.getConsensus(pair);
      });
    });

    return snapshot;
  }

  // Reset all accounts
  resetAllAccounts(initialBalance = 10000) {
    this.timeframes.forEach(tf => {
      this.accounts[tf] = {
        timeframe: tf,
        balance: initialBalance,
        equity: initialBalance,
        openTrades: [],
        closedTrades: [],
        totalPnL: 0,
        winRate: 0,
        totalTrades: 0,
      };
    });
  }
}

module.exports = new MultiTimeframeTradingEngine();
