// LIVE DATA INGESTION SERVICE
// Polls Binance REST API and feeds candles into multiTimeframeTradingEngine
// This unblocks all indicator calculations and Bitcoin predictions.

const marketDataFetcher = require('./marketDataFetcher');
const mte = require('./multiTimeframeTradingEngine');

// Binance interval mapping
const BINANCE_INTERVALS = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '30m': '30m',
  '1h':  '1h',
  '4h':  '4h',
  '1d':  '1d',
  '1w':  '1w',
};

// Top crypto pairs to track. Format: 'BTC/USDT' (mte) <-> 'BTCUSDT' (Binance)
const CRYPTO_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'LINK/USDT', 'MATIC/USDT',
  'DOT/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT', 'NEAR/USDT',
  'ARB/USDT', 'OP/USDT', 'APT/USDT', 'FIL/USDT', 'SHIB/USDT',
];

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
// Priority pairs get upgraded treatment (more frequent polls, WebSocket in future)
const PRIORITY_PAIRS = ['BTC/USDT', 'ETH/USDT'];

// Polling intervals (ms) — short timeframes update more often
const POLL_INTERVALS = {
  '1m':  30_000,    // 30s
  '5m':  60_000,    // 1m
  '15m': 120_000,   // 2m
  '30m': 180_000,   // 3m
  '1h':  300_000,   // 5m
  '4h':  900_000,   // 15m
  '1d':  3_600_000, // 1h
  '1w':  21_600_000, // 6h
};

class LiveDataIngestion {
  constructor() {
    this.timers = [];
    this.lastFetched = {}; // `${pair}_${tf}` -> timestamp
    this.bootstrapped = false;
  }

  // Convert 'BTC/USDT' -> 'BTCUSDT'
  toBinanceSymbol(pair) {
    return pair.replace('/', '');
  }

  // Bootstrap: fetch last 200 candles for every pair/timeframe so indicators activate immediately
  async bootstrap() {
    console.log('[LIVE-DATA] Bootstrapping historical candles for indicator warm-up...');
    let totalLoaded = 0;
    for (const pair of CRYPTO_PAIRS) {
      const symbol = this.toBinanceSymbol(pair);
      for (const tf of TIMEFRAMES) {
        try {
          const klines = await marketDataFetcher.fetchKlines(symbol, BINANCE_INTERVALS[tf], 200);
          if (klines && klines.length > 0) {
            for (const candle of klines) {
              mte.addCandle(pair, tf, candle);
            }
            totalLoaded += klines.length;
          }
          // Be polite to Binance — small delay between requests
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          // Non-fatal; just skip this pair/tf
        }
      }
      console.log(`[LIVE-DATA] Bootstrapped ${pair} across ${TIMEFRAMES.length} timeframes`);
    }
    this.bootstrapped = true;
    console.log(`[LIVE-DATA] Bootstrap complete. Loaded ${totalLoaded} candles for ${CRYPTO_PAIRS.length} pairs.`);
  }

  // Poll for fresh candles for a single pair/timeframe
  async pollPairTimeframe(pair, tf) {
    try {
      const symbol = this.toBinanceSymbol(pair);
      const klines = await marketDataFetcher.fetchKlines(symbol, BINANCE_INTERVALS[tf], 5);
      if (!klines || klines.length === 0) return;
      const key = `${pair}_${tf}`;
      const last = this.lastFetched[key] || 0;
      // Only add candles newer than the last one we saw
      for (const candle of klines) {
        if (candle.timestamp > last) {
          mte.addCandle(pair, tf, candle);
        }
      }
      this.lastFetched[key] = klines[klines.length - 1].timestamp;
    } catch (err) {
      // Silent fail — next poll will retry
    }
  }

  // Start polling all pairs/timeframes on their respective intervals
  startPolling() {
    console.log('[LIVE-DATA] Starting live polling loops...');
    for (const tf of TIMEFRAMES) {
      const interval = POLL_INTERVALS[tf];
      const timer = setInterval(async () => {
        for (const pair of CRYPTO_PAIRS) {
          await this.pollPairTimeframe(pair, tf);
          // Throttle — avoid hitting Binance rate limits
          await new Promise(r => setTimeout(r, 50));
        }
      }, interval);
      this.timers.push(timer);
    }
    console.log(`[LIVE-DATA] Polling ${CRYPTO_PAIRS.length} pairs across ${TIMEFRAMES.length} timeframes`);
  }

  async start() {
    // Run bootstrap async (don't block server startup), then begin polling
    this.bootstrap()
      .then(() => this.startPolling())
      .catch(err => console.error('[LIVE-DATA] Bootstrap failed:', err.message));
  }

  stop() {
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];
    console.log('[LIVE-DATA] Stopped all polling loops');
  }

  getStatus() {
    return {
      bootstrapped: this.bootstrapped,
      pairs: CRYPTO_PAIRS.length,
      timeframes: TIMEFRAMES.length,
      activeTimers: this.timers.length,
    };
  }
}

module.exports = new LiveDataIngestion();
module.exports.CRYPTO_PAIRS = CRYPTO_PAIRS;
module.exports.TIMEFRAMES = TIMEFRAMES;
module.exports.PRIORITY_PAIRS = PRIORITY_PAIRS;
