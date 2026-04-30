# agents/execution/stoploss_agent.py
import asyncio, json
import ccxt.async_support as ccxt
from agents.base_agent import BaseAgent


class StoplossAgent(BaseAgent):
    def __init__(self):
        super().__init__("stoploss")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"
        self.trailing_pct = 0.02  # 2% trailing stop
        self.take_profit_pct = 0.05  # 5% take profit
        self.active_stops = {}  # {order_id: {entry, high, stop, tp}}

    async def update_trailing_stops(self, current_price: float):
        """Update trailing stops based on current price."""
        triggered = []
        for order_id, stop_data in self.active_stops.items():
            entry = stop_data["entry"]
            side = stop_data["side"]

            if side == "long":
                # Update high watermark
                if current_price > stop_data["high"]:
                    stop_data["high"] = current_price
                    stop_data["stop"] = current_price * (1 - self.trailing_pct)

                # Check stop hit
                if current_price <= stop_data["stop"]:
                    triggered.append(("STOP_HIT", order_id, stop_data))
                # Check take profit
                elif current_price >= entry * (1 + self.take_profit_pct):
                    triggered.append(("TP_HIT", order_id, stop_data))

            elif side == "short":
                if current_price < stop_data["low"]:
                    stop_data["low"] = current_price
                    stop_data["stop"] = current_price * (1 + self.trailing_pct)

                if current_price >= stop_data["stop"]:
                    triggered.append(("STOP_HIT", order_id, stop_data))
                elif current_price <= entry * (1 - self.take_profit_pct):
                    triggered.append(("TP_HIT", order_id, stop_data))

        return triggered

    async def execute(self):
        """Monitor prices and manage trailing stops."""
        # Also listen for new position events
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("stoploss:new_position")

        while self.running:
            try:
                # Check for new positions to track
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=0.5)
                if msg and msg["type"] == "message":
                    pos = json.loads(msg["data"])
                    order_id = pos.get("order_id", f"pos_{len(self.active_stops)}")
                    self.active_stops[order_id] = {
                        "entry": pos["price"],
                        "high": pos["price"],
                        "low": pos["price"],
                        "stop": pos["price"] * (1 - self.trailing_pct)
                               if pos.get("side") == "long"
                               else pos["price"] * (1 + self.trailing_pct),
                        "side": pos.get("side", "long"),
                        "symbol": pos.get("symbol", self.symbol),
                        "size": pos.get("size", 0),
                    }
                    self.logger.info(f"Tracking new position: {order_id}")

                # Fetch current price
                ticker = await self.exchange.fetch_ticker(self.symbol)
                current_price = ticker["last"]

                # Update stops
                triggered = await self.update_trailing_stops(current_price)

                signal = "MONITORING"
                for trigger_type, order_id, data in triggered:
                    signal = trigger_type
                    self.logger.info(
                        f"{trigger_type}: {order_id} entry={data['entry']:.2f} "
                        f"current={current_price:.2f}")
                    await self.redis.publish("stoploss:triggered", json.dumps({
                        "type": trigger_type,
                        "order_id": order_id,
                        "entry": data["entry"],
                        "exit_price": current_price,
                        "side": data["side"],
                    }))
                    del self.active_stops[order_id]

                await self.report(signal=signal, metadata={
                    "active_stops": len(self.active_stops),
                    "current_price": current_price,
                    "trailing_pct": self.trailing_pct,
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(10)

        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(StoplossAgent().run())
