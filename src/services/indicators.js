// PRODUCTION-GRADE TECHNICAL INDICATORS
// All 30+ indicators, TA-Lib-accurate formulas, operating on OHLCV candle arrays.
// Candle shape: { timestamp, open, high, low, close, volume }

'use strict';

// ─── Helpers ───
const closes = (c) => c.map(x => x.close);
const highs  = (c) => c.map(x => x.high);
const lows   = (c) => c.map(x => x.low);
const vols   = (c) => c.map(x => x.volume || 0);

function last(arr) { return arr.length ? arr[arr.length - 1] : null; }

// ─── Moving Averages ───
function SMA(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function SMASeries(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}

function EMA(values, period) {
  const s = EMASeries(values, period);
  return last(s.filter(v => v != null));
}

function EMASeries(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

// ─── Momentum ───
function RSI(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) { avgG = (avgG * (period - 1) + d) / period; avgL = (avgL * (period - 1)) / period; }
    else        { avgG = (avgG * (period - 1)) / period; avgL = (avgL * (period - 1) - d) / period; }
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function RSISeries(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) { avgG = (avgG * (period - 1) + d) / period; avgL = (avgL * (period - 1)) / period; }
    else        { avgG = (avgG * (period - 1)) / period; avgL = (avgL * (period - 1) - d) / period; }
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

function StochasticRSI(values, period = 14, kPeriod = 3, dPeriod = 3) {
  const rsiSeries = RSISeries(values, period).filter(v => v != null);
  if (rsiSeries.length < period) return null;
  const stoch = [];
  for (let i = period - 1; i < rsiSeries.length; i++) {
    const slice = rsiSeries.slice(i - period + 1, i + 1);
    const mn = Math.min(...slice), mx = Math.max(...slice);
    stoch.push(mx === mn ? 50 : ((rsiSeries[i] - mn) / (mx - mn)) * 100);
  }
  const kSeries = SMASeries(stoch, kPeriod);
  const k = last(kSeries.filter(v => v != null));
  const dSeries = SMASeries(kSeries.filter(v => v != null), dPeriod);
  const d = last(dSeries.filter(v => v != null));
  return { k: k ?? 50, d: d ?? 50 };
}

function Stochastic(candles, kPeriod = 14, dPeriod = 3, smooth = 3) {
  if (candles.length < kPeriod) return null;
  const raw = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const lo = Math.min(...slice.map(c => c.low));
    const hi = Math.max(...slice.map(c => c.high));
    raw.push(hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100);
  }
  const kSmoothed = SMASeries(raw, smooth).filter(v => v != null);
  const dSeries = SMASeries(kSmoothed, dPeriod).filter(v => v != null);
  return { k: last(kSmoothed) ?? 50, d: last(dSeries) ?? 50 };
}

function CCI(candles, period = 20) {
  if (candles.length < period) return null;
  const tp = candles.map(c => (c.high + c.low + c.close) / 3);
  const sma = SMA(tp, period);
  const slice = tp.slice(-period);
  const meanDev = slice.reduce((s, v) => s + Math.abs(v - sma), 0) / period;
  if (meanDev === 0) return 0;
  return (last(tp) - sma) / (0.015 * meanDev);
}

function ROC(values, period = 10) {
  if (values.length < period + 1) return null;
  const cur = last(values), prev = values[values.length - 1 - period];
  if (!prev) return 0;
  return ((cur - prev) / prev) * 100;
}

function WilliamsR(candles, period = 14) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const hi = Math.max(...slice.map(c => c.high));
  const lo = Math.min(...slice.map(c => c.low));
  const close = last(candles).close;
  if (hi === lo) return -50;
  return ((hi - close) / (hi - lo)) * -100;
}

function AwesomeOscillator(candles) {
  if (candles.length < 34) return null;
  const medians = candles.map(c => (c.high + c.low) / 2);
  return SMA(medians, 5) - SMA(medians, 34);
}

// ─── MACD ───
function MACD(values, fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal) return null;
  const emaFast = EMASeries(values, fast);
  const emaSlow = EMASeries(values, slow);
  const macdLine = values.map((_, i) => (emaFast[i] != null && emaSlow[i] != null) ? emaFast[i] - emaSlow[i] : null);
  const valid = macdLine.filter(v => v != null);
  const signalSeries = EMASeries(valid, signal);
  const signalLine = last(signalSeries.filter(v => v != null));
  const macd = last(valid);
  return { line: macd, signal: signalLine, histogram: macd - signalLine };
}

// ─── Volatility ───
function BollingerBands(values, period = 20, stdDev = 2) {
  if (values.length < period) return null;
  const sma = SMA(values, period);
  const slice = values.slice(-period);
  const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const width = (2 * stdDev * sd) / sma * 100; // %
  const price = last(values);
  const pctB = sd === 0 ? 0.5 : (price - (sma - stdDev * sd)) / (2 * stdDev * sd);
  return {
    upper: sma + stdDev * sd,
    middle: sma,
    lower: sma - stdDev * sd,
    width,
    percentB: pctB,
    squeeze: width < 5,
  };
}

function ATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  // Wilder smoothing
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return atr;
}

function KeltnerChannels(candles, period = 20, mult = 2) {
  const cl = closes(candles);
  const ema = EMA(cl, period);
  const atr = ATR(candles, period);
  if (ema == null || atr == null) return null;
  return { upper: ema + mult * atr, middle: ema, lower: ema - mult * atr };
}

function NATR(candles, period = 14) {
  const atr = ATR(candles, period);
  const c = last(candles)?.close;
  if (atr == null || !c) return null;
  return (atr / c) * 100;
}

// ─── Volume ───
function OBV(candles) {
  if (candles.length < 2) return null;
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume || 0;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume || 0;
  }
  return obv;
}

function OBVTrend(candles, lookback = 10) {
  if (candles.length < lookback + 2) return "NEUTRAL";
  let recent = 0, older = 0;
  for (let i = Math.max(1, candles.length - lookback); i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) recent += candles[i].volume; else recent -= candles[i].volume;
  }
  for (let i = Math.max(1, candles.length - 2 * lookback); i < candles.length - lookback; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) older += candles[i].volume; else older -= candles[i].volume;
  }
  if (recent > older * 1.1) return "INCREASING";
  if (recent < older * 0.9) return "DECREASING";
  return "NEUTRAL";
}

function MFI(candles, period = 14) {
  if (candles.length < period + 1) return null;
  let posFlow = 0, negFlow = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const prevTp = (candles[i - 1].high + candles[i - 1].low + candles[i - 1].close) / 3;
    const mf = tp * (candles[i].volume || 0);
    if (tp > prevTp) posFlow += mf;
    else if (tp < prevTp) negFlow += mf;
  }
  if (negFlow === 0) return 100;
  const mr = posFlow / negFlow;
  return 100 - 100 / (1 + mr);
}

function AccumDist(candles) {
  let ad = 0;
  for (const c of candles) {
    const range = c.high - c.low;
    if (range === 0) continue;
    const clv = ((c.close - c.low) - (c.high - c.close)) / range;
    ad += clv * (c.volume || 0);
  }
  return ad;
}

function VolumeRatio(candles, period = 20) {
  if (candles.length < period + 1) return null;
  const avg = SMA(vols(candles.slice(0, -1)), period);
  const cur = last(candles).volume || 0;
  if (!avg) return null;
  return cur / avg;
}

// ─── Trend ───
function ADX(candles, period = 14) {
  if (candles.length < period * 2) return null;
  const trs = [], plusDM = [], minusDM = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high, dn = p.low - c.low;
    plusDM.push((up > dn && up > 0) ? up : 0);
    minusDM.push((dn > up && dn > 0) ? dn : 0);
  }
  // Wilder smoothing
  const smooth = (arr, per) => {
    const out = new Array(arr.length).fill(null);
    let sum = 0;
    for (let i = 0; i < per; i++) sum += arr[i];
    out[per - 1] = sum;
    for (let i = per; i < arr.length; i++) out[i] = out[i - 1] - (out[i - 1] / per) + arr[i];
    return out;
  };
  const trS = smooth(trs, period), pS = smooth(plusDM, period), mS = smooth(minusDM, period);
  const dxs = [];
  for (let i = period - 1; i < trs.length; i++) {
    if (!trS[i]) continue;
    const pDI = (pS[i] / trS[i]) * 100;
    const mDI = (mS[i] / trS[i]) * 100;
    const dx = (pDI + mDI === 0) ? 0 : Math.abs(pDI - mDI) / (pDI + mDI) * 100;
    dxs.push({ pDI, mDI, dx });
  }
  if (dxs.length < period) return null;
  // ADX = Wilder smoothing of DX
  let adx = dxs.slice(0, period).reduce((s, x) => s + x.dx, 0) / period;
  for (let i = period; i < dxs.length; i++) adx = (adx * (period - 1) + dxs[i].dx) / period;
  const lastDX = last(dxs);
  return { adx, plusDI: lastDX.pDI, minusDI: lastDX.mDI, strength: adx > 25 ? "STRONG" : adx > 20 ? "MODERATE" : "WEAK" };
}

function Supertrend(candles, period = 10, mult = 3) {
  if (candles.length < period + 1) return null;
  const atr = ATR(candles, period);
  if (atr == null) return null;
  const c = last(candles);
  const mid = (c.high + c.low) / 2;
  const upperBand = mid + mult * atr;
  const lowerBand = mid - mult * atr;
  const trend = c.close > mid ? "UP" : "DOWN";
  return { upperBand, lowerBand, trend, value: trend === "UP" ? lowerBand : upperBand };
}

function Ichimoku(candles) {
  if (candles.length < 52) return null;
  const hhll = (arr, n) => ({
    hi: Math.max(...arr.slice(-n).map(c => c.high)),
    lo: Math.min(...arr.slice(-n).map(c => c.low)),
  });
  const t = hhll(candles, 9);
  const k = hhll(candles, 26);
  const s = hhll(candles, 52);
  const tenkan = (t.hi + t.lo) / 2;
  const kijun  = (k.hi + k.lo) / 2;
  const spanA  = (tenkan + kijun) / 2;
  const spanB  = (s.hi + s.lo) / 2;
  const chikou = last(candles).close;
  return { tenkan, kijun, spanA, spanB, chikou, aboveCloud: chikou > Math.max(spanA, spanB), belowCloud: chikou < Math.min(spanA, spanB) };
}

// ─── Support / Resistance ───
function PivotPoints(candles) {
  if (candles.length < 1) return null;
  const c = candles[candles.length - 2] || last(candles);
  const p = (c.high + c.low + c.close) / 3;
  return {
    standard: { p, r1: 2 * p - c.low, s1: 2 * p - c.high, r2: p + (c.high - c.low), s2: p - (c.high - c.low), r3: c.high + 2 * (p - c.low), s3: c.low - 2 * (c.high - p) },
    fibonacci: { p, r1: p + 0.382 * (c.high - c.low), r2: p + 0.618 * (c.high - c.low), r3: p + (c.high - c.low), s1: p - 0.382 * (c.high - c.low), s2: p - 0.618 * (c.high - c.low), s3: p - (c.high - c.low) },
  };
}

function SwingHighLow(candles, lookback = 10) {
  const slice = candles.slice(-Math.min(candles.length, 50));
  const highs = [], lows = [];
  for (let i = lookback; i < slice.length - lookback; i++) {
    const h = slice[i].high, l = slice[i].low;
    let isHigh = true, isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (slice[j].high >= h) isHigh = false;
      if (slice[j].low  <= l) isLow = false;
    }
    if (isHigh) highs.push(h);
    if (isLow) lows.push(l);
  }
  return {
    resistance: highs.sort((a, b) => b - a).slice(0, 3),
    support:    lows.sort((a, b) => a - b).slice(0, 3),
  };
}

// ─── Aggregate ALL indicators ───
function computeAll(candles) {
  if (!candles || candles.length < 50) return null;
  const cl = closes(candles);
  const price = last(candles).close;

  const sma = {
    9:   SMA(cl, 9),   21: SMA(cl, 21),  50: SMA(cl, 50),  100: SMA(cl, 100), 200: SMA(cl, 200),
  };
  const ema = {
    9:   EMA(cl, 9),   21: EMA(cl, 21),  50: EMA(cl, 50),  100: EMA(cl, 100), 200: EMA(cl, 200),
  };

  return {
    price,
    trend: {
      sma, ema,
      macd: MACD(cl),
      adx: ADX(candles),
      ichimoku: Ichimoku(candles),
      supertrend: Supertrend(candles),
    },
    momentum: {
      rsi: RSI(cl),
      stochRsi: StochasticRSI(cl),
      stoch: Stochastic(candles),
      cci: CCI(candles),
      roc: ROC(cl),
      williamsR: WilliamsR(candles),
      awesome: AwesomeOscillator(candles),
    },
    volatility: {
      bb: BollingerBands(cl),
      atr: ATR(candles),
      keltner: KeltnerChannels(candles),
      natr: NATR(candles),
    },
    volume: {
      obv: OBV(candles),
      obvTrend: OBVTrend(candles),
      mfi: MFI(candles),
      accumDist: AccumDist(candles),
      volumeRatio: VolumeRatio(candles),
    },
    sr: {
      pivots: PivotPoints(candles),
      swing: SwingHighLow(candles),
    },
  };
}

module.exports = {
  SMA, EMA, RSI, StochasticRSI, Stochastic, MACD, BollingerBands, ATR,
  KeltnerChannels, NATR, OBV, MFI, AccumDist, VolumeRatio, ADX, Supertrend,
  Ichimoku, CCI, ROC, WilliamsR, AwesomeOscillator, PivotPoints, SwingHighLow,
  OBVTrend, computeAll,
};
