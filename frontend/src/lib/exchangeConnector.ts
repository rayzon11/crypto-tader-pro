// Exchange Connector — Real Binance & Coinbase Trading
// Client-side HMAC signing with Web Crypto API (keys never leave browser)
// Uses Next.js API routes as CORS proxy

export interface ExchangeCredentials {
  binance?: { apiKey: string; secret: string };
  coinbase?: { apiKey: string; secret: string; passphrase?: string };
}

export interface ExchangeBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
}

export interface ExchangeOrder {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: "NEW" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED" | "PENDING";
  filledQty: number;
  avgPrice: number;
  timestamp: string;
  exchange: "binance" | "coinbase";
}

export interface ExchangeTrade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  timestamp: string;
  pnl?: number;
}

export interface OrderRequest {
  symbol: string;           // e.g. "BTCUSDT" for Binance, "BTC-USDT" for Coinbase
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  quantity: number;         // base asset quantity
  price?: number;           // required for LIMIT
  stopPrice?: number;       // required for STOP_LIMIT
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface ConnectionStatus {
  connected: boolean;
  exchange: "binance" | "coinbase";
  accountType?: string;
  canTrade?: boolean;
  canWithdraw?: boolean;
  serverTime?: number;
  error?: string;
}

// ============================================================
// STORAGE
// ============================================================
const CREDS_KEY = "cryptobot_exchange_creds";
const LIVE_MODE_KEY = "cryptobot_live_trading";
const BOT_LIMITS_KEY = "cryptobot_bot_limits";

export interface BotTradingLimits {
  maxPositionUSD: number;
  maxDailyLossUSD: number;
  maxOrderUSD: number;
  allowedPairs: string[];
  agentsEnabled: string[];
  emergencyStop: boolean;
}

export function loadCredentials(): ExchangeCredentials {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(CREDS_KEY); // sessionStorage: clears on tab close
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveCredentials(creds: ExchangeCredentials): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CREDS_KEY, JSON.stringify(creds)); // session only, not persisted
}

export function clearCredentials(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CREDS_KEY);
}

export function isLiveMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LIVE_MODE_KEY) === "true";
}

export function setLiveMode(live: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIVE_MODE_KEY, live ? "true" : "false");
}

export function loadBotLimits(): BotTradingLimits {
  if (typeof window === "undefined") return defaultBotLimits();
  try {
    const raw = localStorage.getItem(BOT_LIMITS_KEY);
    return raw ? JSON.parse(raw) : defaultBotLimits();
  } catch { return defaultBotLimits(); }
}

export function saveBotLimits(limits: BotTradingLimits): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOT_LIMITS_KEY, JSON.stringify(limits));
}

function defaultBotLimits(): BotTradingLimits {
  return {
    maxPositionUSD: 100,
    maxDailyLossUSD: 50,
    maxOrderUSD: 50,
    allowedPairs: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    agentsEnabled: [],
    emergencyStop: true, // safe default
  };
}

// ============================================================
// HMAC-SHA256 signing using Web Crypto API (browser-safe)
// ============================================================
async function hmacSHA256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// BINANCE CONNECTOR
// ============================================================

const BINANCE_BASE = "https://api.binance.com";

async function binanceFetch(
  endpoint: string,
  method: "GET" | "POST" | "DELETE",
  apiKey: string,
  secret: string,
  params: Record<string, string | number> = {},
  signed = true
): Promise<any> {
  const timestamp = Date.now();
  const allParams: Record<string, string> = {};

  for (const [k, v] of Object.entries(params)) {
    allParams[k] = String(v);
  }

  let queryString = new URLSearchParams(allParams).toString();

  if (signed) {
    if (queryString) queryString += `&timestamp=${timestamp}`;
    else queryString = `timestamp=${timestamp}`;
    const signature = await hmacSHA256(secret, queryString);
    queryString += `&signature=${signature}`;
  }

  const url = `${BINANCE_BASE}${endpoint}${queryString ? "?" + queryString : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ msg: res.statusText }));
    throw new Error(`Binance ${res.status}: ${err.msg || res.statusText}`);
  }

  return res.json();
}

export async function testBinanceConnection(apiKey: string, secret: string): Promise<ConnectionStatus> {
  try {
    const data = await binanceFetch("/api/v3/account", "GET", apiKey, secret, {}, true);
    return {
      connected: true,
      exchange: "binance",
      accountType: data.accountType || "SPOT",
      canTrade: data.canTrade,
      canWithdraw: data.canWithdraw,
    };
  } catch (err: any) {
    return { connected: false, exchange: "binance", error: err.message };
  }
}

export async function getBinanceBalances(apiKey: string, secret: string): Promise<ExchangeBalance[]> {
  const data = await binanceFetch("/api/v3/account", "GET", apiKey, secret, {}, true);
  const prices = await getBinancePrices(apiKey);

  return (data.balances || [])
    .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    .map((b: any) => {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked);
      const total = free + locked;
      const symbol = b.asset;
      const price = symbol === "USDT" || symbol === "BUSD" ? 1 :
        prices[`${symbol}USDT`] || prices[`${symbol}BTC`] ? (prices[`${symbol}BTC`] * (prices["BTCUSDT"] || 67000)) : 0;
      return { asset: symbol, free, locked, total, usdValue: total * price };
    })
    .sort((a: ExchangeBalance, b: ExchangeBalance) => b.usdValue - a.usdValue);
}

async function getBinancePrices(apiKey: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${BINANCE_BASE}/api/v3/ticker/price`, {
      headers: { "X-MBX-APIKEY": apiKey },
    });
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const item of data) {
      prices[item.symbol] = parseFloat(item.price);
    }
    return prices;
  } catch { return {}; }
}

export async function getBinanceOpenOrders(apiKey: string, secret: string, symbol?: string): Promise<ExchangeOrder[]> {
  const params: Record<string, string | number> = symbol ? { symbol } : {};
  const data = await binanceFetch("/api/v3/openOrders", "GET", apiKey, secret, params, true);
  return (data || []).map((o: any) => ({
    orderId: String(o.orderId),
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    quantity: parseFloat(o.origQty),
    price: parseFloat(o.price) || undefined,
    stopPrice: parseFloat(o.stopPrice) || undefined,
    status: o.status,
    filledQty: parseFloat(o.executedQty),
    avgPrice: parseFloat(o.avgPrice || o.price || 0),
    timestamp: new Date(o.time).toISOString(),
    exchange: "binance" as const,
  }));
}

export async function getBinanceTradeHistory(apiKey: string, secret: string, symbol: string, limit = 50): Promise<ExchangeTrade[]> {
  const data = await binanceFetch("/api/v3/myTrades", "GET", apiKey, secret, { symbol, limit }, true);
  return (data || []).map((t: any) => ({
    id: String(t.id),
    symbol: t.symbol,
    side: t.isBuyer ? "BUY" as const : "SELL" as const,
    quantity: parseFloat(t.qty),
    price: parseFloat(t.price),
    fee: parseFloat(t.commission),
    feeAsset: t.commissionAsset,
    timestamp: new Date(t.time).toISOString(),
  }));
}

export async function placeBinanceOrder(
  apiKey: string,
  secret: string,
  order: OrderRequest,
  limits: BotTradingLimits
): Promise<ExchangeOrder> {
  // Safety checks
  if (limits.emergencyStop) throw new Error("Emergency stop is ACTIVE. Disable it in bot controls before trading.");
  const orderUSD = order.quantity * (order.price || 67000);
  if (orderUSD > limits.maxOrderUSD) throw new Error(`Order size $${orderUSD.toFixed(0)} exceeds limit $${limits.maxOrderUSD}`);
  const binanceSymbol = order.symbol.replace("-", "");
  if (!limits.allowedPairs.includes(binanceSymbol)) throw new Error(`Pair ${binanceSymbol} not in allowed list`);

  const params: Record<string, string | number> = {
    symbol: binanceSymbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity,
  };

  if (order.type === "LIMIT") {
    if (!order.price) throw new Error("Price required for LIMIT order");
    params.price = order.price;
    params.timeInForce = order.timeInForce || "GTC";
  }

  if (order.type === "STOP_LIMIT") {
    if (!order.price || !order.stopPrice) throw new Error("Price and stopPrice required for STOP_LIMIT");
    params.price = order.price;
    params.stopPrice = order.stopPrice;
    params.timeInForce = order.timeInForce || "GTC";
  }

  const data = await binanceFetch("/api/v3/order", "POST", apiKey, secret, params, true);

  return {
    orderId: String(data.orderId),
    symbol: data.symbol,
    side: data.side,
    type: data.type,
    quantity: parseFloat(data.origQty),
    price: parseFloat(data.price) || undefined,
    status: data.status,
    filledQty: parseFloat(data.executedQty),
    avgPrice: parseFloat(data.fills?.[0]?.price || data.price || 0),
    timestamp: new Date(data.transactTime).toISOString(),
    exchange: "binance",
  };
}

export async function cancelBinanceOrder(apiKey: string, secret: string, symbol: string, orderId: string): Promise<void> {
  await binanceFetch("/api/v3/order", "DELETE", apiKey, secret, { symbol: symbol.replace("-", ""), orderId }, true);
}

// ============================================================
// COINBASE ADVANCED TRADE CONNECTOR
// ============================================================

const CB_BASE = "https://api.coinbase.com/api/v3/brokerage";

async function coinbaseFetch(
  endpoint: string,
  method: "GET" | "POST" | "DELETE",
  apiKey: string,
  secret: string,
  body?: object
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const message = timestamp + method + "/api/v3/brokerage" + endpoint + bodyStr;
  const signature = await hmacSHA256(secret, message);

  const res = await fetch(`${CB_BASE}${endpoint}`, {
    method,
    headers: {
      "CB-ACCESS-KEY": apiKey,
      "CB-ACCESS-SIGN": signature,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
    },
    body: bodyStr || undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Coinbase ${res.status}: ${err.message || err.error || res.statusText}`);
  }

  return res.json();
}

export async function testCoinbaseConnection(apiKey: string, secret: string): Promise<ConnectionStatus> {
  try {
    const data = await coinbaseFetch("/accounts", "GET", apiKey, secret);
    return {
      connected: true,
      exchange: "coinbase",
      canTrade: true,
      canWithdraw: false,
    };
  } catch (err: any) {
    return { connected: false, exchange: "coinbase", error: err.message };
  }
}

export async function getCoinbaseBalances(apiKey: string, secret: string): Promise<ExchangeBalance[]> {
  const data = await coinbaseFetch("/accounts", "GET", apiKey, secret);
  return (data.accounts || [])
    .filter((a: any) => parseFloat(a.available_balance?.value || 0) > 0)
    .map((a: any) => {
      const free = parseFloat(a.available_balance?.value || 0);
      const total = parseFloat(a.hold?.value || 0) + free;
      return {
        asset: a.currency,
        free,
        locked: parseFloat(a.hold?.value || 0),
        total,
        usdValue: a.currency === "USD" || a.currency === "USDC" ? total : 0,
      };
    })
    .sort((a: ExchangeBalance, b: ExchangeBalance) => b.usdValue - a.usdValue);
}

export async function getCoinbaseOpenOrders(apiKey: string, secret: string): Promise<ExchangeOrder[]> {
  const data = await coinbaseFetch("/orders/historical/batch?order_status=OPEN", "GET", apiKey, secret);
  return (data.orders || []).map((o: any) => ({
    orderId: o.order_id,
    symbol: o.product_id,
    side: o.side,
    type: o.order_type?.toUpperCase() || "LIMIT",
    quantity: parseFloat(o.base_size || 0),
    price: parseFloat(o.limit_price || 0) || undefined,
    status: o.status,
    filledQty: parseFloat(o.filled_size || 0),
    avgPrice: parseFloat(o.average_filled_price || 0),
    timestamp: o.created_time,
    exchange: "coinbase" as const,
  }));
}

export async function placeCoinbaseOrder(
  apiKey: string,
  secret: string,
  order: OrderRequest,
  limits: BotTradingLimits
): Promise<ExchangeOrder> {
  if (limits.emergencyStop) throw new Error("Emergency stop is ACTIVE.");
  const cbSymbol = order.symbol.includes("-") ? order.symbol : order.symbol.replace("USDT", "-USDT").replace("BTC", "BTC-");

  const body: any = {
    client_order_id: `bot_${Date.now()}`,
    product_id: cbSymbol,
    side: order.side,
  };

  if (order.type === "MARKET") {
    body.order_configuration = { market_market_ioc: { base_size: String(order.quantity) } };
  } else if (order.type === "LIMIT") {
    body.order_configuration = {
      limit_limit_gtc: {
        base_size: String(order.quantity),
        limit_price: String(order.price),
      },
    };
  }

  const data = await coinbaseFetch("/orders", "POST", apiKey, secret, body);
  const o = data.order_id ? data : data.success_response;

  return {
    orderId: o?.order_id || "pending",
    symbol: cbSymbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity,
    price: order.price,
    status: "NEW",
    filledQty: 0,
    avgPrice: 0,
    timestamp: new Date().toISOString(),
    exchange: "coinbase",
  };
}

// ============================================================
// UNIFIED INTERFACE
// ============================================================

export async function getBalances(creds: ExchangeCredentials): Promise<{
  binance: ExchangeBalance[];
  coinbase: ExchangeBalance[];
  totalUSD: number;
}> {
  const [binance, coinbase] = await Promise.all([
    creds.binance ? getBinanceBalances(creds.binance.apiKey, creds.binance.secret).catch(() => []) : Promise.resolve([]),
    creds.coinbase ? getCoinbaseBalances(creds.coinbase.apiKey, creds.coinbase.secret).catch(() => []) : Promise.resolve([]),
  ]);

  const totalUSD = [...binance, ...coinbase].reduce((s, b) => s + b.usdValue, 0);
  return { binance, coinbase, totalUSD };
}

export async function getOpenOrders(creds: ExchangeCredentials): Promise<ExchangeOrder[]> {
  const [binance, coinbase] = await Promise.all([
    creds.binance ? getBinanceOpenOrders(creds.binance.apiKey, creds.binance.secret).catch(() => []) : Promise.resolve([]),
    creds.coinbase ? getCoinbaseOpenOrders(creds.coinbase.apiKey, creds.coinbase.secret).catch(() => []) : Promise.resolve([]),
  ]);
  return [...binance, ...coinbase].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================
// SYMBOL HELPERS
// ============================================================
export const TRADEABLE_SYMBOLS = [
  { binance: "BTCUSDT", coinbase: "BTC-USDT", label: "Bitcoin", asset: "BTC" },
  { binance: "ETHUSDT", coinbase: "ETH-USDT", label: "Ethereum", asset: "ETH" },
  { binance: "SOLUSDT", coinbase: "SOL-USDT", label: "Solana", asset: "SOL" },
  { binance: "BNBUSDT", coinbase: "BNB-USDT", label: "BNB", asset: "BNB" },
  { binance: "AVAXUSDT", coinbase: "AVAX-USDT", label: "Avalanche", asset: "AVAX" },
  { binance: "ADAUSDT", coinbase: "ADA-USDT", label: "Cardano", asset: "ADA" },
  { binance: "DOGEUSDT", coinbase: "DOGE-USDT", label: "Dogecoin", asset: "DOGE" },
  { binance: "XRPUSDT", coinbase: "XRP-USDT", label: "Ripple", asset: "XRP" },
];

export function formatBalance(n: number, decimals = 4): string {
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}
