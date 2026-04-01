"""
BASE AGENT — All 20 agents inherit from this class.
File: agents/base_agent.py
"""
import asyncio, json, logging, time
import redis.asyncio as aioredis
from abc import ABC, abstractmethod
from datetime import datetime


class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.redis = None
        self.running = True
        self.pnl = 0.0
        self.trade_count = 0
        self.win_count = 0
        self.logger = logging.getLogger(f"agent.{name}")
        logging.basicConfig(
            level=logging.INFO,
            format=f"%(asctime)s [{name.upper()}] %(message)s"
        )

    @property
    def win_rate(self) -> float:
        if self.trade_count == 0:
            return 0.5
        return self.win_count / self.trade_count

    async def connect(self):
        self.redis = await aioredis.from_url("redis://localhost:6379")
        self.logger.info(f"Connected to Redis")

    async def heartbeat_loop(self):
        """Publish heartbeat every 30s so health_check.sh can detect death."""
        while self.running:
            ts = int(time.time())
            await self.redis.set(f"agent:heartbeat:{self.name}", ts, ex=120)
            await asyncio.sleep(30)

    async def report(self, signal=None, metadata=None):
        payload = {
            "agent": self.name,
            "status": "active" if self.running else "halted",
            "pnl": round(self.pnl, 6),
            "win_rate": round(self.win_rate, 4),
            "trade_count": self.trade_count,
            "signal": signal,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self.redis.publish(
            f"agent:report:{self.name}", json.dumps(payload)
        )

    async def record_trade(self, won: bool, pnl: float):
        """Call after every closed trade to update self-improvement stats."""
        self.trade_count += 1
        self.pnl += pnl
        if won:
            self.win_count += 1
        self.logger.info(
            f"Trade #{self.trade_count} | won={won} | pnl={pnl:.4f} "
            f"| win_rate={self.win_rate:.2%}"
        )
        # Publish result to ML agent for retraining
        await self.redis.publish("agent:trade_result", json.dumps({
            "agent": self.name, "won": won, "pnl": pnl,
            "timestamp": datetime.utcnow().isoformat(),
        }))

    async def listen_commands(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(f"agent:command:{self.name}")
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                cmd = json.loads(msg["data"])
                if cmd.get("command") == "HALT":
                    self.logger.warning("HALT received — stopping")
                    self.running = False
                elif cmd.get("command") == "REDUCE_SIZE":
                    self.logger.warning("REDUCE_SIZE received")
                    # subclasses implement this

    @abstractmethod
    async def execute(self):
        """Core trading logic — each agent implements this."""
        pass

    async def run(self):
        await self.connect()
        await asyncio.gather(
            self.execute(),
            self.listen_commands(),
            self.heartbeat_loop(),
        )
