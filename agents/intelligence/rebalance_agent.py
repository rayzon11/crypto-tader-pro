# agents/intelligence/rebalance_agent.py
"""
REBALANCE AGENT — Portfolio drift correction and monthly rebalancing.
Monitors portfolio allocation and suggests rebalancing when drift exceeds threshold.
"""
import asyncio, json
import numpy as np
from agents.base_agent import BaseAgent


class RebalanceAgent(BaseAgent):
    def __init__(self):
        super().__init__("rebalance")
        self.target_allocation = {
            "BTC/USDT": 0.40,
            "ETH/USDT": 0.30,
            "SOL/USDT": 0.15,
            "BNB/USDT": 0.10,
            "AVAX/USDT": 0.05,
        }
        self.drift_threshold = 0.05  # 5% drift triggers rebalance
        self.rebalance_interval = 3600 * 24 * 7  # weekly check

    def compute_drift(self, current_allocation: dict) -> dict:
        """Compute drift from target allocation for each asset."""
        drifts = {}
        for symbol, target in self.target_allocation.items():
            current = current_allocation.get(symbol, 0.0)
            drift = current - target
            drifts[symbol] = {
                "target": target,
                "current": round(current, 4),
                "drift": round(drift, 4),
                "drift_pct": round(abs(drift) * 100, 2),
            }
        return drifts

    def needs_rebalance(self, drifts: dict) -> bool:
        """Check if any position has drifted beyond threshold."""
        for symbol, data in drifts.items():
            if abs(data["drift"]) > self.drift_threshold:
                return True
        return False

    def compute_trades(self, drifts: dict, total_value: float) -> list:
        """Compute the trades needed to rebalance."""
        trades = []
        for symbol, data in drifts.items():
            drift = data["drift"]
            if abs(drift) > 0.01:  # only trade if drift > 1%
                trade_value = -drift * total_value  # negative drift = need to buy
                side = "buy" if trade_value > 0 else "sell"
                trades.append({
                    "symbol": symbol,
                    "side": side,
                    "value_usdt": round(abs(trade_value), 2),
                    "drift_pct": data["drift_pct"],
                })
        return sorted(trades, key=lambda t: t["value_usdt"], reverse=True)

    async def execute(self):
        while self.running:
            try:
                snap = await self.redis.get("portfolio:snapshot")
                if snap:
                    data = json.loads(snap)
                    positions = data.get("positions", {})
                    total_value = data.get("total_value", 10000)

                    # Compute current allocation
                    current_allocation = {}
                    for symbol, pos in positions.items():
                        pos_value = pos.get("value", 0)
                        current_allocation[symbol] = pos_value / (total_value + 1e-9)

                    drifts = self.compute_drift(current_allocation)
                    rebalance_needed = self.needs_rebalance(drifts)

                    if rebalance_needed:
                        signal = "REBALANCE_NEEDED"
                        trades = self.compute_trades(drifts, total_value)
                        self.logger.info(
                            f"Rebalance needed! {len(trades)} trades suggested")
                        for t in trades:
                            self.logger.info(
                                f"  {t['side'].upper()} ${t['value_usdt']:.2f} "
                                f"of {t['symbol']} (drift={t['drift_pct']:.1f}%)")

                        await self.redis.publish("rebalance:trades",
                            json.dumps(trades))
                    else:
                        signal = "BALANCED"
                        trades = []

                    max_drift = max(
                        (abs(d["drift"]) for d in drifts.values()), default=0)
                    await self.report(signal=signal, metadata={
                        "max_drift_pct": round(max_drift * 100, 2),
                        "rebalance_needed": rebalance_needed,
                        "trades_suggested": len(trades),
                        "drifts": drifts,
                    })
                else:
                    await self.report(signal="BALANCED",
                        metadata={"note": "no_portfolio_snapshot"})
            except Exception as e:
                self.logger.error(e)

            # Check weekly, but sleep in 1-hour increments for responsiveness
            for _ in range(168):
                if not self.running:
                    break
                await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(RebalanceAgent().run())
