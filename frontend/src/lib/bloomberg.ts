// Bloomberg-Style Data Integration Layer
// Simulates Bloomberg Terminal data feeds for demo mode
// When BLPAPI is available, this layer can be swapped with real Bloomberg API calls

export interface BloombergQuote {
  ticker: string;
  name: string;
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  vwap: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  change: number;
  changePct: number;
  marketCap: string;
  pe: number | null;
  sector: string;
  exchange: string;
  timestamp: string;
}

export interface BloombergNews {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  sentiment: number; // -1 to 1
  tickers: string[];
  category: string;
  urgency: "flash" | "breaking" | "normal";
}

export interface BloombergAnalytics {
  ticker: string;
  rsi14: number;
  macd: { value: number; signal: number; histogram: number };
  bollingerBands: { upper: number; middle: number; lower: number };
  atr14: number;
  adx: number;
  obv: number;
  impliedVol: number;
  historicalVol30d: number;
  sharpeRatio: number;
  beta: number;
  correlation: Record<string, number>;
}

export interface BloombergEconomic {
  indicator: string;
  actual: number | string;
  forecast: number | string;
  previous: number | string;
  timestamp: string;
  impact: "high" | "medium" | "low";
  country: string;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const BASE_QUOTES: Record<string, Omit<BloombergQuote, "last" | "open" | "high" | "low" | "change" | "changePct" | "bid" | "ask" | "bidSize" | "askSize" | "vwap" | "volume" | "timestamp">> = {
  "BTC/USDT": { ticker: "BTC/USDT", name: "Bitcoin", marketCap: "$1.32T", pe: null, sector: "Cryptocurrency", exchange: "Multi-Exchange" },
  "ETH/USDT": { ticker: "ETH/USDT", name: "Ethereum", marketCap: "$415B", pe: null, sector: "Cryptocurrency", exchange: "Multi-Exchange" },
  "SOL/USDT": { ticker: "SOL/USDT", name: "Solana", marketCap: "$82B", pe: null, sector: "Cryptocurrency", exchange: "Multi-Exchange" },
  "BNB/USDT": { ticker: "BNB/USDT", name: "BNB", marketCap: "$90B", pe: null, sector: "Cryptocurrency", exchange: "Binance" },
  "AVAX/USDT": { ticker: "AVAX/USDT", name: "Avalanche", marketCap: "$15B", pe: null, sector: "Cryptocurrency", exchange: "Multi-Exchange" },
  "AAPL": { ticker: "AAPL", name: "Apple Inc.", marketCap: "$2.95T", pe: 28.5, sector: "Technology", exchange: "NASDAQ" },
  "TSLA": { ticker: "TSLA", name: "Tesla Inc.", marketCap: "$790B", pe: 62.3, sector: "Consumer Discretionary", exchange: "NASDAQ" },
  "NVDA": { ticker: "NVDA", name: "NVIDIA Corp.", marketCap: "$2.18T", pe: 55.8, sector: "Technology", exchange: "NASDAQ" },
  "SPY": { ticker: "SPY", name: "S&P 500 ETF", marketCap: "$520B", pe: 21.4, sector: "ETF - Index", exchange: "NYSE Arca" },
  "QQQ": { ticker: "QQQ", name: "Nasdaq 100 ETF", marketCap: "$210B", pe: 29.6, sector: "ETF - Index", exchange: "NASDAQ" },
};

const BASE_PRICES: Record<string, number> = {
  "BTC/USDT": 67523.45,
  "ETH/USDT": 3451.23,
  "SOL/USDT": 178.56,
  "BNB/USDT": 598.34,
  "AVAX/USDT": 38.67,
  "AAPL": 189.45,
  "TSLA": 248.90,
  "NVDA": 875.30,
  "SPY": 512.65,
  "QQQ": 445.20,
};

export function getBloombergQuote(ticker: string, tick: number = 0): BloombergQuote | null {
  const base = BASE_QUOTES[ticker];
  const basePrice = BASE_PRICES[ticker];
  if (!base || !basePrice) return null;

  const noise = Math.sin(tick * 0.1 + ticker.length) * basePrice * 0.003;
  const trend = Math.sin(tick * 0.01) * basePrice * 0.002;
  const last = Math.round((basePrice + noise + trend) * 100) / 100;
  const open = Math.round(basePrice * (1 + (seededRandom(tick * 3) - 0.5) * 0.01) * 100) / 100;
  const high = Math.round(Math.max(last, open) * (1 + seededRandom(tick * 7) * 0.005) * 100) / 100;
  const low = Math.round(Math.min(last, open) * (1 - seededRandom(tick * 11) * 0.005) * 100) / 100;
  const spread = basePrice * 0.0003;

  return {
    ...base,
    last,
    open,
    high,
    low,
    volume: Math.floor(1000000 + seededRandom(tick * 13) * 50000000),
    vwap: Math.round((last * 0.998 + seededRandom(tick * 17) * basePrice * 0.004) * 100) / 100,
    bid: Math.round((last - spread / 2) * 100) / 100,
    ask: Math.round((last + spread / 2) * 100) / 100,
    bidSize: Math.floor(100 + seededRandom(tick * 19) * 5000),
    askSize: Math.floor(100 + seededRandom(tick * 23) * 5000),
    change: Math.round((last - open) * 100) / 100,
    changePct: Math.round(((last - open) / open) * 10000) / 100,
    timestamp: new Date().toISOString(),
  };
}

export function getBloombergAnalytics(ticker: string, tick: number = 0): BloombergAnalytics {
  const basePrice = BASE_PRICES[ticker] || 100;
  const rsi = 30 + seededRandom(tick * 29 + ticker.length) * 40; // 30-70 range mostly
  const macdVal = (seededRandom(tick * 31) - 0.45) * basePrice * 0.01;

  return {
    ticker,
    rsi14: Math.round(rsi * 10) / 10,
    macd: {
      value: Math.round(macdVal * 100) / 100,
      signal: Math.round(macdVal * 0.8 * 100) / 100,
      histogram: Math.round(macdVal * 0.2 * 100) / 100,
    },
    bollingerBands: {
      upper: Math.round(basePrice * 1.02 * 100) / 100,
      middle: basePrice,
      lower: Math.round(basePrice * 0.98 * 100) / 100,
    },
    atr14: Math.round(basePrice * 0.015 * 100) / 100,
    adx: Math.round((15 + seededRandom(tick * 37) * 35) * 10) / 10,
    obv: Math.floor(seededRandom(tick * 41) * 10000000),
    impliedVol: Math.round((20 + seededRandom(tick * 43) * 60) * 10) / 10,
    historicalVol30d: Math.round((15 + seededRandom(tick * 47) * 40) * 10) / 10,
    sharpeRatio: Math.round((0.5 + seededRandom(tick * 53) * 2.5) * 100) / 100,
    beta: Math.round((0.3 + seededRandom(tick * 59) * 1.5) * 100) / 100,
    correlation: {
      "BTC/USDT": ticker === "BTC/USDT" ? 1 : Math.round((0.3 + seededRandom(tick * 61 + ticker.length) * 0.6) * 100) / 100,
      "SPY": Math.round((0.1 + seededRandom(tick * 67 + ticker.length) * 0.5) * 100) / 100,
    },
  };
}

export function getBloombergNews(tick: number = 0, count: number = 10): BloombergNews[] {
  const HEADLINES = [
    { headline: "FLASH: Fed Holds Rates Steady, Signals Two Cuts This Year", source: "Bloomberg", sentiment: 0.6, tickers: ["SPY", "QQQ", "BTC/USDT"], category: "Central Banks", urgency: "flash" as const },
    { headline: "Bitcoin ETF Inflows Hit Record $1.2B as BlackRock Fund Dominates", source: "Bloomberg Crypto", sentiment: 0.8, tickers: ["BTC/USDT"], category: "ETFs", urgency: "breaking" as const },
    { headline: "NVDA Reports Earnings Beat, Data Center Revenue Surges 427%", source: "Bloomberg", sentiment: 0.9, tickers: ["NVDA", "QQQ"], category: "Earnings", urgency: "breaking" as const },
    { headline: "Ethereum Layer 2 TVL Surpasses $50B Milestone", source: "Bloomberg Crypto", sentiment: 0.7, tickers: ["ETH/USDT"], category: "DeFi", urgency: "normal" as const },
    { headline: "SEC Commissioner Signals Softer Stance on Crypto Regulation", source: "Reuters", sentiment: 0.5, tickers: ["BTC/USDT", "ETH/USDT", "SOL/USDT"], category: "Regulation", urgency: "normal" as const },
    { headline: "Tesla Announces $500M Bitcoin Purchase for Treasury Reserve", source: "Bloomberg", sentiment: 0.75, tickers: ["TSLA", "BTC/USDT"], category: "Corporate", urgency: "breaking" as const },
    { headline: "Solana Processes Record 100M Transactions, Network Stable", source: "The Block", sentiment: 0.65, tickers: ["SOL/USDT"], category: "Technology", urgency: "normal" as const },
    { headline: "Chinese Government Crackdown on Crypto Mining Expands", source: "Bloomberg Asia", sentiment: -0.6, tickers: ["BTC/USDT"], category: "Regulation", urgency: "normal" as const },
    { headline: "Major Exchange Suffers $200M Security Breach", source: "Bloomberg", sentiment: -0.85, tickers: ["BTC/USDT", "ETH/USDT"], category: "Security", urgency: "flash" as const },
    { headline: "Apple Integrates Crypto Payments into Apple Pay", source: "Bloomberg Tech", sentiment: 0.7, tickers: ["AAPL", "BTC/USDT", "ETH/USDT"], category: "Corporate", urgency: "breaking" as const },
    { headline: "US Treasury Announces New Stablecoin Framework", source: "Reuters", sentiment: 0.3, tickers: ["BTC/USDT", "ETH/USDT"], category: "Regulation", urgency: "normal" as const },
    { headline: "DeFi Protocol Suffers Flash Loan Attack, $45M Drained", source: "The Block", sentiment: -0.7, tickers: ["ETH/USDT", "AVAX/USDT"], category: "Security", urgency: "breaking" as const },
    { headline: "S&P 500 Hits All-Time High as Tech Rally Broadens", source: "Bloomberg", sentiment: 0.6, tickers: ["SPY", "QQQ"], category: "Markets", urgency: "normal" as const },
    { headline: "Avalanche Subnet Launch Attracts $2B in Institutional Capital", source: "CoinDesk", sentiment: 0.8, tickers: ["AVAX/USDT"], category: "Institutional", urgency: "normal" as const },
    { headline: "BNB Chain Burns $500M in Quarterly Token Burn", source: "Bloomberg Crypto", sentiment: 0.5, tickers: ["BNB/USDT"], category: "Tokenomics", urgency: "normal" as const },
  ];

  return HEADLINES.slice(0, count).map((h, i) => ({
    id: `BBG${String(i + 1).padStart(4, "0")}`,
    ...h,
    timestamp: new Date(Date.now() - i * 600000 - Math.floor(seededRandom(i * 19 + tick) * 300000)).toISOString(),
  }));
}

export function getEconomicCalendar(tick: number = 0): BloombergEconomic[] {
  return [
    { indicator: "US CPI (YoY)", actual: "3.2%", forecast: "3.3%", previous: "3.4%", timestamp: new Date().toISOString(), impact: "high", country: "US" },
    { indicator: "Fed Funds Rate", actual: "5.25%", forecast: "5.25%", previous: "5.25%", timestamp: new Date().toISOString(), impact: "high", country: "US" },
    { indicator: "Non-Farm Payrolls", actual: "272K", forecast: "180K", previous: "165K", timestamp: new Date().toISOString(), impact: "high", country: "US" },
    { indicator: "US GDP (QoQ)", actual: "2.8%", forecast: "2.5%", previous: "3.4%", timestamp: new Date().toISOString(), impact: "high", country: "US" },
    { indicator: "EU PMI Manufacturing", actual: "47.3", forecast: "46.8", previous: "46.1", timestamp: new Date().toISOString(), impact: "medium", country: "EU" },
    { indicator: "China Trade Balance", actual: "$72.4B", forecast: "$65.0B", previous: "$58.3B", timestamp: new Date().toISOString(), impact: "medium", country: "CN" },
    { indicator: "UK Inflation (YoY)", actual: "4.0%", forecast: "4.1%", previous: "4.2%", timestamp: new Date().toISOString(), impact: "medium", country: "UK" },
    { indicator: "US 10Y Treasury Yield", actual: "4.28%", forecast: "4.30%", previous: "4.35%", timestamp: new Date().toISOString(), impact: "high", country: "US" },
    { indicator: "BTC Hash Rate", actual: "625 EH/s", forecast: "610 EH/s", previous: "598 EH/s", timestamp: new Date().toISOString(), impact: "low", country: "Global" },
    { indicator: "Crypto Fear & Greed", actual: "72", forecast: "68", previous: "65", timestamp: new Date().toISOString(), impact: "medium", country: "Global" },
  ];
}

// Sector heat map data
export function getSectorHeatMap(tick: number = 0): { name: string; change: number; volume: string }[] {
  return [
    { name: "Layer 1", change: Math.round((seededRandom(tick * 71) - 0.4) * 8 * 100) / 100, volume: "$12.4B" },
    { name: "Layer 2", change: Math.round((seededRandom(tick * 73) - 0.35) * 10 * 100) / 100, volume: "$4.8B" },
    { name: "DeFi", change: Math.round((seededRandom(tick * 79) - 0.45) * 7 * 100) / 100, volume: "$8.2B" },
    { name: "NFT/Gaming", change: Math.round((seededRandom(tick * 83) - 0.5) * 12 * 100) / 100, volume: "$1.9B" },
    { name: "AI Tokens", change: Math.round((seededRandom(tick * 89) - 0.3) * 15 * 100) / 100, volume: "$3.1B" },
    { name: "Memecoins", change: Math.round((seededRandom(tick * 97) - 0.5) * 20 * 100) / 100, volume: "$6.7B" },
    { name: "Privacy", change: Math.round((seededRandom(tick * 101) - 0.45) * 6 * 100) / 100, volume: "$0.8B" },
    { name: "Stablecoins", change: Math.round((seededRandom(tick * 103) - 0.5) * 0.5 * 100) / 100, volume: "$45.2B" },
  ];
}

// Correlation matrix
export function getCorrelationMatrix(tick: number = 0): { pairs: string[]; matrix: number[][] } {
  const pairs = ["BTC", "ETH", "SOL", "BNB", "AVAX", "SPY"];
  const n = pairs.length;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i];
      } else {
        matrix[i][j] = Math.round((0.2 + seededRandom(tick * 107 + i * 13 + j * 17) * 0.7) * 100) / 100;
      }
    }
  }
  return { pairs, matrix };
}
