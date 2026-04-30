const BaseAgent = require('./baseAgent');

class PortfolioManagerAgent extends BaseAgent {
  constructor() {
    super('PORTFOLIO_MANAGER', 'PORTFOLIO_MANAGER');
    this.maxCorrelation = 0.65;
    this.maxConcentration = 0.10; // 10% max per position
    this.lastRebalance = null;
  }

  // Daily portfolio health check
  checkHealth(positions, equity) {
    const issues = [];
    const actions = [];

    if (!positions || Object.keys(positions).length === 0) {
      return this.logDecision({ status: 'HEALTHY', issues: [], actions: [], positions: 0 });
    }

    // 1. Concentration check
    for (const [asset, pos] of Object.entries(positions)) {
      const posValue = pos.total * (pos.price || 1);
      const concentration = posValue / equity;
      if (concentration > this.maxConcentration) {
        issues.push({ type: 'CONCENTRATION', asset, pct: parseFloat((concentration * 100).toFixed(1)), limit: this.maxConcentration * 100 });
        actions.push({ action: 'REDUCE', asset, from_pct: parseFloat((concentration * 100).toFixed(1)), to_pct: 8 });
      }
    }

    // 2. Simplified correlation check (BTC-heavy portfolios)
    const cryptoAssets = Object.keys(positions).filter(a => a !== 'USDT' && a !== 'USD');
    if (cryptoAssets.length >= 3) {
      // Most crypto assets correlate with BTC ~0.6-0.85
      const estimatedCorrelation = 0.45 + (cryptoAssets.length * 0.05);
      if (estimatedCorrelation > this.maxCorrelation) {
        issues.push({ type: 'CORRELATION', estimated: parseFloat(estimatedCorrelation.toFixed(2)), limit: this.maxCorrelation });
        actions.push({ action: 'DIVERSIFY', reason: 'Too many correlated crypto positions', suggestion: 'Close lowest-conviction position' });
      }
    }

    const status = issues.length === 0 ? 'HEALTHY' : (issues.some(i => i.type === 'CONCENTRATION') ? 'REBALANCE_NEEDED' : 'WARNING');

    this.lastRebalance = new Date().toISOString();
    return this.logDecision({
      status,
      issues,
      actions,
      positions: cryptoAssets.length,
      equity,
      last_rebalance: this.lastRebalance,
    });
  }

  // Calculate position weights
  getPortfolioWeights(positions, equity) {
    const weights = {};
    for (const [asset, pos] of Object.entries(positions)) {
      const value = pos.total * (pos.price || 1);
      weights[asset] = parseFloat((value / equity * 100).toFixed(2));
    }
    return weights;
  }
}

module.exports = new PortfolioManagerAgent();
