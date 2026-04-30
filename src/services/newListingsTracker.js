/**
 * New-Listings & Meme-Coin Tracker
 * ────────────────────────────────
 * Three feeds:
 *   1. NEW LISTINGS on Binance (`/api/v3/exchangeInfo` diff vs last snapshot)
 *   2. MEME COIN watchlist with live 24h stats
 *   3. CRYPTO "IPO" analyst — scores newly-listed tokens on:
 *        • 24h volume         (liquidity gate)
 *        • 24h % move         (hype vs overheat)
 *        • bid-ask spread     (market-maker quality)
 *        • listing age        (1–7 days = hot IPO window)
 *        • momentum vs BTC    (beta)
 *      Emits BUY / WATCH / AVOID verdict with reasoning.
 *
 * Runs in background with persistent memory (survives restarts).
 */
const axios = require('axios');
const memory = require('./memoryStore');

// Curated meme coin watchlist (Binance-listed majors)
const MEME_COINS = [
  'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'BONKUSDT',
  'WIFUSDT', 'MEMEUSDT', 'BOMEUSDT', '1000SATSUSDT',
  'TURBOUSDT', 'BRETTUSDT', 'POPCATUSDT', 'MEWUSDT',
  'NEIROUSDT', 'PNUTUSDT', 'GOATUSDT', 'MOODENGUSDT',
  'TRUMPUSDT', 'PENGUUSDT',
];

const LISTING_HOT_WINDOW_DAYS = 14;
const LISTING_NEW_WINDOW_DAYS = 7;

class NewListingsTracker {
  constructor() {
    this.allSymbols = new Set();
    this.listingDates = {};     // symbol → first-seen-at ms (from memory or exchangeInfo.onboardDate)
    this.newListings = [];      // last 50 newly detected
    this.memeStats = {};        // symbol → { price, change24h, volume, ... }
    this.newListingScores = {}; // symbol → { score, verdict, reasoning, ... }
    this.btc24h = 0;

    const saved = memory.get('newListings') || {};
    this.listingDates = saved.listingDates || {};
    this.newListings = saved.newListings || [];
    this.newListingScores = saved.newListingScores || {};
    memory.subscribe('newListings', () => ({
      listingDates: this.listingDates,
      newListings: this.newListings.slice(-100),
      newListingScores: this.newListingScores,
    }));
  }

  async _fetchExchangeInfo() {
    const r = await axios.get('https://api.binance.com/api/v3/exchangeInfo', { timeout: 8000 });
    return r.data.symbols.filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT');
  }

  async _fetch24hr(symbols) {
    const syms = encodeURIComponent(JSON.stringify(symbols));
    const r = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbols=${syms}`, { timeout: 10000 });
    return r.data;
  }

  async _fetchBookTicker(symbols) {
    const syms = encodeURIComponent(JSON.stringify(symbols));
    const r = await axios.get(`https://api.binance.com/api/v3/ticker/bookTicker?symbols=${syms}`, { timeout: 8000 });
    return r.data;
  }

  async tick() {
    try {
      const syms = await this._fetchExchangeInfo();
      const currentSet = new Set(syms.map(s => s.symbol));

      // ─ Detect newly listed symbols ─
      for (const s of syms) {
        if (!this.listingDates[s.symbol]) {
          // First time we see it → record either onboardDate or now
          const onboard = s.onboardDate && s.onboardDate > 0 ? s.onboardDate : Date.now();
          this.listingDates[s.symbol] = onboard;
          // Only announce if we had already bootstrapped at least once (otherwise everything is "new")
          if (this.allSymbols.size > 0) {
            const entry = { symbol: s.symbol, base: s.baseAsset, listedAt: onboard, detectedAt: Date.now() };
            this.newListings.push(entry);
            if (this.newListings.length > 100) this.newListings.shift();
            console.log(`[NEW-LISTING] ${s.symbol} (${s.baseAsset}) detected`);
          }
        }
      }
      this.allSymbols = currentSet;

      // ─ Hot-window listings (< 14 days old) ─
      const hotWindowMs = LISTING_HOT_WINDOW_DAYS * 86400_000;
      const hotSyms = Object.entries(this.listingDates)
        .filter(([sym, ts]) => currentSet.has(sym) && Date.now() - ts < hotWindowMs)
        .map(([sym]) => sym);

      // ─ Batch 24hr stats for memes + hot listings ─
      const watched = [...new Set([...MEME_COINS.filter(s => currentSet.has(s)), ...hotSyms, 'BTCUSDT'])];
      if (watched.length === 0) return;

      const [stats24, book] = await Promise.all([
        this._fetch24hr(watched),
        this._fetchBookTicker(watched).catch(() => []),
      ]);
      const bookBySym = Object.fromEntries(book.map(b => [b.symbol, b]));

      const btcRow = stats24.find(s => s.symbol === 'BTCUSDT');
      this.btc24h = btcRow ? +btcRow.priceChangePercent : 0;

      // ─ Meme coin stats ─
      for (const s of stats24) {
        if (!MEME_COINS.includes(s.symbol)) continue;
        const b = bookBySym[s.symbol];
        const spreadPct = b && +b.bidPrice ? ((+b.askPrice - +b.bidPrice) / +b.bidPrice) * 100 : null;
        this.memeStats[s.symbol] = {
          symbol: s.symbol,
          price: +s.lastPrice,
          change24h: +s.priceChangePercent,
          high24h: +s.highPrice,
          low24h: +s.lowPrice,
          volume: +s.volume,
          quoteVolume: +s.quoteVolume,
          trades: +s.count,
          spreadPct,
          betaVsBtc: this.btc24h ? +s.priceChangePercent / this.btc24h : null,
          ts: Date.now(),
        };
      }

      // ─ IPO analyst scoring on hot-window listings ─
      for (const sym of hotSyms) {
        const row = stats24.find(x => x.symbol === sym);
        if (!row) continue;
        const b = bookBySym[sym];
        const listedAt = this.listingDates[sym];
        const ageDays = (Date.now() - listedAt) / 86400_000;
        const volUsd = +row.quoteVolume;
        const change = +row.priceChangePercent;
        const spreadPct = b && +b.bidPrice ? ((+b.askPrice - +b.bidPrice) / +b.bidPrice) * 100 : 100;
        const trades = +row.count;

        // Scoring (0..100)
        let score = 50;
        // Liquidity bonus
        if (volUsd > 50_000_000) score += 25;
        else if (volUsd > 10_000_000) score += 15;
        else if (volUsd > 1_000_000) score += 5;
        else score -= 20;
        // Trade count (activity)
        if (trades > 100_000) score += 10;
        else if (trades < 1000) score -= 15;
        // Spread
        if (spreadPct < 0.05) score += 10;
        else if (spreadPct < 0.2) score += 5;
        else if (spreadPct > 1) score -= 15;
        // Hype vs overheat
        if (change > 50) score -= 15;         // Parabolic = risky
        else if (change > 15) score += 10;    // Healthy momentum
        else if (change > 0) score += 5;
        else if (change < -30) score -= 10;   // Post-dump
        // Listing freshness
        if (ageDays < 1) score -= 5;          // Too fresh, volatile
        else if (ageDays < LISTING_NEW_WINDOW_DAYS) score += 5;

        score = Math.max(0, Math.min(100, score));
        const verdict = score >= 70 ? 'BUY' : score >= 50 ? 'WATCH' : 'AVOID';
        const reasoning = [
          `Listed ${ageDays.toFixed(1)}d ago`,
          `24h vol $${(volUsd / 1e6).toFixed(2)}M`,
          `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
          `spread ${spreadPct.toFixed(3)}%`,
          `${(trades / 1000).toFixed(0)}k trades`,
          this.btc24h ? `β ${(+row.priceChangePercent / this.btc24h).toFixed(2)} vs BTC` : '',
        ].filter(Boolean).join(' · ');

        this.newListingScores[sym] = {
          symbol: sym,
          base: sym.replace('USDT', ''),
          listedAt,
          ageDays: +ageDays.toFixed(2),
          price: +row.lastPrice,
          change24h: change,
          volume: +row.volume,
          quoteVolume: volUsd,
          trades,
          spreadPct,
          score,
          verdict,
          reasoning,
          ts: Date.now(),
        };
      }
    } catch (e) {
      console.error('[NEW-LISTINGS] tick err:', e.message);
    }
  }

  start() {
    if (this._timer) return;
    this.tick();
    this._timer = setInterval(() => this.tick(), 60_000); // every 60s
    console.log('[NEW-LISTINGS] tracker started — scanning Binance exchangeInfo every 60s');
  }

  getMemeStats() {
    return Object.values(this.memeStats).sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0));
  }

  getNewListings() {
    return this.newListings.slice().reverse();
  }

  getIpoAnalysis() {
    return Object.values(this.newListingScores).sort((a, b) => b.score - a.score);
  }

  status() {
    return {
      trackedSymbols: this.allSymbols.size,
      memeCount: Object.keys(this.memeStats).length,
      newListingCount: this.newListings.length,
      ipoWindowCount: Object.keys(this.newListingScores).length,
      btc24hPct: this.btc24h,
    };
  }
}

module.exports = new NewListingsTracker();
