// Institutional-Grade Agent Configurations
// Intelligence level: JPMorgan Senior Analyst + BlackRock PM + Renaissance Quant
// Architecture inspired by Claw Code: tool registry, permission tiers, decision loop, hooks

// === PERMISSION TIERS (Claw-Code Pattern) ===
// ReadOnly: Can analyze markets, no trading
// WorkspaceWrite: Can place limit orders, manage stops
// DangerFullAccess: Can place market orders, liquidate positions
export type PermissionTier = "ReadOnly" | "WorkspaceWrite" | "DangerFullAccess";

// === TOOL REGISTRY (Claw-Code Pattern) ===
export interface AgentTool {
  name: string;
  description: string;
  permission: PermissionTier;
}

export const AGENT_TOOLS: AgentTool[] = [
  { name: "GetMarketData", description: "Fetch real-time price, volume, order book", permission: "ReadOnly" },
  { name: "GetSentiment", description: "Fetch Fear & Greed, news sentiment", permission: "ReadOnly" },
  { name: "GetOnChainData", description: "Fetch whale flows, exchange netflow", permission: "ReadOnly" },
  { name: "AnalyzeChart", description: "Run technical indicators on price data", permission: "ReadOnly" },
  { name: "GetPortfolioState", description: "Read current positions, balance, PnL", permission: "ReadOnly" },
  { name: "CheckRisk", description: "Calculate VaR, max drawdown, correlation", permission: "ReadOnly" },
  { name: "PlaceLimitOrder", description: "Place limit buy/sell order", permission: "WorkspaceWrite" },
  { name: "SetStopLoss", description: "Set or modify stop-loss level", permission: "WorkspaceWrite" },
  { name: "SetTakeProfit", description: "Set or modify take-profit target", permission: "WorkspaceWrite" },
  { name: "ModifyPosition", description: "Adjust position size or parameters", permission: "WorkspaceWrite" },
  { name: "PlaceMarketOrder", description: "Execute immediate market order", permission: "DangerFullAccess" },
  { name: "LiquidatePosition", description: "Emergency position closure", permission: "DangerFullAccess" },
  { name: "ExecuteSwap", description: "Cross-exchange or token swap", permission: "DangerFullAccess" },
  { name: "EmergencyHalt", description: "Kill switch - halt all trading", permission: "DangerFullAccess" },
];

// === HOOK SYSTEM (Claw-Code Pattern) ===
export interface AgentHook {
  name: string;
  type: "PreTrade" | "PostTrade" | "PreAnalysis" | "PostAnalysis";
  description: string;
}

export const AGENT_HOOKS: AgentHook[] = [
  { name: "ValidatePositionSize", type: "PreTrade", description: "Ensure trade size within limits" },
  { name: "CheckDailyBudget", type: "PreTrade", description: "Verify daily budget not exceeded" },
  { name: "CheckKillSwitch", type: "PreTrade", description: "Verify kill switch not triggered" },
  { name: "CheckCorrelation", type: "PreTrade", description: "Ensure position diversification" },
  { name: "LogTrade", type: "PostTrade", description: "Record trade to audit log" },
  { name: "UpdateLearning", type: "PostTrade", description: "Update self-learning weights" },
  { name: "NotifyAlerts", type: "PostTrade", description: "Send Telegram/Discord alerts" },
  { name: "AnomalyCheck", type: "PostTrade", description: "Z-score anomaly detection" },
  { name: "FetchBloombergData", type: "PreAnalysis", description: "Pull Bloomberg terminal data" },
  { name: "AggregateSignals", type: "PostAnalysis", description: "Combine signals for consensus" },
];

// === DECISION LOOP (Claw-Code Pattern) ===
// Each agent follows: Observe → Analyze → Decide → Execute → Learn
export type DecisionPhase = "Observe" | "Analyze" | "Decide" | "Execute" | "Learn";

export interface AgentConfig {
  name: string;
  displayName: string;
  tier: string;
  specialty: string;
  level: number; // 1-10 skill level
  levelLabel: string;
  winRate: number;
  description: string;
  style: string; // trading style
  riskTolerance: "Conservative" | "Moderate" | "Aggressive";
  dailyBudget: number;
  maxPositionSize: number;
  stopLoss: number;
  takeProfit: number;
  allowedAssets: string[];
  avatar: string; // emoji
  status: "Active" | "Analyzing" | "Waiting" | "Paused";
  // Claw-Code inspired fields
  permissionTier?: PermissionTier;
  tools?: string[];
  hooks?: string[];
  decisionPhase?: DecisionPhase;
  sessionTokens?: number;
  confidenceThreshold?: number;
}

// Type alias for pages that reference AgentProfile
export type AgentProfile = AgentConfig;

export const INSTITUTIONAL_AGENTS: AgentConfig[] = [
  // === STRATEGY LAYER (6) ===
  {
    name: "trend",
    displayName: "Marcus Chen",
    tier: "Strategy",
    specialty: "Macro Trend Analysis",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.78,
    description: "Former JPMorgan head of macro strategy. Identifies multi-timeframe trend regimes using proprietary EMA/MACD confluence with institutional order flow analysis. 15 years at Goldman Sachs FX desk.",
    style: "Trend Following — Multi-Timeframe Confluence",
    riskTolerance: "Moderate",
    dailyBudget: 200,
    maxPositionSize: 100,
    stopLoss: 2.5,
    takeProfit: 6.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "👔",
    status: "Active",
    permissionTier: "WorkspaceWrite",
    tools: ["GetMarketData", "AnalyzeChart", "PlaceLimitOrder", "SetStopLoss", "SetTakeProfit"],
    hooks: ["ValidatePositionSize", "CheckDailyBudget", "LogTrade", "UpdateLearning", "FetchBloombergData"],
    decisionPhase: "Analyze",
    sessionTokens: 4200,
    confidenceThreshold: 0.72,
  },
  {
    name: "momentum",
    displayName: "Sarah Blackwell",
    tier: "Strategy",
    specialty: "Momentum & Mean Reversion",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.74,
    description: "Ex-Renaissance Technologies quant researcher. RSI/Stochastic momentum with statistical mean reversion overlays. Specializes in detecting regime changes before the crowd.",
    style: "Statistical Momentum — Regime Detection",
    riskTolerance: "Aggressive",
    dailyBudget: 180,
    maxPositionSize: 80,
    stopLoss: 3.0,
    takeProfit: 5.5,
    allowedAssets: ["crypto", "stock"],
    avatar: "📊",
    status: "Active",
  },
  {
    name: "mean_reversion",
    displayName: "Dr. James Wei",
    tier: "Strategy",
    specialty: "Volatility & Mean Reversion",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.72,
    description: "PhD in Financial Mathematics from MIT. Bollinger Band + Z-score mean reversion with volatility surface modeling. Formerly ran $200M stat arb book at Citadel.",
    style: "Statistical Arbitrage — Volatility Surface",
    riskTolerance: "Conservative",
    dailyBudget: 150,
    maxPositionSize: 60,
    stopLoss: 2.0,
    takeProfit: 4.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "🎯",
    status: "Active",
  },
  {
    name: "arbitrage",
    displayName: "Viktor Petrov",
    tier: "Strategy",
    specialty: "Cross-Exchange Arbitrage",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.86,
    description: "Former Jump Trading HFT developer. Sub-millisecond cross-exchange spread detection. Exploits pricing inefficiencies between Binance, Kraken, and DEXs with zero directional risk.",
    style: "Market-Neutral Arbitrage — Zero Beta",
    riskTolerance: "Conservative",
    dailyBudget: 250,
    maxPositionSize: 120,
    stopLoss: 0.5,
    takeProfit: 1.5,
    allowedAssets: ["crypto"],
    avatar: "⚡",
    status: "Active",
  },
  {
    name: "breakout",
    displayName: "Elena Rodriguez",
    tier: "Strategy",
    specialty: "Breakout & Structure Trading",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.68,
    description: "15 years at Bridgewater Associates. Volume-profile breakout detection with market structure analysis. Identifies accumulation/distribution zones using Wyckoff methodology.",
    style: "Wyckoff Structure — Volume Profile",
    riskTolerance: "Moderate",
    dailyBudget: 160,
    maxPositionSize: 70,
    stopLoss: 3.5,
    takeProfit: 7.0,
    allowedAssets: ["crypto", "stock"],
    avatar: "🚀",
    status: "Active",
  },
  {
    name: "indicator_master",
    displayName: "Alexander Volkov",
    tier: "Strategy",
    specialty: "Multi-Indicator Synthesis",
    level: 10,
    levelLabel: "Elite",
    winRate: 0.82,
    description: "Chief Quantitative Strategist. Combines all 10 major indicators (RSI, MACD, EMA, BB, Stoch, ADX, OBV, VWAP, Ichimoku, Fibonacci) with ML-weighted scoring. Self-learning weights adapt after every trade.",
    style: "Adaptive Multi-Factor — Machine Learning Weights",
    riskTolerance: "Moderate",
    dailyBudget: 300,
    maxPositionSize: 150,
    stopLoss: 2.0,
    takeProfit: 5.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "🧠",
    status: "Active",
  },

  // === DATA & RISK LAYER (5) ===
  {
    name: "sentiment",
    displayName: "Maya Johansson",
    tier: "Data+Risk",
    specialty: "Sentiment & NLP Analysis",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.71,
    description: "Ex-Two Sigma NLP researcher. Real-time news sentiment scoring with Fear & Greed integration. Processes 10,000+ headlines/day with proprietary transformer model.",
    style: "NLP Sentiment — Contrarian Signals",
    riskTolerance: "Moderate",
    dailyBudget: 100,
    maxPositionSize: 50,
    stopLoss: 2.0,
    takeProfit: 4.0,
    allowedAssets: ["crypto", "stock"],
    avatar: "📰",
    status: "Active",
  },
  {
    name: "onchain",
    displayName: "David Nakamoto",
    tier: "Data+Risk",
    specialty: "On-Chain Intelligence",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.69,
    description: "Blockchain analytics pioneer. Tracks whale wallets, exchange netflows, and smart money movements via Glassnode. Predicted 3 of last 4 major BTC moves 48hrs early.",
    style: "On-Chain Flow Analysis — Whale Tracking",
    riskTolerance: "Moderate",
    dailyBudget: 120,
    maxPositionSize: 50,
    stopLoss: 3.0,
    takeProfit: 5.0,
    allowedAssets: ["crypto"],
    avatar: "🔗",
    status: "Active",
  },
  {
    name: "risk",
    displayName: "Dr. Catherine Park",
    tier: "Data+Risk",
    specialty: "Portfolio Risk Management",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.81,
    description: "Former BlackRock Chief Risk Officer. VaR(99%), CVaR, max drawdown monitoring with real-time stress testing. Manages correlation risk across all agent positions.",
    style: "Risk-First — Tail Risk Hedging",
    riskTolerance: "Conservative",
    dailyBudget: 80,
    maxPositionSize: 40,
    stopLoss: 1.5,
    takeProfit: 3.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "🛡️",
    status: "Active",
  },
  {
    name: "portfolio",
    displayName: "Thomas Ashworth",
    tier: "Data+Risk",
    specialty: "Portfolio Construction",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.76,
    description: "20 years at PIMCO. Kelly Criterion position sizing with Modern Portfolio Theory optimization. Half-Kelly for safety, max 20% per asset. Correlation-aware allocation.",
    style: "Kelly Criterion — MPT Optimization",
    riskTolerance: "Conservative",
    dailyBudget: 100,
    maxPositionSize: 50,
    stopLoss: 2.0,
    takeProfit: 4.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "📐",
    status: "Active",
  },
  {
    name: "orderbook",
    displayName: "Ryan Kim",
    tier: "Data+Risk",
    specialty: "Order Flow & Liquidity",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.70,
    description: "Ex-Jane Street market maker. Reads order book depth, detects iceberg orders, and measures bid-ask imbalance. Predicts short-term price moves from order flow toxicity.",
    style: "Order Flow — Microstructure Analysis",
    riskTolerance: "Moderate",
    dailyBudget: 140,
    maxPositionSize: 60,
    stopLoss: 1.5,
    takeProfit: 3.0,
    allowedAssets: ["crypto"],
    avatar: "📖",
    status: "Active",
  },

  // === EXECUTION LAYER (5) ===
  {
    name: "order",
    displayName: "Michelle Torres",
    tier: "Execution",
    specialty: "Smart Order Execution",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.79,
    description: "Former Goldman Sachs execution desk lead. Limit/market/TWAP order placement with smart timing. Minimizes market impact on large orders using iceberg splitting.",
    style: "TWAP/VWAP — Iceberg Execution",
    riskTolerance: "Moderate",
    dailyBudget: 200,
    maxPositionSize: 100,
    stopLoss: 2.0,
    takeProfit: 4.5,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "⚙️",
    status: "Active",
  },
  {
    name: "slippage",
    displayName: "Andrew Walsh",
    tier: "Execution",
    specialty: "Slippage Optimization",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.83,
    description: "HFT specialist from Virtu Financial. Routes orders across exchanges for best execution. Saved $2.3M in slippage costs over 12 months at previous fund.",
    style: "Smart Order Routing — Best Execution",
    riskTolerance: "Conservative",
    dailyBudget: 180,
    maxPositionSize: 80,
    stopLoss: 1.0,
    takeProfit: 3.0,
    allowedAssets: ["crypto", "stock"],
    avatar: "🔄",
    status: "Active",
  },
  {
    name: "stoploss",
    displayName: "Nicole Chang",
    tier: "Execution",
    specialty: "Stop-Loss & Risk Exit",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.75,
    description: "Risk management veteran from AQR Capital. Dynamic trailing stops with ATR-based levels. Never lets a winner become a loser. Manages exit timing for all agents.",
    style: "ATR Trailing Stop — Dynamic Exits",
    riskTolerance: "Conservative",
    dailyBudget: 100,
    maxPositionSize: 50,
    stopLoss: 2.0,
    takeProfit: 5.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "🎯",
    status: "Active",
  },
  {
    name: "fee",
    displayName: "Patrick O'Brien",
    tier: "Execution",
    specialty: "Cost Optimization",
    level: 6,
    levelLabel: "Senior",
    winRate: 0.72,
    description: "Operations specialist from Wintermute. Gas estimation, maker/taker fee optimization, rebate harvesting. Saves 15-30bps per trade through smart fee management.",
    style: "Fee Optimization — Rebate Harvesting",
    riskTolerance: "Conservative",
    dailyBudget: 80,
    maxPositionSize: 40,
    stopLoss: 1.0,
    takeProfit: 2.0,
    allowedAssets: ["crypto"],
    avatar: "💰",
    status: "Active",
  },
  {
    name: "defi",
    displayName: "Aisha Patel",
    tier: "Execution",
    specialty: "DeFi & Yield Strategy",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.67,
    description: "DeFi native from Aave core team. Yield farming, liquidity provision, and DEX routing. Monitors 500+ DeFi pools for alpha opportunities.",
    style: "DeFi Yield — Liquidity Mining",
    riskTolerance: "Aggressive",
    dailyBudget: 120,
    maxPositionSize: 60,
    stopLoss: 5.0,
    takeProfit: 10.0,
    allowedAssets: ["crypto"],
    avatar: "🌾",
    status: "Active",
  },

  // === INTELLIGENCE LAYER (6) ===
  {
    name: "ml",
    displayName: "Dr. Priya Sharma",
    tier: "Intelligence",
    specialty: "Machine Learning & Prediction",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.77,
    description: "PhD Stanford AI Lab, ex-DeepMind. LSTM/Transformer models retrained per-agent every 20 trades. Ensemble of 5 models with confidence-weighted voting. Published 12 papers on financial ML.",
    style: "Deep Learning Ensemble — LSTM + Transformer",
    riskTolerance: "Moderate",
    dailyBudget: 150,
    maxPositionSize: 70,
    stopLoss: 2.5,
    takeProfit: 5.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "🤖",
    status: "Active",
  },
  {
    name: "backtest",
    displayName: "Robert Fischer",
    tier: "Intelligence",
    specialty: "Strategy Backtesting & Optimization",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.73,
    description: "Former D.E. Shaw quantitative analyst. Weekly parameter optimization across all strategy agents. Walk-forward analysis, Monte Carlo simulation, and out-of-sample testing.",
    style: "Walk-Forward Optimization — Monte Carlo",
    riskTolerance: "Conservative",
    dailyBudget: 100,
    maxPositionSize: 50,
    stopLoss: 2.0,
    takeProfit: 4.0,
    allowedAssets: ["crypto", "stock"],
    avatar: "🔬",
    status: "Analyzing",
  },
  {
    name: "alert",
    displayName: "Lisa Thompson",
    tier: "Intelligence",
    specialty: "Alert & Communication",
    level: 6,
    levelLabel: "Senior",
    winRate: 0.70,
    description: "Former Bloomberg terminal product lead. Real-time Telegram + Discord notifications with smart filtering. Only surfaces high-conviction alerts to reduce noise.",
    style: "Signal Filtering — Priority Routing",
    riskTolerance: "Moderate",
    dailyBudget: 50,
    maxPositionSize: 25,
    stopLoss: 2.0,
    takeProfit: 3.0,
    allowedAssets: ["crypto", "stock"],
    avatar: "🔔",
    status: "Active",
  },
  {
    name: "audit",
    displayName: "William Drake",
    tier: "Intelligence",
    specialty: "Compliance & Audit",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.68,
    description: "20 years SEC compliance experience. PostgreSQL trade logging with z-score anomaly detection. Flags suspicious patterns and ensures regulatory compliance across all agents.",
    style: "Anomaly Detection — Compliance Monitoring",
    riskTolerance: "Conservative",
    dailyBudget: 60,
    maxPositionSize: 30,
    stopLoss: 1.5,
    takeProfit: 3.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "📋",
    status: "Active",
  },
  {
    name: "rebalance",
    displayName: "Hannah Morrison",
    tier: "Intelligence",
    specialty: "Portfolio Rebalancing",
    level: 8,
    levelLabel: "Elite",
    winRate: 0.76,
    description: "Former Vanguard portfolio strategist. Drift correction with tax-loss harvesting awareness. Maintains target allocation within 2% bands using Kelly-optimal sizing.",
    style: "Drift Correction — Tax-Aware Rebalancing",
    riskTolerance: "Conservative",
    dailyBudget: 100,
    maxPositionSize: 50,
    stopLoss: 2.0,
    takeProfit: 4.0,
    allowedAssets: ["crypto", "stock", "etf"],
    avatar: "⚖️",
    status: "Active",
  },
  {
    name: "news",
    displayName: "Carlos Mendez",
    tier: "Intelligence",
    specialty: "News Intelligence & Sentiment",
    level: 7,
    levelLabel: "Senior",
    winRate: 0.69,
    description: "Ex-Bloomberg News AI team. Live crypto news from CoinGecko & CryptoPanic with 45+ keyword sentiment model. Self-learning weights improve with every trade cycle.",
    style: "NLP News Sentiment — Adaptive Keywords",
    riskTolerance: "Moderate",
    dailyBudget: 80,
    maxPositionSize: 40,
    stopLoss: 3.0,
    takeProfit: 5.0,
    allowedAssets: ["crypto"],
    avatar: "📡",
    status: "Active",
  },

  // === SECURITY LAYER (3) ===
  {
    name: "npm_security",
    displayName: "Security Agent Alpha",
    tier: "Security",
    specialty: "NPM & Supply Chain Security",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.94,
    description: "Autonomous supply chain guardian. npm audit + lockfile integrity + typosquatting detection with Levenshtein similarity. Self-learning threat pattern database with 234 tracked patterns.",
    style: "Zero-Trust Supply Chain — Self-Learning",
    riskTolerance: "Conservative",
    dailyBudget: 0,
    maxPositionSize: 0,
    stopLoss: 0,
    takeProfit: 0,
    allowedAssets: [],
    avatar: "🔒",
    status: "Active",
  },
  {
    name: "db_security",
    displayName: "Security Agent Beta",
    tier: "Security",
    specialty: "Database & Query Security",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.96,
    description: "SQL injection sentinel. EMA-based query anomaly baselines, PostgreSQL permission auditing, and real-time raw SQL scanning. 156 injection patterns tracked and growing.",
    style: "Behavioral Baseline — Anomaly Detection",
    riskTolerance: "Conservative",
    dailyBudget: 0,
    maxPositionSize: 0,
    stopLoss: 0,
    takeProfit: 0,
    allowedAssets: [],
    avatar: "🗄️",
    status: "Active",
  },
  {
    name: "code_security",
    displayName: "Security Agent Gamma",
    tier: "Security",
    specialty: "Code & Secret Scanning",
    level: 9,
    levelLabel: "Elite",
    winRate: 0.92,
    description: "OWASP guardian. 12 secret patterns + 13 vulnerability patterns + SHA-256 file integrity monitoring. Severity trend tracking ensures security score only goes up.",
    style: "OWASP Compliance — Integrity Monitoring",
    riskTolerance: "Conservative",
    dailyBudget: 0,
    maxPositionSize: 0,
    stopLoss: 0,
    takeProfit: 0,
    allowedAssets: [],
    avatar: "🔐",
    status: "Active",
  },
];

export function getAgent(name: string): AgentConfig | undefined {
  return INSTITUTIONAL_AGENTS.find((a) => a.name === name);
}

export function getAgentsByTier(tier: string): AgentConfig[] {
  return INSTITUTIONAL_AGENTS.filter((a) => a.tier === tier);
}

export function getLevelColor(level: number): string {
  if (level >= 9) return "text-amber-400";
  if (level >= 7) return "text-purple-400";
  if (level >= 4) return "text-blue-400";
  return "text-slate-400";
}

export function getLevelLabel(level: number): string {
  if (level >= 8) return "Elite";
  if (level >= 4) return "Senior";
  return "Junior";
}

// === ENRICH AGENTS WITH CLAW-CODE FIELDS (based on tier/role) ===
const TIER_DEFAULTS: Record<string, { permissionTier: PermissionTier; tools: string[]; hooks: string[]; sessionTokens: number; confidenceThreshold: number }> = {
  Strategy: {
    permissionTier: "WorkspaceWrite",
    tools: ["GetMarketData", "AnalyzeChart", "GetSentiment", "PlaceLimitOrder", "SetStopLoss", "SetTakeProfit"],
    hooks: ["ValidatePositionSize", "CheckDailyBudget", "CheckKillSwitch", "LogTrade", "UpdateLearning", "FetchBloombergData"],
    sessionTokens: 4200,
    confidenceThreshold: 0.72,
  },
  "Data+Risk": {
    permissionTier: "ReadOnly",
    tools: ["GetMarketData", "GetSentiment", "GetOnChainData", "CheckRisk", "GetPortfolioState"],
    hooks: ["CheckCorrelation", "AggregateSignals", "FetchBloombergData"],
    sessionTokens: 3500,
    confidenceThreshold: 0.65,
  },
  Execution: {
    permissionTier: "DangerFullAccess",
    tools: ["GetMarketData", "PlaceLimitOrder", "PlaceMarketOrder", "SetStopLoss", "ModifyPosition", "ExecuteSwap"],
    hooks: ["ValidatePositionSize", "CheckDailyBudget", "CheckKillSwitch", "LogTrade", "NotifyAlerts"],
    sessionTokens: 2800,
    confidenceThreshold: 0.80,
  },
  Intelligence: {
    permissionTier: "ReadOnly",
    tools: ["GetMarketData", "AnalyzeChart", "GetSentiment", "GetPortfolioState", "CheckRisk"],
    hooks: ["UpdateLearning", "AnomalyCheck", "AggregateSignals", "FetchBloombergData"],
    sessionTokens: 5000,
    confidenceThreshold: 0.60,
  },
  Security: {
    permissionTier: "ReadOnly",
    tools: ["GetPortfolioState"],
    hooks: ["AnomalyCheck"],
    sessionTokens: 1500,
    confidenceThreshold: 0.50,
  },
};

const DECISION_PHASES: DecisionPhase[] = ["Observe", "Analyze", "Decide", "Execute", "Learn"];

// Enrich each agent with tier-appropriate defaults
INSTITUTIONAL_AGENTS.forEach((agent, idx) => {
  const defaults = TIER_DEFAULTS[agent.tier] || TIER_DEFAULTS.Security;
  if (!agent.permissionTier) agent.permissionTier = defaults.permissionTier;
  if (!agent.tools) agent.tools = defaults.tools;
  if (!agent.hooks) agent.hooks = defaults.hooks;
  if (!agent.sessionTokens) agent.sessionTokens = defaults.sessionTokens;
  if (!agent.confidenceThreshold) agent.confidenceThreshold = defaults.confidenceThreshold;
  if (!agent.decisionPhase) agent.decisionPhase = DECISION_PHASES[idx % DECISION_PHASES.length];
});

// Alias for backward compatibility
export const AGENTS = INSTITUTIONAL_AGENTS;

// Generate simulated demo trades for the wallet
export function generateDemoTrades(tick: number): { pair: string; side: "LONG" | "SHORT"; agent: string; confidence: number }[] {
  const trades: { pair: string; side: "LONG" | "SHORT"; agent: string; confidence: number }[] = [];
  const tradingAgents = INSTITUTIONAL_AGENTS.filter(
    (a) => a.tier !== "Security" && a.dailyBudget > 0
  );

  // Each tick, 1-3 agents might suggest a trade
  const numTrades = 1 + Math.floor(Math.sin(tick * 7) * 1.5 + 1.5);
  const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];

  for (let i = 0; i < numTrades && i < 3; i++) {
    const agentIdx = Math.floor(((Math.sin(tick * 13 + i * 7) + 1) / 2) * tradingAgents.length);
    const agent = tradingAgents[agentIdx % tradingAgents.length];
    const pairIdx = Math.floor(((Math.sin(tick * 17 + i * 11) + 1) / 2) * pairs.length);
    const side = Math.sin(tick * 23 + i * 3) > 0 ? "LONG" : "SHORT";
    const confidence = 60 + Math.floor(((Math.sin(tick * 29 + i * 5) + 1) / 2) * 35);

    trades.push({
      pair: pairs[pairIdx % pairs.length],
      side: side as "LONG" | "SHORT",
      agent: agent.name,
      confidence,
    });
  }

  return trades;
}
