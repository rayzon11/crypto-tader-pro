# agents/execution/defi_agent.py
import asyncio, os, json
from agents.base_agent import BaseAgent


class DefiAgent(BaseAgent):
    def __init__(self):
        super().__init__("defi")
        self.infura_url = os.getenv("INFURA_URL", "")
        self.min_apy = 5.0  # minimum 5% APY to consider
        self.max_il_pct = 2.0  # max impermanent loss tolerance

    async def fetch_pool_data(self) -> list:
        """Fetch top DeFi pool yields from public APIs."""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                url = "https://yields.llama.fi/pools"
                async with session.get(url,
                                       timeout=aiohttp.ClientTimeout(total=15)) as r:
                    if r.status == 200:
                        data = await r.json()
                        pools = data.get("data", [])
                        # Filter for relevant pools
                        relevant = [
                            p for p in pools
                            if p.get("symbol", "").upper() in [
                                "WBTC-USDT", "ETH-USDT", "WBTC-ETH",
                                "SOL-USDT", "BNB-USDT"
                            ]
                            and p.get("apy", 0) > self.min_apy
                        ]
                        return sorted(relevant,
                                      key=lambda x: x.get("apy", 0),
                                      reverse=True)[:10]
        except Exception as e:
            self.logger.warning(f"DeFi pool fetch failed: {e}")
        return []

    async def execute(self):
        while self.running:
            try:
                pools = await self.fetch_pool_data()

                if pools:
                    best = pools[0]
                    best_apy = best.get("apy", 0)
                    best_pool = best.get("symbol", "unknown")
                    best_chain = best.get("chain", "unknown")
                    best_project = best.get("project", "unknown")

                    if best_apy > self.min_apy * 2:
                        signal = "LP_ADD"  # high yield opportunity
                    elif best_apy < self.min_apy:
                        signal = "LP_REMOVE"  # yields too low
                    else:
                        signal = "LP_HOLD"

                    self.logger.info(
                        f"Best pool: {best_pool} on {best_chain} "
                        f"({best_project}) APY={best_apy:.2f}% => {signal}")
                    await self.report(signal=signal, metadata={
                        "best_pool": best_pool,
                        "best_apy": best_apy,
                        "best_chain": best_chain,
                        "best_project": best_project,
                        "pools_found": len(pools),
                    })
                else:
                    await self.report(signal="LP_HOLD",
                        metadata={"pools_found": 0, "note": "no_pools_above_threshold"})
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(600)  # every 10 minutes


if __name__ == "__main__":
    asyncio.run(DefiAgent().run())
