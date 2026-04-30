# agents/intelligence/alert_agent.py
"""
ALERT AGENT — Sends notifications via Telegram and Discord
for trade events, drawdown warnings, and system failures.
"""
import asyncio, json, os
import aiohttp
from agents.base_agent import BaseAgent


class AlertAgent(BaseAgent):
    def __init__(self):
        super().__init__("alert")
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK_URL", "")

    async def send_telegram(self, message: str) -> bool:
        if not self.telegram_token or not self.telegram_chat_id:
            return False
        try:
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json={
                    "chat_id": self.telegram_chat_id,
                    "text": message,
                    "parse_mode": "HTML",
                }, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    return r.status == 200
        except Exception as e:
            self.logger.warning(f"Telegram send failed: {e}")
            return False

    async def send_discord(self, message: str) -> bool:
        if not self.discord_webhook:
            return False
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.discord_webhook, json={
                    "content": message,
                }, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    return r.status in [200, 204]
        except Exception as e:
            self.logger.warning(f"Discord send failed: {e}")
            return False

    async def send_alert(self, message: str, level: str = "info"):
        """Send alert to all configured channels."""
        prefix = {
            "info": "INFO",
            "warning": "WARNING",
            "critical": "CRITICAL",
        }.get(level, "INFO")

        formatted = f"[{prefix}] CryptoBot: {message}"

        tg_ok = await self.send_telegram(formatted)
        dc_ok = await self.send_discord(formatted)

        self.logger.info(
            f"Alert sent (TG={tg_ok}, DC={dc_ok}): {formatted[:100]}")
        return tg_ok or dc_ok

    async def execute(self):
        """Listen for alert events from all agents."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(
            "supervisor:broadcast",
            "stoploss:triggered",
            "ml:model_updated",
            "alert:send",
        )

        while self.running:
            try:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    channel = msg["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    data = json.loads(msg["data"])

                    if channel == "supervisor:broadcast":
                        # Check for critical conditions
                        if data.get("kill_switch"):
                            await self.send_alert(
                                "KILL SWITCH ACTIVATED! All agents halted.",
                                "critical")
                        pnl = data.get("master_pnl", 0)
                        if pnl < -0.02:  # 2% drawdown warning
                            await self.send_alert(
                                f"Drawdown warning: PnL={pnl:.4f}",
                                "warning")

                    elif channel == "stoploss:triggered":
                        trigger = data.get("type", "STOP")
                        await self.send_alert(
                            f"{trigger}: {data.get('side', '')} position "
                            f"entry={data.get('entry', 0):.2f} "
                            f"exit={data.get('exit_price', 0):.2f}",
                            "info")

                    elif channel == "ml:model_updated":
                        agent = data.get("agent", "unknown")
                        sharpe = data.get("new_sharpe", 0)
                        await self.send_alert(
                            f"Model updated for [{agent}] Sharpe={sharpe:.2f}",
                            "info")

                    elif channel == "alert:send":
                        await self.send_alert(
                            data.get("message", "Unknown alert"),
                            data.get("level", "info"))

                    await self.report(signal="ALERT_SENT",
                        metadata={"channel": channel})
                else:
                    await asyncio.sleep(1)
            except Exception as e:
                self.logger.error(e)
                await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(AlertAgent().run())
