# agents/data_risk/onchain_agent.py
import asyncio, json, os
import aiohttp
from agents.base_agent import BaseAgent


class OnchainAgent(BaseAgent):
    def __init__(self):
        super().__init__("onchain")
        self.glassnode_key = os.getenv("GLASSNODE_API_KEY", "")
        self.whale_threshold = 100  # BTC — large transaction threshold

    async def fetch_exchange_netflow(self) -> dict:
        """Fetch exchange net flow data — positive = inflow (bearish),
        negative = outflow (bullish)."""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    "a": "BTC",
                    "api_key": self.glassnode_key,
                    "i": "24h",
                }
                url = "https://api.glassnode.com/v1/metrics/transactions/transfers_volume_exchanges_net"
                async with session.get(url, params=params,
                                       timeout=aiohttp.ClientTimeout(total=15)) as r:
                    if r.status == 200:
                        data = await r.json()
                        if data:
                            latest = data[-1]
                            return {"netflow": latest.get("v", 0),
                                    "timestamp": latest.get("t", 0)}
        except Exception as e:
            self.logger.warning(f"Glassnode fetch failed: {e}")
        return {"netflow": 0, "timestamp": 0}

    async def fetch_whale_transactions(self) -> int:
        """Count large transactions in the last 24h via public APIs."""
        try:
            async with aiohttp.ClientSession() as session:
                url = "https://api.blockchain.info/q/24hrbtc"
                async with session.get(url,
                                       timeout=aiohttp.ClientTimeout(total=10)) as r:
                    if r.status == 200:
                        return int(await r.text()) // 100_000_000  # satoshi to BTC
        except Exception as e:
            self.logger.warning(f"Whale tx fetch failed: {e}")
        return 0

    async def execute(self):
        while self.running:
            try:
                netflow_data = await self.fetch_exchange_netflow()
                netflow = netflow_data.get("netflow", 0)

                if netflow > self.whale_threshold:
                    signal = "WHALE_SELL"  # large inflow to exchanges
                elif netflow < -self.whale_threshold:
                    signal = "WHALE_BUY"   # large outflow from exchanges
                else:
                    signal = "NEUTRAL"

                self.logger.info(
                    f"Exchange Netflow={netflow:.2f} BTC => {signal}")
                await self.report(signal=signal, metadata={
                    "exchange_netflow": netflow,
                    "whale_threshold": self.whale_threshold,
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(600)  # every 10 minutes


if __name__ == "__main__":
    asyncio.run(OnchainAgent().run())
