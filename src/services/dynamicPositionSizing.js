// Dynamic Position Sizing Algorithm
// Adjusts all position sizes based on market regime, volatility, correlation, drawdown

class DynamicPositionSizing {
  calculatePositionSize(signal, portfolio, marketData) {
    const equity = portfolio.equity || parseFloat(process.env.INITIAL_EQUITY || 10000);
    const baseSize = equity * 0.02; // 2% of account

    let sizeMultiplier = 1.0;

    // Regime-based adjustment
    const regimeMultiplier = this.getRegimeMultiplier(marketData);
    sizeMultiplier *= regimeMultiplier;

    // Volatility-based adjustment
    const volatilityMultiplier = this.getVolatilityMultiplier(marketData);
    sizeMultiplier *= volatilityMultiplier;

    // Correlation-based adjustment
    const correlationMultiplier = this.getCorrelationMultiplier(portfolio, signal.symbol);
    sizeMultiplier *= correlationMultiplier;

    // Drawdown-based adjustment
    const drawdownMultiplier = this.getDrawdownMultiplier(portfolio);
    sizeMultiplier *= drawdownMultiplier;

    const finalSize = baseSize * sizeMultiplier;

    return {
      baseSize: parseFloat(baseSize.toFixed(2)),
      regimeMultiplier,
      volatilityMultiplier,
      correlationMultiplier,
      drawdownMultiplier,
      combinedMultiplier: parseFloat(sizeMultiplier.toFixed(3)),
      finalSize: parseFloat(Math.max(baseSize * 0.1, finalSize).toFixed(2)),
      riskAmount: parseFloat((Math.max(baseSize * 0.1, finalSize) * 0.02).toFixed(2)),
      reasoning: `Base $${baseSize.toFixed(0)} x regime ${regimeMultiplier} x vol ${volatilityMultiplier} x corr ${correlationMultiplier} x dd ${drawdownMultiplier} = $${finalSize.toFixed(0)}`
    };
  }

  getRegimeMultiplier(marketData) {
    const atrPercent = marketData.atr && marketData.price
      ? (marketData.atr / marketData.price) * 100
      : 1;

    if (atrPercent < 0.5) return 1.2; // TRENDING
    if (atrPercent < 2) return 1.5;   // RANGING
    if (atrPercent < 5) return 0.7;   // VOLATILE
    return 0.0;                        // CRISIS
  }

  getVolatilityMultiplier(marketData) {
    const todayVol = marketData.volatility || 0;
    const forecastVol = marketData.forecastedVolatility || todayVol;

    if (todayVol === 0) return 1.0;
    if (forecastVol < todayVol * 0.8) return 1.1; // Contracting
    if (forecastVol > todayVol * 1.5) return 0.6; // Spiking
    return 1.0;
  }

  getCorrelationMultiplier(portfolio, symbol) {
    const correlations = portfolio.correlations || {};
    const correlation = correlations[symbol] || 0.5;

    if (correlation < 0.40) return 1.2;
    if (correlation < 0.60) return 1.0;
    if (correlation < 0.75) return 0.7;
    return 0.3;
  }

  getDrawdownMultiplier(portfolio) {
    const drawdownPercent = portfolio.drawdownPercent || 0;

    if (drawdownPercent < 5) return 1.0;
    if (drawdownPercent < 10) return 0.7;
    if (drawdownPercent < 15) return 0.3;
    return 0.0; // HALT
  }
}

module.exports = new DynamicPositionSizing();
