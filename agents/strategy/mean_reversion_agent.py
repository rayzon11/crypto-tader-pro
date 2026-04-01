# agents/strategy/mean_reversion_agent.py
import asyncio
import ccxt.async_support as ccxt
import pandas as pd
import numpy as np
from agents.base_agent import BaseAgent


class MeanReversionAgent(BaseAgent):
    def __init__(self):
        super().__init__("mean_reversion")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"
        self.bb_period = 20
        self.bb_std = 2.0
        self.zscore_threshold = 2.0

    def bollinger_bands(self, closes: pd.Series):
        sma = closes.rolling(window=self.bb_period).mean()
        std = closes.rolling(window=self.bb_period).std()
        upper = sma + (self.bb_std * std)
        lower = sma - (self.bb_std * std)
        return upper, sma, lower

    def zscore(self, closes: pd.Series) -> float:
        mean = closes.rolling(window=self.bb_period).mean().iloc[-1]
        std = closes.rolling(window=self.bb_period).std().iloc[-1]
        if std == 0:
            return 0.0
        return float((closes.iloc[-1] - mean) / std)

    async def execute(self):
        while self.running:
            try:
                ohlcv = await self.exchange.fetch_ohlcv(
                    self.symbol, "1h", limit=100)
                df = pd.DataFrame(ohlcv,
                    columns=["ts", "o", "h", "l", "c", "v"])
                closes = df["c"]

                upper, sma, lower = self.bollinger_bands(closes)
                price = closes.iloc[-1]
                z = self.zscore(closes)

                upper_val = upper.iloc[-1]
                lower_val = lower.iloc[-1]
                sma_val = sma.iloc[-1]

                if price <= lower_val and z <= -self.zscore_threshold:
                    signal = "BUY"
                elif price >= upper_val and z >= self.zscore_threshold:
                    signal = "SELL"
                else:
                    signal = "NEUTRAL"

                self.logger.info(
                    f"Price={price:.2f} BB=[{lower_val:.2f},{upper_val:.2f}] "
                    f"Z={z:.2f} => {signal}")
                await self.report(signal=signal, metadata={
                    "price": price, "bb_upper": upper_val,
                    "bb_lower": lower_val, "bb_sma": sma_val,
                    "zscore": z,
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(60)
        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(MeanReversionAgent().run())
