const BaseAgent = require('./baseAgent');

class MarketAnalystAgent extends BaseAgent {
  constructor() {
    super('MARKET_ANALYST', 'MARKET_ANALYST');
    this.scanInterval = 4; // hours
    this.lastScan = null;
  }

  // Scan top assets for setups on 4H+ timeframes
  scan(allKlines) {
    const setups = [];
    const timestamp = new Date().toISOString();

    for (const [symbol, klines] of Object.entries(allKlines)) {
      if (!klines || klines.length < 50) continue;

      const closes = klines.map(k => k.close);
      const current = closes[closes.length - 1];
      const ma20 = this.sma(closes, 20);
      const ma50 = this.sma(closes, 50);
      const rsi = this.rsi(closes, 14);
      const bb = this.bollingerBands(closes, 20);
      const volume = klines[klines.length - 1].volume;
      const avgVol = klines.slice(-20).reduce((s, k) => s + k.volume, 0) / 20;

      let probability = 0.50;
      const signals = [];

      // Trend alignment
      if (current > ma50) { probability += 0.08; signals.push('Price > 50-MA'); }
      if (current > ma20) { probability += 0.04; signals.push('Price > 20-MA'); }

      // RSI
      if (rsi >= 40 && rsi <= 60) { probability += 0.03; signals.push(`RSI ${rsi.toFixed(0)} (neutral zone)`); }
      else if (rsi < 30) { probability += 0.06; signals.push(`RSI ${rsi.toFixed(0)} (oversold)`); }
      else if (rsi > 70) { probability -= 0.04; signals.push(`RSI ${rsi.toFixed(0)} (overbought risk)`); }

      // Bollinger Band squeeze (volatility compression)
      const bbWidth = (bb.upper - bb.lower) / bb.middle;
      if (bbWidth < 0.03) { probability += 0.05; signals.push('BB squeeze (breakout imminent)'); }

      // Volume confirmation
      if (volume > avgVol * 1.5) { probability += 0.04; signals.push(`Volume +${((volume / avgVol - 1) * 100).toFixed(0)}%`); }

      if (probability >= 0.65) {
        setups.push({
          symbol,
          probability: parseFloat(probability.toFixed(3)),
          setup: signals.join(', '),
          timeframe: '4H',
          recommendation: probability >= 0.72 ? 'Send to TRADER for BUY signal' : 'Watch — close to actionable',
          rsi: parseFloat(rsi.toFixed(1)),
          bbWidth: parseFloat(bbWidth.toFixed(4)),
        });
      }
    }

    // Sort by probability
    setups.sort((a, b) => b.probability - a.probability);

    this.lastScan = timestamp;
    return this.logDecision({
      scan_timestamp: timestamp,
      setups_found: setups.length,
      top_setups: setups.slice(0, 5),
      next_scan: `${this.scanInterval}H`,
    });
  }

  // Detect market regime
  detectRegime(btcKlines) {
    if (!btcKlines || btcKlines.length < 50) return 'UNKNOWN';
    const closes = btcKlines.map(k => k.close);
    const ma50 = this.sma(closes, 50);
    const rsi = this.rsi(closes, 14);
    const current = closes[closes.length - 1];
    const bb = this.bollingerBands(closes, 20);
    const bbWidth = (bb.upper - bb.lower) / bb.middle;

    if (current > ma50 && rsi > 55) return 'BULLISH';
    if (current < ma50 && rsi < 45) return 'BEARISH';
    if (bbWidth < 0.025) return 'CONSOLIDATION';
    return 'NEUTRAL';
  }

  sma(data, period) {
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  rsi(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = (gains / period) / ((losses / period) || 1);
    return 100 - (100 / (1 + rs));
  }

  bollingerBands(closes, period = 20) {
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const std = Math.sqrt(variance);
    return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
  }
}

module.exports = new MarketAnalystAgent();
