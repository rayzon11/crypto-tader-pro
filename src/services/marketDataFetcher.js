const axios = require('axios');

class MarketDataFetcher {
  constructor() {
    this.binanceAPI = 'https://api.binance.com/api/v3';
    this.top20Assets = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
      'LINKUSDT', 'AAVEUSDT', 'UNIUSDT', 'AVAXUSDT', 'ADAUSDT',
    ];
  }

  async fetchRealTimeQuotes() {
    try {
      const quotes = {};
      for (const symbol of this.top20Assets) {
        const response = await axios.get(`${this.binanceAPI}/ticker/24hr`, {
          params: { symbol },
          timeout: 5000,
        });
        quotes[symbol] = {
          symbol,
          price: parseFloat(response.data.lastPrice),
          volume24h: parseFloat(response.data.volume),
          change24h: parseFloat(response.data.priceChangePercent),
          high: parseFloat(response.data.highPrice),
          low: parseFloat(response.data.lowPrice),
        };
      }
      return quotes;
    } catch (error) {
      console.error('Failed to fetch market data:', error.message);
      return null;
    }
  }

  async fetchKlines(symbol, interval = '4h', limit = 500) {
    try {
      const response = await axios.get(`${this.binanceAPI}/klines`, {
        params: { symbol, interval, limit },
        timeout: 10000,
      });
      return response.data.map(candle => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[7]),
      }));
    } catch (error) {
      console.error(`Failed to fetch klines for ${symbol}:`, error.message);
      return null;
    }
  }

  async fetchOrderBook(symbol, limit = 20) {
    try {
      const response = await axios.get(`${this.binanceAPI}/depth`, {
        params: { symbol, limit },
        timeout: 5000,
      });
      return {
        bids: response.data.bids,
        asks: response.data.asks,
      };
    } catch (error) {
      console.error(`Failed to fetch orderbook for ${symbol}:`, error.message);
      return null;
    }
  }
}

module.exports = new MarketDataFetcher();
