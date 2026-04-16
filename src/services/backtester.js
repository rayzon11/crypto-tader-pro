// BACKTESTER — Validate strategies on historical data
// Test all agents on 2024-2026 data before live trading

const fs = require('fs');
const path = require('path');

class Backtester {
  constructor() {
    this.results = [];
    this.backtestedAgents = new Map();
    this.backtestedStrategies = new Map();
  }

  /**
   * MAIN: Backtest a strategy on historical data
   */
  async backtest(strategyName, agentType, historicalData, config = {}) {
    const startTime = Date.now();

    try {
      console.log(`[BACKTEST] Starting: ${strategyName} (${agentType})`);
      console.log(`[BACKTEST] Data points: ${historicalData.length}`);

      // Initialize
      let equity = config.initialEquity || 10000;
      let peakEquity = equity;
      let trades = [];
      let maxDrawdown = 0;
      let wins = 0;
      let losses = 0;
      let totalPnL = 0;

      // Iterate through historical data
      for (let i = 100; i < historicalData.length; i++) {
        const candle = historicalData[i];
        const prevCandles = historicalData.slice(Math.max(0, i - 100), i);

        // Generate signal based on agent type
        const signal = this.generateSignal(agentType, candle, prevCandles);

        if (signal.decision !== 'HOLD') {
          // Simulate trade
          const entryPrice = candle.close;
          const entryTime = candle.timestamp;

          // Find exit (next 10-50 candles for profit/loss)
          let exitPrice = entryPrice;
          let exitTime = entryTime;
          let reason = 'TIMEOUT';

          for (let j = i + 1; j < Math.min(i + 50, historicalData.length); j++) {
            const futureCandle = historicalData[j];

            // Check stop loss
            if (signal.decision === 'BUY') {
              if (futureCandle.low <= signal.stopLoss) {
                exitPrice = signal.stopLoss;
                exitTime = futureCandle.timestamp;
                reason = 'STOP_LOSS';
                break;
              }
              // Check take profit
              if (futureCandle.high >= signal.takeProfit) {
                exitPrice = signal.takeProfit;
                exitTime = futureCandle.timestamp;
                reason = 'TAKE_PROFIT';
                break;
              }
            } else if (signal.decision === 'SELL') {
              if (futureCandle.high >= signal.stopLoss) {
                exitPrice = signal.stopLoss;
                exitTime = futureCandle.timestamp;
                reason = 'STOP_LOSS';
                break;
              }
              if (futureCandle.low <= signal.takeProfit) {
                exitPrice = signal.takeProfit;
                exitTime = futureCandle.timestamp;
                reason = 'TAKE_PROFIT';
                break;
              }
            }
          }

          // Calculate P&L
          const pnl = signal.decision === 'BUY'
            ? (exitPrice - entryPrice) * 10 // 10 contracts
            : (entryPrice - exitPrice) * 10;

          totalPnL += pnl;
          equity += pnl;

          if (pnl > 0) wins++;
          else if (pnl < 0) losses++;

          // Track drawdown
          if (equity > peakEquity) {
            peakEquity = equity;
          }
          const drawdown = (peakEquity - equity) / peakEquity;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }

          // Record trade
          trades.push({
            symbol: signal.symbol,
            side: signal.decision,
            entryPrice,
            entryTime,
            exitPrice,
            exitTime,
            pnl,
            reason,
            agent: agentType
          });
        }
      }

      const backestDuration = Date.now() - startTime;

      // Calculate metrics
      const totalTrades = trades.length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const avgWin = wins > 0 ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
      const avgLoss = losses > 0 ? trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losses : 0;
      const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
      const returnPercent = ((equity - config.initialEquity) / config.initialEquity) * 100;
      const sharpRatio = this.calculateSharpeRatio(trades);

      const result = {
        strategy: strategyName,
        agent: agentType,
        totalTrades,
        wins,
        losses,
        winRate: parseFloat(winRate.toFixed(2)),
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        returnPercent: parseFloat(returnPercent.toFixed(2)),
        maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
        sharpeRatio: parseFloat(sharpRatio.toFixed(2)),
        initialEquity: config.initialEquity,
        finalEquity: parseFloat(equity.toFixed(2)),
        backtestDuration: `${(backestDuration / 1000).toFixed(1)}s`,
        dataPoints: historicalData.length,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      this.backtestedAgents.set(agentType, result);

      console.log(`[BACKTEST] Complete: ${result.winRate}% win rate, ${result.returnPercent}% return`);
      return result;

    } catch (error) {
      console.error('[BACKTEST] Error:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Generate signal based on agent type
   */
  generateSignal(agentType, candle, prevCandles) {
    const price = candle.close;

    switch (agentType) {
      case 'TRADER':
        return this.traderSignal(candle, prevCandles);
      case 'MARKET_ANALYST':
        return this.analystSignal(candle, prevCandles);
      case 'ARBITRAGE_SCOUT':
        return this.arbitrageSignal(candle, prevCandles);
      case 'FOREX_1M':
        return this.forex1mSignal(candle, prevCandles);
      case 'FOREX_5M':
        return this.forex5mSignal(candle, prevCandles);
      default:
        return { decision: 'HOLD' };
    }
  }

  /**
   * TRADER SIGNAL: Trend following
   */
  traderSignal(candle, prevCandles) {
    const closes = prevCandles.map(c => c.close);
    const sma50 = this.calculateSMA(closes, 50);
    const sma200 = this.calculateSMA(closes, 200);

    const currentSma50 = sma50[sma50.length - 1];
    const currentSma200 = sma200[sma200.length - 1];
    const price = candle.close;

    // Bullish: Price > SMA50 > SMA200
    if (price > currentSma50 && currentSma50 > currentSma200) {
      return {
        decision: 'BUY',
        symbol: 'BTC/USDT',
        stopLoss: currentSma50 * 0.98,
        takeProfit: price * 1.03,
        confidence: 0.72
      };
    }

    // Bearish: Price < SMA50 < SMA200
    if (price < currentSma50 && currentSma50 < currentSma200) {
      return {
        decision: 'SELL',
        symbol: 'BTC/USDT',
        stopLoss: currentSma50 * 1.02,
        takeProfit: price * 0.97,
        confidence: 0.72
      };
    }

    return { decision: 'HOLD' };
  }

  /**
   * ANALYST SIGNAL: Regime detection + mean reversion
   */
  analystSignal(candle, prevCandles) {
    const closes = prevCandles.map(c => c.close);
    const rsi = this.calculateRSI(closes, 14);
    const currentRsi = rsi[rsi.length - 1];
    const price = candle.close;
    const sma20 = this.calculateSMA(closes, 20);
    const currentSma20 = sma20[sma20.length - 1];

    // RSI oversold + price near SMA
    if (currentRsi < 30 && price < currentSma20) {
      return {
        decision: 'BUY',
        symbol: 'ETH/USDT',
        stopLoss: price * 0.97,
        takeProfit: currentSma20 * 1.02,
        confidence: 0.68
      };
    }

    // RSI overbought + price near SMA
    if (currentRsi > 70 && price > currentSma20) {
      return {
        decision: 'SELL',
        symbol: 'ETH/USDT',
        stopLoss: price * 1.03,
        takeProfit: currentSma20 * 0.98,
        confidence: 0.68
      };
    }

    return { decision: 'HOLD' };
  }

  /**
   * ARBITRAGE SIGNAL: Range trading
   */
  arbitrageSignal(candle, prevCandles) {
    const lows = prevCandles.map(c => c.low);
    const highs = prevCandles.map(c => c.high);
    const closes = prevCandles.map(c => c.close);

    const support = Math.min(...lows.slice(-20));
    const resistance = Math.max(...highs.slice(-20));
    const midpoint = (support + resistance) / 2;
    const price = candle.close;

    // Buy near support
    if (Math.abs(price - support) < (resistance - support) * 0.05) {
      return {
        decision: 'BUY',
        symbol: 'SOL/USDT',
        stopLoss: support * 0.99,
        takeProfit: midpoint,
        confidence: 0.65
      };
    }

    // Sell near resistance
    if (Math.abs(price - resistance) < (resistance - support) * 0.05) {
      return {
        decision: 'SELL',
        symbol: 'SOL/USDT',
        stopLoss: resistance * 1.01,
        takeProfit: midpoint,
        confidence: 0.65
      };
    }

    return { decision: 'HOLD' };
  }

  /**
   * FOREX 1M: Scalping
   */
  forex1mSignal(candle, prevCandles) {
    const closes = prevCandles.map(c => c.close);
    const bb = this.bollingerBands(closes, 20, 2);
    const currentBb = bb[bb.length - 1];
    const price = candle.close;

    if (price <= currentBb.lower) {
      return {
        decision: 'BUY',
        symbol: 'EUR/USD',
        stopLoss: currentBb.lower * 0.995,
        takeProfit: price + (price * 0.0005), // 5 pips
        confidence: 0.72
      };
    }

    if (price >= currentBb.upper) {
      return {
        decision: 'SELL',
        symbol: 'EUR/USD',
        stopLoss: currentBb.upper * 1.005,
        takeProfit: price - (price * 0.0005),
        confidence: 0.72
      };
    }

    return { decision: 'HOLD' };
  }

  /**
   * FOREX 5M: Crossover
   */
  forex5mSignal(candle, prevCandles) {
    const closes = prevCandles.map(c => c.close);
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);

    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    const prevEma9 = ema9[ema9.length - 2];
    const prevEma21 = ema21[ema21.length - 2];

    const price = candle.close;
    const atr = this.calculateATR(prevCandles.slice(-14), 14);

    // Bullish crossover
    if (prevEma9 <= prevEma21 && currentEma9 > currentEma21) {
      return {
        decision: 'BUY',
        symbol: 'GBP/USD',
        stopLoss: price - atr[atr.length - 1],
        takeProfit: price + (atr[atr.length - 1] * 2),
        confidence: 0.68
      };
    }

    // Bearish crossover
    if (prevEma9 >= prevEma21 && currentEma9 < currentEma21) {
      return {
        decision: 'SELL',
        symbol: 'GBP/USD',
        stopLoss: price + atr[atr.length - 1],
        takeProfit: price - (atr[atr.length - 1] * 2),
        confidence: 0.68
      };
    }

    return { decision: 'HOLD' };
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
      if (i === 0) return [val];
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

  calculateSharpeRatio(trades) {
    if (trades.length === 0) return 0;

    const returns = trades.map(t => t.pnl);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // 252 trading days
  }

  /**
   * Get backtest results
   */
  getResults() {
    return this.results.sort((a, b) => b.winRate - a.winRate);
  }

  /**
   * Save results to file
   */
  saveResults(filename = 'backtest_results.json') {
    const filepath = path.join(__dirname, '../../', filename);
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`[BACKTEST] Results saved to: ${filepath}`);
  }

  /**
   * Compare agents
   */
  compareAgents() {
    const comparison = Array.from(this.backtestedAgents.values())
      .sort((a, b) => b.profitFactor - a.profitFactor)
      .map(result => ({
        agent: result.agent,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        returnPercent: result.returnPercent,
        maxDrawdown: result.maxDrawdown
      }));

    return comparison;
  }
}

module.exports = new Backtester();
