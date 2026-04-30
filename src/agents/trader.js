const BaseAgent = require('./baseAgent');

class TraderAgent extends BaseAgent {
  constructor() {
    super('TRADER', 'TRADER');
    this.maxPositionSize = 5000;
    this.minConviction = 0.65;
    this.activePositions = [];
  }

  // Generate trade signal from market data
  generateSignal(marketData, klines) {
    if (!marketData || !klines || klines.length < 50) {
      return this.logDecision({ signal_type: 'HOLD', reasoning: 'Insufficient data' });
    }

    const closes = klines.map(k => k.close);
    const ma50 = this.sma(closes, 50);
    const ma200 = closes.length >= 200 ? this.sma(closes, 200) : ma50 * 0.98;
    const rsi = this.rsi(closes, 14);
    const currentPrice = closes[closes.length - 1];
    const volume = klines[klines.length - 1].volume;
    const avgVolume = klines.slice(-20).reduce((s, k) => s + k.volume, 0) / 20;
    const volumeRatio = volume / avgVolume;

    let conviction = 0.50;
    let signalType = 'HOLD';
    const reasons = [];

    // Trend following checks
    if (currentPrice > ma50) { conviction += 0.08; reasons.push('Price > 50-MA'); }
    if (ma50 > ma200) { conviction += 0.06; reasons.push('50-MA > 200-MA (golden cross)'); }
    if (rsi > 40 && rsi < 70) { conviction += 0.04; reasons.push(`RSI ${rsi.toFixed(0)} (healthy)`); }
    if (volumeRatio > 1.5) { conviction += 0.06; reasons.push(`Volume ${(volumeRatio * 100).toFixed(0)}% of avg`); }

    // Bearish signals
    if (currentPrice < ma50) { conviction -= 0.08; reasons.push('Price < 50-MA'); }
    if (rsi > 75) { conviction -= 0.06; reasons.push(`RSI ${rsi.toFixed(0)} (overbought)`); }
    if (rsi < 25) { conviction += 0.05; reasons.push(`RSI ${rsi.toFixed(0)} (oversold bounce)`); }

    if (conviction >= this.minConviction) {
      signalType = currentPrice > ma50 ? 'BUY' : 'SELL';
    }

    const stopLoss = signalType === 'BUY'
      ? currentPrice * 0.98 // 2% below
      : currentPrice * 1.02;
    const takeProfit = signalType === 'BUY'
      ? currentPrice * 1.04 // 4% above (2:1 R/R)
      : currentPrice * 0.96;
    const riskReward = Math.abs(takeProfit - currentPrice) / Math.abs(currentPrice - stopLoss);

    return this.logDecision({
      signal_type: signalType,
      symbol: marketData.symbol,
      entry: currentPrice,
      stop_loss: parseFloat(stopLoss.toFixed(2)),
      take_profit: parseFloat(takeProfit.toFixed(2)),
      conviction: parseFloat(conviction.toFixed(3)),
      risk_reward: parseFloat(riskReward.toFixed(2)),
      reasoning: reasons.join('. '),
      rsi: parseFloat(rsi.toFixed(1)),
      volume_ratio: parseFloat(volumeRatio.toFixed(2)),
    });
  }

  // Trail stops for open positions
  checkTrailingStops(currentPrice, position) {
    const profitPct = ((currentPrice - position.entry) / position.entry) * 100;
    if (profitPct >= 3) {
      return { action: 'TRAIL_STOP', new_stop: position.entry * 1.005, reason: '+3% hit, trail to BE+0.5%' };
    }
    if (profitPct >= 5) {
      return { action: 'TRAIL_STOP', new_stop: position.entry * 1.01, reason: '+5% hit, trail to +1%' };
    }
    return null;
  }

  // Simple Moving Average
  sma(data, period) {
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  // Relative Strength Index
  rsi(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = (gains / period) / ((losses / period) || 1);
    return 100 - (100 / (1 + rs));
  }
}

module.exports = new TraderAgent();
