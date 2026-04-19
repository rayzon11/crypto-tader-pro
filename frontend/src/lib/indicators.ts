/**
 * Comprehensive Indicator Library
 * ───────────────────────────────
 * Every indicator serious traders use. Pure functions, no deps, computed
 * directly from OHLCV arrays in the browser so charts never depend on
 * backend being alive.
 *
 * Trend:        SMA, EMA, WMA, DEMA, TEMA, HMA, KAMA, VWAP, Supertrend, ParabolicSAR, Ichimoku
 * Momentum:     RSI, Stochastic, StochRSI, MACD, CCI, Williams%R, ROC, Momentum, TRIX, AwesomeOsc, UO
 * Volatility:   ATR, Bollinger Bands, Keltner Channels, Donchian Channels, StdDev, ChaikinVol
 * Volume:       OBV, MFI, ChaikinMF, ForceIndex, AccDist, VWAP, VolumeProfile, CMF
 * Strength:     ADX, Aroon, DMI, ChoppinessIndex
 * Levels:       Pivots (Classic/Fib/Camarilla), Fibonacci retracements, S/R clustering
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const arr = (n: number, v = NaN) => new Array(n).fill(v);
const last = <T,>(a: T[]): T | undefined => a[a.length - 1];

// ─────────────────── TREND ───────────────────
export function SMA(values: number[], period: number): number[] {
  const out = arr(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function EMA(values: number[], period: number): number[] {
  const out = arr(values.length);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

export function WMA(values: number[], period: number): number[] {
  const out = arr(values.length);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j] * (period - j);
    out[i] = sum / denom;
  }
  return out;
}

export function DEMA(values: number[], period: number): number[] {
  const e1 = EMA(values, period);
  const e2 = EMA(e1.map(v => (Number.isFinite(v) ? v : 0)), period);
  return values.map((_, i) =>
    Number.isFinite(e1[i]) && Number.isFinite(e2[i]) ? 2 * e1[i] - e2[i] : NaN
  );
}

export function TEMA(values: number[], period: number): number[] {
  const e1 = EMA(values, period);
  const e2 = EMA(e1.map(v => (Number.isFinite(v) ? v : 0)), period);
  const e3 = EMA(e2.map(v => (Number.isFinite(v) ? v : 0)), period);
  return values.map((_, i) =>
    [e1, e2, e3].every(a => Number.isFinite(a[i])) ? 3 * e1[i] - 3 * e2[i] + e3[i] : NaN
  );
}

export function HMA(values: number[], period: number): number[] {
  const half = Math.floor(period / 2);
  const sqrt = Math.floor(Math.sqrt(period));
  const w1 = WMA(values, half).map(v => v * 2);
  const w2 = WMA(values, period);
  const diff = values.map((_, i) =>
    Number.isFinite(w1[i]) && Number.isFinite(w2[i]) ? w1[i] - w2[i] : NaN
  );
  return WMA(diff.map(v => (Number.isFinite(v) ? v : 0)), sqrt);
}

/** Kaufman Adaptive MA — slows in noise, speeds in trends */
export function KAMA(values: number[], period = 10, fast = 2, slow = 30): number[] {
  const out = arr(values.length);
  if (values.length <= period) return out;
  const fastSC = 2 / (fast + 1), slowSC = 2 / (slow + 1);
  out[period] = values[period];
  for (let i = period + 1; i < values.length; i++) {
    const change = Math.abs(values[i] - values[i - period]);
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) volatility += Math.abs(values[j] - values[j - 1]);
    const er = volatility ? change / volatility : 0;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    out[i] = out[i - 1] + sc * (values[i] - out[i - 1]);
  }
  return out;
}

export function VWAP(c: Candle[]): number[] {
  const out = arr(c.length);
  let cumPV = 0, cumV = 0;
  for (let i = 0; i < c.length; i++) {
    const tp = (c[i].high + c[i].low + c[i].close) / 3;
    const v = c[i].volume || 0;
    cumPV += tp * v;
    cumV += v;
    out[i] = cumV ? cumPV / cumV : c[i].close;
  }
  return out;
}

/** Supertrend — ATR-based trend flipper */
export function supertrend(c: Candle[], period = 10, mult = 3): { line: number[]; trend: number[] } {
  const atrArr = ATR(c, period);
  const line = arr(c.length), trend = arr(c.length);
  let prevTrend = 1, prevLine = 0;
  for (let i = period; i < c.length; i++) {
    const hl2 = (c[i].high + c[i].low) / 2;
    const up = hl2 + mult * atrArr[i];
    const dn = hl2 - mult * atrArr[i];
    let curTrend = prevTrend;
    if (c[i].close > prevLine) curTrend = 1;
    else if (c[i].close < prevLine) curTrend = -1;
    const curLine = curTrend === 1
      ? Math.max(dn, prevTrend === 1 ? prevLine : -Infinity)
      : Math.min(up, prevTrend === -1 ? prevLine : Infinity);
    line[i] = curLine; trend[i] = curTrend;
    prevTrend = curTrend; prevLine = curLine;
  }
  return { line, trend };
}

/** Parabolic SAR */
export function parabolicSAR(c: Candle[], start = 0.02, step = 0.02, max = 0.2): number[] {
  const out = arr(c.length);
  if (c.length < 2) return out;
  let trend = 1, sar = c[0].low, ep = c[0].high, af = start;
  out[0] = sar;
  for (let i = 1; i < c.length; i++) {
    sar = sar + af * (ep - sar);
    if (trend === 1) {
      if (c[i].low < sar) { trend = -1; sar = ep; ep = c[i].low; af = start; }
      else {
        if (c[i].high > ep) { ep = c[i].high; af = Math.min(af + step, max); }
        sar = Math.min(sar, c[i - 1].low, i >= 2 ? c[i - 2].low : c[i - 1].low);
      }
    } else {
      if (c[i].high > sar) { trend = 1; sar = ep; ep = c[i].high; af = start; }
      else {
        if (c[i].low < ep) { ep = c[i].low; af = Math.min(af + step, max); }
        sar = Math.max(sar, c[i - 1].high, i >= 2 ? c[i - 2].high : c[i - 1].high);
      }
    }
    out[i] = sar;
  }
  return out;
}

export function ichimoku(c: Candle[], conv = 9, base = 26, spanB = 52, lag = 26) {
  const hh = (p: number, i: number) => Math.max(...c.slice(Math.max(0, i - p + 1), i + 1).map(x => x.high));
  const ll = (p: number, i: number) => Math.min(...c.slice(Math.max(0, i - p + 1), i + 1).map(x => x.low));
  const tenkan = arr(c.length), kijun = arr(c.length), senkouA = arr(c.length), senkouB = arr(c.length), chikou = arr(c.length);
  for (let i = 0; i < c.length; i++) {
    if (i >= conv - 1)  tenkan[i] = (hh(conv, i) + ll(conv, i)) / 2;
    if (i >= base - 1)  kijun[i]  = (hh(base, i) + ll(base, i)) / 2;
    if (Number.isFinite(tenkan[i]) && Number.isFinite(kijun[i])) senkouA[i] = (tenkan[i] + kijun[i]) / 2;
    if (i >= spanB - 1) senkouB[i] = (hh(spanB, i) + ll(spanB, i)) / 2;
    if (i + lag < c.length) chikou[i + lag] = c[i].close;
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ─────────────────── MOMENTUM ───────────────────
export function RSI(values: number[], period = 14): number[] {
  const out = arr(values.length);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function stochRSI(values: number[], rsiPeriod = 14, stochPeriod = 14, k = 3, d = 3) {
  const rsi = RSI(values, rsiPeriod);
  const out = arr(values.length);
  for (let i = stochPeriod - 1; i < values.length; i++) {
    const slice = rsi.slice(i - stochPeriod + 1, i + 1).filter(Number.isFinite);
    if (slice.length < stochPeriod) continue;
    const lo = Math.min(...slice), hi = Math.max(...slice);
    out[i] = hi === lo ? 0 : ((rsi[i] - lo) / (hi - lo)) * 100;
  }
  const kLine = SMA(out.map(v => (Number.isFinite(v) ? v : 0)), k);
  const dLine = SMA(kLine.map(v => (Number.isFinite(v) ? v : 0)), d);
  return { k: kLine, d: dLine };
}

export function stochastic(c: Candle[], period = 14, kSmooth = 3, dSmooth = 3) {
  const rawK = arr(c.length);
  for (let i = period - 1; i < c.length; i++) {
    const slice = c.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map(x => x.high));
    const lo = Math.min(...slice.map(x => x.low));
    rawK[i] = hi === lo ? 0 : ((c[i].close - lo) / (hi - lo)) * 100;
  }
  const k = SMA(rawK.map(v => (Number.isFinite(v) ? v : 0)), kSmooth);
  const d = SMA(k.map(v => (Number.isFinite(v) ? v : 0)), dSmooth);
  return { k, d };
}

export function MACD(values: number[], fast = 12, slow = 26, signal = 9) {
  const ef = EMA(values, fast), es = EMA(values, slow);
  const macd = values.map((_, i) =>
    Number.isFinite(ef[i]) && Number.isFinite(es[i]) ? ef[i] - es[i] : NaN
  );
  const sig = EMA(macd.map(v => (Number.isFinite(v) ? v : 0)), signal);
  const hist = macd.map((v, i) =>
    Number.isFinite(v) && Number.isFinite(sig[i]) ? v - sig[i] : NaN
  );
  return { macd, signal: sig, histogram: hist };
}

export function CCI(c: Candle[], period = 20): number[] {
  const tp = c.map(x => (x.high + x.low + x.close) / 3);
  const sma = SMA(tp, period);
  const out = arr(c.length);
  for (let i = period - 1; i < c.length; i++) {
    let md = 0;
    for (let j = i - period + 1; j <= i; j++) md += Math.abs(tp[j] - sma[i]);
    md /= period;
    out[i] = md ? (tp[i] - sma[i]) / (0.015 * md) : 0;
  }
  return out;
}

export function williamsR(c: Candle[], period = 14): number[] {
  const out = arr(c.length);
  for (let i = period - 1; i < c.length; i++) {
    const slice = c.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map(x => x.high));
    const lo = Math.min(...slice.map(x => x.low));
    out[i] = hi === lo ? 0 : -100 * (hi - c[i].close) / (hi - lo);
  }
  return out;
}

export function ROC(values: number[], period = 10): number[] {
  const out = arr(values.length);
  for (let i = period; i < values.length; i++) {
    out[i] = values[i - period] ? ((values[i] - values[i - period]) / values[i - period]) * 100 : 0;
  }
  return out;
}

export function momentum(values: number[], period = 10): number[] {
  const out = arr(values.length);
  for (let i = period; i < values.length; i++) out[i] = values[i] - values[i - period];
  return out;
}

export function TRIX(values: number[], period = 15): number[] {
  const e1 = EMA(values, period);
  const e2 = EMA(e1.map(v => (Number.isFinite(v) ? v : 0)), period);
  const e3 = EMA(e2.map(v => (Number.isFinite(v) ? v : 0)), period);
  return values.map((_, i) => (i === 0 || !Number.isFinite(e3[i - 1]) || !Number.isFinite(e3[i])) ? NaN : ((e3[i] - e3[i - 1]) / e3[i - 1]) * 10000);
}

export function awesomeOscillator(c: Candle[]): number[] {
  const mp = c.map(x => (x.high + x.low) / 2);
  const s5 = SMA(mp, 5), s34 = SMA(mp, 34);
  return mp.map((_, i) => Number.isFinite(s5[i]) && Number.isFinite(s34[i]) ? s5[i] - s34[i] : NaN);
}

export function ultimateOscillator(c: Candle[], p1 = 7, p2 = 14, p3 = 28): number[] {
  const bp = arr(c.length), tr = arr(c.length);
  for (let i = 1; i < c.length; i++) {
    bp[i] = c[i].close - Math.min(c[i].low, c[i - 1].close);
    tr[i] = Math.max(c[i].high, c[i - 1].close) - Math.min(c[i].low, c[i - 1].close);
  }
  const sum = (a: number[], i: number, p: number) => a.slice(Math.max(0, i - p + 1), i + 1).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const out = arr(c.length);
  for (let i = p3; i < c.length; i++) {
    const a1 = sum(bp, i, p1) / sum(tr, i, p1);
    const a2 = sum(bp, i, p2) / sum(tr, i, p2);
    const a3 = sum(bp, i, p3) / sum(tr, i, p3);
    out[i] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  }
  return out;
}

// ─────────────────── VOLATILITY ───────────────────
export function ATR(c: Candle[], period = 14): number[] {
  const out = arr(c.length);
  if (c.length < 2) return out;
  const tr = arr(c.length);
  tr[0] = c[0].high - c[0].low;
  for (let i = 1; i < c.length; i++) {
    tr[i] = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close));
  }
  let a = tr.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
  out[period] = a;
  for (let i = period + 1; i < c.length; i++) {
    a = (a * (period - 1) + tr[i]) / period;
    out[i] = a;
  }
  return out;
}

export function bollinger(values: number[], period = 20, stdDev = 2) {
  const sma = SMA(values, period);
  const upper = arr(values.length), lower = arr(values.length), bandwidth = arr(values.length), percentB = arr(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - sma[i]) ** 2;
    const sd = Math.sqrt(sq / period);
    upper[i] = sma[i] + stdDev * sd;
    lower[i] = sma[i] - stdDev * sd;
    bandwidth[i] = sma[i] ? ((upper[i] - lower[i]) / sma[i]) * 100 : 0;
    percentB[i] = upper[i] === lower[i] ? 0.5 : (values[i] - lower[i]) / (upper[i] - lower[i]);
  }
  return { upper, middle: sma, lower, bandwidth, percentB };
}

export function keltner(c: Candle[], period = 20, mult = 2) {
  const ema = EMA(c.map(x => x.close), period);
  const atrArr = ATR(c, period);
  const upper = c.map((_, i) => ema[i] + mult * atrArr[i]);
  const lower = c.map((_, i) => ema[i] - mult * atrArr[i]);
  return { upper, middle: ema, lower };
}

export function donchian(c: Candle[], period = 20) {
  const upper = arr(c.length), lower = arr(c.length), middle = arr(c.length);
  for (let i = period - 1; i < c.length; i++) {
    const slice = c.slice(i - period + 1, i + 1);
    upper[i] = Math.max(...slice.map(x => x.high));
    lower[i] = Math.min(...slice.map(x => x.low));
    middle[i] = (upper[i] + lower[i]) / 2;
  }
  return { upper, middle, lower };
}

export function stdDev(values: number[], period = 20): number[] {
  const sma = SMA(values, period);
  const out = arr(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - sma[i]) ** 2;
    out[i] = Math.sqrt(sq / period);
  }
  return out;
}

// ─────────────────── VOLUME ───────────────────
export function OBV(c: Candle[]): number[] {
  const out = arr(c.length, 0);
  out[0] = 0;
  for (let i = 1; i < c.length; i++) {
    const v = c[i].volume || 0;
    out[i] = out[i - 1] + (c[i].close > c[i - 1].close ? v : c[i].close < c[i - 1].close ? -v : 0);
  }
  return out;
}

export function MFI(c: Candle[], period = 14): number[] {
  const out = arr(c.length);
  const tp = c.map(x => (x.high + x.low + x.close) / 3);
  const pos = arr(c.length, 0), neg = arr(c.length, 0);
  for (let i = 1; i < c.length; i++) {
    const mf = tp[i] * (c[i].volume || 0);
    if (tp[i] > tp[i - 1]) pos[i] = mf; else if (tp[i] < tp[i - 1]) neg[i] = mf;
  }
  for (let i = period; i < c.length; i++) {
    const p = pos.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    const n = neg.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    out[i] = n === 0 ? 100 : 100 - 100 / (1 + p / n);
  }
  return out;
}

export function chaikinMF(c: Candle[], period = 20): number[] {
  const mfv = c.map(x => {
    const r = x.high - x.low;
    return r === 0 ? 0 : ((x.close - x.low) - (x.high - x.close)) / r * (x.volume || 0);
  });
  const out = arr(c.length);
  for (let i = period - 1; i < c.length; i++) {
    const v = mfv.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    const vol = c.slice(i - period + 1, i + 1).reduce((s, x) => s + (x.volume || 0), 0);
    out[i] = vol ? v / vol : 0;
  }
  return out;
}

export function forceIndex(c: Candle[], period = 13): number[] {
  const raw = arr(c.length, 0);
  for (let i = 1; i < c.length; i++) raw[i] = (c[i].close - c[i - 1].close) * (c[i].volume || 0);
  return EMA(raw, period);
}

export function accDist(c: Candle[]): number[] {
  const out = arr(c.length, 0);
  let ad = 0;
  for (let i = 0; i < c.length; i++) {
    const r = c[i].high - c[i].low;
    const clv = r === 0 ? 0 : ((c[i].close - c[i].low) - (c[i].high - c[i].close)) / r;
    ad += clv * (c[i].volume || 0);
    out[i] = ad;
  }
  return out;
}

// ─────────────────── TREND STRENGTH ───────────────────
export function ADX(c: Candle[], period = 14) {
  const plusDM = arr(c.length, 0), minusDM = arr(c.length, 0), tr = arr(c.length, 0);
  for (let i = 1; i < c.length; i++) {
    const up = c[i].high - c[i - 1].high, dn = c[i - 1].low - c[i].low;
    plusDM[i]  = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
    tr[i] = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close));
  }
  const smooth = (a: number[]) => {
    const out = arr(a.length);
    if (a.length <= period) return out;
    let s = a.slice(1, period + 1).reduce((x, y) => x + y, 0);
    out[period] = s;
    for (let i = period + 1; i < a.length; i++) { s = s - s / period + a[i]; out[i] = s; }
    return out;
  };
  const sTR = smooth(tr), sP = smooth(plusDM), sM = smooth(minusDM);
  const plusDI = sTR.map((t, i) => (t ? (100 * sP[i]) / t : 0));
  const minusDI = sTR.map((t, i) => (t ? (100 * sM[i]) / t : 0));
  const dx = plusDI.map((p, i) => { const sum = p + minusDI[i]; return sum ? (100 * Math.abs(p - minusDI[i])) / sum : 0; });
  const adx = arr(c.length);
  if (c.length > 2 * period) {
    let a = dx.slice(period, 2 * period).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) / period;
    adx[2 * period - 1] = a;
    for (let i = 2 * period; i < c.length; i++) { a = (a * (period - 1) + dx[i]) / period; adx[i] = a; }
  }
  return { adx, plusDI, minusDI };
}

export function aroon(c: Candle[], period = 25) {
  const up = arr(c.length), dn = arr(c.length), osc = arr(c.length);
  for (let i = period; i < c.length; i++) {
    const slice = c.slice(i - period, i + 1);
    let hi = 0, lo = 0;
    for (let j = 0; j <= period; j++) {
      if (slice[j].high >= slice[hi].high) hi = j;
      if (slice[j].low  <= slice[lo].low)  lo = j;
    }
    up[i] = ((period - (period - hi)) / period) * 100;
    dn[i] = ((period - (period - lo)) / period) * 100;
    osc[i] = up[i] - dn[i];
  }
  return { up, down: dn, oscillator: osc };
}

export function choppiness(c: Candle[], period = 14): number[] {
  const atrSum = arr(c.length);
  const tr = arr(c.length);
  for (let i = 1; i < c.length; i++) tr[i] = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close));
  const out = arr(c.length);
  for (let i = period; i < c.length; i++) {
    const slice = c.slice(i - period + 1, i + 1);
    const sumTR = tr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    const hi = Math.max(...slice.map(x => x.high)), lo = Math.min(...slice.map(x => x.low));
    out[i] = hi === lo ? 0 : 100 * Math.log10(sumTR / (hi - lo)) / Math.log10(period);
  }
  return out;
}

// ─────────────────── LEVELS ───────────────────
export function pivotPoints(prev: Candle) {
  const P = (prev.high + prev.low + prev.close) / 3;
  const classic = { P, R1: 2 * P - prev.low, R2: P + (prev.high - prev.low), R3: prev.high + 2 * (P - prev.low),
                    S1: 2 * P - prev.high, S2: P - (prev.high - prev.low), S3: prev.low - 2 * (prev.high - P) };
  const range = prev.high - prev.low;
  const fib = { P,
    R1: P + 0.382 * range, R2: P + 0.618 * range, R3: P + 1.000 * range,
    S1: P - 0.382 * range, S2: P - 0.618 * range, S3: P - 1.000 * range,
  };
  const cam = {
    R1: prev.close + range * 1.1 / 12, R2: prev.close + range * 1.1 / 6, R3: prev.close + range * 1.1 / 4, R4: prev.close + range * 1.1 / 2,
    S1: prev.close - range * 1.1 / 12, S2: prev.close - range * 1.1 / 6, S3: prev.close - range * 1.1 / 4, S4: prev.close - range * 1.1 / 2,
  };
  return { classic, fib, camarilla: cam };
}

export function fibRetracements(swingHigh: number, swingLow: number) {
  const d = swingHigh - swingLow;
  return {
    0:     swingLow,
    0.236: swingLow + 0.236 * d,
    0.382: swingLow + 0.382 * d,
    0.5:   swingLow + 0.5   * d,
    0.618: swingLow + 0.618 * d,
    0.786: swingLow + 0.786 * d,
    1:     swingHigh,
    1.272: swingLow + 1.272 * d,
    1.618: swingLow + 1.618 * d,
  };
}

// ─────────────────── OMNIBUS ───────────────────
/** Compute everything at once, return only the last value per indicator. */
export function summary(candles: Candle[]) {
  if (candles.length < 30) return null;
  const closes = candles.map(c => c.close);
  const bb = bollinger(closes, 20, 2);
  const m = MACD(closes);
  const s = stochastic(candles);
  const srsi = stochRSI(closes);
  const adxObj = ADX(candles);
  const ich = ichimoku(candles);
  const prev = candles[candles.length - 2];
  return {
    price: last(closes),
    sma20:   last(SMA(closes, 20)),    sma50: last(SMA(closes, 50)),  sma200: last(SMA(closes, 200)),
    ema9:    last(EMA(closes, 9)),     ema20: last(EMA(closes, 20)),  ema50:  last(EMA(closes, 50)),   ema200: last(EMA(closes, 200)),
    hma21:   last(HMA(closes, 21)),    kama:  last(KAMA(closes)),     vwap:   last(VWAP(candles)),
    rsi14:   last(RSI(closes, 14)),
    stochK:  last(s.k),                stochD: last(s.d),
    stochRsiK: last(srsi.k),           stochRsiD: last(srsi.d),
    macd:    last(m.macd),             macdSignal: last(m.signal),    macdHist: last(m.histogram),
    cci20:   last(CCI(candles, 20)),
    wpr14:   last(williamsR(candles, 14)),
    roc10:   last(ROC(closes, 10)),
    mom10:   last(momentum(closes, 10)),
    trix:    last(TRIX(closes)),
    ao:      last(awesomeOscillator(candles)),
    uo:      last(ultimateOscillator(candles)),
    atr14:   last(ATR(candles, 14)),
    bbUpper: last(bb.upper),           bbMid: last(bb.middle),        bbLower: last(bb.lower),
    bbBW:    last(bb.bandwidth),       bbPB:  last(bb.percentB),
    kcUpper: last(keltner(candles).upper),   kcLower: last(keltner(candles).lower),
    dcUpper: last(donchian(candles).upper),  dcLower: last(donchian(candles).lower),
    obv:     last(OBV(candles)),
    mfi14:   last(MFI(candles, 14)),
    cmf:     last(chaikinMF(candles)),
    forceIdx: last(forceIndex(candles)),
    adx14:   last(adxObj.adx),         plusDI: last(adxObj.plusDI),  minusDI: last(adxObj.minusDI),
    aroonUp: last(aroon(candles).up),  aroonDn: last(aroon(candles).down),
    chop:    last(choppiness(candles)),
    ichTenkan: last(ich.tenkan), ichKijun: last(ich.kijun), ichSpanA: last(ich.senkouA), ichSpanB: last(ich.senkouB),
    pivots: prev ? pivotPoints(prev) : null,
  };
}
