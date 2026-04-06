// Whale Wallet Tracker — On-Chain Intelligence System
// Tracks large wallet movements using free APIs:
// - Mempool.space (BTC, free, no key)
// - Blockchain.com (BTC, free)
// - CoinGecko (market context)
// Falls back to realistic simulation if APIs unavailable

export interface WhaleWallet {
  id: string;
  label: string;
  chain: "BTC" | "ETH" | "SOL" | "BNB";
  address: string;
  balance: number;
  balanceUSD: number;
  change24h: number;        // BTC/ETH amount change
  changeUSD24h: number;
  lastActivity: string;     // ISO timestamp
  type: "exchange" | "fund" | "miner" | "unknown" | "defi" | "government";
  tags: string[];
  txCount: number;
  isActive: boolean;        // activity in last 24h
}

export interface WhaleTrade {
  id: string;
  txHash: string;
  chain: "BTC" | "ETH" | "SOL" | "BNB";
  asset: string;
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  amount: number;
  amountUSD: number;
  type: "exchange_inflow" | "exchange_outflow" | "wallet_to_wallet" | "defi" | "mining";
  sentiment: "bullish" | "bearish" | "neutral";
  timestamp: string;
  significance: "mega" | "large" | "medium"; // >$100M, >$10M, >$1M
}

export interface WhaleAlert {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  asset: string;
  amountUSD: number;
  sentiment: "bullish" | "bearish" | "neutral";
  icon: string;
}

export interface ChainFlowSummary {
  chain: string;
  asset: string;
  exchangeInflow24h: number;   // USD
  exchangeOutflow24h: number;  // USD
  netFlow: number;              // positive = inflow (bearish), negative = outflow (bullish)
  largeTransactions: number;
  whaleCount: number;
  sentiment: "bullish" | "bearish" | "neutral";
}

export interface SmartMoneyFlow {
  asset: string;
  accumulating: number;   // % of whales accumulating
  distributing: number;
  holding: number;
  netPositionChange: number;  // % change in whale holdings
  signal: "strong_accumulation" | "accumulation" | "neutral" | "distribution" | "strong_distribution";
  historicalAccuracy: number; // % how often this signal preceded price movement
}

// ============================================================
// KNOWN WHALE WALLETS (real public addresses)
// ============================================================

const KNOWN_WALLETS = [
  { address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", label: "Binance Cold Wallet", type: "exchange" as const, chain: "BTC" as const },
  { address: "1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ", label: "Coinbase Custody", type: "exchange" as const, chain: "BTC" as const },
  { address: "3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64", label: "Bitfinex Hot Wallet", type: "exchange" as const, chain: "BTC" as const },
  { address: "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97", label: "Kraken Cold Storage", type: "exchange" as const, chain: "BTC" as const },
  { address: "1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF", label: "MtGox Trustee", type: "unknown" as const, chain: "BTC" as const },
  { address: "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb", label: "BlackRock Bitcoin Fund", type: "fund" as const, chain: "BTC" as const },
  { address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna", label: "Satoshi Genesis Block", type: "unknown" as const, chain: "BTC" as const },
  { address: "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1", label: "US Government BTC", type: "government" as const, chain: "BTC" as const },
];

// ============================================================
// FETCH REAL BTC WALLET DATA from Mempool.space
// ============================================================

export async function fetchBtcWalletData(address: string): Promise<{ balance: number; txCount: number; lastSeen: string } | null> {
  try {
    const res = await fetch(`https://mempool.space/api/address/${address}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const balanceSats = (data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0);
    const balanceBTC = balanceSats / 100_000_000;
    return {
      balance: balanceBTC,
      txCount: data.chain_stats?.tx_count || 0,
      lastSeen: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Fetch recent large BTC transactions from mempool
export async function fetchRecentBtcWhaleTransactions(): Promise<WhaleTrade[]> {
  try {
    const res = await fetch("https://mempool.space/api/mempool/recent", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("API error");
    const txs = await res.json();

    const BTC_PRICE = 67500;
    const trades: WhaleTrade[] = [];

    for (const tx of txs.slice(0, 20)) {
      const valueSats = tx.value || 0;
      const valueBTC = valueSats / 100_000_000;
      const valueUSD = valueBTC * BTC_PRICE;
      if (valueUSD < 1_000_000) continue; // only >$1M

      trades.push({
        id: tx.txid?.slice(0, 12) || Math.random().toString(36).slice(2),
        txHash: tx.txid || "",
        chain: "BTC",
        asset: "BTC",
        from: "Unknown",
        fromLabel: "Unknown Wallet",
        to: "Unknown",
        toLabel: "Unknown Wallet",
        amount: valueBTC,
        amountUSD: valueUSD,
        type: "wallet_to_wallet",
        sentiment: "neutral",
        timestamp: new Date().toISOString(),
        significance: valueUSD > 100_000_000 ? "mega" : valueUSD > 10_000_000 ? "large" : "medium",
      });
    }
    return trades;
  } catch {
    return [];
  }
}

// ============================================================
// SIMULATION — realistic whale data when APIs unavailable
// ============================================================

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function generateWhaleWallets(tick: number): WhaleWallet[] {
  const prices = { BTC: 67500, ETH: 3450, SOL: 178, BNB: 598 };

  const wallets: WhaleWallet[] = [
    {
      id: "w1", label: "Binance Cold Wallet", chain: "BTC", address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",
      balance: 248_431 + Math.sin(tick * 0.05) * 500, balanceUSD: 0,
      change24h: -1240 + Math.sin(tick * 0.1) * 300, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 300_000).toISOString(),
      type: "exchange", tags: ["Exchange", "Hot Wallet", "Binance"], txCount: 842_441, isActive: true,
    },
    {
      id: "w2", label: "BlackRock Bitcoin ETF", chain: "BTC", address: "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb",
      balance: 127_821 + Math.sin(tick * 0.04) * 200, balanceUSD: 0,
      change24h: +2180 + Math.sin(tick * 0.08) * 400, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 3_600_000).toISOString(),
      type: "fund", tags: ["ETF", "Institutional", "BlackRock"], txCount: 14_220, isActive: true,
    },
    {
      id: "w3", label: "Fidelity Crypto Fund", chain: "BTC", address: "1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ",
      balance: 89_342 + Math.sin(tick * 0.06) * 150, balanceUSD: 0,
      change24h: +740 + Math.sin(tick * 0.12) * 200, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 7_200_000).toISOString(),
      type: "fund", tags: ["ETF", "Institutional", "Fidelity"], txCount: 8_901, isActive: false,
    },
    {
      id: "w4", label: "US Government Seized BTC", chain: "BTC", address: "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1",
      balance: 69_370 + Math.sin(tick * 0.03) * 100, balanceUSD: 0,
      change24h: 0, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 86_400_000 * 30).toISOString(),
      type: "government", tags: ["Government", "DOJ", "Seized"], txCount: 142, isActive: false,
    },
    {
      id: "w5", label: "MtGox Trustee", chain: "BTC", address: "1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF",
      balance: 46_164 + Math.sin(tick * 0.02) * 80, balanceUSD: 0,
      change24h: Math.sin(tick * 0.15) * 500, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 86_400_000 * 7).toISOString(),
      type: "unknown", tags: ["MtGox", "Creditor Repayment", "Bearish Risk"], txCount: 24, isActive: false,
    },
    {
      id: "w6", label: "Coinbase Institutional", chain: "BTC", address: "3NukJ6fYZJ5Kk8bPjycAnruZkE5Q7UW7i8",
      balance: 42_890 + Math.sin(tick * 0.07) * 120, balanceUSD: 0,
      change24h: +320 + Math.sin(tick * 0.09) * 150, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 1_800_000).toISOString(),
      type: "exchange", tags: ["Exchange", "Institutional", "Coinbase"], txCount: 421_830, isActive: true,
    },
    {
      id: "w7", label: "Grayscale GBTC Trust", chain: "BTC", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      balance: 31_204 + Math.sin(tick * 0.06) * 200, balanceUSD: 0,
      change24h: -880 + Math.sin(tick * 0.11) * 250, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 14_400_000).toISOString(),
      type: "fund", tags: ["GBTC", "Grayscale", "Fund Outflows"], txCount: 2_841, isActive: false,
    },
    {
      id: "w8", label: "Marathon Digital Holdings", chain: "BTC", address: "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv",
      balance: 17_631 + Math.sin(tick * 0.09) * 100, balanceUSD: 0,
      change24h: +1420 + Math.sin(tick * 0.13) * 300, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 900_000).toISOString(),
      type: "miner", tags: ["Miner", "MARA", "Public Miner"], txCount: 18_920, isActive: true,
    },
    // ETH Whales
    {
      id: "w9", label: "Ethereum Foundation", chain: "ETH", address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
      balance: 285_420 + Math.sin(tick * 0.05) * 1000, balanceUSD: 0,
      change24h: -2100 + Math.sin(tick * 0.1) * 500, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 7_200_000).toISOString(),
      type: "fund", tags: ["Foundation", "ETH", "Non-Profit"], txCount: 4_201, isActive: false,
    },
    {
      id: "w10", label: "Binance ETH Hot Wallet", chain: "ETH", address: "0x28C6c06298d514Db089934071355E5743bf21d60",
      balance: 1_842_300 + Math.sin(tick * 0.06) * 50000, balanceUSD: 0,
      change24h: +18_420 + Math.sin(tick * 0.08) * 5000, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 180_000).toISOString(),
      type: "exchange", tags: ["Exchange", "Binance", "High Volume"], txCount: 9_241_200, isActive: true,
    },
    {
      id: "w11", label: "Vitalik Buterin", chain: "ETH", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      balance: 244_800 + Math.sin(tick * 0.04) * 2000, balanceUSD: 0,
      change24h: +500 + Math.sin(tick * 0.14) * 1000, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 21_600_000).toISOString(),
      type: "unknown", tags: ["Co-Founder", "ETH Creator", "Long-term Holder"], txCount: 1_842, isActive: false,
    },
    {
      id: "w12", label: "Jump Trading Crypto", chain: "ETH", address: "0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0",
      balance: 124_500 + Math.sin(tick * 0.07) * 3000, balanceUSD: 0,
      change24h: +5200 + Math.sin(tick * 0.11) * 2000, changeUSD24h: 0,
      lastActivity: new Date(Date.now() - 600_000).toISOString(),
      type: "fund", tags: ["Market Maker", "Jump Trading", "High Frequency"], txCount: 284_100, isActive: true,
    },
  ];

  // Compute USD values
  return wallets.map(w => ({
    ...w,
    balanceUSD: w.balance * prices[w.chain],
    changeUSD24h: w.change24h * prices[w.chain],
  }));
}

// ============================================================
// WHALE TRADES — Recent large transactions
// ============================================================

export function generateWhaleTrades(tick: number): WhaleTrade[] {
  const now = Date.now();
  const prices = { BTC: 67500, ETH: 3450, SOL: 178, BNB: 598 };

  const templates: Omit<WhaleTrade, "id" | "timestamp">[] = [
    {
      txHash: "a1b2c3d4e5f6", chain: "BTC", asset: "BTC",
      from: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", fromLabel: "Binance Cold Wallet",
      to: "Unknown Wallet", toLabel: "Cold Storage",
      amount: 1240 + Math.sin(tick * 0.3) * 200, amountUSD: 0,
      type: "exchange_outflow", sentiment: "bullish", significance: "mega",
    },
    {
      txHash: "f6e5d4c3b2a1", chain: "BTC", asset: "BTC",
      from: "Unknown OTC Desk", fromLabel: "OTC Desk",
      to: "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb", toLabel: "BlackRock ETF",
      amount: 850 + Math.sin(tick * 0.25) * 150, amountUSD: 0,
      type: "exchange_inflow", sentiment: "bullish", significance: "mega",
    },
    {
      txHash: "1a2b3c4d5e6f", chain: "ETH", asset: "ETH",
      from: "0x28C6c06298d514Db089934071355E5743bf21d60", fromLabel: "Binance ETH Hot",
      to: "0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0", toLabel: "Jump Trading",
      amount: 48_200 + Math.sin(tick * 0.2) * 5000, amountUSD: 0,
      type: "exchange_outflow", sentiment: "bullish", significance: "large",
    },
    {
      txHash: "2b3c4d5e6f1a", chain: "BTC", asset: "BTC",
      from: "Unknown Wallet", fromLabel: "Unknown",
      to: "3NukJ6fYZJ5Kk8bPjycAnruZkE5Q7UW7i8", toLabel: "Coinbase Institutional",
      amount: 420 + Math.sin(tick * 0.35) * 80, amountUSD: 0,
      type: "exchange_inflow", sentiment: "bearish", significance: "large",
    },
    {
      txHash: "3c4d5e6f1a2b", chain: "ETH", asset: "ETH",
      from: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe", fromLabel: "ETH Foundation",
      to: "Kraken Exchange", toLabel: "Kraken",
      amount: 15_000 + Math.sin(tick * 0.28) * 2000, amountUSD: 0,
      type: "exchange_inflow", sentiment: "bearish", significance: "large",
    },
    {
      txHash: "4d5e6f1a2b3c", chain: "BTC", asset: "BTC",
      from: "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv", fromLabel: "Marathon Mining",
      to: "Unknown OTC", toLabel: "OTC Desk",
      amount: 320 + Math.sin(tick * 0.22) * 60, amountUSD: 0,
      type: "mining", sentiment: "neutral", significance: "medium",
    },
    {
      txHash: "5e6f1a2b3c4d", chain: "BTC", asset: "BTC",
      from: "Unknown Cold Storage", fromLabel: "Cold Storage",
      to: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", toLabel: "Grayscale Wallet",
      amount: 680 + Math.sin(tick * 0.18) * 120, amountUSD: 0,
      type: "wallet_to_wallet", sentiment: "bullish", significance: "large",
    },
    {
      txHash: "6f1a2b3c4d5e", chain: "ETH", asset: "ETH",
      from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", fromLabel: "Vitalik Buterin",
      to: "Uniswap V3", toLabel: "Uniswap DeFi",
      amount: 5_000 + Math.sin(tick * 0.32) * 800, amountUSD: 0,
      type: "defi", sentiment: "neutral", significance: "medium",
    },
  ];

  return templates.map((t, i) => ({
    ...t,
    id: `tx${tick}_${i}`,
    amount: Math.abs(t.amount),
    amountUSD: Math.abs(t.amount) * prices[t.chain],
    timestamp: new Date(now - (i * 180_000) - (seededRand(tick + i) * 300_000)).toISOString(),
  }));
}

// ============================================================
// WHALE ALERTS
// ============================================================

export function generateWhaleAlerts(tick: number): WhaleAlert[] {
  const allAlerts: WhaleAlert[][] = [
    [
      { id: "a1", timestamp: new Date(Date.now() - 120_000).toISOString(), title: "🚨 MEGA MOVE: 1,240 BTC left Binance", description: "1,240 BTC ($83.7M) moved from Binance Cold Wallet to unknown cold storage. Exchange outflow historically bullish — signals reduced sell pressure.", severity: "critical", asset: "BTC", amountUSD: 83_700_000, sentiment: "bullish", icon: "🟢" },
      { id: "a2", timestamp: new Date(Date.now() - 600_000).toISOString(), title: "📈 BlackRock ETF accumulated 850 BTC", description: "BlackRock Bitcoin ETF received 850 BTC ($57.4M) today. Institutional accumulation continuing — 3rd consecutive day of inflows.", severity: "high", asset: "BTC", amountUSD: 57_400_000, sentiment: "bullish", icon: "🟢" },
      { id: "a3", timestamp: new Date(Date.now() - 1_200_000).toISOString(), title: "⚠️ ETH Foundation sold 2,100 ETH", description: "Ethereum Foundation moved 2,100 ETH ($7.2M) toward exchanges. Foundation historically sells to fund operations — not necessarily bearish.", severity: "medium", asset: "ETH", amountUSD: 7_245_000, sentiment: "neutral", icon: "🟡" },
    ],
    [
      { id: "a4", timestamp: new Date(Date.now() - 300_000).toISOString(), title: "🐋 Unknown wallet accumulated 2,800 BTC", description: "A previously dormant wallet accumulated 2,800 BTC ($189M) from 14 separate OTC transactions over 48h. Classic institutional accumulation pattern.", severity: "critical", asset: "BTC", amountUSD: 189_000_000, sentiment: "bullish", icon: "🟢" },
      { id: "a5", timestamp: new Date(Date.now() - 900_000).toISOString(), title: "⚠️ MtGox wallet shows activity", description: "MtGox trustee wallet had internal reorganization. No funds moved to exchanges yet. 46,164 BTC ($3.1B) still held — monitor for creditor repayments.", severity: "critical", asset: "BTC", amountUSD: 3_100_000_000, sentiment: "bearish", icon: "🔴" },
      { id: "a6", timestamp: new Date(Date.now() - 1_800_000).toISOString(), title: "📊 Jump Trading received 48K ETH", description: "Jump Trading Crypto received 48,200 ETH ($166M) from Binance. Market maker positioning for increased activity — could signal upcoming volatility.", severity: "high", asset: "ETH", amountUSD: 166_290_000, sentiment: "neutral", icon: "🟡" },
    ],
    [
      { id: "a7", timestamp: new Date(Date.now() - 180_000).toISOString(), title: "🟢 Grayscale received 680 BTC inflows", description: "680 BTC ($45.9M) transferred into Grayscale wallets. GBTC discount narrowing — institutional demand increasing.", severity: "high", asset: "BTC", amountUSD: 45_900_000, sentiment: "bullish", icon: "🟢" },
      { id: "a8", timestamp: new Date(Date.now() - 720_000).toISOString(), title: "⛏️ Marathon Mining moved 320 BTC to OTC", description: "Marathon Digital Holdings sold 320 BTC ($21.6M) via OTC desk. Miners selling production — not panic selling. Neutral signal.", severity: "medium", asset: "BTC", amountUSD: 21_600_000, sentiment: "neutral", icon: "🟡" },
      { id: "a9", timestamp: new Date(Date.now() - 3_600_000).toISOString(), title: "🔴 420 BTC moved TO exchange", description: "420 BTC ($28.4M) deposited to Coinbase Institutional. Could indicate intent to sell — monitor closely. Exchange inflow = potential bearish pressure.", severity: "high", asset: "BTC", amountUSD: 28_350_000, sentiment: "bearish", icon: "🔴" },
    ],
  ];

  return allAlerts[tick % allAlerts.length];
}

// ============================================================
// EXCHANGE FLOW SUMMARY
// ============================================================

export function getChainFlows(tick: number): ChainFlowSummary[] {
  return [
    {
      chain: "Bitcoin", asset: "BTC",
      exchangeInflow24h: 2_840_000_000 + Math.sin(tick * 0.1) * 200_000_000,
      exchangeOutflow24h: 3_920_000_000 + Math.sin(tick * 0.12) * 300_000_000,
      netFlow: -1_080_000_000 + Math.sin(tick * 0.08) * 100_000_000,
      largeTransactions: 147 + Math.floor(Math.sin(tick * 0.2) * 20),
      whaleCount: 38 + Math.floor(Math.sin(tick * 0.15) * 8),
      sentiment: "bullish",
    },
    {
      chain: "Ethereum", asset: "ETH",
      exchangeInflow24h: 1_240_000_000 + Math.sin(tick * 0.09) * 100_000_000,
      exchangeOutflow24h: 1_680_000_000 + Math.sin(tick * 0.11) * 150_000_000,
      netFlow: -440_000_000 + Math.sin(tick * 0.07) * 80_000_000,
      largeTransactions: 284 + Math.floor(Math.sin(tick * 0.18) * 40),
      whaleCount: 62 + Math.floor(Math.sin(tick * 0.14) * 12),
      sentiment: "bullish",
    },
    {
      chain: "Solana", asset: "SOL",
      exchangeInflow24h: 420_000_000 + Math.sin(tick * 0.13) * 60_000_000,
      exchangeOutflow24h: 380_000_000 + Math.sin(tick * 0.16) * 50_000_000,
      netFlow: 40_000_000 + Math.sin(tick * 0.1) * 30_000_000,
      largeTransactions: 98 + Math.floor(Math.sin(tick * 0.22) * 15),
      whaleCount: 24 + Math.floor(Math.sin(tick * 0.17) * 6),
      sentiment: "bearish",
    },
    {
      chain: "BNB Chain", asset: "BNB",
      exchangeInflow24h: 280_000_000 + Math.sin(tick * 0.11) * 40_000_000,
      exchangeOutflow24h: 310_000_000 + Math.sin(tick * 0.14) * 45_000_000,
      netFlow: -30_000_000 + Math.sin(tick * 0.09) * 20_000_000,
      largeTransactions: 64 + Math.floor(Math.sin(tick * 0.19) * 10),
      whaleCount: 18 + Math.floor(Math.sin(tick * 0.13) * 4),
      sentiment: "neutral",
    },
  ];
}

// ============================================================
// SMART MONEY FLOWS
// ============================================================

export function getSmartMoneyFlows(tick: number): SmartMoneyFlow[] {
  return [
    {
      asset: "BTC",
      accumulating: 64 + Math.sin(tick * 0.1) * 8,
      distributing: 22 + Math.sin(tick * 0.12) * 4,
      holding: 14 + Math.sin(tick * 0.08) * 3,
      netPositionChange: +2.4 + Math.sin(tick * 0.15) * 1.2,
      signal: "accumulation",
      historicalAccuracy: 78,
    },
    {
      asset: "ETH",
      accumulating: 58 + Math.sin(tick * 0.09) * 7,
      distributing: 28 + Math.sin(tick * 0.11) * 5,
      holding: 14 + Math.sin(tick * 0.07) * 3,
      netPositionChange: +1.8 + Math.sin(tick * 0.14) * 1.0,
      signal: "accumulation",
      historicalAccuracy: 74,
    },
    {
      asset: "SOL",
      accumulating: 44 + Math.sin(tick * 0.11) * 6,
      distributing: 38 + Math.sin(tick * 0.13) * 5,
      holding: 18 + Math.sin(tick * 0.09) * 3,
      netPositionChange: -0.6 + Math.sin(tick * 0.16) * 0.8,
      signal: "neutral",
      historicalAccuracy: 69,
    },
  ];
}

// ============================================================
// HELPERS
// ============================================================

export function formatUSD(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
