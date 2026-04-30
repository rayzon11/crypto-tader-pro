// Volatility Forecasting using GARCH(1,1) Model
// Predicts volatility spikes BEFORE they happen

class VolatilityForecast {
  constructor() {
    // GARCH(1,1) parameters optimized for crypto
    this.omega = 0.0001;
    this.alpha = 0.1;
    this.beta = 0.8;
  }

  async forecast(historicalPrices, days = 1) {
    if (!historicalPrices || historicalPrices.length < 30) {
      return { error: "Need 30+ days of data", currentVolatility: 0, forecastedVolatility: 0, change: 0, recommendation: "INSUFFICIENT_DATA" };
    }

    // Calculate returns
    const returns = this.calculateReturns(historicalPrices);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const residuals = returns.map(r => r - meanReturn);

    // Estimate current volatility
    const currentVolatility = this.calculateHistoricalVolatility(returns);

    // Project forward using GARCH
    let forecastedVolatility = currentVolatility;
    for (let i = 0; i < days; i++) {
      const lastResidual = residuals[residuals.length - 1] || 0;
      const lastVariance = forecastedVolatility * forecastedVolatility;

      // GARCH equation: sigma2(t+1) = omega + alpha * epsilon2(t) + beta * sigma2(t)
      const nextVariance =
        this.omega +
        (this.alpha * lastResidual * lastResidual) +
        (this.beta * lastVariance);

      forecastedVolatility = Math.sqrt(nextVariance);
    }

    const change = ((forecastedVolatility - currentVolatility) / currentVolatility) * 100;

    return {
      currentVolatility: parseFloat(currentVolatility.toFixed(6)),
      forecastedVolatility: parseFloat(forecastedVolatility.toFixed(6)),
      change: parseFloat(change.toFixed(2)),
      recommendation: this.getRecommendation(currentVolatility, forecastedVolatility),
      positionMultiplier: this.getPositionMultiplier(currentVolatility, forecastedVolatility)
    };
  }

  calculateReturns(prices) {
    return prices.slice(1).map((price, i) =>
      Math.log(price / prices[i])
    );
  }

  calculateHistoricalVolatility(returns) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => (r - mean) * (r - mean));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(variance);
  }

  getRecommendation(current, forecast) {
    const changePercent = ((forecast - current) / current) * 100;

    if (changePercent > 100) return "HALT_NEW_TRADES";
    if (changePercent > 50) return "REDUCE_POSITIONS_50%";
    if (changePercent > 20) return "REDUCE_POSITIONS_20%";
    if (changePercent < -20) return "BREAKOUT_IMMINENT_TIGHTEN_GRIDS";
    return "NORMAL";
  }

  getPositionMultiplier(current, forecast) {
    const changePercent = ((forecast - current) / current) * 100;

    if (changePercent > 100) return 0.0;
    if (changePercent > 50) return 0.5;
    if (changePercent > 20) return 0.8;
    if (changePercent < -20) return 1.1;
    return 1.0;
  }
}

module.exports = new VolatilityForecast();
