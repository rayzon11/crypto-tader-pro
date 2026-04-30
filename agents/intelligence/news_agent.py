"""
NEWS AGENT — Fetches live crypto news, scores sentiment, shares with all agents.
Self-learning: adjusts keyword weights based on which sentiments preceded profitable trades.
File: agents/intelligence/news_agent.py
"""
import asyncio, json, os, re
import aiohttp
from datetime import datetime
from agents.base_agent import BaseAgent


class NewsAgent(BaseAgent):
    def __init__(self):
        super().__init__("news")
        self.cryptopanic_key = os.getenv("CRYPTOPANIC_API_KEY", "")
        # Sentiment keyword weights — self-learning adjusts these over time
        self.positive_keywords = {
            "bull": 1.0, "bullish": 1.2, "surge": 1.1, "rally": 1.0,
            "adoption": 0.8, "etf": 0.9, "approved": 1.0, "partnership": 0.7,
            "upgrade": 0.6, "breakout": 0.8, "record": 0.7, "launch": 0.5,
            "institutional": 0.8, "accumulation": 0.7, "growth": 0.6,
            "moon": 0.5, "pump": 0.4, "gain": 0.6, "profit": 0.5,
            "support": 0.3, "recovery": 0.7, "all-time high": 1.3,
        }
        self.negative_keywords = {
            "crash": -1.2, "hack": -1.3, "ban": -1.0, "sec": -0.6,
            "fraud": -1.1, "liquidation": -1.0, "dump": -0.9, "sell-off": -1.0,
            "bearish": -1.2, "bear": -0.8, "decline": -0.7, "lawsuit": -0.9,
            "exploit": -1.2, "rug": -1.3, "scam": -1.1, "regulation": -0.4,
            "fud": -0.5, "fear": -0.6, "panic": -0.8, "collapse": -1.2,
            "bankrupt": -1.3, "loss": -0.7, "warning": -0.5,
        }
        self.news_cache = []
        self.sentiment_history = []  # track sentiment vs subsequent trades

    async def fetch_coingecko_news(self) -> list:
        """Fetch trending coins and market data from CoinGecko (free, no key)."""
        news_items = []
        try:
            async with aiohttp.ClientSession() as session:
                # Trending search — gives us popular coins and their momentum
                async with session.get(
                    "https://api.coingecko.com/api/v3/search/trending",
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for coin in data.get("coins", [])[:7]:
                            item = coin.get("item", {})
                            score = item.get("score", 0)
                            price_change = item.get("data", {}).get(
                                "price_change_percentage_24h", {}).get("usd", 0)
                            news_items.append({
                                "title": f"{item.get('name', 'Unknown')} ({item.get('symbol', '?').upper()}) trending — "
                                         f"Rank #{score + 1} on CoinGecko",
                                "source": "CoinGecko Trending",
                                "timestamp": datetime.utcnow().isoformat(),
                                "url": f"https://www.coingecko.com/en/coins/{item.get('id', '')}",
                                "price_change_24h": price_change or 0,
                            })

                # Global market data
                async with session.get(
                    "https://api.coingecko.com/api/v3/global",
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        market = data.get("data", {})
                        mc_change = market.get("market_cap_change_percentage_24h_usd", 0)
                        direction = "up" if mc_change > 0 else "down"
                        news_items.append({
                            "title": f"Global crypto market cap {direction} {abs(mc_change):.1f}% "
                                     f"in 24h — Total: ${market.get('total_market_cap', {}).get('usd', 0) / 1e12:.2f}T",
                            "source": "CoinGecko Global",
                            "timestamp": datetime.utcnow().isoformat(),
                            "url": "https://www.coingecko.com/en/global-charts",
                            "price_change_24h": mc_change,
                        })
        except Exception as e:
            self.logger.warning(f"CoinGecko fetch error: {e}")
        return news_items

    async def fetch_cryptopanic_news(self) -> list:
        """Fetch news from CryptoPanic API (requires free API key)."""
        if not self.cryptopanic_key:
            return []
        news_items = []
        try:
            url = (
                f"https://cryptopanic.com/api/v1/posts/"
                f"?auth_token={self.cryptopanic_key}&public=true&kind=news"
            )
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for post in data.get("results", [])[:20]:
                            news_items.append({
                                "title": post.get("title", ""),
                                "source": post.get("source", {}).get("title", "CryptoPanic"),
                                "timestamp": post.get("published_at", datetime.utcnow().isoformat()),
                                "url": post.get("url", ""),
                                "price_change_24h": 0,
                            })
        except Exception as e:
            self.logger.warning(f"CryptoPanic fetch error: {e}")
        return news_items

    def score_headline(self, title: str) -> float:
        """Score a headline from -1 (very bearish) to +1 (very bullish)."""
        title_lower = title.lower()
        score = 0.0
        matches = 0
        for kw, weight in self.positive_keywords.items():
            if kw in title_lower:
                score += weight
                matches += 1
        for kw, weight in self.negative_keywords.items():
            if kw in title_lower:
                score += weight  # weight is already negative
                matches += 1
        # Also check for price change data
        if matches == 0:
            return 0.0
        return max(-1.0, min(1.0, score / max(matches, 1)))

    async def _learn_from_trades(self):
        """Listen to trade results and correlate with recent news sentiment."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("agent:trade_result")
        async for msg in pubsub.listen():
            if msg["type"] != "message":
                continue
            try:
                trade = json.loads(msg["data"])
                won = trade.get("won", False)
                # Get current news sentiment
                if not self.sentiment_history:
                    continue
                recent_sentiment = self.sentiment_history[-1]
                # If sentiment was positive and trade won, boost positive keywords
                # If sentiment was positive and trade lost, reduce positive keywords
                adjustment = 0.02 if won else -0.01
                if recent_sentiment > 0.1:
                    for kw in self.positive_keywords:
                        self.positive_keywords[kw] *= (1 + adjustment)
                elif recent_sentiment < -0.1:
                    for kw in self.negative_keywords:
                        self.negative_keywords[kw] *= (1 + adjustment)
                # Save learned weights
                self.learning_data["param_adjustments"] = {
                    "positive_keywords": self.positive_keywords,
                    "negative_keywords": self.negative_keywords,
                }
                await self.save_learning_state()
            except Exception:
                pass

    async def execute(self):
        # Restore learned keyword weights if available
        saved_params = self.learning_data.get("param_adjustments", {})
        if "positive_keywords" in saved_params:
            self.positive_keywords.update(saved_params["positive_keywords"])
        if "negative_keywords" in saved_params:
            self.negative_keywords.update(saved_params["negative_keywords"])

        # Start trade learning listener
        asyncio.create_task(self._learn_from_trades())

        while self.running:
            try:
                # Fetch from all sources
                cg_news = await self.fetch_coingecko_news()
                cp_news = await self.fetch_cryptopanic_news()
                all_news = cp_news + cg_news  # CryptoPanic first if available

                # Score all headlines
                scored_news = []
                for item in all_news:
                    sentiment_score = self.score_headline(item["title"])
                    # Also factor in price change data if available
                    pc = item.get("price_change_24h", 0)
                    if pc > 5:
                        sentiment_score = min(1.0, sentiment_score + 0.3)
                    elif pc < -5:
                        sentiment_score = max(-1.0, sentiment_score - 0.3)
                    scored_news.append({
                        **item,
                        "sentiment_score": round(sentiment_score, 3),
                        "sentiment": "positive" if sentiment_score > 0.1
                                     else "negative" if sentiment_score < -0.1
                                     else "neutral",
                    })

                # Compute aggregate sentiment
                scores = [n["sentiment_score"] for n in scored_news]
                avg_score = sum(scores) / max(len(scores), 1)
                self.sentiment_history.append(avg_score)
                self.sentiment_history = self.sentiment_history[-100:]  # keep last 100

                # Determine signal
                if avg_score > 0.2:
                    signal = "BULLISH_NEWS"
                elif avg_score < -0.2:
                    signal = "BEARISH_NEWS"
                else:
                    signal = "NEUTRAL_NEWS"

                # Store in Redis for frontend
                self.news_cache = scored_news[:50]
                await self.redis.set(
                    "news:latest",
                    json.dumps(self.news_cache),
                    ex=600  # 10 minute TTL
                )

                # Share with all agents
                await self.publish_shared_data("news_sentiment", {
                    "score": round(avg_score, 4),
                    "signal": signal,
                    "article_count": len(scored_news),
                    "top_headlines": [n["title"] for n in scored_news[:5]],
                    "timestamp": datetime.utcnow().isoformat(),
                })

                await self.report(
                    signal=signal,
                    metadata={
                        "news_score": round(avg_score, 4),
                        "articles": len(scored_news),
                        "positive": sum(1 for n in scored_news if n["sentiment"] == "positive"),
                        "negative": sum(1 for n in scored_news if n["sentiment"] == "negative"),
                        "neutral": sum(1 for n in scored_news if n["sentiment"] == "neutral"),
                        "learning_cycles": self.learning_data["total_learning_cycles"],
                    }
                )

                self.logger.info(
                    f"News: {len(scored_news)} articles | sentiment={avg_score:.3f} "
                    f"| signal={signal}"
                )

            except Exception as e:
                self.logger.error(f"News cycle error: {e}")

            await asyncio.sleep(120)  # check every 2 minutes


if __name__ == "__main__":
    asyncio.run(NewsAgent().run())
