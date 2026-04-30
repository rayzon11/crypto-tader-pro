// On-Chain Intelligence Service
// Tracks whale behavior, network activity, funding rates

const axios = require('axios');

class OnChainAnalysis {
  async analyzeOnChain(symbol) {
    const [whaleMovement, networkActivity, fundingRates] = await Promise.all([
      this.analyzeWhaleMovement(symbol),
      this.getNetworkActivity(symbol),
      this.getFundingRates(symbol)
    ]);

    let score = 50; // neutral baseline
    if (whaleMovement.accumulating) score += 15;
    if (whaleMovement.distributing) score -= 15;
    if (networkActivity.percentile > 70) score += 10;
    if (networkActivity.percentile < 30) score -= 10;
    if (fundingRates.annualized > 18) score -= 5; // overheated
    if (fundingRates.annualized < -10) score += 5; // discounted

    return {
      whaleMovement,
      networkActivity,
      fundingRates,
      score: Math.max(0, Math.min(100, score)),
      signal: score > 65 ? "BULLISH" : score < 35 ? "BEARISH" : "NEUTRAL"
    };
  }

  async analyzeWhaleMovement(symbol) {
    try {
      // Integration point for Glassnode, Nansen, or Whale Alert API
      if (process.env.MODE === 'DEMO') {
        const accumulation = Math.random() * 100;
        return {
          largeTransactionsLast24h: Math.floor(accumulation),
          accumulating: accumulation > 60,
          distributing: accumulation < 40,
          confidence: 0.72
        };
      }

      // TODO: Integrate with Glassnode API
      // const response = await axios.get(`https://api.glassnode.com/v1/metrics/transactions/transfers_volume_large`);
      return { largeTransactionsLast24h: 0, accumulating: false, distributing: false, confidence: 0 };
    } catch (error) {
      console.warn('Whale analysis failed:', error.message);
      return { error: "Failed to fetch whale data" };
    }
  }

  async getNetworkActivity(symbol) {
    try {
      if (process.env.MODE === 'DEMO') {
        const activeAddresses = Math.random() * 100;
        const txVolume = Math.random() * 100;
        return {
          activeAddressesPercentile: Math.floor(activeAddresses),
          txVolumePercentile: Math.floor(txVolume),
          percentile: Math.floor((activeAddresses + txVolume) / 2)
        };
      }

      // TODO: Integrate with blockchain analytics API
      return { activeAddressesPercentile: 50, txVolumePercentile: 50, percentile: 50 };
    } catch (error) {
      return { error: "Failed to fetch network data" };
    }
  }

  async getFundingRates(symbol) {
    try {
      // Fetch from Binance futures funding rate
      const cleanSymbol = symbol.replace('/', '');
      const response = await axios.get('https://fapi.binance.com/fapi/v1/fundingRate', {
        params: { symbol: cleanSymbol, limit: 1 },
        timeout: 5000
      });

      if (response.data && response.data.length > 0) {
        const fundingRate = parseFloat(response.data[0].fundingRate);
        const annualized = fundingRate * 3 * 365 * 100; // 3 funding periods per day

        return {
          currentRate: (fundingRate * 100).toFixed(4),
          annualized: parseFloat(annualized.toFixed(2)),
          interpretation: annualized > 0 ? "Bulls paying (long bias)" : "Bears paying (short bias)"
        };
      }

      return { currentRate: "0.0000", annualized: 0, interpretation: "No data" };
    } catch (error) {
      if (process.env.MODE === 'DEMO') {
        const rate = (Math.random() * 0.001) - 0.0005;
        return {
          currentRate: (rate * 100).toFixed(4),
          annualized: parseFloat((rate * 3 * 365 * 100).toFixed(2)),
          interpretation: rate > 0 ? "Bulls paying" : "Bears paying"
        };
      }
      return { currentRate: "0.0000", annualized: 0, interpretation: "Unavailable" };
    }
  }
}

module.exports = new OnChainAnalysis();
