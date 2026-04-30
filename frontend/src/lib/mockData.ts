// Mock data generator for standalone demo mode (no WebSocket needed)

export interface AgentReport {
  agent: string;
  status: "active" | "halted" | "error";
  pnl: number;
  signal: string | null;
  win_rate: number;
  trade_count: number;
  weight: number;
  timestamp: string;
}

export interface TradeRecord {
  id: string;
  timestamp: string;
  pair: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  pnl: number;
  agent: string;
  status: "filled" | "pending" | "cancelled";
}

export interface PricePoint {
  time: string;
  price: number;
  volume: number;
}

export interface SecurityScan {
  id: string;
  agent: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  timestamp: string;
  resolved: boolean;
}

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];
const SIGNALS = ["BUY", "SELL", "HOLD", null];

const AGENT_CONFIGS: Record<string, { tier: string; baseWinRate: number; basePnl: number }> = {
  trend: { tier: "Strategy", baseWinRate: 0.62, basePnl: 0.0234 },
  momentum: { tier: "Strategy", baseWinRate: 0.58, basePnl: 0.0156 },
  mean_reversion: { tier: "Strategy", baseWinRate: 0.55, basePnl: 0.0089 },
  arbitrage: { tier: "Strategy", baseWinRate: 0.71, basePnl: 0.0312 },
  breakout: { tier: "Strategy", baseWinRate: 0.49, basePnl: -0.0023 },
  sentiment: { tier: "Data+Risk", baseWinRate: 0.54, basePnl: 0.0045 },
  onchain: { tier: "Data+Risk", baseWinRate: 0.60, basePnl: 0.0178 },
  risk: { tier: "Data+Risk", baseWinRate: 0.65, basePnl: 0.0201 },
  portfolio: { tier: "Data+Risk", baseWinRate: 0.63, basePnl: 0.0267 },
  orderbook: { tier: "Data+Risk", baseWinRate: 0.57, basePnl: 0.0134 },
  order: { tier: "Execution", baseWinRate: 0.68, basePnl: 0.0289 },
  slippage: { tier: "Execution", baseWinRate: 0.72, basePnl: 0.0345 },
  stoploss: { tier: "Execution", baseWinRate: 0.66, basePnl: 0.0198 },
  fee: { tier: "Execution", baseWinRate: 0.59, basePnl: 0.0112 },
  defi: { tier: "Execution", baseWinRate: 0.52, basePnl: 0.0067 },
  ml: { tier: "Intelligence", baseWinRate: 0.64, basePnl: 0.0223 },
  backtest: { tier: "Intelligence", baseWinRate: 0.61, basePnl: 0.0189 },
  alert: { tier: "Intelligence", baseWinRate: 0.56, basePnl: 0.0078 },
  audit: { tier: "Intelligence", baseWinRate: 0.53, basePnl: 0.0034 },
  rebalance: { tier: "Intelligence", baseWinRate: 0.67, basePnl: 0.0256 },
  npm_security: { tier: "Security", baseWinRate: 0.88, basePnl: 0.0 },
  db_security: { tier: "Security", baseWinRate: 0.91, basePnl: 0.0 },
  code_security: { tier: "Security", baseWinRate: 0.85, basePnl: 0.0 },
  // New agents (v2)
  indicator_master: { tier: "Strategy", baseWinRate: 0.69, basePnl: 0.0278 },
  news: { tier: "Intelligence", baseWinRate: 0.58, basePnl: 0.0098 },
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function jitter(base: number, range: number, seed: number): number {
  return base + (seededRandom(seed) - 0.5) * range * 2;
}

export function generateAgentReports(tick: number): Record<string, AgentReport> {
  const agents: Record<string, AgentReport> = {};

  Object.entries(AGENT_CONFIGS).forEach(([name, config], idx) => {
    const seed = tick * 100 + idx;
    const isActive = seededRandom(seed + 1) > 0.05;

    agents[name] = {
      agent: name,
      status: isActive ? "active" : seededRandom(seed + 2) > 0.5 ? "halted" : "error",
      pnl: jitter(config.basePnl, 0.02, seed + 3),
      signal: SIGNALS[Math.floor(seededRandom(seed + 4) * SIGNALS.length)],
      win_rate: Math.max(0.3, Math.min(0.95, jitter(config.baseWinRate, 0.08, seed + 5))),
      trade_count: Math.floor(50 + seededRandom(seed + 6) * 200),
      weight: Math.max(0.5, jitter(1.2, 0.5, seed + 7)),
      timestamp: typeof window !== "undefined" ? new Date().toISOString() : "",
    };
  });

  return agents;
}

export function generateMasterState(tick: number) {
  const agents = generateAgentReports(tick);
  const activeCount = Object.values(agents).filter((a) => a.status === "active").length;
  const totalPnl = Object.values(agents).reduce((sum, a) => sum + a.pnl, 0);
  const signals = Object.values(agents)
    .filter((a) => a.signal && a.status === "active")
    .map((a) => a.signal);
  const buys = signals.filter((s) => s === "BUY").length;
  const sells = signals.filter((s) => s === "SELL").length;
  const consensus = buys > sells + 2 ? "BUY" : sells > buys + 2 ? "SELL" : "HOLD";

  return {
    masterPnl: totalPnl,
    activeAgents: activeCount,
    killSwitch: false,
    consensus,
    confidence: 0.65 + seededRandom(tick) * 0.3,
    agents,
    cycleTs: typeof window !== "undefined" ? new Date().toISOString() : "",
  };
}

export function generatePriceHistory(pair: string, hours: number = 24): PricePoint[] {
  const basePrices: Record<string, number> = {
    "BTC/USDT": 67500,
    "ETH/USDT": 3450,
    "SOL/USDT": 178,
    "BNB/USDT": 598,
    "AVAX/USDT": 38.5,
  };

  const base = basePrices[pair] || 100;
  const points: PricePoint[] = [];
  const now = Date.now();
  const interval = (hours * 3600000) / 200;

  let price = base * 0.97;
  for (let i = 0; i < 200; i++) {
    const change = (seededRandom(i * 17 + pair.length) - 0.48) * base * 0.005;
    price = Math.max(base * 0.9, Math.min(base * 1.1, price + change));
    points.push({
      time: new Date(now - (200 - i) * interval).toISOString(),
      price: Math.round(price * 100) / 100,
      volume: Math.floor(50000 + seededRandom(i * 31) * 500000),
    });
  }

  return points;
}

export function generateTradeHistory(count: number = 50): TradeRecord[] {
  const trades: TradeRecord[] = [];
  const agentNames = Object.keys(AGENT_CONFIGS).filter(
    (n) => !n.includes("security")
  );
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const pair = PAIRS[Math.floor(seededRandom(i * 7) * PAIRS.length)];
    const agent = agentNames[Math.floor(seededRandom(i * 13) * agentNames.length)];
    const side = seededRandom(i * 19) > 0.5 ? "BUY" : "SELL";
    const basePrices: Record<string, number> = {
      "BTC/USDT": 67500,
      "ETH/USDT": 3450,
      "SOL/USDT": 178,
      "BNB/USDT": 598,
      "AVAX/USDT": 38.5,
    };
    const basePrice = basePrices[pair] || 100;

    trades.push({
      id: `T${String(1000 + i).padStart(6, "0")}`,
      timestamp: new Date(now - i * 180000 - Math.floor(seededRandom(i * 23) * 60000)).toISOString(),
      pair,
      side: side as "BUY" | "SELL",
      price: basePrice * (1 + (seededRandom(i * 29) - 0.5) * 0.02),
      amount: Math.round(seededRandom(i * 37) * 1000) / 100,
      pnl: (seededRandom(i * 41) - 0.4) * 200,
      agent,
      status: seededRandom(i * 43) > 0.1 ? "filled" : seededRandom(i * 47) > 0.5 ? "pending" : "cancelled",
    });
  }

  return trades;
}

export function generateSecurityScans(): SecurityScan[] {
  return [
    {
      id: "SEC001",
      agent: "npm_security",
      severity: "info",
      message: "All 847 npm packages verified - no vulnerabilities found",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC002",
      agent: "npm_security",
      severity: "low",
      message: "Package lockfile integrity check passed (SHA-256 verified)",
      timestamp: new Date(Date.now() - 600000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC003",
      agent: "db_security",
      severity: "info",
      message: "PostgreSQL SSL enforced, no raw SQL detected in codebase",
      timestamp: new Date(Date.now() - 900000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC004",
      agent: "db_security",
      severity: "medium",
      message: "Query pattern anomaly detected - EMA baseline updated (false positive learned)",
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC005",
      agent: "code_security",
      severity: "info",
      message: ".env is in .gitignore - safe to push",
      timestamp: new Date(Date.now() - 1500000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC006",
      agent: "code_security",
      severity: "low",
      message: "File integrity check: 0 unauthorized modifications across 59 tracked files",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC007",
      agent: "npm_security",
      severity: "info",
      message: "Typosquatting scan complete: 0 suspicious packages detected",
      timestamp: new Date(Date.now() - 2100000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC008",
      agent: "code_security",
      severity: "info",
      message: "OWASP scan: no eval(), exec(), or insecure deserialization found",
      timestamp: new Date(Date.now() - 2400000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC009",
      agent: "db_security",
      severity: "info",
      message: "SQL injection pattern database updated: 156 known patterns tracked",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      resolved: true,
    },
    {
      id: "SEC010",
      agent: "code_security",
      severity: "info",
      message: "Security trend: improving (score 94/100, up from 91 last cycle)",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      resolved: true,
    },
  ];
}

// --- NEWS DATA ---

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  timestamp: string;
  url: string;
}

const NEWS_HEADLINES = [
  { title: "Bitcoin ETF sees record $1.2B inflows as institutional adoption accelerates", sentiment: "positive" as const, source: "CoinDesk" },
  { title: "Ethereum Layer 2 transactions hit all-time high, surpassing mainnet", sentiment: "positive" as const, source: "The Block" },
  { title: "SEC delays decision on Solana ETF application to Q3 2025", sentiment: "negative" as const, source: "Reuters" },
  { title: "Global crypto market cap reaches $2.8 trillion amid renewed optimism", sentiment: "positive" as const, source: "CoinGecko" },
  { title: "Major exchange reports zero security incidents for 365 consecutive days", sentiment: "positive" as const, source: "Binance" },
  { title: "DeFi total value locked surges past $150B milestone", sentiment: "positive" as const, source: "DeFi Llama" },
  { title: "Federal Reserve signals potential rate cuts, crypto markets react positively", sentiment: "positive" as const, source: "Bloomberg" },
  { title: "Bitcoin mining difficulty reaches new record high", sentiment: "neutral" as const, source: "CoinTelegraph" },
  { title: "Whale alert: 10,000 BTC moved from cold storage to exchange", sentiment: "negative" as const, source: "Whale Alert" },
  { title: "South Korea announces new crypto tax framework effective 2026", sentiment: "negative" as const, source: "Korea Herald" },
  { title: "Lightning Network capacity doubles in Q1, reaching 6,500 BTC", sentiment: "positive" as const, source: "Bitcoin Magazine" },
  { title: "Stablecoin market cap hits $200B as USDC gains market share", sentiment: "neutral" as const, source: "The Block" },
  { title: "Solana processes 100M transactions in single day, new record", sentiment: "positive" as const, source: "Solana Foundation" },
  { title: "Crypto venture funding rebounds with $3.2B raised in Q1", sentiment: "positive" as const, source: "Messari" },
  { title: "European MiCA regulations take full effect, exchanges adapt", sentiment: "neutral" as const, source: "CoinDesk" },
  { title: "BNB Chain introduces zero-gas fee transactions for micro-payments", sentiment: "positive" as const, source: "BNB Chain" },
  { title: "Avalanche subnet launches for institutional DeFi with KYC compliance", sentiment: "positive" as const, source: "Avalanche" },
  { title: "Bitcoin correlation with S&P 500 drops to 2-year low", sentiment: "neutral" as const, source: "Glassnode" },
  { title: "Major bank announces Bitcoin custody service for wealth management clients", sentiment: "positive" as const, source: "Financial Times" },
  { title: "Crypto market volatility index drops to 6-month low", sentiment: "neutral" as const, source: "CryptoCompare" },
];

export function generateNewsItems(count: number = 20, tick: number = 0): NewsItem[] {
  const items: NewsItem[] = [];
  for (let i = 0; i < Math.min(count, NEWS_HEADLINES.length); i++) {
    const idx = (i + tick) % NEWS_HEADLINES.length;
    const headline = NEWS_HEADLINES[idx];
    const score = headline.sentiment === "positive" ? 0.3 + seededRandom(i * 11 + tick) * 0.5
      : headline.sentiment === "negative" ? -(0.3 + seededRandom(i * 13 + tick) * 0.5)
      : (seededRandom(i * 17 + tick) - 0.5) * 0.3;

    items.push({
      id: `NEWS${String(i + 1).padStart(3, "0")}`,
      title: headline.title,
      source: headline.source,
      sentiment: headline.sentiment,
      score: Math.round(score * 1000) / 1000,
      timestamp: new Date(Date.now() - i * 420000 - Math.floor(seededRandom(i * 19 + tick) * 300000)).toISOString(),
      url: "#",
    });
  }
  return items;
}

export const PORTFOLIO_ALLOCATION = [
  { name: "BTC", allocation: 40, value: 27000, color: "#F7931A" },
  { name: "ETH", allocation: 30, value: 20250, color: "#627EEA" },
  { name: "SOL", allocation: 15, value: 10125, color: "#9945FF" },
  { name: "BNB", allocation: 10, value: 6750, color: "#F3BA2F" },
  { name: "AVAX", allocation: 5, value: 3375, color: "#E84142" },
];

export function generateEquityCurve(days: number = 30): { date: string; equity: number; drawdown: number }[] {
  const points: { date: string; equity: number; drawdown: number }[] = [];
  let equity = 50000;
  let peak = equity;

  for (let i = 0; i < days; i++) {
    const dailyReturn = (seededRandom(i * 53) - 0.42) * 0.025;
    equity = equity * (1 + dailyReturn);
    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;

    const date = new Date(Date.now() - (days - i) * 86400000);
    points.push({
      date: date.toISOString().split("T")[0],
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }

  return points;
}
