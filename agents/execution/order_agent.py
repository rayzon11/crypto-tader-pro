# agents/execution/order_agent.py
import asyncio, json, os
import ccxt.async_support as ccxt
from agents.base_agent import BaseAgent


class OrderAgent(BaseAgent):
    def __init__(self):
        super().__init__("order")
        self.exchange = ccxt.binance({
            "enableRateLimit": True,
            "apiKey": os.getenv("BINANCE_API_KEY", ""),
            "secret": os.getenv("BINANCE_SECRET", ""),
        })
        self.paper_trading = os.getenv("PAPER_TRADING", "true").lower() == "true"

    async def place_order(self, symbol: str, side: str, amount: float,
                          order_type: str = "limit", price: float = None) -> dict:
        """Place an order — paper or live."""
        if self.paper_trading:
            self.logger.info(
                f"[PAPER] {side} {amount} {symbol} @ {price or 'market'}")
            return {
                "id": f"paper_{self.trade_count}",
                "symbol": symbol, "side": side, "amount": amount,
                "price": price, "status": "filled", "paper": True,
            }

        if order_type == "limit" and price:
            order = await self.exchange.create_limit_order(
                symbol, side, amount, price)
        else:
            order = await self.exchange.create_market_order(
                symbol, side, amount)
        return order

    async def twap_order(self, symbol: str, side: str, total_amount: float,
                         slices: int = 5, interval: int = 60) -> list:
        """Time-weighted average price — split into slices."""
        slice_amount = total_amount / slices
        results = []
        for i in range(slices):
            result = await self.place_order(
                symbol, side, slice_amount, order_type="market")
            results.append(result)
            self.logger.info(f"TWAP slice {i+1}/{slices} executed")
            if i < slices - 1:
                await asyncio.sleep(interval)
        return results

    async def execute(self):
        """Listen for trade commands from the supervisor."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("supervisor:trade_command")

        while self.running:
            try:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    cmd = json.loads(msg["data"])
                    symbol = cmd.get("symbol", "BTC/USDT")
                    side = cmd.get("side", "buy")
                    size = cmd.get("size", 0.001)
                    order_type = cmd.get("type", "market")
                    price = cmd.get("price")

                    result = await self.place_order(
                        symbol, side, size, order_type, price)

                    status = result.get("status", "unknown")
                    signal = "PLACED" if status in ["filled", "open"] else "FAILED"

                    self.logger.info(f"Order {signal}: {side} {size} {symbol}")
                    await self.report(signal=signal, metadata={
                        "order_id": result.get("id"),
                        "symbol": symbol,
                        "side": side,
                        "size": size,
                        "status": status,
                    })
                else:
                    await self.report(signal="WAITING",
                        metadata={"paper_mode": self.paper_trading})
                    await asyncio.sleep(30)
            except Exception as e:
                self.logger.error(e)
                await asyncio.sleep(5)

        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(OrderAgent().run())
