# agents/strategy/arbitrage_agent.py
import asyncio
import ccxt.async_support as ccxt
from agents.base_agent import BaseAgent


class ArbitrageAgent(BaseAgent):
    def __init__(self):
        super().__init__("arbitrage")
        self.exchanges = {
            "binance": ccxt.binance({"enableRateLimit": True}),
            "kraken": ccxt.kraken({"enableRateLimit": True}),
        }
        self.symbol = "BTC/USDT"
        self.min_spread_pct = 0.3  # minimum 0.3% spread to signal

    async def fetch_price(self, exchange_name: str) -> float:
        exchange = self.exchanges[exchange_name]
        ticker = await exchange.fetch_ticker(self.symbol)
        return float(ticker["last"])

    async def execute(self):
        while self.running:
            try:
                prices = {}
                for name in self.exchanges:
                    try:
                        prices[name] = await self.fetch_price(name)
                    except Exception as e:
                        self.logger.warning(f"Failed to fetch {name}: {e}")

                if len(prices) < 2:
                    await self.report(signal="HOLD",
                        metadata={"error": "insufficient_exchanges"})
                    await asyncio.sleep(30)
                    continue

                exchange_names = list(prices.keys())
                price_values = list(prices.values())
                min_idx = price_values.index(min(price_values))
                max_idx = price_values.index(max(price_values))

                low_exchange = exchange_names[min_idx]
                high_exchange = exchange_names[max_idx]
                low_price = price_values[min_idx]
                high_price = price_values[max_idx]

                spread_pct = ((high_price - low_price) / low_price) * 100

                if spread_pct >= self.min_spread_pct:
                    signal = "ARB_OPEN"
                else:
                    signal = "ARB_CLOSE"

                self.logger.info(
                    f"Spread={spread_pct:.3f}% "
                    f"({low_exchange}={low_price:.2f} vs "
                    f"{high_exchange}={high_price:.2f}) => {signal}")
                await self.report(signal=signal, metadata={
                    "spread_pct": spread_pct,
                    "buy_exchange": low_exchange,
                    "sell_exchange": high_exchange,
                    "buy_price": low_price,
                    "sell_price": high_price,
                    "prices": prices,
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(30)

        for ex in self.exchanges.values():
            await ex.close()


if __name__ == "__main__":
    asyncio.run(ArbitrageAgent().run())
