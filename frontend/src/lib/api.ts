// Real Free API Integration Layer
// CoinGecko (free, no key), CryptoPanic (free key), CryptoCompare (free key)
// Falls back to mock data if APIs fail

export interface LivePrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  image: string;
  sparkline_in_7d?: { price: number[] };
}

export interface CryptoNews {
  id: string;
  title: string;
  url: string;
  source: string;
  imageUrl: string | null;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral";
  currencies?: { code: string; title: string }[];
}

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: string;
}

// === COINGECKO FREE API ===

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchLivePrices(): Promise<LivePrice[]> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin,avalanche-2&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("CoinGecko API failed, using fallback:", e);
    return getFallbackPrices();
  }
}

export async function fetchCoinDetail(coinId: string): Promise<any> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("CoinGecko coin detail failed:", e);
    return null;
  }
}

export async function fetchTrendingCoins(): Promise<any[]> {
  try {
    const res = await fetch(`${COINGECKO_BASE}/search/trending`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`CoinGecko trending error: ${res.status}`);
    const data = await res.json();
    return data.coins?.map((c: any) => c.item) || [];
  } catch (e) {
    console.warn("CoinGecko trending failed:", e);
    return [];
  }
}

// === FEAR & GREED INDEX ===

export async function fetchFearGreed(): Promise<FearGreedData> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error("Fear & Greed error");
    const data = await res.json();
    const item = data.data?.[0];
    return {
      value: parseInt(item?.value || "50"),
      classification: item?.value_classification || "Neutral",
      timestamp: item?.timestamp || "",
    };
  } catch (e) {
    console.warn("Fear & Greed API failed:", e);
    return { value: 65, classification: "Greed", timestamp: "" };
  }
}

// === CRYPTO NEWS (CryptoPanic — free with key, or fallback) ===

export async function fetchCryptoNews(apiKey?: string): Promise<CryptoNews[]> {
  // Try CryptoPanic if key available
  if (apiKey) {
    try {
      const res = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&kind=news&filter=hot&public=true`,
        { next: { revalidate: 120 } }
      );
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).slice(0, 20).map((item: any, i: number) => ({
          id: `CP${i}`,
          title: item.title,
          url: item.url,
          source: item.source?.title || "CryptoPanic",
          imageUrl: null,
          publishedAt: item.published_at,
          sentiment: item.votes?.positive > item.votes?.negative ? "positive" as const
            : item.votes?.negative > item.votes?.positive ? "negative" as const
            : "neutral" as const,
          currencies: item.currencies,
        }));
      }
    } catch (e) {
      console.warn("CryptoPanic API failed:", e);
    }
  }

  // Fallback: CoinGecko trending + status
  try {
    const [trending, global] = await Promise.all([
      fetch(`${COINGECKO_BASE}/search/trending`, { next: { revalidate: 300 } }),
      fetch(`${COINGECKO_BASE}/global`, { next: { revalidate: 300 } }),
    ]);

    const news: CryptoNews[] = [];

    if (trending.ok) {
      const data = await trending.json();
      (data.coins || []).slice(0, 10).forEach((c: any, i: number) => {
        news.push({
          id: `TR${i}`,
          title: `${c.item.name} (${c.item.symbol.toUpperCase()}) trending — Rank #${c.item.market_cap_rank || "N/A"}`,
          url: `https://www.coingecko.com/en/coins/${c.item.id}`,
          source: "CoinGecko Trending",
          imageUrl: c.item.small || c.item.thumb || null,
          publishedAt: new Date().toISOString(),
          sentiment: "positive",
        });
      });
    }

    if (global.ok) {
      const data = await global.json();
      const mktChange = data.data?.market_cap_change_percentage_24h_usd || 0;
      news.unshift({
        id: "GL1",
        title: `Global crypto market cap ${mktChange >= 0 ? "up" : "down"} ${Math.abs(mktChange).toFixed(2)}% — Total: $${((data.data?.total_market_cap?.usd || 0) / 1e12).toFixed(2)}T`,
        url: "https://www.coingecko.com/en/global-charts",
        source: "CoinGecko Global",
        imageUrl: null,
        publishedAt: new Date().toISOString(),
        sentiment: mktChange >= 0 ? "positive" : "negative",
      });
    }

    return news;
  } catch (e) {
    console.warn("All news APIs failed, using static fallback");
    return getFallbackNews();
  }
}

// === FALLBACKS ===

function getFallbackPrices(): LivePrice[] {
  return [
    { id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 67523.45, price_change_24h: 1580.23, price_change_percentage_24h: 2.34, market_cap: 1320000000000, total_volume: 28500000000, high_24h: 68100, low_24h: 65900, image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
    { id: "ethereum", symbol: "eth", name: "Ethereum", current_price: 3451.23, price_change_24h: -30.12, price_change_percentage_24h: -0.87, market_cap: 415000000000, total_volume: 15200000000, high_24h: 3520, low_24h: 3410, image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
    { id: "solana", symbol: "sol", name: "Solana", current_price: 178.56, price_change_24h: 9.14, price_change_percentage_24h: 5.12, market_cap: 82000000000, total_volume: 3800000000, high_24h: 182, low_24h: 170, image: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
    { id: "binancecoin", symbol: "bnb", name: "BNB", current_price: 598.34, price_change_24h: 7.35, price_change_percentage_24h: 1.23, market_cap: 90000000000, total_volume: 1900000000, high_24h: 605, low_24h: 588, image: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
    { id: "avalanche-2", symbol: "avax", name: "Avalanche", current_price: 38.67, price_change_24h: -0.56, price_change_percentage_24h: -1.45, market_cap: 15000000000, total_volume: 520000000, high_24h: 39.8, low_24h: 37.9, image: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  ];
}

function getFallbackNews(): CryptoNews[] {
  return [
    { id: "F1", title: "Bitcoin ETF sees record $1.2B inflows as institutional adoption accelerates", url: "#", source: "CoinDesk", imageUrl: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png", publishedAt: new Date().toISOString(), sentiment: "positive" },
    { id: "F2", title: "Ethereum Layer 2 TVL surpasses $50B milestone", url: "#", source: "The Block", imageUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", publishedAt: new Date().toISOString(), sentiment: "positive" },
    { id: "F3", title: "SEC delays decision on Solana ETF application", url: "#", source: "Reuters", imageUrl: "https://assets.coingecko.com/coins/images/4128/small/solana.png", publishedAt: new Date().toISOString(), sentiment: "negative" },
    { id: "F4", title: "Global crypto market cap reaches $2.8 trillion", url: "#", source: "Bloomberg", imageUrl: null, publishedAt: new Date().toISOString(), sentiment: "positive" },
    { id: "F5", title: "Fed signals potential rate cuts, crypto markets react", url: "#", source: "CNBC", imageUrl: null, publishedAt: new Date().toISOString(), sentiment: "positive" },
  ];
}

// === API KEY STORAGE (localStorage) ===

const API_KEYS_STORAGE = "cryptobot_api_keys";

export interface ApiKeyConfig {
  coingecko?: string; // Pro key (optional, free tier works)
  cryptopanic?: string;
  cryptocompare?: string;
  binanceApiKey?: string;
  binanceSecret?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  discordWebhook?: string;
}

export function loadApiKeys(): ApiKeyConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveApiKeys(keys: ApiKeyConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEYS_STORAGE, JSON.stringify(keys));
}
