"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import NewsFeed from "@/components/NewsFeed";
import { generateNewsItems, type NewsItem } from "@/lib/mockData";

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setNews(generateNewsItems(20, 0));
    const interval = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        setNews(generateNewsItems(20, next));
        return next;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === "all" ? news : news.filter((n) => n.sentiment === filter);

  const positiveCount = news.filter((n) => n.sentiment === "positive").length;
  const negativeCount = news.filter((n) => n.sentiment === "negative").length;
  const neutralCount = news.filter((n) => n.sentiment === "neutral").length;
  const avgScore = news.length > 0 ? news.reduce((sum, n) => sum + n.score, 0) / news.length : 0;

  // Sentiment gauge: -1 to +1 mapped to 0-100%
  const gaugePercent = Math.round((avgScore + 1) * 50);

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Crypto News Feed
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live news with AI sentiment scoring — feeds into all 25 agents
          </p>
        </div>

        {/* Sentiment Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="card-hover bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Total Articles</div>
            <div className="text-2xl font-bold text-blue-400">{news.length}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Positive</div>
            <div className="text-2xl font-bold text-green-400">{positiveCount}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-red-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Negative</div>
            <div className="text-2xl font-bold text-red-400">{negativeCount}</div>
          </div>
          <div className="card-hover bg-gradient-to-br from-slate-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 uppercase">Neutral</div>
            <div className="text-2xl font-bold text-slate-400">{neutralCount}</div>
          </div>
          <div className="col-span-2 lg:col-span-1 card-hover bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl border border-slate-800/50 px-4 py-3">
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
              Auto-refreshing every 10s
            </span>
          </div>
          <NewsFeed items={filtered} />
        </div>

        {/* How it works */}
        <div className="mt-6 p-4 rounded-xl bg-slate-800/20 border border-slate-700/20">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">How News Agent Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] text-slate-500">
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">1.</span>
              <span>Fetches crypto news from CoinGecko Trending and CryptoPanic API every 2 minutes</span>
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
