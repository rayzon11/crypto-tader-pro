# agents/data_risk/sentiment_agent.py
import asyncio
import aiohttp
from agents.base_agent import BaseAgent


class SentimentAgent(BaseAgent):
    def __init__(self):
        super().__init__("sentiment")
        self.fg_url = "https://api.alternative.me/fng/?limit=1"

    async def fetch_fear_greed(self) -> int:
        """Fetch Fear & Greed index (0=Extreme Fear, 100=Extreme Greed)."""
        async with aiohttp.ClientSession() as s:
            async with s.get(self.fg_url,
                             timeout=aiohttp.ClientTimeout(total=10)) as r:
                data = await r.json()
                return int(data["data"][0]["value"])

    async def execute(self):
        while self.running:
            try:
                fg_value = await self.fetch_fear_greed()

                if fg_value <= 20:
                    signal = "EXTREME_FEAR"
                elif fg_value <= 40:
                    signal = "FEAR"
                elif fg_value <= 60:
                    signal = "NEUTRAL"
                elif fg_value <= 80:
                    signal = "GREED"
                else:
                    signal = "EXTREME_GREED"

                self.logger.info(f"Fear&Greed={fg_value} => {signal}")
                await self.report(signal=signal,
                    metadata={"fear_greed": fg_value})
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(300)  # every 5 minutes


if __name__ == "__main__":
    asyncio.run(SentimentAgent().run())
