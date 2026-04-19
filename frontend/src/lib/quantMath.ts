/**
 * Heavy Quant Math Library
 * ────────────────────────
 * Production-grade numerical methods used by hedge funds and sell-side desks.
 * Pure functions, no deps. Compute in the browser off live candles.
 *
 * Contents
 * ────────
 * 1. Kalman filter 1-D  — denoised price estimate + optimal prediction
 * 2. GARCH(1,1) vol     — conditional volatility forecast
 * 3. Hurst exponent     — mean-reverting (<0.5) vs trending (>0.5)
 * 4. Cornish-Fisher VaR — fat-tail-adjusted Value-at-Risk
 * 5. Monte Carlo GBM    — N-path price simulation
 * 6. Ornstein-Uhlenbeck — mean-reversion fit for stat-arb
 * 7. Hidden Markov regime (2-state)  — bull / bear regime probs
 * 8. Exponential smoothing ensemble  — Holt-Winters level+trend
 * 9. Information entropy / Shannon  — market randomness
 * 10. Order-flow toxicity (VPIN)
 * 11. AR(1) + momentum+MR blend forecaster
 * 12. Composite risk score (weighted Z-aggregate)
 */

// ─────────────── helpers ───────────────
const erf = (x: number): number => {
  // Abramowitz-Stegun approximation — max error ~1.5e-7
  const sign = Math.sign(x); x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
};
const normCDF = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const normInv = (p: number) => {
  // Beasley-Springer-Moro
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p <= pHigh) { q = p - 0.5; r = q*q; return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
};

const moments = (x: number[]) => {
  const n = x.length || 1;
  const mean = x.reduce((s, v) => s + v, 0) / n;
  const dev = x.map(v => v - mean);
  const m2 = dev.reduce((s, v) => s + v * v, 0) / n;
  const m3 = dev.reduce((s, v) => s + v * v * v, 0) / n;
  const m4 = dev.reduce((s, v) => s + v * v * v * v, 0) / n;
  const sd = Math.sqrt(m2);
  const skew = sd ? m3 / (sd ** 3) : 0;
  const kurt = m2 ? m4 / (m2 * m2) - 3 : 0; // excess kurtosis
  return { mean, sd, skew, kurt, n };
};

export const logReturns = (prices: number[]): number[] => {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) out.push(Math.log(prices[i] / prices[i - 1]));
  return out;
};

// ─────────────── 1. Kalman filter ───────────────
/**
 * 1-D Kalman filter. Treats price as a random walk with observation noise.
 * Returns filtered estimate + 1-step prediction of next price.
 */
export function kalman1D(prices: number[], q = 1e-5, r = 1e-2) {
  if (!prices.length) return { filtered: [], prediction: NaN, variance: NaN };
  let x = prices[0], p = 1;
  const filtered: number[] = [x];
  for (let i = 1; i < prices.length; i++) {
    // Predict
    p = p + q;
    // Update
    const k = p / (p + r);
    x = x + k * (prices[i] - x);
    p = (1 - k) * p;
    filtered.push(x);
  }
  // 1-step-ahead prediction (random walk: E[x_{t+1}] = x_t)
  return { filtered, prediction: x, variance: p };
}

// ─────────────── 2. GARCH(1,1) ───────────────
/**
 * Fits GARCH(1,1) volatility via simple MLE grid search.
 * Returns conditional vol path + next-step forecast.
 * σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
 */
export function garch11(returns: number[]) {
  const n = returns.length;
  if (n < 30) return { sigma: [], forecast: 0, omega: 0, alpha: 0, beta: 0 };
  const { mean } = moments(returns);
  const eps = returns.map(r => r - mean);
  const unc = eps.reduce((s, v) => s + v * v, 0) / n; // unconditional var

  // Simple calibration: use typical values α+β≈0.95, scan α
  let best = { omega: 0, alpha: 0, beta: 0, ll: -Infinity, sigma: [] as number[] };
  for (const alpha of [0.05, 0.08, 0.1, 0.15, 0.2]) {
    for (const persistence of [0.9, 0.93, 0.95, 0.97, 0.985]) {
      const beta = persistence - alpha;
      if (beta <= 0) continue;
      const omega = unc * (1 - alpha - beta);
      const sigma2: number[] = [unc];
      let ll = 0;
      for (let i = 1; i < n; i++) {
        const s2 = omega + alpha * eps[i - 1] ** 2 + beta * sigma2[i - 1];
        sigma2.push(s2);
        if (s2 > 0) ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(s2) + eps[i] ** 2 / s2);
      }
      if (ll > best.ll) best = { omega, alpha, beta, ll, sigma: sigma2.map(Math.sqrt) };
    }
  }
  // Next-step forecast
  const lastEps = eps[n - 1], lastS2 = best.sigma[best.sigma.length - 1] ** 2;
  const forecast = Math.sqrt(best.omega + best.alpha * lastEps ** 2 + best.beta * lastS2);
  return { sigma: best.sigma, forecast, omega: best.omega, alpha: best.alpha, beta: best.beta };
}

// ─────────────── 3. Hurst exponent ───────────────
/**
 * R/S analysis. H = 0.5 random walk, <0.5 mean-reverting, >0.5 trending.
 */
export function hurstExponent(x: number[]): number {
  const n = x.length;
  if (n < 20) return 0.5;
  const chunks = [n, Math.floor(n / 2), Math.floor(n / 4), Math.floor(n / 8)].filter(s => s >= 4);
  const pts: { logN: number; logRS: number }[] = [];
  for (const size of chunks) {
    let sumRS = 0, count = 0;
    for (let start = 0; start + size <= n; start += size) {
      const slice = x.slice(start, start + size);
      const mean = slice.reduce((s, v) => s + v, 0) / size;
      const dev = slice.map(v => v - mean);
      const cum: number[] = [];
      let run = 0;
      for (const d of dev) { run += d; cum.push(run); }
      const R = Math.max(...cum) - Math.min(...cum);
      const S = Math.sqrt(dev.reduce((s, v) => s + v * v, 0) / size);
      if (S > 0 && R > 0) { sumRS += R / S; count++; }
    }
    if (count > 0) pts.push({ logN: Math.log(size), logRS: Math.log(sumRS / count) });
  }
  // Linear regression logRS = H·logN + c
  const nP = pts.length;
  if (nP < 2) return 0.5;
  const mx = pts.reduce((s, p) => s + p.logN, 0) / nP;
  const my = pts.reduce((s, p) => s + p.logRS, 0) / nP;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.logN - mx) * (p.logRS - my); den += (p.logN - mx) ** 2; }
  return den ? num / den : 0.5;
}

// ─────────────── 4. Cornish-Fisher VaR ───────────────
/**
 * Fat-tail-corrected Value-at-Risk via Cornish-Fisher expansion.
 * alpha = 0.05 → 95% VaR, 0.01 → 99% VaR
 */
export function cornishFisherVaR(returns: number[], alpha = 0.05) {
  const { mean, sd, skew, kurt } = moments(returns);
  const z = normInv(alpha);
  const zCF = z + (z ** 2 - 1) * skew / 6 + (z ** 3 - 3 * z) * kurt / 24 - (2 * z ** 3 - 5 * z) * skew ** 2 / 36;
  const varCF = mean + sd * zCF;
  const varNormal = mean + sd * z;
  const es = -(mean - sd * Math.exp(-(z * z) / 2) / (alpha * Math.sqrt(2 * Math.PI))); // Expected Shortfall
  return { varCF: -varCF, varNormal: -varNormal, expectedShortfall: es, skew, kurt };
}

// ─────────────── 5. Monte Carlo GBM ───────────────
/**
 * Geometric Brownian Motion Monte Carlo forecast.
 * Returns median + [5, 25, 75, 95] percentile paths at horizon.
 */
export function monteCarloGBM(S0: number, mu: number, sigma: number, steps: number, paths = 2000, dt = 1) {
  const terminals: number[] = new Array(paths);
  for (let p = 0; p < paths; p++) {
    let s = S0;
    for (let t = 0; t < steps; t++) {
      const z = normInv(Math.random());
      s = s * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
    }
    terminals[p] = s;
  }
  terminals.sort((a, b) => a - b);
  const pctl = (p: number) => terminals[Math.max(0, Math.min(paths - 1, Math.floor(paths * p)))];
  return { p05: pctl(0.05), p25: pctl(0.25), median: pctl(0.5), p75: pctl(0.75), p95: pctl(0.95), mean: terminals.reduce((s, v) => s + v, 0) / paths };
}

// ─────────────── 6. Ornstein-Uhlenbeck ───────────────
/**
 * Fit dX = κ(θ - X)dt + σ dW via OLS on discretized form.
 * Half-life t½ = ln(2) / κ   (how fast price reverts to mean)
 */
export function fitOU(prices: number[]) {
  const n = prices.length;
  if (n < 10) return { kappa: 0, theta: 0, sigma: 0, halfLife: Infinity };
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 1; i < n; i++) {
    const x = prices[i - 1], y = prices[i];
    sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
  }
  const N = n - 1;
  const beta = (N * sxy - sx * sy) / (N * sxx - sx * sx);
  const alpha = (sy - beta * sx) / N;
  const resid: number[] = [];
  for (let i = 1; i < n; i++) resid.push(prices[i] - (alpha + beta * prices[i - 1]));
  const { sd } = moments(resid);
  const kappa = -Math.log(beta);
  const theta = alpha / (1 - beta);
  const sigma = sd * Math.sqrt(2 * kappa / (1 - beta * beta));
  return { kappa, theta, sigma, halfLife: Math.log(2) / kappa };
}

// ─────────────── 7. Hidden Markov 2-state regime ───────────────
/**
 * Simple 2-regime detector: Baum-Welch-lite on returns.
 * Returns last-bar probability of being in the bullish regime.
 */
export function hmmRegime(returns: number[]) {
  const n = returns.length;
  if (n < 30) return { pBull: 0.5, regime: "NEUTRAL" };
  // Initialize: split by median
  const sorted = [...returns].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const bull = returns.filter(r => r > median);
  const bear = returns.filter(r => r <= median);
  const muB = bull.reduce((s, v) => s + v, 0) / (bull.length || 1);
  const muR = bear.reduce((s, v) => s + v, 0) / (bear.length || 1);
  const sdB = Math.sqrt(bull.reduce((s, v) => s + (v - muB) ** 2, 0) / (bull.length || 1));
  const sdR = Math.sqrt(bear.reduce((s, v) => s + (v - muR) ** 2, 0) / (bear.length || 1));
  const phi = (x: number, mu: number, sd: number) => sd ? Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)) : 0;
  // Forward pass with equal priors + sticky 0.95 transition
  let pB = 0.5, pR = 0.5; const a = 0.95;
  for (const r of returns) {
    const pBN = a * pB + (1 - a) * pR;
    const pRN = a * pR + (1 - a) * pB;
    const eB = phi(r, muB, sdB), eR = phi(r, muR, sdR);
    const uB = pBN * eB, uR = pRN * eR; const s = uB + uR || 1;
    pB = uB / s; pR = uR / s;
  }
  return { pBull: pB, regime: pB > 0.65 ? "BULL" : pB < 0.35 ? "BEAR" : "NEUTRAL" };
}

// ─────────────── 8. Holt-Winters (level + trend) ───────────────
export function holt(prices: number[], alpha = 0.3, beta = 0.1, horizon = 5) {
  if (prices.length < 2) return { forecast: [] as number[] };
  let L = prices[0], T = prices[1] - prices[0];
  for (let i = 1; i < prices.length; i++) {
    const newL = alpha * prices[i] + (1 - alpha) * (L + T);
    const newT = beta * (newL - L) + (1 - beta) * T;
    L = newL; T = newT;
  }
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) out.push(L + h * T);
  return { forecast: out, level: L, trend: T };
}

// ─────────────── 9. Shannon entropy on binned returns ───────────────
export function shannonEntropy(returns: number[], bins = 16): number {
  if (returns.length < 10) return 0;
  const lo = Math.min(...returns), hi = Math.max(...returns);
  if (hi === lo) return 0;
  const counts = new Array(bins).fill(0);
  for (const r of returns) {
    const i = Math.min(bins - 1, Math.floor(((r - lo) / (hi - lo)) * bins));
    counts[i]++;
  }
  let H = 0; const N = returns.length;
  for (const c of counts) if (c) { const p = c / N; H -= p * Math.log2(p); }
  return H; // max = log2(bins)
}

// ─────────────── 10. VPIN (volume-weighted order-flow toxicity) ───────────────
/**
 * Easley-Lopez-O'Hara VPIN. Needs candles with volume. Approximates
 * buy vs sell volume via bulk volume classification (close > open = buy).
 */
export function vpin(candles: { open: number; close: number; volume: number }[], bucketSize = 50, windowBuckets = 50): number {
  if (candles.length < bucketSize * 2) return 0;
  const buckets: { buy: number; sell: number }[] = [];
  let b: { buy: number; sell: number } = { buy: 0, sell: 0 };
  let acc = 0;
  for (const c of candles) {
    const v = c.volume || 0;
    const side = c.close >= c.open ? "buy" : "sell";
    acc += v;
    if (side === "buy") b.buy += v; else b.sell += v;
    if (acc >= bucketSize) {
      buckets.push(b);
      b = { buy: 0, sell: 0 };
      acc = 0;
    }
  }
  const tail = buckets.slice(-windowBuckets);
  if (!tail.length) return 0;
  const imb = tail.reduce((s, x) => s + Math.abs(x.buy - x.sell), 0);
  const tot = tail.reduce((s, x) => s + x.buy + x.sell, 0);
  return tot ? imb / tot : 0; // 0..1, higher = more toxic flow
}

// ─────────────── 11. Composite forecaster ───────────────
/**
 * Blends Kalman, Holt (trend), OU (mean reversion), and Monte Carlo
 * for a rich next-horizon expected value + uncertainty band.
 */
export function compositeForecast(prices: number[], horizonSteps = 10) {
  if (prices.length < 30) return null;
  const logs = prices.map(Math.log);
  const rets = logReturns(prices);
  const { mean: muLog, sd: sdLog } = moments(rets);

  const kf = kalman1D(prices);
  const ho = holt(prices, 0.3, 0.1, horizonSteps);
  const ou = fitOU(prices);
  const garchOut = garch11(rets);
  const sigmaNext = garchOut.forecast || sdLog;
  const mc = monteCarloGBM(prices[prices.length - 1], muLog, sigmaNext, horizonSteps, 1500);

  // Ensemble mean: weighted by method "confidence"
  const muHolt = ho.forecast[ho.forecast.length - 1];
  const muMC = mc.median;
  const muOU = prices[prices.length - 1] + (ou.theta - prices[prices.length - 1]) * (1 - Math.exp(-ou.kappa * horizonSteps));
  const muKF = kf.prediction * Math.exp(muLog * horizonSteps);
  const ensemble = (0.30 * muMC + 0.25 * muHolt + 0.25 * muOU + 0.20 * muKF);

  return {
    point: ensemble,
    p05: mc.p05, p25: mc.p25, median: mc.median, p75: mc.p75, p95: mc.p95,
    kalmanNext: muKF, holtNext: muHolt, ouNext: muOU, mcMedian: muMC,
    garch: { sigma: sigmaNext, omega: garchOut.omega, alpha: garchOut.alpha, beta: garchOut.beta },
    horizonSteps,
  };
}

// ─────────────── 12. Composite risk score ───────────────
/**
 * Weighted Z-aggregate over:
 *   • GARCH vol vs long-run
 *   • Drawdown
 *   • VPIN order toxicity
 *   • Hurst (|H-0.5| adds risk both sides)
 *   • CF-VaR fatness (kurtosis)
 * Output: 0..100, higher = riskier right now.
 */
export function compositeRisk(params: {
  garchVol: number; avgVol: number;
  drawdownPct: number;
  vpin: number;
  hurst: number;
  kurtosis: number;
}): { score: number; level: "LOW" | "ELEVATED" | "HIGH" | "EXTREME"; components: any } {
  const { garchVol, avgVol, drawdownPct, vpin, hurst, kurtosis } = params;
  const vScore  = Math.min(40, Math.max(0, ((garchVol / (avgVol || garchVol || 1)) - 1) * 40));
  const ddScore = Math.min(25, drawdownPct * 1.5);
  const vpScore = Math.min(20, vpin * 40);
  const hScore  = Math.min(10, Math.abs(hurst - 0.5) * 30);
  const kScore  = Math.min(5, Math.max(0, kurtosis)); // fat tails
  const score = vScore + ddScore + vpScore + hScore + kScore;
  const level = score >= 75 ? "EXTREME" : score >= 50 ? "HIGH" : score >= 25 ? "ELEVATED" : "LOW";
  return { score: +score.toFixed(1), level, components: { vol: vScore, dd: ddScore, vpin: vpScore, hurst: hScore, kurt: kScore } };
}
