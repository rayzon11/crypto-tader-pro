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
const candleCache = require("./candleCache");

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
      // Persist to cache so we build up history over time
      try {
        candleCache.put(symbol, interval, data.map(d => ({
          timestamp: d.openTime, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
        })));
      } catch {}
      res.json({ symbol, interval, count: data.length, data, ts: Date.now() });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Cached candles (offline / backtest fast path)
  app.get("/api/v1/candles/cached", (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const interval = String(req.query.interval || "1h");
      const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit, 10) || 500));
      const rows = candleCache.get(symbol, interval, limit);
      res.json({ symbol, interval, count: rows.length, data: rows, ts: Date.now() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/v1/cache/stats", (_req, res) => res.json(candleCache.stats()));

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

  // ── Volume Profile (VPVR) ─────────────────────────────────────────
  // Bloomberg-style Volume-at-Price: POC, VAH, VAL, HVN/LVN detection
  app.get("/api/v1/volume-profile", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const interval = String(req.query.interval || "1h");
      const limit = Math.min(1000, Math.max(50, parseInt(req.query.limit, 10) || 500));
      const buckets = Math.min(100, Math.max(20, parseInt(req.query.buckets, 10) || 50));

      const raw = await bfetch(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const bars = raw.map(k => ({
        h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]),
        v: parseFloat(k[5]), buyVol: parseFloat(k[9]) || 0,
      }));
      const hi = Math.max(...bars.map(b => b.h));
      const lo = Math.min(...bars.map(b => b.l));
      const step = (hi - lo) / buckets;
      if (!Number.isFinite(step) || step <= 0) return res.json({ symbol, buckets: [], poc: null });

      // Distribute each bar's volume across buckets it spans
      const bins = new Array(buckets).fill(0).map(() => ({ price: 0, vol: 0, buy: 0, sell: 0 }));
      for (let i = 0; i < buckets; i++) bins[i].price = lo + step * (i + 0.5);
      for (const b of bars) {
        const spanLo = Math.max(0, Math.floor((b.l - lo) / step));
        const spanHi = Math.min(buckets - 1, Math.floor((b.h - lo) / step));
        const span = spanHi - spanLo + 1;
        if (span <= 0) continue;
        const share = b.v / span;
        const buyShare = b.buyVol / span;
        const sellShare = (b.v - b.buyVol) / span;
        for (let i = spanLo; i <= spanHi; i++) {
          bins[i].vol += share;
          bins[i].buy += buyShare;
          bins[i].sell += sellShare;
        }
      }
      const totalVol = bins.reduce((s, b) => s + b.vol, 0);
      const pocIdx = bins.reduce((a, b, i, arr) => b.vol > arr[a].vol ? i : a, 0);
      const poc = bins[pocIdx];
      // Value Area: expand around POC until 70% of volume captured
      const target = totalVol * 0.70;
      let captured = bins[pocIdx].vol;
      let lo_i = pocIdx, hi_i = pocIdx;
      while (captured < target && (lo_i > 0 || hi_i < buckets - 1)) {
        const nextLo = lo_i > 0 ? bins[lo_i - 1].vol : -1;
        const nextHi = hi_i < buckets - 1 ? bins[hi_i + 1].vol : -1;
        if (nextHi > nextLo) { hi_i++; captured += bins[hi_i].vol; }
        else if (nextLo >= 0) { lo_i--; captured += bins[lo_i].vol; }
        else break;
      }
      // HVN/LVN — high/low volume nodes (>1.5x / <0.3x avg)
      const avg = totalVol / buckets;
      const nodes = bins.map((b, i) => ({
        price: b.price, vol: b.vol,
        type: b.vol > avg * 1.5 ? "HVN" : b.vol < avg * 0.3 ? "LVN" : "NORMAL",
        delta: b.buy - b.sell, buyPct: b.vol > 0 ? b.buy / b.vol : 0.5,
        idx: i,
      }));

      res.json({
        symbol, interval, limit, buckets,
        priceRange: { lo, hi, step },
        totalVol,
        poc: { price: poc.price, vol: poc.vol, idx: pocIdx },
        valueArea: { vah: bins[hi_i].price, val: bins[lo_i].price, captured, pct: captured / totalVol },
        nodes,
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // ── Microstructure — OFI, VPIN, Kyle λ, spread health ─────────────
  // These are the core signals used by HFT desks (Citadel, Jump, JP Morgan EFX)
  app.get("/api/v1/microstructure", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();

      // Pull orderbook (depth=100) + recent trades (limit=500)
      const [depth, trades] = await Promise.all([
        bfetch(`/api/v3/depth?symbol=${symbol}&limit=100`),
        bfetch(`/api/v3/trades?symbol=${symbol}&limit=500`),
      ]);
      const bids = depth.bids.map(b => [parseFloat(b[0]), parseFloat(b[1])]);
      const asks = depth.asks.map(a => [parseFloat(a[0]), parseFloat(a[1])]);
      const bestBid = bids[0][0], bestAsk = asks[0][0];
      const mid = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      const spreadBps = (spread / mid) * 10000;

      // Depth imbalance (top 10 levels)
      const bidQty = bids.slice(0, 10).reduce((s, b) => s + b[1], 0);
      const askQty = asks.slice(0, 10).reduce((s, a) => s + a[1], 0);
      const depthImbalance = (bidQty - askQty) / (bidQty + askQty);

      // Order-flow imbalance (OFI) from recent trades
      let buyVol = 0, sellVol = 0, buyCount = 0, sellCount = 0;
      for (const t of trades) {
        const q = parseFloat(t.qty);
        if (t.isBuyerMaker) { sellVol += q; sellCount++; }
        else { buyVol += q; buyCount++; }
      }
      const totalVol = buyVol + sellVol;
      const ofi = totalVol > 0 ? (buyVol - sellVol) / totalVol : 0;

      // VPIN (Volume-synchronized Probability of Informed trading)
      // Simplified: absolute imbalance normalized by bucket volume
      const bucketSize = totalVol / 10;
      const buckets = [];
      let curBuy = 0, curSell = 0, curVol = 0;
      for (const t of trades) {
        const q = parseFloat(t.qty);
        if (t.isBuyerMaker) curSell += q; else curBuy += q;
        curVol += q;
        if (curVol >= bucketSize) {
          buckets.push(Math.abs(curBuy - curSell) / curVol);
          curBuy = curSell = curVol = 0;
        }
      }
      const vpin = buckets.length > 0 ? buckets.reduce((s, v) => s + v, 0) / buckets.length : 0;

      // Kyle's Lambda — price impact per unit volume (simplified)
      // Regress price changes on signed volume across recent trades
      const priceChanges = [];
      const signedVols = [];
      for (let i = 1; i < trades.length; i++) {
        const p0 = parseFloat(trades[i - 1].price);
        const p1 = parseFloat(trades[i].price);
        const q = parseFloat(trades[i].qty);
        const signed = trades[i].isBuyerMaker ? -q : q;
        priceChanges.push(p1 - p0);
        signedVols.push(signed);
      }
      const meanDP = priceChanges.reduce((s, v) => s + v, 0) / (priceChanges.length || 1);
      const meanSV = signedVols.reduce((s, v) => s + v, 0) / (signedVols.length || 1);
      let num = 0, den = 0;
      for (let i = 0; i < priceChanges.length; i++) {
        num += (signedVols[i] - meanSV) * (priceChanges[i] - meanDP);
        den += (signedVols[i] - meanSV) ** 2;
      }
      const kyleLambda = den > 0 ? num / den : 0;

      // Liquidity walls — big levels within ±1% of mid
      const walls = [];
      const band = mid * 0.01;
      for (const [p, q] of bids) {
        if (mid - p > band) break;
        if (q * p > 500_000) walls.push({ side: "BID", price: p, qty: q, usd: q * p });
      }
      for (const [p, q] of asks) {
        if (p - mid > band) break;
        if (q * p > 500_000) walls.push({ side: "ASK", price: p, qty: q, usd: q * p });
      }
      walls.sort((a, b) => b.usd - a.usd);

      // Toxicity verdict
      const toxicity = vpin > 0.4 ? "TOXIC" : vpin > 0.25 ? "ELEVATED" : "NORMAL";
      const pressure = ofi > 0.3 ? "STRONG_BUY" : ofi > 0.1 ? "BUY" : ofi < -0.3 ? "STRONG_SELL" : ofi < -0.1 ? "SELL" : "BALANCED";

      res.json({
        symbol, mid, spread, spreadBps,
        depth: { bidQty, askQty, imbalance: depthImbalance },
        orderFlow: { buyVol, sellVol, buyCount, sellCount, ofi, pressure },
        vpin, toxicity,
        kyleLambda,  // $ per unit volume
        walls: walls.slice(0, 10),
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // ── VWAP / TWAP with deviation bands ──────────────────────────────
  app.get("/api/v1/vwap", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const interval = String(req.query.interval || "5m");
      const limit = Math.min(500, Math.max(20, parseInt(req.query.limit, 10) || 288)); // ~24h of 5m
      const raw = await bfetch(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const bars = raw.map(k => ({
        t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
        typical: (+k[2] + +k[3] + +k[4]) / 3,
      }));

      let pvSum = 0, vSum = 0;
      const series = [];
      const devs = [];
      for (const b of bars) {
        pvSum += b.typical * b.v;
        vSum += b.v;
        const vwap = vSum > 0 ? pvSum / vSum : b.c;
        devs.push(b.c - vwap);
        series.push({ t: b.t, c: b.c, vwap });
      }
      // Deviation std → VWAP bands (1σ, 2σ)
      const meanDev = devs.reduce((s, v) => s + v, 0) / devs.length;
      const variance = devs.reduce((s, v) => s + (v - meanDev) ** 2, 0) / devs.length;
      const sigma = Math.sqrt(variance);
      const vwap = vSum > 0 ? pvSum / vSum : 0;
      // TWAP = simple mean of closes
      const twap = bars.reduce((s, b) => s + b.c, 0) / bars.length;
      const last = bars[bars.length - 1];
      const devPct = vwap > 0 ? ((last.c - vwap) / vwap) * 100 : 0;
      const zscore = sigma > 0 ? (last.c - vwap) / sigma : 0;

      res.json({
        symbol, interval,
        vwap, twap, sigma,
        bands: {
          upper1: vwap + sigma, lower1: vwap - sigma,
          upper2: vwap + 2 * sigma, lower2: vwap - 2 * sigma,
        },
        last: last.c,
        devPct, zscore,
        signal: zscore > 2 ? "OVEREXTENDED_UP" : zscore < -2 ? "OVEREXTENDED_DOWN"
              : zscore > 1 ? "ABOVE_VALUE" : zscore < -1 ? "BELOW_VALUE" : "AT_VALUE",
        series: series.slice(-120),
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // ── Kelly sizing + risk-of-ruin ───────────────────────────────────
  // Optimal fractional Kelly given winrate, avg win, avg loss
  app.get("/api/v1/kelly", (req, res) => {
    const w = Math.max(0.01, Math.min(0.99, parseFloat(req.query.winrate) || 0.55));
    const avgWin = Math.max(0.0001, parseFloat(req.query.avgWin) || 0.02);
    const avgLoss = Math.max(0.0001, Math.abs(parseFloat(req.query.avgLoss)) || 0.01);
    const equity = parseFloat(req.query.equity) || 10000;
    const b = avgWin / avgLoss;
    const kelly = w - (1 - w) / b;
    const halfKelly = kelly / 2;
    const quarterKelly = kelly / 4;
    // Risk of ruin (fixed-fraction) — simplified Vince formula
    const edge = w * avgWin - (1 - w) * avgLoss;
    const ror = edge <= 0 ? 1 : Math.pow((1 - edge) / (1 + edge), 10);
    const expectancy = w * avgWin - (1 - w) * avgLoss;
    res.json({
      winrate: w, avgWin, avgLoss, b,
      kelly, halfKelly, quarterKelly,
      equity,
      sizeFull: Math.max(0, equity * kelly),
      sizeHalf: Math.max(0, equity * halfKelly),
      sizeQuarter: Math.max(0, equity * quarterKelly),
      expectancy, edge,
      riskOfRuin: Math.max(0, Math.min(1, ror)),
      recommendation: kelly <= 0 ? "NO_EDGE_DO_NOT_TRADE"
        : kelly < 0.05 ? "TINY_EDGE_QUARTER_KELLY"
        : kelly < 0.15 ? "HEALTHY_EDGE_HALF_KELLY"
        : "STRONG_EDGE_HALF_KELLY_MAX",
      ts: Date.now(),
    });
  });

  // ── Big trades (block prints) ─────────────────────────────────────
  // Filter recent trades by USD threshold — Bloomberg Block Ticker equivalent
  app.get("/api/v1/big-trades", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
      const minUsd = parseFloat(req.query.minUsd) || 100_000;
      const limit = Math.min(1000, Math.max(10, parseInt(req.query.limit, 10) || 500));
      const raw = await bfetch(`/api/v3/trades?symbol=${symbol}&limit=${limit}`);
      const blocks = raw
        .map(t => {
          const price = parseFloat(t.price);
          const qty = parseFloat(t.qty);
          const usd = price * qty;
          return {
            id: t.id, price, qty, usd, time: t.time,
            side: t.isBuyerMaker ? "SELL" : "BUY",
            tier: usd >= 1_000_000 ? "MEGA" : usd >= 250_000 ? "LARGE" : usd >= 100_000 ? "BLOCK" : "NORMAL",
          };
        })
        .filter(t => t.usd >= minUsd)
        .sort((a, b) => b.time - a.time);
      const stats = blocks.reduce((s, t) => {
        if (t.side === "BUY") { s.buyUsd += t.usd; s.buyCount++; }
        else { s.sellUsd += t.usd; s.sellCount++; }
        return s;
      }, { buyUsd: 0, sellUsd: 0, buyCount: 0, sellCount: 0 });
      const totalUsd = stats.buyUsd + stats.sellUsd;
      res.json({
        symbol, minUsd, count: blocks.length,
        stats: { ...stats, netUsd: stats.buyUsd - stats.sellUsd, pressure: totalUsd > 0 ? (stats.buyUsd - stats.sellUsd) / totalUsd : 0 },
        trades: blocks,
        ts: Date.now(),
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Status
  app.get("/api/v1/status", (_req, res) => {
    res.json({
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      news: newsAgg.status(),
      endpoints: [
        "/api/v1/klines", "/api/v1/ticker", "/api/v1/orderbook", "/api/v1/trades",
        "/api/v1/indicators", "/api/v1/correlation", "/api/v1/news",
        "/api/v1/volume-profile", "/api/v1/microstructure", "/api/v1/vwap",
        "/api/v1/kelly", "/api/v1/big-trades",
        "/api/v1/candles/cached", "/api/v1/cache/stats", "/api/v1/status",
      ],
      candleCache: candleCache.stats(),
      ts: Date.now(),
    });
  });

  console.log("[BOT-API] v1 endpoints registered: klines, ticker, orderbook, trades, indicators, correlation, news, volume-profile, microstructure, vwap, kelly, big-trades, candles/cached, cache/stats, status");
}

module.exports = { register };
