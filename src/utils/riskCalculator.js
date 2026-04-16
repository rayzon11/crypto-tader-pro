// Risk Calculator — portfolio-level risk metrics

class RiskCalculator {
  constructor() {
    this.equityHistory = [];
    this.peakEquity = 0;
  }

  recordEquity(equity) {
    this.equityHistory.push({ equity, timestamp: new Date().toISOString() });
    if (equity > this.peakEquity) this.peakEquity = equity;
    if (this.equityHistory.length > 1000) this.equityHistory = this.equityHistory.slice(-1000);
  }

  // Current drawdown from peak
  currentDrawdown(equity) {
    if (this.peakEquity === 0) return 0;
    return (this.peakEquity - equity) / this.peakEquity;
  }

  // Maximum drawdown from history
  maxDrawdown() {
    let peak = 0;
    let maxDD = 0;
    for (const { equity } of this.equityHistory) {
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }

  // Value at Risk (99% confidence, parametric)
  valueAtRisk(equity, confidence = 0.99) {
    if (this.equityHistory.length < 10) return 0;
    const returns = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      returns.push((this.equityHistory[i].equity - this.equityHistory[i - 1].equity) / this.equityHistory[i - 1].equity);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);

    // Z-scores: 95% = 1.645, 99% = 2.326
    const z = confidence >= 0.99 ? 2.326 : 1.645;
    return equity * (mean - z * std);
  }

  // Position size calculator (2% risk rule)
  calculatePositionSize(equity, entryPrice, stopLoss, maxRiskPct = 0.02) {
    const riskAmount = equity * maxRiskPct;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    if (stopDistance === 0) return 0;
    const shares = riskAmount / stopDistance;
    const positionValue = shares * entryPrice;
    return {
      shares: parseFloat(shares.toFixed(6)),
      positionValue: parseFloat(positionValue.toFixed(2)),
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      riskPct: maxRiskPct * 100,
    };
  }

  // Portfolio Sharpe ratio from equity history
  sharpeRatio() {
    if (this.equityHistory.length < 10) return 0;
    const returns = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      returns.push((this.equityHistory[i].equity - this.equityHistory[i - 1].equity) / this.equityHistory[i - 1].equity);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance) || 1;
    return (mean / std) * Math.sqrt(252); // Annualized
  }

  getMetrics(equity) {
    return {
      equity,
      peakEquity: this.peakEquity,
      currentDrawdown: parseFloat((this.currentDrawdown(equity) * 100).toFixed(2)),
      maxDrawdown: parseFloat((this.maxDrawdown() * 100).toFixed(2)),
      sharpeRatio: parseFloat(this.sharpeRatio().toFixed(2)),
      var99: parseFloat(this.valueAtRisk(equity).toFixed(2)),
      dataPoints: this.equityHistory.length,
    };
  }
}

module.exports = new RiskCalculator();
