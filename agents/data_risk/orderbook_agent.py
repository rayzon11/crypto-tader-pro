# agents/data_risk/orderbook_agent.py
import asyncio
import ccxt.async_support as ccxt
import numpy as np
from agents.base_agent import BaseAgent


class OrderbookAgent(BaseAgent):
    def __init__(self):
        super().__init__("orderbook")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"
        self.depth_limit = 50
        self.imbalance_threshold = 0.3  # 30% imbalance

    async def execute(self):
        while self.running:
            try:
                orderbook = await self.exchange.fetch_order_book(
                    self.symbol, limit=self.depth_limit)

                bids = orderbook["bids"]  # [[price, amount], ...]
                asks = orderbook["asks"]

                if not bids or not asks:
                    await asyncio.sleep(15)
                    continue

                bid_volume = sum(b[1] for b in bids)
                ask_volume = sum(a[1] for a in asks)
                total_volume = bid_volume + ask_volume

                if total_volume == 0:
                    await asyncio.sleep(15)
                    continue

                # Imbalance: positive = more bids (bullish), negative = more asks
                imbalance = (bid_volume - ask_volume) / total_volume

                spread = asks[0][0] - bids[0][0]
                spread_pct = (spread / bids[0][0]) * 100
                mid_price = (bids[0][0] + asks[0][0]) / 2

                if abs(imbalance) > self.imbalance_threshold:
                    signal = "IMBALANCE"
                elif spread_pct > 0.1:  # wide spread = thin book
                    signal = "THIN"
                else:
                    signal = "NORMAL"

                self.logger.info(
                    f"Imbalance={imbalance:.3f} Spread={spread_pct:.4f}% "
                    f"BidVol={bid_volume:.2f} AskVol={ask_volume:.2f} => {signal}")
                await self.report(signal=signal, metadata={
                    "imbalance": imbalance,
                    "spread_pct": spread_pct,
                    "bid_volume": bid_volume,
                    "ask_volume": ask_volume,
                    "mid_price": mid_price,
                    "best_bid": bids[0][0],
                    "best_ask": asks[0][0],
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(15)
        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(OrderbookAgent().run())
