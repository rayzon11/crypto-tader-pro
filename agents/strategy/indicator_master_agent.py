"""
INDICATOR MASTER AGENT — Combines ALL 10 major technical indicators into
one master signal with self-learning weights that adapt after every trade.
File: agents/strategy/indicator_master_agent.py
"""
import asyncio, json, os, math
import ccxt.async_support as ccxt
import pandas as pd
import numpy as np
from agents.base_agent import BaseAgent

try:
    import pandas_ta as ta
    HAS_TA = True
except ImportError:
    HAS_TA = False


class IndicatorMasterAgent(BaseAgent):
    def __init__(self):
        super().__init__("indicator_master")
        self.exchange = ccxt.binance({
            "apiKey": os.getenv("BINANCE_API_KEY", ""),
            "secret": os.getenv("BINANCE_SECRET", ""),
            "enableRateLimit": True,
        })
        self.symbol = os.getenv("MASTER_SYMBOL", "BTC/USDT")
        self.timeframe = "1h"
        # Self-learning indicator weights (initial: equal)
        self.indicator_weights = {
            "rsi": 0.10, "macd": 0.10, "ema_cross": 0.10,
            "bollinger": 0.10, "stochastic": 0.10, "adx": 0.10,
            "obv": 0.10, "vwap": 0.10, "ichimoku": 0.10,
            "fibonacci": 0.10,
        }
        self.last_signals = {}  # last computed signals for learning
        self.decay = 0.95  # EMA decay for weight updates

    def compute_rsi(self, df: pd.DataFrame) -> int:
        """RSI(14): oversold < 30 = BUY, overbought > 70 = SELL."""
        close = df["c"]
        delta = close.diff()
        gain = delta.where(delta > 0, 0.0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0.0)).rolling(14).mean()
        rs = gain / loss.replace(0, 1e-9)
        rsi = 100 - (100 / (1 + rs))
        val = rsi.iloc[-1]
        if val < 30:
            return 1   # BUY
        elif val > 70:
            return -1  # SELL
        return 0

    def compute_macd(self, df: pd.DataFrame) -> int:
        """MACD(12,26,9): signal line crossover."""
        close = df["c"]
        ema12 = close.ewm(span=12).mean()
        ema26 = close.ewm(span=26).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9).mean()
        if macd_line.iloc[-1] > signal_line.iloc[-1] and macd_line.iloc[-2] <= signal_line.iloc[-2]:
            return 1   # bullish crossover
        elif macd_line.iloc[-1] < signal_line.iloc[-1] and macd_line.iloc[-2] >= signal_line.iloc[-2]:
            return -1  # bearish crossover
        return 0

    def compute_ema_cross(self, df: pd.DataFrame) -> int:
        """EMA(9) vs EMA(21) crossover."""
        close = df["c"]
        ema9 = close.ewm(span=9).mean()
        ema21 = close.ewm(span=21).mean()
        if ema9.iloc[-1] > ema21.iloc[-1]:
            return 1
        elif ema9.iloc[-1] < ema21.iloc[-1]:
            return -1
        return 0

    def compute_bollinger(self, df: pd.DataFrame) -> int:
        """Bollinger Bands(20,2): price at lower band = BUY, upper = SELL."""
        close = df["c"]
        sma = close.rolling(20).mean()
        std = close.rolling(20).std()
        upper = sma + 2 * std
        lower = sma - 2 * std
        price = close.iloc[-1]
        if price <= lower.iloc[-1]:
            return 1   # oversold
        elif price >= upper.iloc[-1]:
            return -1  # overbought
        return 0

    def compute_stochastic(self, df: pd.DataFrame) -> int:
        """Stochastic(14,3,3): K < 20 = BUY, K > 80 = SELL."""
        high = df["h"].rolling(14).max()
        low = df["l"].rolling(14).min()
        k = ((df["c"] - low) / (high - low).replace(0, 1e-9)) * 100
        k_smooth = k.rolling(3).mean()
        val = k_smooth.iloc[-1]
        if val < 20:
            return 1
        elif val > 80:
            return -1
        return 0

    def compute_adx(self, df: pd.DataFrame) -> int:
        """ADX(14): measures trend strength. ADX > 25 confirms trend direction."""
        high, low, close = df["h"], df["l"], df["c"]
        plus_dm = high.diff().clip(lower=0)
        minus_dm = (-low.diff()).clip(lower=0)
        tr = pd.concat([
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs()
        ], axis=1).max(axis=1)
        atr14 = tr.rolling(14).mean()
        plus_di = 100 * (plus_dm.rolling(14).mean() / atr14.replace(0, 1e-9))
        minus_di = 100 * (minus_dm.rolling(14).mean() / atr14.replace(0, 1e-9))
        dx = 100 * ((plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, 1e-9))
        adx = dx.rolling(14).mean()
        adx_val = adx.iloc[-1]
        if adx_val > 25:
            return 1 if plus_di.iloc[-1] > minus_di.iloc[-1] else -1
        return 0  # no strong trend

    def compute_obv(self, df: pd.DataFrame) -> int:
        """On Balance Volume: confirms price direction with volume."""
        close, volume = df["c"], df["v"]
        obv = (volume * ((close.diff() > 0).astype(int) * 2 - 1)).cumsum()
        obv_sma = obv.rolling(20).mean()
        if obv.iloc[-1] > obv_sma.iloc[-1]:
            return 1   # volume confirming up
        elif obv.iloc[-1] < obv_sma.iloc[-1]:
            return -1  # volume confirming down
        return 0

    def compute_vwap(self, df: pd.DataFrame) -> int:
        """VWAP: price above VWAP = bullish, below = bearish."""
        typical_price = (df["h"] + df["l"] + df["c"]) / 3
        vwap = (typical_price * df["v"]).cumsum() / df["v"].cumsum().replace(0, 1e-9)
        if df["c"].iloc[-1] > vwap.iloc[-1]:
            return 1
        elif df["c"].iloc[-1] < vwap.iloc[-1]:
            return -1
        return 0

    def compute_ichimoku(self, df: pd.DataFrame) -> int:
        """Ichimoku Cloud: price above cloud = bullish, below = bearish."""
        high, low, close = df["h"], df["l"], df["c"]
        tenkan = (high.rolling(9).max() + low.rolling(9).min()) / 2
        kijun = (high.rolling(26).max() + low.rolling(26).min()) / 2
        senkou_a = ((tenkan + kijun) / 2).shift(26)
        senkou_b = ((high.rolling(52).max() + low.rolling(52).min()) / 2).shift(26)
        price = close.iloc[-1]
        cloud_top = max(senkou_a.iloc[-1] if not pd.isna(senkou_a.iloc[-1]) else 0,
                        senkou_b.iloc[-1] if not pd.isna(senkou_b.iloc[-1]) else 0)
        cloud_bot = min(senkou_a.iloc[-1] if not pd.isna(senkou_a.iloc[-1]) else 0,
                        senkou_b.iloc[-1] if not pd.isna(senkou_b.iloc[-1]) else 0)
        if price > cloud_top and cloud_top > 0:
            return 1
        elif price < cloud_bot and cloud_bot > 0:
            return -1
        return 0

    def compute_fibonacci(self, df: pd.DataFrame) -> int:
        """Fibonacci retracement levels from recent swing."""
        close = df["c"]
        window = close.tail(50)
        high_val = window.max()
        low_val = window.min()
        diff = high_val - low_val
        if diff == 0:
            return 0
        fib_382 = high_val - diff * 0.382
        fib_618 = high_val - diff * 0.618
        price = close.iloc[-1]
        if price <= fib_618:
            return 1   # at deep retracement — potential bounce
        elif price >= fib_382:
            return -1  # near top — potential pullback
        return 0

    def compute_all_indicators(self, df: pd.DataFrame) -> dict:
        """Compute all 10 indicators and return their signals."""
        return {
            "rsi": self.compute_rsi(df),
            "macd": self.compute_macd(df),
            "ema_cross": self.compute_ema_cross(df),
            "bollinger": self.compute_bollinger(df),
            "stochastic": self.compute_stochastic(df),
            "adx": self.compute_adx(df),
            "obv": self.compute_obv(df),
            "vwap": self.compute_vwap(df),
            "ichimoku": self.compute_ichimoku(df),
            "fibonacci": self.compute_fibonacci(df),
        }

    def master_signal(self, signals: dict) -> tuple:
        """Combine indicator signals with learned weights."""
        score = sum(
            self.indicator_weights[k] * v
            for k, v in signals.items()
        )
        if score > 0.3:
            signal = "STRONG_BUY"
        elif score > 0.1:
            signal = "BUY"
        elif score < -0.3:
            signal = "STRONG_SELL"
        elif score < -0.1:
            signal = "SELL"
        else:
            signal = "HOLD"
        return signal, round(score, 4)

    async def _learn_from_trades(self):
        """Adjust indicator weights based on trade outcomes."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("agent:trade_result")
        async for msg in pubsub.listen():
            if msg["type"] != "message":
                continue
            try:
                trade = json.loads(msg["data"])
                won = trade.get("won", False)
                if not self.last_signals:
                    continue
                # Adjust weights: reward indicators that agreed with winning direction
                for ind, sig in self.last_signals.items():
                    if sig == 0:
                        continue  # neutral indicators don't learn
                    if won:
                        # Boost indicators that gave correct direction
                        self.indicator_weights[ind] = min(
                            0.3, self.indicator_weights[ind] * 1.02
                        )
                    else:
                        # Reduce indicators that gave wrong direction
                        self.indicator_weights[ind] = max(
                            0.02, self.indicator_weights[ind] * 0.98
                        )
                # Normalize weights to sum to 1.0
                total = sum(self.indicator_weights.values())
                self.indicator_weights = {
                    k: v / total for k, v in self.indicator_weights.items()
                }
                # Persist learned weights
                self.learning_data["param_adjustments"] = {
                    "indicator_weights": self.indicator_weights,
                }
                await self.save_learning_state()
                self.logger.info(
                    f"Weights updated after {'WIN' if won else 'LOSS'}: "
                    f"{json.dumps({k: round(v, 3) for k, v in self.indicator_weights.items()})}"
                )
            except Exception as e:
                self.logger.warning(f"Learning error: {e}")

    async def execute(self):
        # Restore learned weights if available
        saved = self.learning_data.get("param_adjustments", {})
        if "indicator_weights" in saved:
            self.indicator_weights.update(saved["indicator_weights"])
            self.logger.info(f"Restored learned weights from {self.learning_data['total_learning_cycles']} cycles")

        # Subscribe to news sentiment for context
        asyncio.create_task(self.subscribe_shared_data(["news_sentiment"]))
        # Start trade learning
        asyncio.create_task(self._learn_from_trades())

        while self.running:
            try:
                ohlcv = await self.exchange.fetch_ohlcv(
                    self.symbol, self.timeframe, limit=200
                )
                df = pd.DataFrame(ohlcv, columns=["ts", "o", "h", "l", "c", "v"])

                # Compute all 10 indicators
                signals = self.compute_all_indicators(df)
                self.last_signals = signals

                # Get master signal
                signal, score = self.master_signal(signals)

                # Factor in news sentiment if available
                news = self.shared_data.get("news_sentiment", {})
                news_score = news.get("score", 0)
                if abs(news_score) > 0.3:
                    # Strong news sentiment adjusts master score
                    adjusted_score = score + news_score * 0.15
                    if adjusted_score > 0.3:
                        signal = "STRONG_BUY"
                    elif adjusted_score > 0.1:
                        signal = "BUY"
                    elif adjusted_score < -0.3:
                        signal = "STRONG_SELL"
                    elif adjusted_score < -0.1:
                        signal = "SELL"
                    else:
                        signal = "HOLD"
                    score = round(adjusted_score, 4)

                # Share indicator data with ALL agents
                await self.publish_shared_data("indicators", {
                    "signals": signals,
                    "master_score": score,
                    "master_signal": signal,
                    "weights": {k: round(v, 4) for k, v in self.indicator_weights.items()},
                    "price": float(df["c"].iloc[-1]),
                    "symbol": self.symbol,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                await self.report(
                    signal=signal,
                    metadata={
                        "indicators": signals,
                        "score": score,
                        "weights": {k: round(v, 4) for k, v in self.indicator_weights.items()},
                        "price": float(df["c"].iloc[-1]),
                        "news_factor": round(news_score, 4),
                        "learning_cycles": self.learning_data["total_learning_cycles"],
                    }
                )

                self.logger.info(
                    f"Master signal: {signal} (score={score}) | "
                    f"Indicators: {json.dumps(signals)} | "
                    f"Price: ${df['c'].iloc[-1]:,.2f}"
                )

            except Exception as e:
                self.logger.error(f"Indicator cycle error: {e}")

            await asyncio.sleep(60)

        await self.exchange.close()


# Required import for datetime in shared data
from datetime import datetime

if __name__ == "__main__":
    asyncio.run(IndicatorMasterAgent().run())
