/**
 * Bot API v1 — stable REST surface for trading bots
 * ───────────────────────────────────────────────────
 * Phase 1 endpoints from the master spec. Proxies Binance for market
 * data (so bots don't need direct exchange keys), adds server-side
 * indicator calculations, and exposes the news aggregator.
 *
 * GET  /api/v1/klines     — OHLCV
 * GET  /api/v1/ticker     — 24h ticker
 * GET  /api/v1/orderbook  — depth
 * GET  /api/v1/trades     — recent trades
 * GET  /api/v1/indicators — RSI/MACD/BB/EMA/ATR/ADX computed server-side
 * GET  /api/v1/correlation — rolling Pearson between N assets
 * GET  /api/v1/news       — from newsAggregator
 * GET  /api/v1/status     — uptime + data freshness
 */

const newsAgg = require("./newsAggregator");

const BINANCE = "https://api.binance.com";

async function bfetch(path, ms = 6000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`${BINANCE}${path}`, { signal: ac.signal });
    if (!r.ok) throw new Error(`binance ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ── Indicator math (self-contained, no deps) ─────────────────────
function sma(arr, p) {
  const out = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= p) sum -= arr[i - p];
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
}
function ema(arr, p) {
  const out = new Array(arr.length).fill(null);
  const k = 2 / (p + 1);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) continue;
    if (prev == null) {
      let s = 0;
      for (let j = i - p + 1; j <= i; j++) s += arr[j];
      prev = s / p;
    } else {
      prev = arr[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}
function rsi(arr, p = 14) {
  const out = new Array(arr.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    const g = Math.max(0, d), l = Math.max(0, -d);
    if (i <= p) {
      gain += g; loss += l;
      if (i === p) {
        const ag = gain / p, al = loss / p;
        out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        gain = ag; loss = al;
      }
    } else {
      gain = (gain * (p - 1) + g) / p;
      loss = (loss * (p - 1) + l) / p;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}
function macd(arr, fast = 12, slow = 26, sig = 9) {
  const ef = ema(arr, fast), es = ema(arr, slow);
  const line = arr.map((_, i) => ef[i] != null && es[i] != null ? ef[i] - es[i] : null);
  const linePop = line.filter(x => x != null);
  const signalPart = ema(linePop, sig);
  const signal = new Array(arr.length).fill(null);
  let j = 0;
  for (let i = 0; i < line.length; i++) if (line[i] != null) { signal[i] = signalPart[j++]; }
  const hist = line.map((v, i) => v != null && signal[i] != null ? v - signal[i] : null);
  return { line, signal, hist };
}
function bb(arr, p = 20, mult = 2) {
  const mid = sma(arr, p);
  const up = new Array(arr.length).fill(null);
  const lo = new Array(arr.length).fill(null);
  for (let i = p - 1; i < arr.length; i++) {
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += (arr[j] - mid[i]) ** 2;
    const sd = Math.sqrt(s / p);
    up[i] = mid[i] + mult * sd;
    lo[i] = mid[i] - mult * sd;
  }
  return { mid, up, lo };
}
function atr(highs, lows, closes, p = 14) {
  const tr = new Array(closes.length).fill(null);
  for (let i = 1; i < closes.length; i++) {
    const a = highs[i] - lows[i];
    const b = Math.abs(highs[i] - closes[i - 1]);
    const c = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(a, b, c);
  }
  const out = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 1; i <= p; i++) sum += tr[i] || 0;
  out[p] = sum / p;
  for (let i = p + 1; i < closes.length; i++) {
    out[i] = (out[i - 1] * (p - 1) + (tr[i] || 0)) / p;
  }
  return out;
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const d = Math.sqrt(da * db);
  return d === 0 ? 0 : num / d;
}

// ── Route registration ─────────────────────────────────────────
function register(app) {
  // 24h ticker
  app.get("/api/v1/ticker", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const d = await bfetch(`/api/v3/ticker/24hr?symbol=${symbol}`);
      res.json({
        symbol: d.symbol,
        lastPrice: parseFloat(d.lastPrice),
        priceChangePct: parseFloat(d.priceChangePercent),
        high24h: parseFloat(d.highPrice),
        low24h: parseFloat(d.lowPrice),
        volume: parseFloat(d.volume),
        quoteVolume: parseFloat(d.quoteVolume),
        trades: Number(d.count),
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Klines
  app.get("/api/v1/klines", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const interval = String(req.query.interval || "1h");
      const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 200));
      const raw = await bfetch(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const data = raw.map(k => ({
        openTime: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
        low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
        closeTime: k[6], trades: Number(k[8]),
      }));
      res.json({ symbol, interval, count: data.length, data, ts: Date.now() });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Orderbook
  app.get("/api/v1/orderbook", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const limit = Math.min(5000, Math.max(5, parseInt(req.query.limit, 10) || 50));
      const d = await bfetch(`/api/v3/depth?symbol=${symbol}&limit=${limit}`);
      const bids = d.bids.map(b => [parseFloat(b[0]), parseFloat(b[1])]);
      const asks = d.asks.map(a => [parseFloat(a[0]), parseFloat(a[1])]);
      const bestBid = bids[0]?.[0], bestAsk = asks[0]?.[0];
      res.json({
        symbol, bids, asks,
        spread: bestBid && bestAsk ? bestAsk - bestBid : null,
        spreadPct: bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 100 : null,
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Recent trades
  app.get("/api/v1/trades", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 100));
      const d = await bfetch(`/api/v3/trades?symbol=${symbol}&limit=${limit}`);
      res.json({
        symbol,
        trades: d.map(t => ({
          id: t.id, price: parseFloat(t.price), qty: parseFloat(t.qty),
          time: t.time, isBuyerMaker: t.isBuyerMaker,
        })),
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Indicators (server-side — bots fetch once, get full analysis)
  app.get("/api/v1/indicators", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const interval = String(req.query.interval || "1h");
      const limit = Math.min(500, Math.max(30, parseInt(req.query.limit, 10) || 200));
      const raw = await bfetch(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const closes = raw.map(k => parseFloat(k[4]));
      const highs = raw.map(k => parseFloat(k[2]));
      const lows = raw.map(k => parseFloat(k[3]));

      const ema20 = ema(closes, 20);
      const ema50 = ema(closes, 50);
      const ema200 = ema(closes, 200);
      const sma20 = sma(closes, 20);
      const rsi14 = rsi(closes, 14);
      const m = macd(closes);
      const bands = bb(closes, 20, 2);
      const atr14 = atr(highs, lows, closes, 14);

      const last = closes.length - 1;
      res.json({
        symbol, interval, bars: closes.length,
        price: closes[last],
        indicators: {
          ema20: ema20[last], ema50: ema50[last], ema200: ema200[last],
          sma20: sma20[last],
          rsi14: rsi14[last],
          macd: { line: m.line[last], signal: m.signal[last], hist: m.hist[last] },
          bb: { mid: bands.mid[last], up: bands.up[last], lo: bands.lo[last] },
          atr14: atr14[last],
        },
        signals: {
          trend: ema20[last] != null && ema50[last] != null
            ? (ema20[last] > ema50[last] ? "UP" : "DOWN") : "NEUTRAL",
          rsiState: rsi14[last] == null ? "—"
            : rsi14[last] > 70 ? "OVERBOUGHT" : rsi14[last] < 30 ? "OVERSOLD" : "NEUTRAL",
          macdSignal: m.hist[last] == null ? "—"
            : m.hist[last] > 0 ? "BULLISH" : "BEARISH",
          bbPosition: bands.up[last] && bands.lo[last]
            ? (closes[last] > bands.up[last] ? "ABOVE_UPPER"
              : closes[last] < bands.lo[last] ? "BELOW_LOWER" : "INSIDE") : "—",
        },
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Correlation matrix
  app.get("/api/v1/correlation", async (req, res) => {
    try {
      const symbols = String(req.query.symbols || "BTCUSDT,ETHUSDT,SOLUSDT")
        .split(",").map(s => s.trim().toUpperCase()).slice(0, 10);
      const interval = String(req.query.interval || "1h");
      const limit = Math.min(500, Math.max(20, parseInt(req.query.limit, 10) || 168));
      const all = await Promise.all(symbols.map(async s => {
        const raw = await bfetch(`/api/v3/klines?symbol=${s}&interval=${interval}&limit=${limit}`);
        const closes = raw.map(k => parseFloat(k[4]));
        const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
        return { symbol: s, returns: rets };
      }));
      const matrix = {};
      for (const a of all) {
        matrix[a.symbol] = {};
        for (const b of all) {
          matrix[a.symbol][b.symbol] = a.symbol === b.symbol ? 1 : pearson(a.returns, b.returns);
        }
      }
      res.json({ symbols, interval, bars: limit, matrix, ts: Date.now() });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // News
  app.get("/api/v1/news", (req, res) => {
    const limit = Math.min(120, Math.max(1, parseInt(req.query.limit, 10) || 60));
    const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : null;
    const sentiment = req.query.sentiment; // "bull" | "bear" | "neutral"
    let out = newsAgg.items();
    if (symbol) out = out.filter(n => n.symbols.includes(symbol));
    if (sentiment === "bull") out = out.filter(n => n.sentiment > 0.15);
    else if (sentiment === "bear") out = out.filter(n => n.sentiment < -0.15);
    else if (sentiment === "neutral") out = out.filter(n => Math.abs(n.sentiment) <= 0.15);
    res.json({ count: out.length, items: out.slice(0, limit), status: newsAgg.status(), ts: Date.now() });
  });

  // Status
  app.get("/api/v1/status", (_req, res) => {
    res.json({
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      news: newsAgg.status(),
      endpoints: [
        "/api/v1/klines", "/api/v1/ticker", "/api/v1/orderbook", "/api/v1/trades",
        "/api/v1/indicators", "/api/v1/correlation", "/api/v1/news", "/api/v1/status",
      ],
      ts: Date.now(),
    });
  });

  console.log("[BOT-API] v1 endpoints registered: klines, ticker, orderbook, trades, indicators, correlation, news, status");
}

module.exports = { register };
