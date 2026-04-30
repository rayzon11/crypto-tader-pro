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

  // Value at Risk (99% confidence, parametric fallback)
  valueAtRisk(equity, confidence = 0.99) {
    if (this.equityHistory.length < 10) return 0;
    const returns = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      returns.push((this.equityHistory[i].equity - this.equityHistory[i - 1].equity) / this.equityHistory[i - 1].equity);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    const z = confidence >= 0.99 ? 2.326 : 1.645;
    return equity * Math.abs(mean - z * std);
  }

  // Value at Risk (99% confidence, Monte Carlo simulation)
  // Bloomberg Aladdin Style
  monteCarloVaR(equity, confidence = 0.99, horizon = 1) {
    if (this.equityHistory.length < 20) return this.valueAtRisk(equity, confidence);
    
    const returns = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      returns.push((this.equityHistory[i].equity - this.equityHistory[i - 1].equity) / this.equityHistory[i - 1].equity);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);

    const simulations = 10000;
    const results = [];
    for (let i = 0; i < simulations; i++) {
      let simEquity = equity;
      for (let h = 0; h < horizon; h++) {
        // Random normal via Box-Muller
        const u = 1 - Math.random(), v = 1 - Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        simEquity *= (1 + mean + z * std);
      }
      results.push(simEquity);
    }
    
    results.sort((a, b) => a - b);
    const index = Math.floor(simulations * (1 - confidence));
    const varAmount = equity - results[index];
    return varAmount;
  }

  // Stress Testing: Black Swan scenarios
  stressTest(equity) {
    return {
      flashCrash: equity * 0.15, // -15% in minutes
      marketCapitulation: equity * 0.35, // -35% over days
      volatilitySpike: equity * 0.05, // High slippage scenario
      expectedShortfall: this.monteCarloVaR(equity, 0.95) * 1.5 // Loss beyond VaR
    };
  }

  // Portfolio Heatmap/Correlation Check
  estimateCorrelation(positions) {
    if (!positions || positions.length < 2) return 0;
    // Simplified: BTC/ETH/Alt dominance check
    const btcWeight = positions.find(p => p.symbol === 'BTCUSDT')?.amount || 0;
    const ethWeight = positions.find(p => p.symbol === 'ETHUSDT')?.amount || 0;
    const total = positions.reduce((s, p) => s + p.amount, 0);
    if (total === 0) return 0;
    return (btcWeight + ethWeight) / total; // High % in top 2 = high correlation risk
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

  getMetrics(equity, positions = []) {
    const mcVaR = this.monteCarloVaR(equity);
    return {
      equity,
      peakEquity: this.peakEquity,
      currentDrawdown: parseFloat((this.currentDrawdown(equity) * 100).toFixed(2)),
      maxDrawdown: parseFloat((this.maxDrawdown() * 100).toFixed(2)),
      sharpeRatio: parseFloat(this.sharpeRatio().toFixed(2)),
      var99: parseFloat(mcVaR.toFixed(2)),
      varPct: parseFloat(((mcVaR / equity) * 100).toFixed(2)),
      stressTests: this.stressTest(equity),
      correlationRisk: this.estimateCorrelation(positions),
      dataPoints: this.equityHistory.length,
      status: this.currentDrawdown(equity) > 0.10 ? 'CRITICAL' : 'STABLE'
    };
  }
}

module.exports = new RiskCalculator();
