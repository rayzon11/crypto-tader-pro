"""
SUPERVISOR AGENT — Master orchestrator for all 23 trading + security agents.
File: supervisor/supervisor_agent.py
"""
import asyncio, json, logging
import redis.asyncio as aioredis
from datetime import datetime
from typing import Dict, Any

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [SUPERVISOR] %(message)s")
logger = logging.getLogger("supervisor")

AGENTS = [
    "trend", "momentum", "mean_reversion", "arbitrage", "breakout",
    "sentiment", "onchain", "risk", "portfolio", "orderbook",
    "order", "slippage", "stoploss", "fee", "defi",
    "ml", "backtest", "alert", "audit", "rebalance",
    "npm_security", "db_security", "code_security",
]


class SupervisorAgent:
    def __init__(self):
        self.redis = None
        self.agent_reports: Dict[str, Any] = {}
        self.agent_weights: Dict[str, float] = {a: 1.0 for a in AGENTS}
        self.master_pnl = 0.0
        self.kill_switch = False
        self.MAX_DRAWDOWN = 0.05  # 5% kill switch threshold

    async def connect(self):
        self.redis = await aioredis.from_url("redis://localhost:6379")
        logger.info("Supervisor connected to Redis")

    async def listen_to_agents(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(*[f"agent:report:{n}" for n in AGENTS])
        logger.info(f"Subscribed to {len(AGENTS)} agent channels")
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                await self.process_report(msg)

    async def process_report(self, message: dict):
        data = json.loads(message["data"])
        agent = data.get("agent")
        pnl = data.get("pnl", 0.0)
        signal = data.get("signal")
        win_rate = data.get("win_rate", 0.5)

        self.agent_reports[agent] = data
        self.master_pnl += pnl

        # Smart weight update: reward good agents, penalise bad ones
        if win_rate > 0.65:
            self.agent_weights[agent] = min(2.0,
                self.agent_weights[agent] * 1.05)
        elif win_rate < 0.40:
            self.agent_weights[agent] = max(0.1,
                self.agent_weights[agent] * 0.90)

        logger.info(f"[{agent.upper()}] signal={signal} pnl={pnl:.4f} "
                     f"weight={self.agent_weights[agent]:.2f}")

        if self.master_pnl < -self.MAX_DRAWDOWN:
            logger.critical("DRAWDOWN LIMIT HIT — KILL SWITCH ACTIVATED")
            self.kill_switch = True
            await self.broadcast_kill_switch()

    def compute_consensus(self) -> str:
        """Weighted voting across all strategy agents."""
        buy_weight = sell_weight = 0.0
        for name in ["trend", "momentum", "mean_reversion", "arbitrage", "breakout"]:
            report = self.agent_reports.get(name, {})
            w = self.agent_weights.get(name, 1.0)
            sig = report.get("signal", "HOLD")
            if sig == "BUY":
                buy_weight += w
            elif sig == "SELL":
                sell_weight += w
        if buy_weight > sell_weight * 1.5:
            return "BUY"
        if sell_weight > buy_weight * 1.5:
            return "SELL"
        return "HOLD"

    async def broadcast_kill_switch(self):
        cmd = json.dumps({"command": "HALT"})
        for agent in AGENTS:
            await self.redis.publish(f"agent:command:{agent}", cmd)
        logger.critical("Kill switch broadcast to all 20 agents")

    async def master_report_loop(self):
        while True:
            await asyncio.sleep(60)
            consensus = self.compute_consensus()
            active = sum(1 for r in self.agent_reports.values()
                         if r.get("status") == "active")
            report = {
                "cycle_ts": datetime.utcnow().isoformat(),
                "master_pnl": round(self.master_pnl, 6),
                "active_agents": active,
                "consensus": consensus,
                "kill_switch": self.kill_switch,
            }
            await self.redis.set("supervisor:master_report",
                                 json.dumps(report))
            await self.redis.publish("supervisor:broadcast",
                                     json.dumps(report))
            logger.info(f"=== MASTER REPORT | PnL={self.master_pnl:.4f} "
                         f"| Consensus={consensus} | Active={active}/20 ===")

    async def run(self):
        await self.connect()
        await asyncio.gather(
            self.listen_to_agents(),
            self.master_report_loop(),
        )


if __name__ == "__main__":
    asyncio.run(SupervisorAgent().run())
