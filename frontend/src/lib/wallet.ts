// Demo Wallet Engine — $1,000 starting balance with full trade simulation
// Persisted in localStorage so it survives page refreshes

export interface Position {
  id: string;
  pair: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  amount: number;
  value: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  agent: string;
  openedAt: string;
  stopLoss: number | null;
  takeProfit: number | null;
}

export interface ClosedTrade {
  id: string;
  pair: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  pnlPct: number;
  fees: number;
  agent: string;
  openedAt: string;
  closedAt: string;
  reason: string;
}

export interface WalletState {
  startingBalance: number;
  balance: number;
  equity: number;
  openPositions: Position[];
  closedTrades: ClosedTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  bestTradeToday: ClosedTrade | null;
  worstTradeToday: ClosedTrade | null;
  dailyPnl: number;
  dailyReturn: number;
  tradesToday: number;
  sessionStartedAt: string;
  lastUpdated: string;
}

const STORAGE_KEY = "cryptobot_demo_wallet";
const STARTING_BALANCE = 1000.0;

const LIVE_PRICES: Record<string, number> = {
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

export function getDefaultWallet(): WalletState {
  return {
    startingBalance: STARTING_BALANCE,
    balance: STARTING_BALANCE,
    equity: STARTING_BALANCE,
    openPositions: [],
    closedTrades: [],
    totalTrades: 0,
    wins: 0,
    losses: 0,
    bestTradeToday: null,
    worstTradeToday: null,
    dailyPnl: 0,
    dailyReturn: 0,
    tradesToday: 0,
    sessionStartedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

export function loadWallet(): WalletState {
  if (typeof window === "undefined") return getDefaultWallet();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const wallet = JSON.parse(raw) as WalletState;
      return wallet;
    }
  } catch {}
  return getDefaultWallet();
}

export function saveWallet(wallet: WalletState): void {
  if (typeof window === "undefined") return;
  wallet.lastUpdated = new Date().toISOString();
  // Recompute equity
  const unrealized = wallet.openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
  wallet.equity = wallet.balance + unrealized;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
}

export function resetWallet(): WalletState {
  const fresh = getDefaultWallet();
  saveWallet(fresh);
  return fresh;
}

export function getPrice(pair: string, tick: number = 0): number {
  const base = LIVE_PRICES[pair] || 100;
  // Simulate realistic price movement
  const noise = Math.sin(tick * 0.1 + pair.length) * base * 0.002;
  const trend = Math.sin(tick * 0.01) * base * 0.001;
  return Math.round((base + noise + trend) * 100) / 100;
}

export function calculateFees(value: number): { spread: number; slippage: number; platformFee: number; total: number } {
  const spread = value * 0.0005; // 0.05% spread
  const slippage = value * 0.0002; // 0.02% slippage
  const platformFee = value * 0.001; // 0.1% platform fee
  return {
    spread: Math.round(spread * 100) / 100,
    slippage: Math.round(slippage * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    total: Math.round((spread + slippage + platformFee) * 100) / 100,
  };
}

export function openPosition(
  wallet: WalletState,
  pair: string,
  side: "LONG" | "SHORT",
  amount: number,
  agent: string,
  tick: number = 0
): WalletState {
  const price = getPrice(pair, tick);
  const value = amount * price;
  const fees = calculateFees(value);

  if (wallet.balance < value + fees.total) return wallet; // insufficient funds

  const position: Position = {
    id: `POS${Date.now()}`,
    pair,
    side,
    entryPrice: price,
    currentPrice: price,
    amount,
    value,
    unrealizedPnl: -fees.total, // start negative due to fees
    unrealizedPnlPct: (-fees.total / value) * 100,
    agent,
    openedAt: new Date().toISOString(),
    stopLoss: side === "LONG" ? price * 0.97 : price * 1.03, // 3% stop loss
    takeProfit: side === "LONG" ? price * 1.05 : price * 0.95, // 5% take profit
  };

  wallet.balance -= value + fees.total;
  wallet.openPositions.push(position);
  wallet.totalTrades++;
  wallet.tradesToday++;
  saveWallet(wallet);
  return { ...wallet };
}

export function closePosition(
  wallet: WalletState,
  positionId: string,
  tick: number = 0,
  reason: string = "Manual close"
): WalletState {
  const idx = wallet.openPositions.findIndex((p) => p.id === positionId);
  if (idx === -1) return wallet;

  const pos = wallet.openPositions[idx];
  const exitPrice = getPrice(pos.pair, tick);
  const exitValue = pos.amount * exitPrice;
  const fees = calculateFees(exitValue);

  let pnl: number;
  if (pos.side === "LONG") {
    pnl = (exitPrice - pos.entryPrice) * pos.amount - fees.total;
  } else {
    pnl = (pos.entryPrice - exitPrice) * pos.amount - fees.total;
  }

  const trade: ClosedTrade = {
    id: pos.id,
    pair: pos.pair,
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice,
    amount: pos.amount,
    pnl: Math.round(pnl * 100) / 100,
    pnlPct: Math.round((pnl / pos.value) * 10000) / 100,
    fees: fees.total,
    agent: pos.agent,
    openedAt: pos.openedAt,
    closedAt: new Date().toISOString(),
    reason,
  };

  wallet.balance += exitValue - fees.total;
  wallet.closedTrades.unshift(trade);
  wallet.openPositions.splice(idx, 1);
  wallet.dailyPnl += pnl;
  wallet.dailyReturn = (wallet.dailyPnl / wallet.startingBalance) * 100;

  if (pnl > 0) {
    wallet.wins++;
    if (!wallet.bestTradeToday || pnl > wallet.bestTradeToday.pnl) {
      wallet.bestTradeToday = trade;
    }
  } else {
    wallet.losses++;
    if (!wallet.worstTradeToday || pnl < wallet.worstTradeToday.pnl) {
      wallet.worstTradeToday = trade;
    }
  }

  saveWallet(wallet);
  return { ...wallet };
}

export function updatePositionPrices(wallet: WalletState, tick: number): WalletState {
  wallet.openPositions = wallet.openPositions.map((pos) => {
    const currentPrice = getPrice(pos.pair, tick);
    let unrealizedPnl: number;
    if (pos.side === "LONG") {
      unrealizedPnl = (currentPrice - pos.entryPrice) * pos.amount;
    } else {
      unrealizedPnl = (pos.entryPrice - currentPrice) * pos.amount;
    }
    return {
      ...pos,
      currentPrice,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      unrealizedPnlPct: Math.round((unrealizedPnl / pos.value) * 10000) / 100,
    };
  });
  const unrealized = wallet.openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
  wallet.equity = wallet.balance + unrealized;
  wallet.lastUpdated = new Date().toISOString();
  return { ...wallet };
}

export function getWinRate(wallet: WalletState): number {
  const total = wallet.wins + wallet.losses;
  if (total === 0) return 0;
  return Math.round((wallet.wins / total) * 1000) / 10;
}

export function getWinRateColor(rate: number): string {
  if (rate >= 65) return "text-amber-400"; // GOLD — Elite
  if (rate >= 55) return "text-green-400"; // GREEN — Good
  if (rate >= 40) return "text-yellow-400"; // YELLOW — Acceptable
  return "text-red-400"; // RED — Needs recalibration
}

export function getWinRateBadge(rate: number): { label: string; color: string; bg: string } {
  if (rate >= 65) return { label: "ELITE", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" };
  if (rate >= 55) return { label: "GOOD", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" };
  if (rate >= 40) return { label: "MONITOR", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" };
  return { label: "RECALIBRATE", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" };
}

// Projection calculator: "If this were real money"
export function projectReturns(dailyReturn: number, capital: number) {
  const daily = capital * (dailyReturn / 100);
  const weekly = daily * 5; // 5 trading days
  const monthly = daily * 22; // 22 trading days
  const yearly = daily * 252; // 252 trading days
  return {
    daily: Math.round(daily * 100) / 100,
    weekly: Math.round(weekly * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    yearly: Math.round(yearly * 100) / 100,
  };
}

export const TRADEABLE_ASSETS = [
  { pair: "BTC/USDT", name: "Bitcoin", type: "crypto", icon: "₿" },
  { pair: "ETH/USDT", name: "Ethereum", type: "crypto", icon: "Ξ" },
  { pair: "SOL/USDT", name: "Solana", type: "crypto", icon: "◎" },
  { pair: "BNB/USDT", name: "BNB", type: "crypto", icon: "◆" },
  { pair: "AVAX/USDT", name: "Avalanche", type: "crypto", icon: "△" },
  { pair: "AAPL", name: "Apple Inc.", type: "stock", icon: "" },
  { pair: "TSLA", name: "Tesla Inc.", type: "stock", icon: "T" },
  { pair: "NVDA", name: "NVIDIA Corp.", type: "stock", icon: "N" },
  { pair: "SPY", name: "S&P 500 ETF", type: "etf", icon: "S" },
  { pair: "QQQ", name: "Nasdaq 100 ETF", type: "etf", icon: "Q" },
];
