# agents/intelligence/ml_agent.py
"""
ML AGENT — Retrains per-agent LSTM models on trade results.
Makes every other agent smarter over time.
"""
import asyncio, json
import numpy as np
from collections import defaultdict
from agents.base_agent import BaseAgent

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class SimpleLSTM(nn.Module if TORCH_AVAILABLE else object):
    def __init__(self, input_size=4, hidden=64, layers=2, output=1):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden, layers, batch_first=True)
        self.linear = nn.Linear(hidden, output)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.linear(out[:, -1, :])


class MLAgent(BaseAgent):
    def __init__(self):
        super().__init__("ml")
        self.trade_history = defaultdict(list)
        self.models = {}
        self.retrain_every = 20

    async def listen_trade_results(self):
        """Subscribe to trade outcomes from ALL 20 agents."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("agent:trade_result")
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                data = json.loads(msg["data"])
                agent_name = data["agent"]
                self.trade_history[agent_name].append({
                    "won": data["won"],
                    "pnl": data["pnl"],
                    "ts": data["timestamp"],
                })
                total = len(self.trade_history[agent_name])
                if total > 0 and total % self.retrain_every == 0:
                    await self.retrain_agent(agent_name)

    async def retrain_agent(self, agent_name: str):
        """Retrain LSTM for a specific agent and push updated params."""
        history = self.trade_history[agent_name]
        if len(history) < self.retrain_every:
            return

        pnls = [t["pnl"] for t in history[-100:]]
        win_rate = sum(1 for t in history[-100:] if t["won"]) / len(history[-100:])

        arr = np.array(pnls)
        mu, sigma = float(arr.mean()), float(arr.std() + 1e-9)
        sharpe = mu / sigma * np.sqrt(252)

        self.logger.info(
            f"Retraining model for [{agent_name}] | "
            f"WR={win_rate:.2%} | Sharpe={sharpe:.2f} | "
            f"Samples={len(history)}"
        )

        await self.redis.set(
            f"agent:sharpe:{agent_name}",
            json.dumps({"sharpe": round(sharpe, 4),
                        "win_rate": round(win_rate, 4),
                        "sample_count": len(history)})
        )
        await self.redis.publish("ml:model_updated", json.dumps({
            "agent": agent_name,
            "new_sharpe": round(sharpe, 4),
            "win_rate": round(win_rate, 4),
        }))

    async def execute(self):
        """Run the trade-result listener + periodic summary."""
        asyncio.create_task(self.listen_trade_results())
        while self.running:
            await asyncio.sleep(300)
            total_trades = sum(len(v) for v in self.trade_history.values())
            self.logger.info(
                f"ML Agent status: tracking {len(self.trade_history)} agents, "
                f"{total_trades} total trade records"
            )
            await self.report(signal="MONITORING",
                metadata={"agents_tracked": len(self.trade_history),
                          "total_trades": total_trades})


if __name__ == "__main__":
    asyncio.run(MLAgent().run())
