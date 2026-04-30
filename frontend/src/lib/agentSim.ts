/**
 * Client-side 27-agent simulator — emits live votes derived from real indicator
 * state so the Command Center always shows something meaningful even when the
 * backend is down.
 */
import { summary, type Candle } from "./indicators";

export interface AgentVote {
  name: string;
  tier: string;
  vote: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number;
  reasoning: string;
}

const AGENTS = [
  ["MOMENTUM_SCOUT",    "STRATEGY"],
  ["MEAN_REV_SNIPER",   "STRATEGY"],
  ["BREAKOUT_HUNTER",   "STRATEGY"],
  ["TREND_RIDER",       "STRATEGY"],
  ["SCALPER_5M",        "STRATEGY"],
  ["SWING_TRADER_4H",   "STRATEGY"],
  ["POSITION_MACRO_1D", "STRATEGY"],
  ["PERP_LEVERAGE_LONG","FUTURES"],
  ["PERP_LEVERAGE_SHORT","FUTURES"],
  ["FUNDING_ARBITRAGE", "FUTURES"],
  ["LIQUIDATION_HUNTER","FUTURES"],
  ["BASIS_TRADER",      "FUTURES"],
  ["ORDERBOOK_ANALYST", "DATA"],
  ["VOLUME_PROFILE",    "DATA"],
  ["ON_CHAIN_READER",   "DATA"],
  ["RISK_OVERSEER",     "RISK"],
  ["DRAWDOWN_GATE",     "RISK"],
  ["ORDER_EXECUTOR",    "EXEC"],
  ["SLIPPAGE_TRACKER",  "EXEC"],
  ["FILL_QUALITY",      "EXEC"],
  ["COST_OPTIMIZER",    "EXEC"],
  ["CLAUDE_OPUS_STRAT", "AI"],
  ["CLAUDE_SENTIMENT",  "AI"],
  ["CLAUDE_NEWS_PARSE", "AI"],
  ["META_ORCHESTRATOR", "AI"],
  ["AUDIT_LOGGER",      "SECURITY"],
  ["ANOMALY_DETECTOR",  "SECURITY"],
] as const;

type Sig = { score: number; reason: string };

/** Score: -3..+3 (very bearish..very bullish) */
function scoreFromIndicators(s: any): Sig[] {
  if (!s) return [];
  const out: Sig[] = [];

  // Trend (price vs MAs)
  const tr =
    (s.price > s.ema20 ? 1 : -1) +
    (s.price > s.ema50 ? 1 : -1) +
    (s.price > s.ema200 ? 1 : -1);
  out.push({ score: tr, reason: `price ${s.price > s.ema50 ? ">" : "<"} EMA50, trend stack ${tr > 0 ? "bullish" : "bearish"}` });

  // RSI
  const rsi = s.rsi14;
  out.push({
    score: rsi > 70 ? -1 : rsi < 30 ? 1 : rsi > 55 ? 1 : rsi < 45 ? -1 : 0,
    reason: `RSI ${rsi?.toFixed(0)} — ${rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral"}`,
  });

  // MACD hist
  const hist = s.macdHist;
  out.push({
    score: hist > 0 ? 1 : hist < 0 ? -1 : 0,
    reason: `MACD hist ${hist?.toFixed(2)}, ${hist > 0 ? "bullish momentum" : "bearish momentum"}`,
  });

  // Stoch
  const k = s.stochK;
  out.push({
    score: k > 80 ? -1 : k < 20 ? 1 : 0,
    reason: `Stoch %K ${k?.toFixed(0)}`,
  });

  // ADX direction
  const adx = s.adx14, plus = s.plusDI, minus = s.minusDI;
  out.push({
    score: adx > 25 ? (plus > minus ? 2 : -2) : 0,
    reason: `ADX ${adx?.toFixed(0)} · ${plus > minus ? "+DI dominant" : "-DI dominant"}`,
  });

  // Bollinger %B
  const pb = s.bbPB;
  out.push({
    score: pb > 1 ? -1 : pb < 0 ? 1 : 0,
    reason: `BB %B ${pb?.toFixed(2)}`,
  });

  // MFI
  const mfi = s.mfi14;
  out.push({
    score: mfi > 80 ? -1 : mfi < 20 ? 1 : 0,
    reason: `MFI ${mfi?.toFixed(0)}`,
  });

  // VWAP
  out.push({
    score: s.price > s.vwap ? 1 : -1,
    reason: `price ${s.price > s.vwap ? "above" : "below"} VWAP`,
  });

  return out;
}

function voteOf(sum: number, maxAbs: number): AgentVote["vote"] {
  const r = maxAbs ? sum / maxAbs : 0;
  if (r > 0.6) return "STRONG BUY";
  if (r > 0.2) return "BUY";
  if (r < -0.6) return "STRONG SELL";
  if (r < -0.2) return "SELL";
  return "HOLD";
}

// Seeded RNG so each agent deterministically focuses on a subset
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

export function simulateAgents(candles: Candle[], pair: string): AgentVote[] {
  const s = summary(candles);
  if (!s) return [];
  const sigs = scoreFromIndicators(s);

  return AGENTS.map(([name, tier]) => {
    // Each agent weights signals differently based on its name
    const seed = hash(name + pair);
    const weights = sigs.map((_, i) => 0.5 + ((seed >> (i * 2)) & 3) / 4); // 0.5..1.25
    const weighted = sigs.reduce((acc, sig, i) => ({
      score: acc.score + sig.score * weights[i],
      maxAbs: acc.maxAbs + Math.abs(sig.score) * weights[i],
      reasons: [...acc.reasons, sig.reason],
    }), { score: 0, maxAbs: 0, reasons: [] as string[] });

    // Tier bias
    let bias = 0;
    if (tier === "STRATEGY") bias = weighted.score;
    else if (tier === "FUTURES") bias = weighted.score * 1.2; // futures leans harder
    else if (tier === "DATA") bias = weighted.score * 0.8;
    else if (tier === "RISK") bias = -Math.abs(weighted.score) * 0.3; // risk biased to HOLD
    else bias = weighted.score * 0.9;

    const vote = voteOf(bias, weighted.maxAbs);
    const conf = Math.min(98, Math.max(45, Math.round((Math.abs(bias) / (weighted.maxAbs || 1)) * 100)));
    const pickedReasons = weighted.reasons
      .filter((_, i) => weights[i] > 0.9)
      .slice(0, 2)
      .join(" · ");

    return {
      name,
      tier,
      vote,
      confidence: conf,
      reasoning: pickedReasons || "mixed signals",
    };
  });
}
