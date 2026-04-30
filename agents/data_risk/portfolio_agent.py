# agents/data_risk/portfolio_agent.py
import asyncio, json
import numpy as np
from agents.base_agent import BaseAgent


class PortfolioAgent(BaseAgent):
    def __init__(self):
        super().__init__("portfolio")
        self.max_position_pct = 0.20  # 20% max per asset
        self.max_open_positions = 5
        self.kelly_fraction = 0.5  # half-Kelly for safety

    def kelly_criterion(self, win_rate: float, avg_win: float,
                        avg_loss: float) -> float:
        """Calculate Kelly criterion position size (half-Kelly)."""
        if avg_loss == 0:
            return 0.0
        win_loss_ratio = abs(avg_win / avg_loss) if avg_loss != 0 else 0
        kelly = win_rate - ((1 - win_rate) / win_loss_ratio) if win_loss_ratio > 0 else 0
        kelly = max(0.0, kelly) * self.kelly_fraction
        return min(kelly, self.max_position_pct)

    def correlation_check(self, returns_matrix: list) -> float:
        """Check average correlation between held positions."""
        if not returns_matrix or len(returns_matrix) < 2:
            return 0.0
        try:
            arr = np.array(returns_matrix)
            if arr.shape[0] < 2 or arr.shape[1] < 5:
                return 0.0
            corr = np.corrcoef(arr)
            n = corr.shape[0]
            mask = np.triu(np.ones((n, n), dtype=bool), k=1)
            avg_corr = float(np.mean(corr[mask]))
            return avg_corr
        except Exception:
            return 0.0

    async def execute(self):
        while self.running:
            try:
                snap = await self.redis.get("portfolio:snapshot")
                if snap:
                    data = json.loads(snap)
                    positions = data.get("positions", {})
                    total_value = data.get("total_value", 10000)
                    returns_history = data.get("returns", [])

                    # Calculate Kelly sizing
                    wins = [r for r in returns_history if r > 0]
                    losses = [r for r in returns_history if r < 0]
                    win_rate = len(wins) / len(returns_history) if returns_history else 0.5
                    avg_win = np.mean(wins) if wins else 0.01
                    avg_loss = np.mean(losses) if losses else -0.01

                    suggested_size = self.kelly_criterion(win_rate, avg_win, avg_loss)

                    # Check position concentration
                    needs_hedge = False
                    for symbol, pos in positions.items():
                        pos_pct = pos.get("value", 0) / (total_value + 1e-9)
                        if pos_pct > self.max_position_pct:
                            needs_hedge = True

                    if needs_hedge:
                        signal = "HEDGE"
                    else:
                        signal = "SIZE"

                    self.logger.info(
                        f"Kelly={suggested_size:.4f} WinRate={win_rate:.2%} "
                        f"Positions={len(positions)} => {signal}")
                    await self.report(signal=signal, metadata={
                        "kelly_size": suggested_size,
                        "win_rate": win_rate,
                        "position_count": len(positions),
                        "needs_hedge": needs_hedge,
                    })
                else:
                    await self.report(signal="SIZE",
                        metadata={"kelly_size": 0.05, "note": "no_snapshot"})
            except Exception as e:
                self.logger.error(e)
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(PortfolioAgent().run())
