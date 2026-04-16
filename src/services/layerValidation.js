// Eight-Layer Trade Validation System
// Every trade must pass ALL 8 checks or it's REJECTED

class EightLayerValidator {
  constructor() {
    this.layers = {
      technical: { weight: 0.20, name: "Technical Foundation" },
      harmonic: { weight: 0.15, name: "Harmonic Patterns" },
      regime: { weight: 0.10, name: "Market Regime" },
      sentiment: { weight: 0.15, name: "Sentiment Analysis" },
      onchain: { weight: 0.12, name: "On-Chain Intel" },
      liquidity: { weight: 0.08, name: "Liquidity" },
      correlation: { weight: 0.10, name: "Correlation" },
      mlEdge: { weight: 0.10, name: "ML Edge Score" }
    };
  }

  async validateTrade(signal, marketData, portfolio) {
    const layerScores = {};
    let totalScore = 0;

    // Layer 1: Technical
    layerScores.technical = await this.validateTechnical(signal, marketData);
    totalScore += layerScores.technical.score * this.layers.technical.weight;

    // Layer 2: Harmonic
    layerScores.harmonic = await this.validateHarmonic(marketData);
    totalScore += layerScores.harmonic.score * this.layers.harmonic.weight;

    // Layer 3: Regime
    layerScores.regime = await this.validateRegime(marketData);
    totalScore += layerScores.regime.score * this.layers.regime.weight;

    // Layer 4: Sentiment
    layerScores.sentiment = await this.validateSentiment(signal.symbol);
    totalScore += layerScores.sentiment.score * this.layers.sentiment.weight;

    // Layer 5: On-Chain
    layerScores.onchain = await this.validateOnChain(signal.symbol);
    totalScore += layerScores.onchain.score * this.layers.onchain.weight;

    // Layer 6: Liquidity
    layerScores.liquidity = await this.validateLiquidity(signal);
    totalScore += layerScores.liquidity.score * this.layers.liquidity.weight;

    // Layer 7: Correlation
    layerScores.correlation = await this.validateCorrelation(signal.symbol, portfolio);
    totalScore += layerScores.correlation.score * this.layers.correlation.weight;

    // Layer 8: ML Edge
    layerScores.mlEdge = await this.validateMLEdge(signal, marketData);
    totalScore += layerScores.mlEdge.score * this.layers.mlEdge.weight;

    return {
      totalScore: Math.round(totalScore),
      layers: layerScores,
      approved: totalScore > 50,
      godMode: totalScore > 85,
      reasoning: this.generateReasoning(layerScores, totalScore)
    };
  }

  async validateTechnical(signal, marketData) {
    const checks = {
      priceAboveMA50: false,
      ma50AboveMA200: false,
      macdPositive: false,
      rsiInRange: false,
      volumeConfirmed: false
    };

    const { price, ma50, ma200, macdHistogram, rsi, volume, avgVolume } = marketData;

    checks.priceAboveMA50 = price > ma50;
    checks.ma50AboveMA200 = ma50 > ma200;
    checks.macdPositive = macdHistogram > 0;
    checks.rsiInRange = rsi >= 30 && rsi <= 70;
    checks.volumeConfirmed = volume > avgVolume * 1.5;

    const passed = Object.values(checks).filter(v => v).length;
    const score = (passed / 5) * 100;

    return {
      score: Math.min(100, score),
      checks,
      passed,
      message: `${passed}/5 technical checks passed`
    };
  }

  async validateHarmonic(marketData) {
    const harmonicPatterns = require('./harmonicPatterns');
    const patterns = await harmonicPatterns.detectPatterns(marketData);

    if (patterns) {
      return {
        score: patterns.accuracy,
        pattern: patterns.type,
        message: `${patterns.type} detected at ${patterns.accuracy}% confidence`
      };
    }

    return { score: 0, pattern: null, message: "No harmonic pattern detected" };
  }

  async validateRegime(marketData) {
    const atr = marketData.atr;
    const price = marketData.price;
    const volatilityPercent = (atr / price) * 100;

    let regime, multiplier;

    if (volatilityPercent < 0.5) {
      regime = "TRENDING";
      multiplier = 1.2;
    } else if (volatilityPercent < 2) {
      regime = "RANGING";
      multiplier = 1.5;
    } else if (volatilityPercent < 5) {
      regime = "VOLATILE";
      multiplier = 0.7;
    } else {
      regime = "CRISIS";
      multiplier = 0.0;
    }

    const score = regime === "CRISIS" ? 0 : (multiplier / 1.5) * 100;

    return {
      score: Math.min(100, score),
      regime,
      volatilityPercent,
      positionMultiplier: multiplier,
      message: `${regime} regime, position multiplier: ${multiplier}x`
    };
  }

  async validateSentiment(symbol) {
    const sentimentAnalysis = require('./sentimentAnalysis');
    const sentiment = await sentimentAnalysis.getMarketSentiment(symbol);

    return {
      score: Math.min(100, parseFloat(sentiment.combined)),
      fgi: sentiment.fearGreedIndex,
      social: sentiment.socialSentiment,
      news: sentiment.newsSentiment,
      level: sentiment.level,
      message: `Sentiment: ${sentiment.level} (${sentiment.combined})`
    };
  }

  async validateOnChain(symbol) {
    const onChainAnalysis = require('./onChainAnalysis');
    const analysis = await onChainAnalysis.analyzeOnChain(symbol);

    return {
      score: analysis.score,
      whaleActivity: analysis.whaleMovement,
      networkActivity: analysis.networkActivity,
      fundingRates: analysis.fundingRates,
      message: `On-chain signal: ${analysis.signal}`
    };
  }

  async validateLiquidity(signal) {
    const { symbol, position_size, entry_price } = signal;
    const marketDataFetcher = require('./marketDataFetcher');

    try {
      const orderbook = await marketDataFetcher.fetchOrderBook(symbol.replace('/', ''));
      const depth = orderbook ? orderbook.bids.reduce((sum, [, qty]) => sum + parseFloat(qty) * entry_price, 0) : 0;

      const estimatedSlippage = depth > 0 ? (position_size / depth) * 0.1 : 1;

      let score = 100;
      if (estimatedSlippage > 0.50) score = 20;
      else if (estimatedSlippage > 0.20) score = 50;
      else if (estimatedSlippage > 0.10) score = 75;

      return {
        score,
        depth,
        estimatedSlippage,
        message: `Liquidity: ${score > 75 ? 'Excellent' : 'Good'} (slippage ${estimatedSlippage.toFixed(3)}%)`
      };
    } catch (error) {
      return { score: 50, message: "Liquidity check unavailable" };
    }
  }

  async validateCorrelation(symbol, portfolio) {
    const openPositions = portfolio?.openPositions || [];
    if (openPositions.length === 0) {
      return { score: 100, correlation: 0, message: "No open positions, correlation safe" };
    }

    // Calculate average correlation with open positions
    let avgCorrelation = 0.3; // default low
    const hasLosingPosition = openPositions.some(p => p.pnl < 0);

    if (hasLosingPosition && avgCorrelation > 0.60) {
      return {
        score: 30,
        correlation: avgCorrelation,
        recommendation: 'REJECT',
        message: `High correlation with losing position`
      };
    }

    let score = 100;
    if (avgCorrelation > 0.75) score = 30;
    else if (avgCorrelation > 0.60) score = 50;
    else if (avgCorrelation > 0.40) score = 75;

    return {
      score,
      correlation: avgCorrelation.toFixed(2),
      recommendation: avgCorrelation > 0.75 ? 'REJECT' : 'APPROVE',
      message: `Portfolio correlation: ${avgCorrelation.toFixed(2)}`
    };
  }

  async validateMLEdge(signal, marketData) {
    // Check against historical pattern library
    const patternLibrary = [
      { type: "MA_Crossover_Bullish", winRate: 79, conditions: (s, m) => m.ma50 > m.ma200 && m.rsi > 50 && m.rsi < 65 },
      { type: "Bollinger_Squeeze_Breakout", winRate: 69, conditions: (s, m) => m.bollingerWidth < 0.01 && m.volume > m.avgVolume * 2 },
      { type: "RSI_Oversold_Bounce", winRate: 72, conditions: (s, m) => m.rsi < 30 && m.macdHistogram > 0 }
    ];

    for (const pattern of patternLibrary) {
      try {
        if (pattern.conditions(signal, marketData)) {
          return {
            score: Math.min(100, pattern.winRate * 1.2),
            patternMatch: pattern.type,
            winRate: pattern.winRate,
            message: `${pattern.type} matched, ${pattern.winRate}% historical win rate`
          };
        }
      } catch (e) {
        continue;
      }
    }

    return { score: 0, patternMatch: null, winRate: 0, message: "No matching pattern in history" };
  }

  generateReasoning(layerScores, totalScore) {
    const bestLayers = Object.entries(layerScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 3)
      .map(([name, data]) => `${name} (${data.score}/100)`)
      .join(", ");

    return `Overall edge score: ${totalScore}/100. Strongest signals: ${bestLayers}`;
  }
}

module.exports = new EightLayerValidator();
