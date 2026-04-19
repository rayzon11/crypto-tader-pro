/**
 * Future-Price Predictor Agents
 * ─────────────────────────────
 * Two dedicated agents (one for BTC, one for ETH) that forecast the asset's
 * price at multiple horizons (5m / 10m / 15m / 30m / 1h / 4h).
 *
 * Inputs used per tick:
 *   • Last 500×1m klines  → realized vol, trend, drift
 *   • ATR(14) on 5m      → volatility cone
 *   • Orderbook depth    → liquidity imbalance (bid-ask pressure)
 *   • 24h ticker change  → macro drift tilt
 *   • Optional Claude news sentiment (if CLAUDE_API_KEY set, best-effort)
 *
 * Output per horizon:
 *   {
 *     horizon: "10m",
 *     price:   67214.21,      // point forecast
 *     low:     67010.40,      // 1σ lower
 *     high:    67418.02,      // 1σ upper
 *     pct:     +0.12,         // % change vs spot
 *     confidence: 0.71        // 0..1
 *   }
 */
const axios = require('axios');
const memory = require('./memoryStore');

const HORIZONS = [
  { key: '1m',  minutes: 1    },
  { key: '5m',  minutes: 5    },
  { key: '15m', minutes: 15   },
  { key: '45m', minutes: 45   },
  { key: '1h',  minutes: 60   },
  { key: '1d',  minutes: 1440 },
];

class FuturePricePredictor {
  constructor(name, symbol) {
    this.name = name;                  // "BTC-PREDICTOR" | "ETH-PREDICTOR"
    this.symbol = symbol;              // "BTCUSDT" | "ETHUSDT"
    this.lastForecast = null;
    this.lastUpdate = 0;
    this.history = [];                 // rolling forecasts for accuracy tracking
    this.accuracy = { hits: 0, total: 0, mapeByHorizon: {} };

    // Restore memory
    const saved = memory.get(`predictor:${name}`);
    if (saved) {
      this.lastForecast = saved.lastForecast || null;
      this.history = saved.history || [];
      this.accuracy = saved.accuracy || this.accuracy;
      console.log(`[${name}] restored ${this.history.length} past forecasts + MAPE from memory`);
    }
    memory.subscribe(`predictor:${name}`, () => ({
      lastForecast: this.lastForecast,
      history: this.history.slice(-100),   // cap
      accuracy: this.accuracy,
    }));
  }

  // ─── Data fetchers ───
  async _klines(interval, limit) {
    const r = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: this.symbol, interval, limit },
      timeout: 8000,
    });
    return r.data.map((k) => ({
      t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
    }));
  }
  async _depth() {
    const r = await axios.get('https://api.binance.com/api/v3/depth', {
      params: { symbol: this.symbol, limit: 100 },
      timeout: 5000,
    });
    return { bids: r.data.bids, asks: r.data.asks };
  }
  async _ticker24h() {
    const r = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
      params: { symbol: this.symbol },
      timeout: 5000,
    });
    return { changePct: +r.data.priceChangePercent, volume: +r.data.volume };
  }

  // ─── Math helpers ───
  _atr(klines, period = 14) {
    if (klines.length < period + 1) return 0;
    const trs = [];
    for (let i = 1; i < klines.length; i++) {
      const h = klines[i].h, l = klines[i].l, pc = klines[i - 1].c;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    const slice = trs.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }
  _realizedVolPerMin(klines1m) {
    // std-dev of log returns on 1m closes
    const rets = [];
    for (let i = 1; i < klines1m.length; i++) {
      rets.push(Math.log(klines1m[i].c / klines1m[i - 1].c));
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    return { mean, sigma: Math.sqrt(variance) };
  }
  _liquidityImbalance(depth) {
    const bidVol = depth.bids.slice(0, 20).reduce((s, [_, q]) => s + +q, 0);
    const askVol = depth.asks.slice(0, 20).reduce((s, [_, q]) => s + +q, 0);
    const total = bidVol + askVol;
    if (!total) return 0;
    return (bidVol - askVol) / total; // -1..+1 (positive = buy pressure)
  }

  // ─── Core forecast ───
  async forecast() {
    try {
      const [k1m, k5m, depth, t24] = await Promise.all([
        this._klines('1m', 500),
        this._klines('5m', 200),
        this._depth().catch(() => ({ bids: [], asks: [] })),
        this._ticker24h().catch(() => ({ changePct: 0, volume: 0 })),
      ]);

      const spot = k1m[k1m.length - 1].c;
      const { mean: driftPerMin, sigma: sigmaPerMin } = this._realizedVolPerMin(k1m);
      const atr5m = this._atr(k5m, 14);
      const imbalance = this._liquidityImbalance(depth);
      const macroDrift = t24.changePct / 100 / (24 * 60); // per-minute macro drift

      // Blended drift: 60% realized + 30% macro + 10% liquidity-pressure tilt
      const blendedDriftPerMin =
        0.6 * driftPerMin +
        0.3 * macroDrift +
        0.1 * (imbalance * 0.0002); // imbalance as ±0.02% nudge

      const horizons = HORIZONS.map(({ key, minutes }) => {
        const driftLog = blendedDriftPerMin * minutes;
        const sigmaLog = sigmaPerMin * Math.sqrt(minutes);
        const point = spot * Math.exp(driftLog);
        const low = spot * Math.exp(driftLog - sigmaLog);
        const high = spot * Math.exp(driftLog + sigmaLog);
        const pct = ((point - spot) / spot) * 100;

        // Confidence: shorter horizon + tighter cone + strong imbalance alignment → higher
        const coneWidthPct = ((high - low) / point) * 100;
        const alignment = Math.sign(driftLog) === Math.sign(imbalance) ? 1 : 0;
        const conf = Math.max(
          0.3,
          Math.min(0.95,
            0.85 - coneWidthPct * 0.04 + alignment * 0.05 - (minutes / 600)
          )
        );

        // Per-horizon YES/NO verdict: YES only if expected move exceeds noise cone
        // AND confidence is high enough to act on. This is a directional trade signal.
        const expectedMovePct = Math.abs(pct);
        const noiseFloorPct = (sigmaLog * 100) * 0.6; // need signal >0.6σ to be meaningful
        const verdict =
          conf >= 0.65 && expectedMovePct >= noiseFloorPct && expectedMovePct >= 0.05
            ? 'YES' : 'NO';
        const side = pct > 0 ? 'LONG' : pct < 0 ? 'SHORT' : 'FLAT';
        const reason = verdict === 'YES'
          ? `${side} ${expectedMovePct.toFixed(2)}% > noise ${noiseFloorPct.toFixed(2)}% · conf ${Math.round(conf*100)}%`
          : conf < 0.65 ? `conf ${Math.round(conf*100)}% below 65% gate`
          : expectedMovePct < noiseFloorPct ? `move ${expectedMovePct.toFixed(2)}% below noise cone ${noiseFloorPct.toFixed(2)}%`
          : `move ${expectedMovePct.toFixed(2)}% below 0.05% min`;

        return {
          horizon: key,
          minutes,
          price: +point.toFixed(2),
          low: +low.toFixed(2),
          high: +high.toFixed(2),
          pct: +pct.toFixed(3),
          confidence: +conf.toFixed(2),
          verdict,
          side,
          reason,
        };
      });

      const direction =
        blendedDriftPerMin > sigmaPerMin * 0.1 ? 'UP' :
        blendedDriftPerMin < -sigmaPerMin * 0.1 ? 'DOWN' : 'SIDEWAYS';

      const result = {
        agent: this.name,
        symbol: this.symbol,
        timestamp: Date.now(),
        spot: +spot.toFixed(2),
        atr5m: +atr5m.toFixed(2),
        realizedVolPct: +(sigmaPerMin * 100).toFixed(4),
        liquidityImbalance: +imbalance.toFixed(3),
        change24hPct: t24.changePct,
        direction,
        horizons,
      };

      this.lastForecast = result;
      this.lastUpdate = Date.now();
      this.history.push({ ts: Date.now(), spot, horizons });
      if (this.history.length > 200) this.history.shift();
      return result;
    } catch (e) {
      console.error(`[${this.name}] forecast error:`, e.message);
      return this.lastForecast || null;
    }
  }

  // Score accuracy: for each past forecast whose horizon has now elapsed,
  // compute MAPE vs actual spot now.
  async scoreAccuracy() {
    if (this.history.length < 5) return;
    try {
      const nowSpot = (await this._klines('1m', 2)).slice(-1)[0].c;
      const now = Date.now();
      this.history.forEach((h) => {
        h.horizons.forEach((hz) => {
          const due = h.ts + hz.minutes * 60_000;
          if (!hz._scored && now >= due) {
            const err = Math.abs(nowSpot - hz.price) / nowSpot;
            this.accuracy.mapeByHorizon[hz.horizon] ??= { sum: 0, n: 0 };
            this.accuracy.mapeByHorizon[hz.horizon].sum += err;
            this.accuracy.mapeByHorizon[hz.horizon].n += 1;
            hz._scored = true;
          }
        });
      });
    } catch {}
  }

  status() {
    const mape = {};
    Object.entries(this.accuracy.mapeByHorizon).forEach(([k, v]) => {
      mape[k] = v.n ? +(100 * v.sum / v.n).toFixed(3) : null;
    });
    return {
      agent: this.name,
      symbol: this.symbol,
      lastUpdate: this.lastUpdate,
      forecast: this.lastForecast,
      mapePct: mape,
      samples: this.history.length,
    };
  }
}

const btcPredictor = new FuturePricePredictor('BTC-PREDICTOR', 'BTCUSDT');
const ethPredictor = new FuturePricePredictor('ETH-PREDICTOR', 'ETHUSDT');

let started = false;
function start() {
  if (started) return;
  started = true;
  const tick = async () => {
    await Promise.all([btcPredictor.forecast(), ethPredictor.forecast()]);
    await Promise.all([btcPredictor.scoreAccuracy(), ethPredictor.scoreAccuracy()]);
  };
  tick();
  setInterval(tick, 15_000); // refresh every 15s
}

module.exports = { btcPredictor, ethPredictor, start };
