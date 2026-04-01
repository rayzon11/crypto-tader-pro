# agents/intelligence/audit_agent.py
"""
AUDIT AGENT — Full trade log, compliance checking, and anomaly detection.
Stores all trade data to PostgreSQL for compliance.
"""
import asyncio, json, os
from datetime import datetime
from collections import deque
from agents.base_agent import BaseAgent


class AuditAgent(BaseAgent):
    def __init__(self):
        super().__init__("audit")
        self.trade_log = deque(maxlen=10000)
        self.anomaly_threshold = 3.0  # z-score for anomaly
        self.db_url = os.getenv(
            "POSTGRES_URL",
            "postgresql://botuser:password@localhost:5432/cryptobot")

    async def init_db(self):
        """Initialize PostgreSQL connection and create tables if needed."""
        try:
            import asyncpg
            self.db = await asyncpg.connect(self.db_url)
            await self.db.execute("""
                CREATE TABLE IF NOT EXISTS trade_log (
                    id SERIAL PRIMARY KEY,
                    agent VARCHAR(50),
                    signal VARCHAR(50),
                    pnl DECIMAL(20, 8),
                    win_rate DECIMAL(5, 4),
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            await self.db.execute("""
                CREATE TABLE IF NOT EXISTS anomaly_log (
                    id SERIAL PRIMARY KEY,
                    agent VARCHAR(50),
                    anomaly_type VARCHAR(100),
                    details JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            self.logger.info("Database initialized")
        except Exception as e:
            self.logger.warning(f"DB init failed (will log to Redis only): {e}")
            self.db = None

    async def log_trade(self, data: dict):
        """Log trade to database and in-memory buffer."""
        self.trade_log.append(data)

        if self.db:
            try:
                await self.db.execute(
                    """INSERT INTO trade_log (agent, signal, pnl, win_rate, metadata)
                       VALUES ($1, $2, $3, $4, $5)""",
                    data.get("agent", "unknown"),
                    data.get("signal", ""),
                    data.get("pnl", 0),
                    data.get("win_rate", 0),
                    json.dumps(data.get("metadata", {})),
                )
            except Exception as e:
                self.logger.warning(f"DB insert failed: {e}")

        # Always log to Redis as backup
        await self.redis.lpush("audit:trade_log",
                               json.dumps(data))
        await self.redis.ltrim("audit:trade_log", 0, 9999)

    def detect_anomalies(self, data: dict) -> list:
        """Detect anomalous trading patterns."""
        anomalies = []
        pnl = data.get("pnl", 0)

        # Check for unusually large P&L swings
        if len(self.trade_log) > 20:
            recent_pnls = [t.get("pnl", 0) for t in list(self.trade_log)[-100:]]
            import numpy as np
            mean_pnl = np.mean(recent_pnls)
            std_pnl = np.std(recent_pnls) + 1e-9
            z_score = (pnl - mean_pnl) / std_pnl

            if abs(z_score) > self.anomaly_threshold:
                anomalies.append({
                    "type": "extreme_pnl",
                    "z_score": round(float(z_score), 2),
                    "pnl": pnl,
                    "agent": data.get("agent"),
                })

        # Check for rapid-fire trading (more than 10 trades per minute)
        recent_trades = [
            t for t in list(self.trade_log)[-20:]
            if t.get("agent") == data.get("agent")
        ]
        if len(recent_trades) > 10:
            anomalies.append({
                "type": "rapid_trading",
                "count": len(recent_trades),
                "agent": data.get("agent"),
            })

        return anomalies

    async def execute(self):
        await self.init_db()

        pubsub = self.redis.pubsub()
        await pubsub.subscribe("agent:trade_result", "supervisor:broadcast")

        while self.running:
            try:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    data = json.loads(msg["data"])
                    await self.log_trade(data)

                    anomalies = self.detect_anomalies(data)
                    if anomalies:
                        signal = "ANOMALY"
                        for anomaly in anomalies:
                            self.logger.warning(f"ANOMALY DETECTED: {anomaly}")
                            if self.db:
                                try:
                                    await self.db.execute(
                                        """INSERT INTO anomaly_log
                                           (agent, anomaly_type, details)
                                           VALUES ($1, $2, $3)""",
                                        anomaly.get("agent", "unknown"),
                                        anomaly.get("type", "unknown"),
                                        json.dumps(anomaly),
                                    )
                                except Exception:
                                    pass
                    else:
                        signal = "CLEAN"

                    await self.report(signal=signal, metadata={
                        "total_logged": len(self.trade_log),
                        "anomalies": len(anomalies),
                    })
                else:
                    await asyncio.sleep(1)
            except Exception as e:
                self.logger.error(e)
                await asyncio.sleep(5)

        if self.db:
            await self.db.close()


if __name__ == "__main__":
    asyncio.run(AuditAgent().run())
