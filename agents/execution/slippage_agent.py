# agents/execution/slippage_agent.py
import asyncio, json
import ccxt.async_support as ccxt
from agents.base_agent import BaseAgent


class SlippageAgent(BaseAgent):
    def __init__(self):
        super().__init__("slippage")
        self.exchanges = {
            "binance": ccxt.binance({"enableRateLimit": True}),
        }
        self.max_slippage_pct = 0.1  # 0.1% max acceptable slippage

    async def estimate_slippage(self, symbol: str, side: str,
                                 amount: float) -> dict:
        """Estimate slippage by checking orderbook depth."""
        best_exchange = None
        best_slippage = float("inf")
        results = {}

        for name, exchange in self.exchanges.items():
            try:
                book = await exchange.fetch_order_book(symbol, limit=50)
                levels = book["asks"] if side == "buy" else book["bids"]

                if not levels:
                    continue

                mid_price = (book["bids"][0][0] + book["asks"][0][0]) / 2
                filled = 0.0
                cost = 0.0

                for price, qty in levels:
                    fill_qty = min(qty, amount - filled)
                    cost += fill_qty * price
                    filled += fill_qty
                    if filled >= amount:
                        break

                if filled > 0:
                    avg_price = cost / filled
                    slippage_pct = abs((avg_price - mid_price) / mid_price) * 100
                    results[name] = {
                        "avg_price": avg_price,
                        "slippage_pct": slippage_pct,
                        "filled": filled,
                    }
                    if slippage_pct < best_slippage:
                        best_slippage = slippage_pct
                        best_exchange = name
            except Exception as e:
                self.logger.warning(f"Slippage check failed on {name}: {e}")

        return {
            "best_exchange": best_exchange,
            "best_slippage_pct": best_slippage,
            "all_exchanges": results,
        }

    async def execute(self):
        """Monitor and report slippage conditions."""
        while self.running:
            try:
                symbol = "BTC/USDT"
                test_amount = 0.1  # BTC

                buy_slip = await self.estimate_slippage(symbol, "buy", test_amount)
                sell_slip = await self.estimate_slippage(symbol, "sell", test_amount)

                buy_pct = buy_slip.get("best_slippage_pct", 0)
                sell_pct = sell_slip.get("best_slippage_pct", 0)
                avg_slip = (buy_pct + sell_pct) / 2

                if avg_slip > self.max_slippage_pct:
                    signal = "SPLIT"  # recommend splitting order
                else:
                    signal = "ROUTED"  # single execution is fine

                self.logger.info(
                    f"BuySlip={buy_pct:.4f}% SellSlip={sell_pct:.4f}% "
                    f"Best={buy_slip.get('best_exchange')} => {signal}")
                await self.report(signal=signal, metadata={
                    "buy_slippage_pct": buy_pct,
                    "sell_slippage_pct": sell_pct,
                    "best_exchange": buy_slip.get("best_exchange"),
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(30)

        for ex in self.exchanges.values():
            await ex.close()


if __name__ == "__main__":
    asyncio.run(SlippageAgent().run())
