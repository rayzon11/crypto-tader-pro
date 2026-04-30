# agents/data_risk/risk_agent.py
import asyncio, json
import numpy as np
from agents.base_agent import BaseAgent


class RiskAgent(BaseAgent):
    def __init__(self):
        super().__init__("risk")
        self.max_drawdown = 0.05  # 5% threshold
        self.max_var = 0.03       # 3% daily VaR limit
        self.position_limit = 0.20  # 20% max per asset

    def var(self, returns, confidence=0.99):
        if len(returns) < 30:
            return 0.0
        return float(np.percentile(np.array(returns),
                                   (1 - confidence) * 100))

    def max_dd(self, returns):
        if not returns:
            return 0.0
        cum = np.cumprod(1 + np.array(returns))
        peak = np.maximum.accumulate(cum)
        dd = (cum - peak) / (peak + 1e-9)
        return float(dd.min())

    async def execute(self):
        while self.running:
            try:
                snap = await self.redis.get("portfolio:snapshot")
                returns = json.loads(snap).get("returns", []) if snap else []

                v = self.var(returns)
                dd = self.max_dd(returns)

                if dd < -self.max_drawdown:
                    signal = "HALT"
                elif abs(v) > self.max_var:
                    signal = "REDUCE_POSITIONS"
                else:
                    signal = "OK"

                self.logger.info(f"VaR={v:.4f} MaxDD={dd:.4f} => {signal}")
                await self.report(signal=signal,
                    metadata={"var_99": v, "max_drawdown": dd})
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(RiskAgent().run())
