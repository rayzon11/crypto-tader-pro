// BlackRock Aladdin-Style Risk Analysis System
// Unified risk management, scenario analysis, portfolio optimization
// Named after BlackRock's $21.6 trillion Aladdin platform

export interface RiskMetrics {
  portfolioVaR: number;        // Value at Risk (99% confidence)
  conditionalVaR: number;      // Expected Shortfall / CVaR
  maxDrawdown: number;         // Maximum drawdown %
  currentDrawdown: number;     // Current drawdown from peak
  sharpeRatio: number;         // Risk-adjusted return
  sortinoRatio: number;        // Downside risk-adjusted return
  calmarRatio: number;         // Return / Max Drawdown
  beta: number;                // Portfolio beta vs BTC
  alpha: number;               // Jensen's Alpha
  informationRatio: number;    // Active return / Tracking error
  trackingError: number;       // Deviation from benchmark
  volatility30d: number;       // 30-day annualized volatility
  volatility7d: number;        // 7-day annualized volatility
  riskScore: number;           // Overall risk score 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface ScenarioResult {
  name: string;
  description: string;
  probability: number;         // Probability of occurrence (%)
  portfolioImpact: number;     // Expected P&L impact ($)
  portfolioImpactPct: number;  // Expected P&L impact (%)
  worstAsset: string;
  bestAsset: string;
  recoveryDays: number;        // Estimated days to recover
  recommendation: string;
}

export interface StressTest {
  scenario: string;
  btcChange: number;
  ethChange: number;
  solChange: number;
  portfolioChange: number;
  marginCall: boolean;
  liquidationRisk: boolean;
}

export interface PositionRisk {
  asset: string;
  weight: number;
  contribution: number;        // Contribution to portfolio risk
  marginalRisk: number;        // Marginal contribution
  standalone: number;          // Standalone VaR
  correlation: number;         // Correlation to portfolio
  concentration: "OK" | "WARNING" | "BREACH";
}

export interface AladdinGoal {
  id: string;
  name: string;
  targetReturn: number;        // % annual target
  maxDrawdown: number;         // Maximum acceptable drawdown %
  riskBudget: number;          // Daily risk budget ($)
  timeHorizon: string;         // e.g., "1 year", "6 months"
  currentProgress: number;     // % toward goal
  onTrack: boolean;
  createdAt: string;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export interface LiveInputs {
  /** net whale pressure, -1..+1 — reduces risk score when extreme either way */
  pressure?: number;
  /** realised 30m vol fraction, e.g. 0.015 = 1.5% */
  rv30m?: number;
  /** session PnL fraction, e.g. -0.04 = -4% */
  sessionPnl?: number;
}

function liveJitter(): number {
  // Micro-jitter from Date.now so unseeded ticks still move between renders
  return (Date.now() % 997) / 997;
}

export function calculateRiskMetrics(tick: number = 0, live?: LiveInputs): RiskMetrics {
  const j = liveJitter();
  const pressure = live?.pressure ?? 0;
  const rv = live?.rv30m ?? 0;
  const pnl = live?.sessionPnl ?? 0;

  // Base vol from seed, amplified by live realised vol if provided
  const baseVol30 = 25 + seededRandom(tick * 31 + j) * 20;
  const volatility30d = rv > 0 ? baseVol30 * (1 + rv * 10) : baseVol30;
  const volatility7d = volatility30d * (0.8 + seededRandom(tick * 37 + j) * 0.4);
  const maxDD = 5 + seededRandom(tick * 41 + j) * 15;
  const currentDD = Math.max(0, pnl < 0 ? -pnl * 100 : seededRandom(tick * 43 + j) * maxDD * 0.6);
  const sharpe = 0.8 + seededRandom(tick * 47 + j) * 2.2;
  // Extreme whale pressure (either way) raises risk
  const pressurePenalty = Math.abs(pressure) * 15;
  const riskScore = Math.round(100 - (volatility30d * 0.3 + maxDD * 1.5 + currentDD * 2 + pressurePenalty));

  return {
    portfolioVaR: Math.round((2 + seededRandom(tick * 53) * 4) * 100) / 100,
    conditionalVaR: Math.round((3 + seededRandom(tick * 59) * 5) * 100) / 100,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    currentDrawdown: Math.round(currentDD * 100) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    sortinoRatio: Math.round(sharpe * 1.3 * 100) / 100,
    calmarRatio: Math.round((sharpe * 0.8 / (maxDD / 100)) * 100) / 100,
    beta: Math.round((0.5 + seededRandom(tick * 61) * 0.8) * 100) / 100,
    alpha: Math.round((seededRandom(tick * 67) - 0.3) * 15 * 100) / 100,
    informationRatio: Math.round((0.3 + seededRandom(tick * 71) * 1.5) * 100) / 100,
    trackingError: Math.round((3 + seededRandom(tick * 73) * 8) * 100) / 100,
    volatility30d: Math.round(volatility30d * 100) / 100,
    volatility7d: Math.round(volatility7d * 100) / 100,
    riskScore: Math.max(20, Math.min(95, riskScore)),
    riskLevel: riskScore >= 75 ? "LOW" : riskScore >= 50 ? "MEDIUM" : riskScore >= 30 ? "HIGH" : "CRITICAL",
  };
}

export function runScenarioAnalysis(tick: number = 0): ScenarioResult[] {
  const j = liveJitter();
  tick = tick + j;
  return [
    {
      name: "BTC Flash Crash (-20%)",
      description: "Sudden BTC drop similar to May 2021. Cascading liquidations across DeFi.",
      probability: 8,
      portfolioImpact: Math.round((-150 - seededRandom(tick * 79) * 100) * 100) / 100,
      portfolioImpactPct: Math.round((-12 - seededRandom(tick * 83) * 8) * 100) / 100,
      worstAsset: "SOL/USDT",
      bestAsset: "USDT",
      recoveryDays: Math.floor(15 + seededRandom(tick * 89) * 30),
      recommendation: "Increase stop-loss tightness. Reduce SOL exposure. Add BTC put options.",
    },
    {
      name: "Fed Rate Hike Surprise",
      description: "Unexpected 50bps rate hike. Risk-off across all crypto assets.",
      probability: 12,
      portfolioImpact: Math.round((-80 - seededRandom(tick * 97) * 60) * 100) / 100,
      portfolioImpactPct: Math.round((-6 - seededRandom(tick * 101) * 5) * 100) / 100,
      worstAsset: "AVAX/USDT",
      bestAsset: "BTC/USDT",
      recoveryDays: Math.floor(10 + seededRandom(tick * 103) * 20),
      recommendation: "Shift allocation toward BTC. Reduce altcoin exposure below 30%.",
    },
    {
      name: "Crypto Bull Run (+40% BTC)",
      description: "ETF inflows accelerate. BTC breaks ATH. Altseason follows.",
      probability: 25,
      portfolioImpact: Math.round((200 + seededRandom(tick * 107) * 150) * 100) / 100,
      portfolioImpactPct: Math.round((25 + seededRandom(tick * 109) * 15) * 100) / 100,
      worstAsset: "USDT",
      bestAsset: "SOL/USDT",
      recoveryDays: 0,
      recommendation: "Increase position sizes. Add SOL/AVAX exposure. Widen take-profit targets.",
    },
    {
      name: "Exchange Hack / Black Swan",
      description: "Major exchange suffers security breach. Contagion fear spreads.",
      probability: 3,
      portfolioImpact: Math.round((-250 - seededRandom(tick * 113) * 150) * 100) / 100,
      portfolioImpactPct: Math.round((-20 - seededRandom(tick * 127) * 15) * 100) / 100,
      worstAsset: "BNB/USDT",
      bestAsset: "BTC/USDT",
      recoveryDays: Math.floor(30 + seededRandom(tick * 131) * 60),
      recommendation: "Emergency: Activate kill switch. Move to cold storage. Wait for confirmation.",
    },
    {
      name: "Stablecoin Depeg Event",
      description: "Major stablecoin loses peg. DeFi cascading failures.",
      probability: 5,
      portfolioImpact: Math.round((-180 - seededRandom(tick * 137) * 100) * 100) / 100,
      portfolioImpactPct: Math.round((-15 - seededRandom(tick * 139) * 10) * 100) / 100,
      worstAsset: "ETH/USDT",
      bestAsset: "BTC/USDT",
      recoveryDays: Math.floor(20 + seededRandom(tick * 149) * 40),
      recommendation: "Reduce DeFi exposure. Convert stablecoin positions to BTC. Monitor peg closely.",
    },
    {
      name: "Regulatory Clarity (Positive)",
      description: "US passes clear crypto framework. Institutional floodgates open.",
      probability: 18,
      portfolioImpact: Math.round((120 + seededRandom(tick * 151) * 100) * 100) / 100,
      portfolioImpactPct: Math.round((10 + seededRandom(tick * 157) * 12) * 100) / 100,
      worstAsset: "USDT",
      bestAsset: "ETH/USDT",
      recoveryDays: 0,
      recommendation: "Increase ETH allocation. Add altcoin basket. Consider leveraged positions.",
    },
  ];
}

export function runStressTests(tick: number = 0): StressTest[] {
  // small live wobble on portfolio response so the table feels live
  const w = (base: number) => base + (seededRandom(tick * 13 + liveJitter()) - 0.5) * 0.8;
  return [
    { scenario: "BTC -10%", btcChange: -10, ethChange: -12, solChange: -18, portfolioChange: w(-11.2), marginCall: false, liquidationRisk: false },
    { scenario: "BTC -25%", btcChange: -25, ethChange: -30, solChange: -40, portfolioChange: w(-28.5), marginCall: true, liquidationRisk: false },
    { scenario: "BTC -50%", btcChange: -50, ethChange: -55, solChange: -65, portfolioChange: w(-53.2), marginCall: true, liquidationRisk: true },
    { scenario: "BTC +20%", btcChange: 20, ethChange: 25, solChange: 35, portfolioChange: w(23.4), marginCall: false, liquidationRisk: false },
    { scenario: "ETH -30%", btcChange: -8, ethChange: -30, solChange: -25, portfolioChange: w(-17.8), marginCall: false, liquidationRisk: false },
    { scenario: "Market Flat", btcChange: 0, ethChange: -2, solChange: 3, portfolioChange: w(0.5), marginCall: false, liquidationRisk: false },
    { scenario: "Altcoin Crash", btcChange: -5, ethChange: -20, solChange: -45, portfolioChange: w(-16.8), marginCall: false, liquidationRisk: false },
    { scenario: "Dollar Collapse", btcChange: 80, ethChange: 60, solChange: 100, portfolioChange: w(75.3), marginCall: false, liquidationRisk: false },
  ];
}

export function calculatePositionRisks(tick: number = 0): PositionRisk[] {
  const w = (base: number, seed: number) => Math.max(0, base + (seededRandom(tick * seed + liveJitter()) - 0.5) * 0.6);
  return [
    { asset: "BTC/USDT", weight: 40, contribution: w(35, 11), marginalRisk: w(2.1, 12), standalone: w(4.5, 13), correlation: 1.0, concentration: "OK" },
    { asset: "ETH/USDT", weight: 30, contribution: w(32, 17), marginalRisk: w(2.8, 19), standalone: w(5.2, 23), correlation: Math.min(1, 0.85 + (seededRandom(tick * 29) - 0.5) * 0.05), concentration: "OK" },
    { asset: "SOL/USDT", weight: 15, contribution: w(20, 31), marginalRisk: w(3.5, 37), standalone: w(8.1, 41), correlation: Math.min(1, 0.72 + (seededRandom(tick * 43) - 0.5) * 0.08), concentration: "OK" },
    { asset: "BNB/USDT", weight: 10, contribution: w(8, 47), marginalRisk: w(1.9, 53), standalone: w(4.8, 59), correlation: Math.min(1, 0.68 + (seededRandom(tick * 61) - 0.5) * 0.08), concentration: "OK" },
    { asset: "AVAX/USDT", weight: 5,  contribution: w(5, 67), marginalRisk: w(2.2, 71), standalone: w(7.3, 73), correlation: Math.min(1, 0.65 + (seededRandom(tick * 79) - 0.5) * 0.1),  concentration: "OK" },
  ];
}

// === GOALS SYSTEM ===

const GOALS_STORAGE = "cryptobot_goals";

export function loadGoals(): AladdinGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GOALS_STORAGE);
    return raw ? JSON.parse(raw) : getDefaultGoals();
  } catch { return getDefaultGoals(); }
}

export function saveGoals(goals: AladdinGoal[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOALS_STORAGE, JSON.stringify(goals));
}

function getDefaultGoals(): AladdinGoal[] {
  return [
    {
      id: "G1",
      name: "Conservative Growth",
      targetReturn: 25,
      maxDrawdown: 10,
      riskBudget: 50,
      timeHorizon: "1 year",
      currentProgress: 34,
      onTrack: true,
      createdAt: "2026-01-01",
    },
    {
      id: "G2",
      name: "Aggressive Alpha",
      targetReturn: 100,
      maxDrawdown: 25,
      riskBudget: 200,
      timeHorizon: "6 months",
      currentProgress: 18,
      onTrack: false,
      createdAt: "2026-01-15",
    },
  ];
}
