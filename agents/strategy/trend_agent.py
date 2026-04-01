# agents/strategy/trend_agent.py
import asyncio
import ccxt.async_support as ccxt
import pandas as pd
from agents.base_agent import BaseAgent


class TrendAgent(BaseAgent):
    def __init__(self):
        super().__init__("trend")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"
        self.timeframe = "1h"

    def ema(self, s, p):
        return s.ewm(span=p, adjust=False).mean()

    def macd(self, s):
        fast, slow = self.ema(s, 12), self.ema(s, 26)
        m = fast - slow
        return m, self.ema(m, 9)

    async def execute(self):
        while self.running:
            try:
                ohlcv = await self.exchange.fetch_ohlcv(
                    self.symbol, self.timeframe, limit=100)
                closes = pd.DataFrame(ohlcv,
                    columns=["ts", "o", "h", "l", "c", "v"])["c"]

                e9, e21 = self.ema(closes, 9).iloc[-1], self.ema(closes, 21).iloc[-1]
                m, sig = self.macd(closes)
                mv, sv = m.iloc[-1], sig.iloc[-1]

                signal = ("BUY" if e9 > e21 and mv > sv else
                          "SELL" if e9 < e21 and mv < sv else "HOLD")

                self.logger.info(f"EMA9={e9:.2f} EMA21={e21:.2f} => {signal}")
                await self.report(signal=signal,
                    metadata={"ema9": e9, "ema21": e21, "macd": mv})
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(60)
        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(TrendAgent().run())
