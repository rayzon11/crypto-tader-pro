# agents/strategy/momentum_agent.py
import asyncio
import ccxt.async_support as ccxt
import pandas as pd
import pandas_ta as ta
from agents.base_agent import BaseAgent


class MomentumAgent(BaseAgent):
    def __init__(self):
        super().__init__("momentum")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"
        self.rsi_period = 14

    async def execute(self):
        while self.running:
            try:
                ohlcv = await self.exchange.fetch_ohlcv(
                    self.symbol, "1h", limit=100)
                df = pd.DataFrame(ohlcv,
                    columns=["ts", "o", "h", "l", "c", "v"])

                rsi = ta.rsi(df["c"], length=self.rsi_period).iloc[-1]
                stoch = ta.stoch(df["h"], df["l"], df["c"])
                stochk = stoch["STOCHk_14_3_3"].iloc[-1]

                if rsi < 30 and stochk < 20:
                    signal = "BUY"
                elif rsi > 70 and stochk > 80:
                    signal = "SELL"
                elif rsi > 70:
                    signal = "OVERBOUGHT"
                elif rsi < 30:
                    signal = "OVERSOLD"
                else:
                    signal = "HOLD"

                self.logger.info(f"RSI={rsi:.1f} StochK={stochk:.1f} => {signal}")
                await self.report(signal=signal,
                    metadata={"rsi": rsi, "stoch_k": stochk})
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(60)
        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(MomentumAgent().run())
