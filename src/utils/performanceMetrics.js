// Performance Metrics — track trades, win rate, profit factor, etc.

class PerformanceMetrics {
  constructor() {
    this.trades = [];
    this.dailyPnL = {};
  }

  recordTrade(trade) {
    this.trades.push({
      ...trade,
      timestamp: trade.timestamp || new Date().toISOString(),
    });
    if (this.trades.length > 5000) this.trades = this.trades.slice(-5000);

    // Update daily P&L
    const day = (trade.timestamp || new Date().toISOString()).split('T')[0];
    this.dailyPnL[day] = (this.dailyPnL[day] || 0) + (trade.pnl || 0);
  }

  getMetrics(period = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const recent = this.trades.filter(t => new Date(t.timestamp) >= cutoff);

    if (recent.length === 0) {
      return {
        totalTrades: 0, wins: 0, losses: 0, winRate: 0,
        totalPnL: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
        sharpeRatio: 0, period,
      };
    }

    const wins = recent.filter(t => t.pnl > 0);
    const losses = recent.filter(t => t.pnl <= 0);
    const totalPnL = recent.reduce((s, t) => s + (t.pnl || 0), 0);
    const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

    return {
      totalTrades: recent.length,
      wins: wins.length,
      losses: losses.length,
      winRate: parseFloat((wins.length / recent.length * 100).toFixed(1)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      avgWin: wins.length > 0 ? parseFloat((grossWins / wins.length).toFixed(2)) : 0,
      avgLoss: losses.length > 0 ? parseFloat((grossLosses / losses.length).toFixed(2)) : 0,
      profitFactor: grossLosses > 0 ? parseFloat((grossWins / grossLosses).toFixed(2)) : grossWins > 0 ? 999 : 0,
      tradesPerDay: parseFloat((recent.length / period).toFixed(1)),
      period,
    };
  }

  // Strategy breakdown
  byStrategy() {
    const strategies = {};
    for (const trade of this.trades) {
      const s = trade.strategy || 'unknown';
      if (!strategies[s]) strategies[s] = [];
      strategies[s].push(trade);
    }

    const result = {};
    for (const [strategy, trades] of Object.entries(strategies)) {
      const wins = trades.filter(t => t.pnl > 0);
      result[strategy] = {
        trades: trades.length,
        wins: wins.length,
        winRate: parseFloat((wins.length / trades.length * 100).toFixed(1)),
        totalPnL: parseFloat(trades.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2)),
      };
    }
    return result;
  }
}

module.exports = new PerformanceMetrics();
