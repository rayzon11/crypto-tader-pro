// Sentiment Analysis Service
// Combines Fear & Greed Index, Social Sentiment, News Sentiment

const axios = require('axios');

class SentimentAnalysis {
  async getMarketSentiment(symbol) {
    const [fgi, social, news] = await Promise.all([
      this.fetchFearGreedIndex(),
      this.fetchSocialSentiment(symbol),
      this.fetchNewsSentiment(symbol)
    ]);

    const combined = (fgi * 0.4) + (social * 0.3) + (news * 0.3);

    return {
      fearGreedIndex: fgi,
      socialSentiment: social,
      newsSentiment: news,
      combined: combined.toFixed(1),
      level: combined > 70 ? "BULLISH" : combined > 40 ? "NEUTRAL" : "BEARISH",
      recommendation: this.getSentimentRecommendation(combined)
    };
  }

  async fetchFearGreedIndex() {
    try {
      const response = await axios.get('https://api.alternative.me/fng/', { timeout: 5000 });
      return parseInt(response.data.data[0].value);
    } catch (error) {
      console.warn('FGI fetch failed:', error.message);
      return 50; // neutral default
    }
  }

  async fetchSocialSentiment(symbol) {
    try {
      // Integration point for Reddit/Twitter API or LunarCrush
      // Returns 0-100 sentiment score
      // Demo mode: simulated score
      if (process.env.MODE === 'DEMO') {
        return 50 + Math.floor(Math.random() * 30 - 15);
      }

      // TODO: Integrate with real social sentiment API
      // const response = await axios.get(`https://api.lunarcrush.com/v2?data=assets&symbol=${symbol}`);
      return 50;
    } catch (error) {
      return 50;
    }
  }

  async fetchNewsSentiment(symbol) {
    try {
      // Integration point for CryptoPanic or NewsAPI
      // Returns 0-100 sentiment score
      if (process.env.MODE === 'DEMO') {
        return 50 + Math.floor(Math.random() * 20 - 10);
      }

      // TODO: Integrate with CryptoPanic API
      // const response = await axios.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${key}&currencies=${symbol}`);
      return 50;
    } catch (error) {
      return 50;
    }
  }

  getSentimentRecommendation(score) {
    if (score > 75) return "FAVOR_LONG_INCREASE_SIZE_30%";
    if (score > 60) return "FAVOR_LONG";
    if (score > 40) return "NEUTRAL_TRADE_TECHNICALS_ONLY";
    if (score > 25) return "FAVOR_SHORT";
    return "AVOID_TRADING_BEARISH_BIAS";
  }
}

module.exports = new SentimentAnalysis();
