const BaseAgent = require('./baseAgent');

class GridMasterAgent extends BaseAgent {
  constructor() {
    super('GRID_MASTER', 'GRID_MASTER');
    this.activeGrids = [];
    this.maxConcurrentGrids = 4;
  }

  // Set up a new grid for a consolidating asset
  setupGrid(symbol, klines, capital = 2000) {
    if (!klines || klines.length < 20) {
      return this.logDecision({ signal_type: 'HOLD', reasoning: 'Insufficient kline data for grid' });
    }

    if (this.activeGrids.length >= this.maxConcurrentGrids) {
      return this.logDecision({ signal_type: 'HOLD', reasoning: `Max ${this.maxConcurrentGrids} grids active` });
    }

    const closes = klines.map(k => k.close);
    const rsi = this.rsi(closes, 14);

    // Only set up in consolidation (RSI 40-60)
    if (rsi < 40 || rsi > 60) {
      return this.logDecision({ signal_type: 'HOLD', reasoning: `RSI ${rsi.toFixed(0)} outside consolidation range (40-60)` });
    }

    // Calculate support/resistance from 7-day data
    const recent = klines.slice(-42); // ~7 days on 4H
    const highs = recent.map(k => k.high);
    const lows = recent.map(k => k.low);
    const resistance = Math.max(...highs);
    const support = Math.min(...lows);
    const range = resistance - support;

    // Volatility-adaptive layer count
    const dailyReturns = [];
    for (let i = 1; i < closes.length; i++) {
      dailyReturns.push(Math.abs(closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgVol = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const layers = Math.max(5, Math.min(15, Math.round(range / (closes[closes.length - 1] * avgVol))));
    const spacing = range / layers;
    const perLayer = capital / layers;

    const grid = {
      symbol,
      support: parseFloat(support.toFixed(2)),
      resistance: parseFloat(resistance.toFixed(2)),
      layers,
      spacing: parseFloat(spacing.toFixed(2)),
      total_capital: capital,
      per_layer: parseFloat(perLayer.toFixed(2)),
      current_price: closes[closes.length - 1],
      rsi: parseFloat(rsi.toFixed(1)),
      volatility: parseFloat((avgVol * 100).toFixed(3)),
      created: new Date().toISOString(),
      status: 'ACTIVE',
    };

    this.activeGrids.push(grid);

    return this.logDecision({
      signal_type: 'GRID_SETUP',
      grid,
      exit_condition: `Price closes outside ${support.toFixed(2)}-${resistance.toFixed(2)} for 1 hour`,
    });
  }

  // Check if any grids should be closed (breakout detected)
  checkGridExits(currentPrices) {
    const exits = [];
    this.activeGrids = this.activeGrids.filter(grid => {
      const price = currentPrices[grid.symbol + 'USDT']?.price || currentPrices[grid.symbol]?.price;
      if (!price) return true;

      if (price > grid.resistance * 1.01 || price < grid.support * 0.99) {
        exits.push({ symbol: grid.symbol, reason: `Breakout: price ${price} outside range`, grid });
        return false; // Remove grid
      }
      return true;
    });

    if (exits.length > 0) {
      return this.logDecision({ signal_type: 'GRID_EXIT', exits });
    }
    return null;
  }

  rsi(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    return 100 - (100 / (1 + (gains / period) / ((losses / period) || 1)));
  }
}

module.exports = new GridMasterAgent();
