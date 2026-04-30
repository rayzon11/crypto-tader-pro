const BaseAgent = require('./baseAgent');

class ArbitrageScoutAgent extends BaseAgent {
  constructor() {
    super('ARBITRAGE_SCOUT', 'ARBITRAGE_SCOUT');
    this.minSpread = 0.003; // 0.3% minimum after fees
    this.executionCost = 0.0025; // 0.25% (slippage + fees)
    this.opportunities = [];
  }

  // Scan for arbitrage between venues
  scanSpreads(binancePrices, dexPrices) {
    const arbs = [];

    for (const symbol of Object.keys(binancePrices)) {
      const binPrice = binancePrices[symbol]?.price;
      if (!binPrice) continue;

      // Check against DEX prices (simulated or real)
      const dexPrice = dexPrices?.[symbol]?.price || binPrice * (1 + (Math.random() - 0.5) * 0.008);
      const spread = Math.abs(dexPrice - binPrice) / binPrice;
      const netProfit = spread - this.executionCost;

      this.opportunities.push({
        symbol,
        binPrice,
        dexPrice: parseFloat(dexPrice.toFixed(2)),
        spread: parseFloat((spread * 100).toFixed(4)),
        netProfit: parseFloat((netProfit * 100).toFixed(4)),
        profitable: netProfit > 0,
        timestamp: new Date().toISOString(),
      });

      if (netProfit > 0 && spread >= this.minSpread) {
        const buyVenue = binPrice < dexPrice ? 'BINANCE' : 'DEX';
        const sellVenue = binPrice < dexPrice ? 'DEX' : 'BINANCE';

        arbs.push({
          arb_type: 'CEX_vs_DEX',
          asset: symbol.replace('USDT', ''),
          buy_venue: buyVenue,
          sell_venue: sellVenue,
          buy_price: Math.min(binPrice, dexPrice),
          sell_price: Math.max(binPrice, dexPrice),
          gross_spread: parseFloat((spread * 100).toFixed(3)),
          net_profit: parseFloat((netProfit * 100).toFixed(3)),
          execution_window: '30 seconds',
          recommended_size: netProfit > 0.005 ? 2000 : 1000,
          confidence: parseFloat(Math.min(0.95, 0.70 + netProfit * 20).toFixed(2)),
        });
      }
    }

    // Keep last 500 opportunities
    if (this.opportunities.length > 500) this.opportunities = this.opportunities.slice(-500);

    if (arbs.length > 0) {
      arbs.sort((a, b) => b.net_profit - a.net_profit);
      return this.logDecision({
        signal_type: 'ARBITRAGE',
        opportunities: arbs,
        best: arbs[0],
        total_scanned: Object.keys(binancePrices).length,
      });
    }

    return this.logDecision({
      signal_type: 'NO_ARB',
      reasoning: `Scanned ${Object.keys(binancePrices).length} pairs, no profitable spreads > ${this.minSpread * 100}%`,
    });
  }

  // Get stats on missed opportunities
  getOpportunityStats() {
    const profitable = this.opportunities.filter(o => o.profitable);
    return {
      total_scanned: this.opportunities.length,
      profitable: profitable.length,
      hit_rate: this.opportunities.length > 0
        ? parseFloat((profitable.length / this.opportunities.length * 100).toFixed(1))
        : 0,
      avg_spread: this.opportunities.length > 0
        ? parseFloat((this.opportunities.reduce((s, o) => s + o.spread, 0) / this.opportunities.length).toFixed(4))
        : 0,
    };
  }
}

module.exports = new ArbitrageScoutAgent();
