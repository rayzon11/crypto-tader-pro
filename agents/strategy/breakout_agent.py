# agents/strategy/breakout_agent.py
import asyncio
import ccxt.async_support as ccxt
import pandas as pd
import numpy as np
from agents.base_agent import BaseAgent


class BreakoutAgent(BaseAgent):
    def __init__(self):
        super().__init__("breakout")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"
        self.lookback = 20  # candles for support/resistance
        self.volume_mult = 1.5  # volume must be 1.5x average

    async def execute(self):
        while self.running:
            try:
                ohlcv = await self.exchange.fetch_ohlcv(
                    self.symbol, "1h", limit=100)
                df = pd.DataFrame(ohlcv,
                    columns=["ts", "o", "h", "l", "c", "v"])

                highs = df["h"].rolling(window=self.lookback).max()
                lows = df["l"].rolling(window=self.lookback).min()
                avg_vol = df["v"].rolling(window=self.lookback).mean()

                price = df["c"].iloc[-1]
                volume = df["v"].iloc[-1]
                resistance = highs.iloc[-2]  # previous bar's rolling high
                support = lows.iloc[-2]
                avg_volume = avg_vol.iloc[-1]

                volume_confirmed = volume > (avg_volume * self.volume_mult)

                if price > resistance and volume_confirmed:
                    signal = "BREAKOUT"
                elif price < support and volume_confirmed:
                    signal = "BREAKDOWN"
                elif price > resistance and not volume_confirmed:
                    signal = "FAKEOUT"
                else:
                    signal = "HOLD"

                self.logger.info(
                    f"Price={price:.2f} R={resistance:.2f} S={support:.2f} "
                    f"Vol={volume:.0f}/{avg_volume:.0f} => {signal}")
                await self.report(signal=signal, metadata={
                    "price": price,
                    "resistance": resistance,
                    "support": support,
                    "volume": volume,
                    "avg_volume": avg_volume,
                    "volume_confirmed": volume_confirmed,
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(60)
        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(BreakoutAgent().run())
