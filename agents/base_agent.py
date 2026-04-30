"""
BASE AGENT — All 25 agents inherit from this class.
Self-learning + inter-agent data sharing via Redis.
File: agents/base_agent.py
"""
import asyncio, json, logging, time, math
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
        # Self-learning state — persisted to Redis, survives restarts
        self.learning_data = {
            "history": [],           # rolling window of last 200 trades
            "rolling_sharpe": 0.0,
            "performance_trend": 0.0,  # +1 improving, -1 declining
            "param_adjustments": {},   # per-agent parameter tweaks
            "total_learning_cycles": 0,
        }
        # Shared data from other agents (populated by subscribe_shared_data)
        self.shared_data = {}

    @property
    def win_rate(self) -> float:
        if self.trade_count == 0:
            return 0.5
        return self.win_count / self.trade_count

    async def connect(self):
        self.redis = await aioredis.from_url("redis://localhost:6379")
        self.logger.info("Connected to Redis")

    async def load_learning_state(self):
        """Load persisted learning state from Redis (survives restarts)."""
        try:
            raw = await self.redis.get(f"agent:learning:{self.name}")
            if raw:
                saved = json.loads(raw)
                self.learning_data.update(saved)
                self.logger.info(
                    f"Loaded learning state: {len(self.learning_data['history'])} "
                    f"historical trades, {self.learning_data['total_learning_cycles']} cycles"
                )
        except Exception as e:
            self.logger.warning(f"Could not load learning state: {e}")

    async def save_learning_state(self):
        """Persist learning state to Redis."""
        try:
            # Keep history bounded to 200 entries
            self.learning_data["history"] = self.learning_data["history"][-200:]
            await self.redis.set(
                f"agent:learning:{self.name}",
                json.dumps(self.learning_data),
                ex=86400 * 30  # 30-day TTL
            )
        except Exception as e:
            self.logger.warning(f"Could not save learning state: {e}")

    def _compute_rolling_sharpe(self) -> float:
        """Compute Sharpe ratio from last 50 trades in history."""
        hist = self.learning_data["history"][-50:]
        if len(hist) < 5:
            return 0.0
        returns = [t["pnl"] for t in hist]
        avg = sum(returns) / len(returns)
        var = sum((r - avg) ** 2 for r in returns) / len(returns)
        std = math.sqrt(var) if var > 0 else 1e-9
        return (avg / std) * math.sqrt(252)  # annualized

    def _compute_performance_trend(self) -> float:
        """Compare recent 25 trades vs older 25 trades to detect improvement."""
        hist = self.learning_data["history"]
        if len(hist) < 20:
            return 0.0
        mid = len(hist) // 2
        old_wr = sum(1 for t in hist[:mid] if t["won"]) / max(mid, 1)
        new_wr = sum(1 for t in hist[mid:] if t["won"]) / max(len(hist) - mid, 1)
        return new_wr - old_wr  # positive = improving

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
            "learning": {
                "sharpe": round(self.learning_data["rolling_sharpe"], 4),
                "trend": round(self.learning_data["performance_trend"], 4),
                "cycles": self.learning_data["total_learning_cycles"],
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self.redis.publish(
            f"agent:report:{self.name}", json.dumps(payload)
        )

    async def record_trade(self, won: bool, pnl: float):
        """Call after every closed trade. Updates self-learning stats."""
        self.trade_count += 1
        self.pnl += pnl
        if won:
            self.win_count += 1

        # Append to learning history
        self.learning_data["history"].append({
            "won": won,
            "pnl": pnl,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Recompute rolling metrics
        self.learning_data["rolling_sharpe"] = self._compute_rolling_sharpe()
        self.learning_data["performance_trend"] = self._compute_performance_trend()
        self.learning_data["total_learning_cycles"] += 1

        self.logger.info(
            f"Trade #{self.trade_count} | won={won} | pnl={pnl:.4f} "
            f"| win_rate={self.win_rate:.2%} "
            f"| sharpe={self.learning_data['rolling_sharpe']:.2f} "
            f"| trend={self.learning_data['performance_trend']:+.2f}"
        )

        # Publish result to ML agent for retraining
        await self.redis.publish("agent:trade_result", json.dumps({
            "agent": self.name, "won": won, "pnl": pnl,
            "win_rate": self.win_rate,
            "sharpe": self.learning_data["rolling_sharpe"],
            "timestamp": datetime.utcnow().isoformat(),
        }))

        # Save learning state every 5 trades
        if self.trade_count % 5 == 0:
            await self.save_learning_state()

    async def subscribe_shared_data(self, channels: list):
        """Subscribe to shared data channels from other agents.
        Data is stored in self.shared_data[channel_name] for use in execute().
        """
        pubsub = self.redis.pubsub()
        ch_names = [f"agent:shared:{ch}" for ch in channels]
        await pubsub.subscribe(*ch_names)
        self.logger.info(f"Subscribed to shared data: {channels}")
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                try:
                    channel = msg["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    key = channel.replace("agent:shared:", "")
                    self.shared_data[key] = json.loads(msg["data"])
                except Exception:
                    pass

    async def publish_shared_data(self, key: str, data: dict):
        """Publish data to a shared channel for other agents to consume."""
        await self.redis.publish(f"agent:shared:{key}", json.dumps(data))

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

    @abstractmethod
    async def execute(self):
        """Core trading logic — each agent implements this."""
        pass

    async def run(self):
        await self.connect()
        await self.load_learning_state()
        await asyncio.gather(
            self.execute(),
            self.listen_commands(),
            self.heartbeat_loop(),
        )
