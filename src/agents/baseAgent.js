// Base Agent class — all 7 agent types inherit from this
// Provides: decision logging, performance tracking, learning state

class BaseAgent {
  constructor(name, type) {
    this.name = name;
    this.type = type;
    this.decisions = [];
    this.trades = [];
    this.winRate = 0;
    this.sharpeRatio = 0;
    this.weight = 1.0;
    this.active = true;
    this.lastDecision = null;
  }

  logDecision(decision) {
    const entry = {
      timestamp: new Date().toISOString(),
      agent: this.name,
      type: this.type,
      ...decision,
    };
    this.decisions.push(entry);
    if (this.decisions.length > 200) this.decisions = this.decisions.slice(-200);
    this.lastDecision = entry;
    return entry;
  }

  recordTrade(won, pnl) {
    this.trades.push({ won, pnl, timestamp: new Date().toISOString() });
    if (this.trades.length > 200) this.trades = this.trades.slice(-200);
    this.updateStats();
  }

  updateStats() {
    if (this.trades.length === 0) return;
    const wins = this.trades.filter(t => t.won).length;
    this.winRate = wins / this.trades.length;

    // Simple Sharpe approximation
    const returns = this.trades.map(t => t.pnl);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance) || 1;
    this.sharpeRatio = (mean / std) * Math.sqrt(252); // Annualized

    // Adjust weight based on performance
    if (this.winRate > 0.65) this.weight = Math.min(this.weight * 1.02, 2.0);
    else if (this.winRate < 0.40) this.weight = Math.max(this.weight * 0.95, 0.1);
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      active: this.active,
      weight: parseFloat(this.weight.toFixed(3)),
      winRate: parseFloat((this.winRate * 100).toFixed(1)),
      sharpeRatio: parseFloat(this.sharpeRatio.toFixed(2)),
      totalTrades: this.trades.length,
      totalDecisions: this.decisions.length,
      lastDecision: this.lastDecision,
    };
  }
}

module.exports = BaseAgent;
