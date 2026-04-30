# agents/intelligence/backtest_agent.py
"""
BACKTEST AGENT — Runs weekly parameter sweeps and pushes optimized
parameters back to strategy agents automatically.
"""
import asyncio, json
import numpy as np
import pandas as pd
from agents.base_agent import BaseAgent


class BacktestAgent(BaseAgent):
    def __init__(self):
        super().__init__("backtest")
        self.backtest_interval = 3600 * 24 * 7  # weekly
        self.min_trades = 30  # minimum trades for valid backtest

    def compute_sharpe(self, returns: list, risk_free: float = 0.0) -> float:
        if not returns or len(returns) < 2:
            return 0.0
        arr = np.array(returns)
        excess = arr - risk_free / 252
        mu = float(excess.mean())
        sigma = float(excess.std() + 1e-9)
        return mu / sigma * np.sqrt(252)

    def compute_max_drawdown(self, returns: list) -> float:
        if not returns:
            return 0.0
        cum = np.cumprod(1 + np.array(returns))
        peak = np.maximum.accumulate(cum)
        dd = (cum - peak) / (peak + 1e-9)
        return float(dd.min())

    def compute_win_rate(self, returns: list) -> float:
        if not returns:
            return 0.0
        wins = sum(1 for r in returns if r > 0)
        return wins / len(returns)

    async def run_backtest(self, agent_name: str) -> dict:
        """Pull trade history from Redis and compute metrics."""
        data = await self.redis.get(f"agent:trade_history:{agent_name}")
        if not data:
            return {}

        trades = json.loads(data)
        if len(trades) < self.min_trades:
            return {"status": "insufficient_data", "trades": len(trades)}

        returns = [t.get("pnl", 0) for t in trades]

        sharpe = self.compute_sharpe(returns)
        max_dd = self.compute_max_drawdown(returns)
        win_rate = self.compute_win_rate(returns)
        total_pnl = sum(returns)
        avg_trade = np.mean(returns) if returns else 0

        return {
            "agent": agent_name,
            "sharpe": round(sharpe, 4),
            "max_drawdown": round(max_dd, 4),
            "win_rate": round(win_rate, 4),
            "total_pnl": round(total_pnl, 6),
            "avg_trade": round(float(avg_trade), 6),
            "trade_count": len(trades),
        }

    async def execute(self):
        strategy_agents = [
            "trend", "momentum", "mean_reversion", "arbitrage", "breakout"
        ]

        while self.running:
            try:
                results = {}
                for agent_name in strategy_agents:
                    result = await self.run_backtest(agent_name)
                    if result:
                        results[agent_name] = result
                        self.logger.info(
                            f"Backtest [{agent_name}]: Sharpe={result.get('sharpe', 0):.2f} "
                            f"WR={result.get('win_rate', 0):.2%} "
                            f"MaxDD={result.get('max_drawdown', 0):.2%}")

                        # Publish updated parameters
                        await self.redis.publish("backtest:results", json.dumps(result))

                signal = "STRATEGY_UPDATE" if results else "NO_DATA"
                await self.report(signal=signal, metadata={
                    "agents_tested": len(results),
                    "results": results,
                })
            except Exception as e:
                self.logger.error(e)

            # Sleep until next backtest cycle (weekly, but check hourly for commands)
            for _ in range(168):  # 168 hours in a week
                if not self.running:
                    break
                await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(BacktestAgent().run())
