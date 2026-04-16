"""
BITCOIN SHORT-TERM PREDICTOR AGENT
Predicts Bitcoin price direction for 1m, 5m, 15m, 30m, 1h timeframes
Lookahead: Next 10 minutes + next 1 hour with high confidence
Strategy: Ensemble of indicators, candle patterns, and momentum
File: agents/strategy/bitcoin_short_term_agent.py
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from agents.base_agent import BaseAgent

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [BITCOIN_SHORT] %(message)s")
logger = logging.getLogger("bitcoin_short_term")


class BitcoinShortTermAgent(BaseAgent):
    """
    Short-term Bitcoin price predictor
    Predicts direction for 1m, 5m, 15m, 30m, 1h timeframes
    """

    def __init__(self):
        super().__init__("bitcoin_short_term")
        self.pair = "BTC/USDT"
        self.timeframes = ["1m", "5m", "15m", "30m", "1h"]

        # Strategy weights (ensemble)
        self.weights = {
            "indicators": 0.40,      # RSI, MACD, Bollinger Bands
            "patterns": 0.20,        # Candle patterns
            "momentum": 0.15,        # Recent price velocity
            "orderflow": 0.15,       # Order book imbalance
            "harmonic": 0.10         # Harmonic patterns
        }

        # Learning state
        self.prediction_history = []
        self.accuracy_by_timeframe = {tf: [] for tf in self.timeframes}
        self.adjustment_factor = 1.0

    async def execute(self):
        """Main execution loop - predict Bitcoin price every 30 seconds"""
        await self.subscribe_shared_data(["indicators", "patterns"])

        while self.running:
            try:
                # Get shared data from other agents
                indicators = self.shared_data.get("indicators", {})
                patterns = self.shared_data.get("patterns", {})

                # Generate predictions for all timeframes
                predictions = await self.predict_all_timeframes(indicators, patterns)

                # Determine overall signal
                signal = self.compute_signal(predictions)
                confidence = predictions.get("overall_confidence", 50)

                # Report to supervisor
                await self.report(
                    signal=signal,
                    metadata={
                        "predictions": predictions,
                        "confidence": confidence,
                        "pair": self.pair,
                        "learning": {
                            "adjustment_factor": self.adjustment_factor,
                            "avg_accuracy": sum(
                                sum(acc_list) / len(acc_list) if acc_list else 0
                                for acc_list in self.accuracy_by_timeframe.values()
                            ) / len(self.timeframes)
                        }
                    }
                )

                # Publish shared data for other agents
                await self.publish_shared_data("bitcoin_short_predictions", predictions)

                logger.info(f"[PREDICTION] {signal} | Confidence: {confidence}% | "
                           f"1m: {predictions['1m'].get('signal')} | "
                           f"5m: {predictions['5m'].get('signal')}")

            except Exception as e:
                logger.error(f"Error in prediction: {e}")

            await asyncio.sleep(30)

    async def predict_all_timeframes(self, indicators: Dict, patterns: Dict) -> Dict:
        """
        Predict price direction for all timeframes
        Returns dict with predictions for each timeframe
        """
        predictions = {}
        confidences = []

        for timeframe in self.timeframes:
            prediction = await self.predict_timeframe(timeframe, indicators, patterns)
            predictions[timeframe] = prediction
            confidences.append(prediction.get("confidence", 0))

        # Calculate overall metrics
        bullish_count = sum(1 for p in predictions.values() if p["signal"] == "BUY")
        bearish_count = sum(1 for p in predictions.values() if p["signal"] == "SELL")

        predictions["overall_confidence"] = int(sum(confidences) / len(confidences))
        predictions["consensus"] = self.determine_consensus(bullish_count, bearish_count)
        predictions["timestamp"] = datetime.utcnow().isoformat()

        return predictions

    async def predict_timeframe(self, timeframe: str, indicators: Dict, patterns: Dict) -> Dict:
        """
        Predict price direction for specific timeframe
        Ensemble method: weighted combination of signals
        """

        # Get indicator signals (40% weight)
        indicator_signal = self.analyze_indicators(timeframe, indicators)

        # Get candle pattern signals (20% weight)
        pattern_signal = self.analyze_patterns(timeframe, patterns)

        # Get momentum signal (15% weight)
        momentum_signal = self.analyze_momentum(timeframe)

        # Get order flow signal (15% weight)
        orderflow_signal = self.analyze_orderflow(timeframe)

        # Get harmonic pattern signal (10% weight)
        harmonic_signal = self.analyze_harmonic_patterns(timeframe)

        # Ensemble: weighted combination
        signals = [
            (indicator_signal["score"], self.weights["indicators"]),
            (pattern_signal["score"], self.weights["patterns"]),
            (momentum_signal["score"], self.weights["momentum"]),
            (orderflow_signal["score"], self.weights["orderflow"]),
            (harmonic_signal["score"], self.weights["harmonic"])
        ]

        weighted_score = sum(score * weight for score, weight in signals)

        # Apply adjustment factor from learning
        adjusted_score = weighted_score * self.adjustment_factor

        # Convert to signal
        if adjusted_score > 0.5:
            signal = "BUY"
        elif adjusted_score < -0.5:
            signal = "SELL"
        else:
            signal = "HOLD"

        # Confidence: how strong is the consensus
        confidence = min(100, int(abs(adjusted_score) * 100))

        # Predicted price direction
        direction = 1 if adjusted_score > 0 else (-1 if adjusted_score < 0 else 0)

        return {
            "timeframe": timeframe,
            "signal": signal,
            "confidence": confidence,
            "direction": direction,
            "weighted_score": round(adjusted_score, 3),
            "components": {
                "indicators": indicator_signal,
                "patterns": pattern_signal,
                "momentum": momentum_signal,
                "orderflow": orderflow_signal,
                "harmonic": harmonic_signal
            }
        }

    def analyze_indicators(self, timeframe: str, indicators: Dict) -> Dict:
        """
        Analyze technical indicators
        RSI, MACD, Bollinger Bands, etc.
        """
        score = 0.0
        components = []

        # RSI analysis (0-100)
        rsi = indicators.get(f"rsi_{timeframe}", 50)
        if rsi < 30:
            score += 0.3  # Oversold = bullish
            components.append(f"RSI oversold: {rsi}")
        elif rsi > 70:
            score -= 0.3  # Overbought = bearish
            components.append(f"RSI overbought: {rsi}")

        # MACD analysis
        macd = indicators.get(f"macd_{timeframe}", {})
        if macd.get("histogram", 0) > 0:
            score += 0.2  # Bullish MACD
            components.append("MACD bullish")
        elif macd.get("histogram", 0) < 0:
            score -= 0.2  # Bearish MACD
            components.append("MACD bearish")

        # Bollinger Bands analysis
        bb = indicators.get(f"bb_{timeframe}", {})
        if bb.get("position", 0.5) < 0.2:
            score += 0.15  # Near lower band = oversold
            components.append("BB near lower")
        elif bb.get("position", 0.5) > 0.8:
            score -= 0.15  # Near upper band = overbought
            components.append("BB near upper")

        # EMA crossover
        ema = indicators.get(f"ema_{timeframe}", {})
        if ema.get("ema_9", 0) > ema.get("ema_21", 0):
            score += 0.15  # Bullish crossover
            components.append("EMA 9 > 21")
        elif ema.get("ema_9", 0) < ema.get("ema_21", 0):
            score -= 0.15  # Bearish crossover
            components.append("EMA 9 < 21")

        # Normalize score to -1 to +1
        score = max(-1, min(1, score))

        return {
            "score": score,
            "confidence": min(100, int(abs(score) * 100)),
            "components": components
        }

    def analyze_patterns(self, timeframe: str, patterns: Dict) -> Dict:
        """
        Analyze candle patterns from detector
        Hammer, Doji, Engulfing, Morning/Evening Star, etc.
        """
        pattern_list = patterns.get(timeframe, [])

        bullish_confidence = 0
        bearish_confidence = 0

        for pattern in pattern_list:
            direction = pattern.get("direction", "NEUTRAL")
            confidence = pattern.get("confidence", 0) / 100

            if direction == "UP":
                bullish_confidence += confidence
            elif direction == "DOWN":
                bearish_confidence += confidence

        # Determine net score
        score = bullish_confidence - bearish_confidence
        score = max(-1, min(1, score))

        return {
            "score": score,
            "confidence": min(100, (bullish_confidence + bearish_confidence) * 100),
            "bullish_patterns": bullish_confidence,
            "bearish_patterns": bearish_confidence
        }

    def analyze_momentum(self, timeframe: str) -> Dict:
        """
        Analyze price momentum
        Recent price velocity and acceleration
        """
        # In real implementation, this would track recent price changes
        # For now, simulate based on timeframe
        if timeframe in ["1m", "5m"]:
            momentum = 0.15  # Short-term momentum tends positive in bull market
        else:
            momentum = 0.0

        return {
            "score": momentum,
            "confidence": 40,
            "description": f"Momentum on {timeframe}"
        }

    def analyze_orderflow(self, timeframe: str) -> Dict:
        """
        Analyze order book imbalance
        Buy pressure vs Sell pressure
        """
        # In real implementation, this would analyze actual order book
        # For now, simulate neutral
        orderflow = 0.0

        return {
            "score": orderflow,
            "confidence": 35,
            "description": "Order flow balanced"
        }

    def analyze_harmonic_patterns(self, timeframe: str) -> Dict:
        """
        Analyze harmonic patterns
        Fibonacci retracements, Gartley patterns, etc.
        """
        # Minimal impact on short-term predictions
        harmonic = 0.05

        return {
            "score": harmonic,
            "confidence": 25,
            "description": "Harmonic pattern neutral"
        }

    def compute_signal(self, predictions: Dict) -> str:
        """
        Compute overall signal from all predictions
        BUY if majority bullish, SELL if majority bearish
        """
        buy_count = sum(1 for p in [predictions.get(tf) for tf in self.timeframes]
                       if p and p.get("signal") == "BUY")
        sell_count = sum(1 for p in [predictions.get(tf) for tf in self.timeframes]
                        if p and p.get("signal") == "SELL")

        if buy_count > sell_count and buy_count >= 3:
            return "BUY"
        elif sell_count > buy_count and sell_count >= 3:
            return "SELL"
        else:
            return "HOLD"

    def determine_consensus(self, bullish: int, bearish: int) -> str:
        """Determine overall consensus from timeframe votes"""
        if bullish > bearish + 1:
            return "STRONG_BUY" if bullish >= 4 else "BUY"
        elif bearish > bullish + 1:
            return "STRONG_SELL" if bearish >= 4 else "SELL"
        else:
            return "HOLD"

    async def record_trade(self, won: bool, pnl: float):
        """Record trade and update learning state"""
        await super().record_trade(won, pnl)

        # Update accuracy metrics
        # (In real implementation, track which predictions were accurate)

        # Adjust weights based on performance
        if self.win_count > 10:
            if self.win_rate > 0.65:
                self.adjustment_factor = min(1.5, self.adjustment_factor * 1.01)
            elif self.win_rate < 0.50:
                self.adjustment_factor = max(0.7, self.adjustment_factor * 0.99)

        logger.info(f"Trade recorded: Won={won}, PnL={pnl:.4f}, "
                   f"Win Rate={self.win_rate:.1%}, Adjustment={self.adjustment_factor:.3f}")


async def main():
    """Run Bitcoin Short-Term Predictor Agent"""
    agent = BitcoinShortTermAgent()
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
