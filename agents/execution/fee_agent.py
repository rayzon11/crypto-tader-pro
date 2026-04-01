# agents/execution/fee_agent.py
import asyncio, os
import ccxt.async_support as ccxt
from agents.base_agent import BaseAgent


class FeeAgent(BaseAgent):
    def __init__(self):
        super().__init__("fee")
        self.exchange = ccxt.binance({"enableRateLimit": True})
        self.symbol = "BTC/USDT"

    async def get_trading_fees(self) -> dict:
        """Fetch current trading fee structure."""
        try:
            markets = await self.exchange.load_markets()
            market = markets.get(self.symbol, {})
            return {
                "maker": market.get("maker", 0.001),
                "taker": market.get("taker", 0.001),
            }
        except Exception:
            return {"maker": 0.001, "taker": 0.001}

    async def estimate_gas(self) -> dict:
        """Estimate ETH gas prices for DeFi operations."""
        try:
            infura_url = os.getenv("INFURA_URL", "")
            if not infura_url:
                return {"gas_gwei": 0, "status": "no_infura"}

            import aiohttp
            async with aiohttp.ClientSession() as session:
                payload = {
                    "jsonrpc": "2.0",
                    "method": "eth_gasPrice",
                    "params": [],
                    "id": 1,
                }
                async with session.post(infura_url, json=payload,
                                        timeout=aiohttp.ClientTimeout(total=10)) as r:
                    data = await r.json()
                    gas_wei = int(data.get("result", "0"), 16)
                    gas_gwei = gas_wei / 1e9
                    return {"gas_gwei": gas_gwei, "status": "ok"}
        except Exception as e:
            self.logger.warning(f"Gas estimation failed: {e}")
            return {"gas_gwei": 0, "status": "error"}

    def recommend_order_type(self, fees: dict, urgency: str = "normal") -> str:
        """Recommend maker or taker based on fee structure."""
        if urgency == "high":
            return "taker"
        if fees["maker"] < fees["taker"] * 0.5:
            return "maker"  # significant discount
        return "maker"  # default to limit orders

    async def execute(self):
        while self.running:
            try:
                fees = await self.get_trading_fees()
                gas = await self.estimate_gas()
                recommendation = self.recommend_order_type(fees)

                signal = "FEE_OPTIMISED"

                self.logger.info(
                    f"Maker={fees['maker']:.4f} Taker={fees['taker']:.4f} "
                    f"Gas={gas['gas_gwei']:.1f}gwei "
                    f"Recommend={recommendation} => {signal}")
                await self.report(signal=signal, metadata={
                    "maker_fee": fees["maker"],
                    "taker_fee": fees["taker"],
                    "gas_gwei": gas["gas_gwei"],
                    "recommendation": recommendation,
                })
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(120)  # every 2 minutes

        await self.exchange.close()


if __name__ == "__main__":
    asyncio.run(FeeAgent().run())
