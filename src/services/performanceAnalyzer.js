// PERFORMANCE ANALYZER
// Calculate advanced metrics: Sharpe, Sortino, Calmar, profit factor

class PerformanceAnalyzer {
  /**
   * Calculate all metrics from trades
   */
  async analyzeTrades(trades) {
    if (!trades || trades.length === 0) {
      return this.emptyMetrics();
    }

    const metrics = {
      totalTrades: trades.length,
      wins: trades.filter(t => t.pnl > 0).length,
      losses: trades.filter(t => t.pnl < 0).length,
      breakeven: trades.filter(t => t.pnl === 0).length,
      ...this.calculateReturns(trades),
      ...this.calculateVolatility(trades),
      ...this.calculateRiskMetrics(trades),
      ...this.calculateProfitMetrics(trades),
      ...this.calculateDrawdown(trades),
      timestamp: new Date().toISOString()
    };

    return metrics;
  }

  /**
   * Calculate return metrics
   */
  calculateReturns(trades) {
    const pnls = trades.map(t => t.pnl);
    const totalPnL = pnls.reduce((a, b) => a + b, 0);
    const avgTrade = totalPnL / trades.length;

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;

    const winRate = (wins.length / trades.length) * 100;

    return {
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      avgTrade: parseFloat(avgTrade.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(2)),
      expectancy: parseFloat((avgWin * (winRate / 100) + avgLoss * ((100 - winRate) / 100)).toFixed(2))
    };
  }

  /**
   * Calculate volatility (std dev of returns)
   */
  calculateVolatility(trades) {
    const pnls = trades.map(t => t.pnl);
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);

    return {
      volatility: parseFloat(stdDev.toFixed(2)),
      volatilityPercent: parseFloat(((stdDev / Math.abs(mean)) * 100).toFixed(2))
    };
  }

  /**
   * Calculate risk metrics: Sharpe, Sortino, Calmar
   */
  calculateRiskMetrics(trades) {
    const pnls = trades.map(t => t.pnl);
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;

    // Sharpe Ratio (mean / std dev, annualized)
    const variance = pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev !== 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

    // Sortino Ratio (only downside volatility)
    const downside = pnls.filter(p => p < 0).map(p => Math.pow(p, 2));
    const downsideVariance = downside.length > 0 ? downside.reduce((a, b) => a + b, 0) / downside.length : 0;
    const downstdDev = Math.sqrt(downsideVariance);
    const sortinoRatio = downstdDev !== 0 ? (mean / downstdDev) * Math.sqrt(252) : 0;

    // Calmar Ratio (return / max drawdown)
    const { maxDrawdown } = this.calculateDrawdown(trades);
    const totalReturn = pnls.reduce((a, b) => a + b, 0);
    const calmarRatio = maxDrawdown !== 0 ? totalReturn / maxDrawdown : 0;

    return {
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      calmarRatio: parseFloat(calmarRatio.toFixed(2))
    };
  }

  /**
   * Calculate profit metrics: Profit Factor, RRR
   */
  calculateProfitMetrics(trades) {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Risk/Reward Ratio
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const riskRewardRatio = avgLoss !== 0 ? avgWin / avgLoss : 0;

    return {
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      grossProfit: parseFloat(totalWins.toFixed(2)),
      grossLoss: parseFloat(totalLosses.toFixed(2))
    };
  }

  /**
   * Calculate drawdown metrics
   */
  calculateDrawdown(trades) {
    let runningPnL = 0;
    let peakPnL = 0;
    let maxDrawdown = 0;
    const drawdownHistory = [];

    for (const trade of trades) {
      runningPnL += trade.pnl;

      if (runningPnL > peakPnL) {
        peakPnL = runningPnL;
      }

      const drawdown = peakPnL - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      drawdownHistory.push({
        pnl: runningPnL,
        drawdown,
        peak: peakPnL
      });
    }

    const avgDrawdown = drawdownHistory.reduce((sum, d) => sum + d.drawdown, 0) / drawdownHistory.length;

    return {
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      avgDrawdown: parseFloat(avgDrawdown.toFixed(2)),
      drawdownHistory
    };
  }

  /**
   * Generate performance report
   */
  generateReport(metrics) {
    return `
╔════════════════════════════════════════════════╗
║           TRADING PERFORMANCE REPORT            ║
╚════════════════════════════════════════════════╝

OVERVIEW
  Total Trades:        ${metrics.totalTrades}
  Winning Trades:      ${metrics.wins} (${metrics.winRate}%)
  Losing Trades:       ${metrics.losses}
  Breakeven Trades:    ${metrics.breakeven}

PROFITABILITY
  Total P&L:           $${metrics.totalPnL}
  Average Trade:       $${metrics.avgTrade}
  Average Win:         $${metrics.avgWin}
  Average Loss:        $${metrics.avgLoss}
  Profit Factor:       ${metrics.profitFactor}x
  Expectancy:          $${metrics.expectancy}

RISK METRICS
  Volatility:          ${metrics.volatility} (${metrics.volatilityPercent}%)
  Sharpe Ratio:        ${metrics.sharpeRatio}
  Sortino Ratio:       ${metrics.sortinoRatio}
  Calmar Ratio:        ${metrics.calmarRatio}

DRAWDOWN
  Max Drawdown:        $${metrics.maxDrawdown}
  Avg Drawdown:        $${metrics.avgDrawdown}

RISK/REWARD
  Risk/Reward Ratio:   ${metrics.riskRewardRatio}:1
  Gross Profit:        $${metrics.grossProfit}
  Gross Loss:          $${metrics.grossLoss}

Generated: ${metrics.timestamp}
`;
  }

  /**
   * Empty metrics (when no trades)
   */
  emptyMetrics() {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      totalPnL: 0,
      avgTrade: 0,
      avgWin: 0,
      avgLoss: 0,
      winRate: 0,
      expectancy: 0,
      volatility: 0,
      volatilityPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      profitFactor: 0,
      riskRewardRatio: 0,
      grossProfit: 0,
      grossLoss: 0,
      maxDrawdown: 0,
      avgDrawdown: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compare two strategies
   */
  compare(metrics1, metrics2) {
    return {
      metric: ['Sharpe Ratio', 'Sortino Ratio', 'Win Rate', 'Profit Factor', 'Max Drawdown'],
      strategy1: [metrics1.sharpeRatio, metrics1.sortinoRatio, metrics1.winRate, metrics1.profitFactor, metrics1.maxDrawdown],
      strategy2: [metrics2.sharpeRatio, metrics2.sortinoRatio, metrics2.winRate, metrics2.profitFactor, metrics2.maxDrawdown],
      winner: this.determineWinner(metrics1, metrics2)
    };
  }

  /**
   * Determine which strategy is better
   */
  determineWinner(metrics1, metrics2) {
    let score1 = 0;
    let score2 = 0;

    // Sharpe ratio (higher is better)
    if (metrics1.sharpeRatio > metrics2.sharpeRatio) score1++;
    else score2++;

    // Sortino ratio (higher is better)
    if (metrics1.sortinoRatio > metrics2.sortinoRatio) score1++;
    else score2++;

    // Win rate (higher is better)
    if (metrics1.winRate > metrics2.winRate) score1++;
    else score2++;

    // Profit factor (higher is better)
    if (metrics1.profitFactor > metrics2.profitFactor) score1++;
    else score2++;

    // Max drawdown (lower is better)
    if (metrics1.maxDrawdown < metrics2.maxDrawdown) score1++;
    else score2++;

    return score1 > score2 ? 'Strategy 1' : score2 > score1 ? 'Strategy 2' : 'Tie';
  }
}

module.exports = new PerformanceAnalyzer();
