"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import NewsFeed, { type NewsFeedItem } from "@/components/NewsFeed";
import NewsWire from "@/components/NewsWire";
import CryptoIPOPanel from "@/components/CryptoIPOPanel";
import { fetchCryptoNews, fetchFearGreed, fetchTrendingCoins, loadApiKeys } from "@/lib/api";
import { generateNewsItems } from "@/lib/mockData";

export default function NewsPage() {
  const [news, setNews] = useState<NewsFeedItem[]>([]);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [fearGreed, setFearGreed] = useState({ value: 50, classification: "Neutral" });
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch real news data
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function loadNews() {
      setLoading(true);
      try {
        const keys = loadApiKeys();

        // Fetch news, fear & greed, and trending in parallel
        const [newsData, fgData, trendingData] = await Promise.all([
          fetchCryptoNews(keys.cryptopanic),
          fetchFearGreed(),
          fetchTrendingCoins(),
        ]);

        if (cancelled) return;

        if (newsData.length > 0) {
          // Convert API news to NewsFeedItem format
          const feedItems: NewsFeedItem[] = newsData.map((n) => ({
            id: n.id,
            title: n.title,
            source: n.source,
            timestamp: n.publishedAt,
            sentiment: n.sentiment,
            score: n.sentiment === "positive" ? 0.7 : n.sentiment === "negative" ? -0.6 : 0.1,
            imageUrl: n.imageUrl,
            url: n.url,
            currencies: n.currencies,
          }));
          setNews(feedItems);
          setDataSource("live");
        } else {
          // Fall back to mock data
          const mockItems = generateNewsItems(20, 0);
          setNews(mockItems.map((m) => ({
            ...m,
            imageUrl: null,
            url: "#",
          })));
          setDataSource("fallback");
        }

        setFearGreed({ value: fgData.value, classification: fgData.classification });
        setTrending(trendingData.slice(0, 8));
      } catch (err) {
        console.warn("News fetch error:", err);
        const mockItems = generateNewsItems(20, 0);
        setNews(mockItems.map((m) => ({ ...m, imageUrl: null, url: "#" })));
        setDataSource("fallback");
      }
      setLoading(false);
    }

    loadNews();

    // Refresh every 2 minutes
    const interval = setInterval(loadNews, 120000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [mounted]);

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading news...</div>;
  }

  const filtered = filter === "all" ? news : news.filter((n) => n.sentiment === filter);
  const positiveCount = news.filter((n) => n.sentiment === "positive").length;
  const negativeCount = news.filter((n) => n.sentiment === "negative").length;
  const neutralCount = news.filter((n) => n.sentiment === "neutral").length;
  const avgScore = news.length > 0 ? news.reduce((sum, n) => sum + n.score, 0) / news.length : 0;
  const gaugePercent = Math.round((avgScore + 1) * 50);

  // Fear & Greed color
  const fgColor = fearGreed.value >= 75 ? "text-green-400" : fearGreed.value >= 50 ? "text-amber-400" : fearGreed.value >= 25 ? "text-orange-400" : "text-red-400";

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Crypto News Feed
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Live news with AI sentiment scoring — feeds into all 25 agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-1 rounded-full ${dataSource === "live" ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
              {dataSource === "live" ? "🟢 Live API" : "🟡 Fallback Data"}
            </span>
            {loading && (
              <span className="text-[10px] text-slate-500 animate-pulse">Fetching...</span>
            )}
          </div>
        </div>

        {/* LIVE RSS WIRE + IPO ANALYST — real-time, no backend required */}
        <div className="space-y-4 mb-6">
          <NewsWire max={60} />
          <CryptoIPOPanel />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <div className="card-hover bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Total Articles</div>
            <div className="text-2xl font-bold text-blue-400">{news.length}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Bullish</div>
            <div className="text-2xl font-bold text-green-400">{positiveCount}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-red-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Bearish</div>
            <div className="text-2xl font-bold text-red-400">{negativeCount}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-slate-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Neutral</div>
            <div className="text-2xl font-bold text-slate-400">{neutralCount}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Fear & Greed</div>
            <div className={`text-2xl font-bold ${fgColor}`}>{fearGreed.value}</div>
            <div className="text-[9px] text-slate-500">{fearGreed.classification}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-cyan-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Market Mood</div>
            <div className={`text-2xl font-bold ${avgScore > 0.1 ? "text-green-400" : avgScore < -0.1 ? "text-red-400" : "text-slate-400"}`}>
              {avgScore > 0.1 ? "BULLISH" : avgScore < -0.1 ? "BEARISH" : "NEUTRAL"}
            </div>
          </div>
        </div>

        {/* Sentiment Gauge */}
        <div className="mb-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-400">News Sentiment Gauge</span>
            <span className="text-[11px] text-slate-500">
              Score: {avgScore >= 0 ? "+" : ""}{(avgScore * 100).toFixed(1)}%
            </span>
          </div>
          <div className="relative w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex">
              <div className="w-1/2 bg-gradient-to-r from-red-500/30 to-transparent" />
              <div className="w-1/2 bg-gradient-to-l from-green-500/30 to-transparent" />
            </div>
            <div
              className="absolute top-0 h-full w-1 bg-amber-400 rounded-full transition-all duration-500 shadow-lg shadow-amber-400/50"
              style={{ left: `${gaugePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-slate-600">
            <span>Extreme Fear</span>
            <span>Neutral</span>
            <span>Extreme Greed</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main News Feed - 2 cols */}
          <div className="lg:col-span-2">
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {(["all", "positive", "negative", "neutral"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                    filter === f
                      ? f === "positive"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : f === "negative"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : f === "neutral"
                        ? "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                        : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800"
                  }`}
                >
                  {f} {f !== "all" && `(${news.filter((n) => n.sentiment === f).length})`}
                </button>
              ))}
            </div>

            {/* News Feed */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-300">Latest Headlines</h3>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Auto-refreshing every 2min
                </span>
              </div>
              {loading && news.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs animate-pulse">
                  Fetching live news from CoinGecko & CryptoPanic...
                </div>
              ) : (
                <NewsFeed items={filtered} />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Trending Coins */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3">🔥 Trending Coins</h3>
              {trending.length > 0 ? (
                <div className="space-y-2">
                  {trending.map((coin: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                      {coin.small || coin.thumb ? (
                        <img
                          src={coin.small || coin.thumb}
                          alt={coin.name}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[9px]">
                          {(coin.symbol || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-300 font-medium truncate">
                          {coin.name}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {coin.symbol?.toUpperCase()} {coin.market_cap_rank ? `• Rank #${coin.market_cap_rank}` : ""}
                        </div>
                      </div>
                      {coin.data?.price_change_percentage_24h?.usd != null && (
                        <span className={`text-[10px] font-bold ${coin.data.price_change_percentage_24h.usd >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {coin.data.price_change_percentage_24h.usd >= 0 ? "+" : ""}{coin.data.price_change_percentage_24h.usd.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-600 text-center py-4">
                  {loading ? "Loading trending..." : "No trending data available"}
                </div>
              )}
            </div>

            {/* Fear & Greed Widget */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3">Fear & Greed Index</h3>
              <div className="text-center">
                <div className={`text-5xl font-black ${fgColor}`}>{fearGreed.value}</div>
                <div className={`text-sm font-bold mt-1 ${fgColor}`}>{fearGreed.classification}</div>
                <div className="mt-3 w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      fearGreed.value >= 75 ? "bg-green-500" : fearGreed.value >= 50 ? "bg-amber-500" : fearGreed.value >= 25 ? "bg-orange-500" : "bg-red-500"
                    }`}
                    style={{ width: `${fearGreed.value}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                  <span>Fear</span>
                  <span>Greed</span>
                </div>
              </div>
            </div>

            {/* Data Sources */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3">📡 Data Sources</h3>
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">CoinGecko API</span>
                  <span className="text-green-400">Connected (Free)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fear & Greed Index</span>
                  <span className="text-green-400">Connected (Free)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">CryptoPanic News</span>
                  <span className={loadApiKeys().cryptopanic ? "text-green-400" : "text-amber-400"}>
                    {loadApiKeys().cryptopanic ? "Connected" : "No API Key (Using Fallback)"}
                  </span>
                </div>
                <div className="mt-2 text-[9px] text-slate-600">
                  Add API keys in Admin → API Keys tab for enhanced news
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-6 p-4 rounded-xl bg-slate-800/20 border border-slate-700/20">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">How News Agent Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] text-slate-500">
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">1.</span>
              <span>Fetches live crypto news from CoinGecko Trending and CryptoPanic API every 2 minutes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">2.</span>
              <span>AI sentiment scoring with 45+ keywords. Weights self-adjust based on trade outcomes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">3.</span>
              <span>Publishes sentiment to all 25 agents via Redis. Strategy agents factor news into signals</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          News sentiment is one of many signals in the 25-agent consensus voting system.
        </div>
      </div>
    </div>
  );
}
