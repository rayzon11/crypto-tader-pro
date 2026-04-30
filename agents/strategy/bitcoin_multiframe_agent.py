"""
BITCOIN MULTI-TIMEFRAME PREDICTOR AGENT
Predicts Bitcoin price direction across multiple timeframes
Specializes in medium to long-term predictions: 15m, 30m, 1h, 4h, 1d
Strategy: Multi-timeframe consensus + Fibonacci + Support/Resistance
File: agents/strategy/bitcoin_multiframe_agent.py
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List
from agents.base_agent import BaseAgent

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [BITCOIN_MULTI] %(message)s")
logger = logging.getLogger("bitcoin_multiframe")


class BitcoinMultiframeAgent(BaseAgent):
    """
    Multi-timeframe Bitcoin predictor
    Predicts direction across 15m, 30m, 1h, 4h, 1d timeframes
    Focus: Trend alignment and medium-term moves
    """

    def __init__(self):
        super().__init__("bitcoin_multiframe")
        self.pair = "BTC/USDT"
        self.timeframes = ["15m", "30m", "1h", "4h", "1d"]

        # Strategy weights
        self.weights = {
            "trend_alignment": 0.35,     # How many TFs align
            "fibonacci": 0.25,           # Fib levels and retracements
            "support_resistance": 0.20,  # S/R proximity
            "moving_averages": 0.10,     # MA crossovers
            "volume_confirmation": 0.10  # Volume support
        }

        # Learning state
        self.accuracy_by_tf = {tf: {"correct": 0, "total": 0} for tf in self.timeframes}
        self.tf_weights = {tf: 1.0 for tf in self.timeframes}
        self.trend_state = {}  # Track trend direction per TF

    async def execute(self):
        """Main execution loop - multi-timeframe predictions every 60 seconds"""
        await self.subscribe_shared_data(["indicators", "support_resistance"])

        while self.running:
            try:
                # Get shared data
                indicators = self.shared_data.get("indicators", {})
                support_resistance = self.shared_data.get("support_resistance", {})

                # Generate predictions for all timeframes
                predictions = await self.predict_multiframe(indicators, support_resistance)

                # Determine overall signal and consensus
                signal = predictions["consensus"]["signal"]
                confidence = predictions["consensus"]["confidence"]

                # Report to supervisor
                await self.report(
                    signal=signal,
                    metadata={
                        "predictions": predictions,
                        "confidence": confidence,
                        "pair": self.pair,
                        "learning": {
                            "timeframe_weights": self.tf_weights,
                            "avg_accuracy": self.calculate_avg_accuracy()
                        }
                    }
                )

                # Publish for other agents
                await self.publish_shared_data("bitcoin_multiframe_predictions", predictions)

                logger.info(f"[MULTI-TF] {signal} | Confidence: {confidence}% | "
                           f"Consensus: {predictions['consensus']['agreed_timeframes']}")

            except Exception as e:
                logger.error(f"Error in multi-timeframe prediction: {e}")

            await asyncio.sleep(60)

    async def predict_multiframe(self, indicators: Dict, support_resistance: Dict) -> Dict:
        """
        Predict across multiple timeframes
        Returns: Dict with individual TF predictions and consensus
        """
        predictions = {}

        for timeframe in self.timeframes:
            prediction = await self.predict_timeframe(
                timeframe, indicators, support_resistance
            )
            predictions[timeframe] = prediction

        # Calculate consensus
        consensus = self.calculate_consensus(predictions)

        return {
            "timeframes": predictions,
            "consensus": consensus,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def predict_timeframe(self, timeframe: str, indicators: Dict,
                               support_resistance: Dict) -> Dict:
        """
        Predict for single timeframe using multi-factor analysis
        """

        # Factor 1: Trend Alignment (35%)
        trend_signal = self.analyze_trend(timeframe, indicators)

        # Factor 2: Fibonacci Levels (25%)
        fib_signal = self.analyze_fibonacci(timeframe, support_resistance)

        # Factor 3: Support/Resistance (20%)
        sr_signal = self.analyze_support_resistance(timeframe, support_resistance)

        # Factor 4: Moving Averages (10%)
        ma_signal = self.analyze_moving_averages(timeframe, indicators)

        # Factor 5: Volume (10%)
        volume_signal = self.analyze_volume(timeframe, indicators)

        # Weighted ensemble
        signals = [
            (trend_signal["score"], self.weights["trend_alignment"]),
            (fib_signal["score"], self.weights["fibonacci"]),
            (sr_signal["score"], self.weights["support_resistance"]),
            (ma_signal["score"], self.weights["moving_averages"]),
            (volume_signal["score"], self.weights["volume_confirmation"])
        ]

        weighted_score = sum(score * weight for score, weight in signals)

        # Apply TF-specific weight based on learning
        weighted_score *= self.tf_weights[timeframe]

        # Determine signal
        if weighted_score > 0.4:
            signal = "BUY"
        elif weighted_score < -0.4:
            signal = "SELL"
        else:
            signal = "HOLD"

        # Calculate confidence
        confidence = min(100, int(abs(weighted_score) * 120))

        # Risk/Reward ratio based on proximity to S/R
        risk_reward = self.calculate_risk_reward(timeframe, weighted_score, support_resistance)

        return {
            "timeframe": timeframe,
            "signal": signal,
            "confidence": confidence,
            "direction": 1 if weighted_score > 0 else (-1 if weighted_score < 0 else 0),
            "score": round(weighted_score, 3),
            "risk_reward": round(risk_reward, 2),
            "components": {
                "trend": trend_signal,
                "fibonacci": fib_signal,
                "support_resistance": sr_signal,
                "moving_averages": ma_signal,
                "volume": volume_signal
            }
        }

    def analyze_trend(self, timeframe: str, indicators: Dict) -> Dict:
        """
        Analyze trend direction
        EMA, SMA, price > / < moving averages
        """
        score = 0.0
        components = []

        # EMA crossover
        ema = indicators.get(f"ema_{timeframe}", {})
        ema_9 = ema.get("ema_9", 0)
        ema_21 = ema.get("ema_21", 0)
        ema_50 = ema.get("ema_50", 0)

        if ema_9 > ema_21 > ema_50:
            score += 0.6  # Strong uptrend
            components.append("EMA stack bullish")
        elif ema_9 < ema_21 < ema_50:
            score -= 0.6  # Strong downtrend
            components.append("EMA stack bearish")
        elif ema_9 > ema_21:
            score += 0.3  # Bullish
            components.append("EMA 9 > 21")
        elif ema_9 < ema_21:
            score -= 0.3  # Bearish
            components.append("EMA 9 < 21")

        # Store trend state for learning
        self.trend_state[timeframe] = "UP" if score > 0 else "DOWN" if score < 0 else "NEUTRAL"

        # Normalize
        score = max(-1, min(1, score))

        return {
            "score": score,
            "confidence": int(abs(score) * 90),
            "trend": self.trend_state[timeframe],
            "components": components
        }

    def analyze_fibonacci(self, timeframe: str, support_resistance: Dict) -> Dict:
        """
        Analyze Fibonacci retracement levels
        Price proximity to Fib levels indicates support/resistance
        """
        fib_data = support_resistance.get(f"fibonacci_{timeframe}", {})

        score = 0.0
        near_level = None

        # Check proximity to Fibonacci levels
        retracements = fib_data.get("retracements", {})

        if retracements:
            # High confidence if near key levels
            for level_name, level_price in retracements.items():
                # Simulate proximity check (within 0.5%)
                current = support_resistance.get(f"current_price_{timeframe}", 0)
                if current and abs(current - level_price) / level_price < 0.005:
                    near_level = (level_name, level_price)

                    if level_name in ["618", "786"]:  # Strong support/resistance
                        score += 0.2
                    elif level_name in ["382", "500"]:  # Moderate
                        score += 0.1

        return {
            "score": score,
            "confidence": 60 if near_level else 30,
            "near_level": near_level,
            "description": f"Fibonacci {'confluence' if score > 0 else 'neutral'}"
        }

    def analyze_support_resistance(self, timeframe: str, support_resistance: Dict) -> Dict:
        """
        Analyze proximity to support and resistance levels
        Price near S/R = potential reversal or breakout
        """
        sr_data = support_resistance.get(f"levels_{timeframe}", {})
        current_price = support_resistance.get(f"current_{timeframe}", 0)

        score = 0.0
        nearest = None
        distance_pct = 100

        support_levels = sr_data.get("support", [])
        resistance_levels = sr_data.get("resistance", [])

        # Check proximity to support (bullish signal if near)
        for support in support_levels:
            if current_price and current_price > support:
                dist = abs(current_price - support) / current_price * 100
                if dist < 2:  # Within 2%
                    score += 0.25
                    if dist < distance_pct:
                        nearest = ("support", support)
                        distance_pct = dist

        # Check proximity to resistance (bearish signal if near)
        for resistance in resistance_levels:
            if current_price and current_price < resistance:
                dist = abs(resistance - current_price) / current_price * 100
                if dist < 2:  # Within 2%
                    score -= 0.25
                    if dist < distance_pct:
                        nearest = ("resistance", resistance)
                        distance_pct = dist

        return {
            "score": score,
            "confidence": min(80, int((2 - distance_pct) * 20)),
            "nearest": nearest,
            "description": f"Near {nearest[0] if nearest else 'no level'}"
        }

    def analyze_moving_averages(self, timeframe: str, indicators: Dict) -> Dict:
        """
        Analyze moving average signals
        SMA crossovers, price above/below MAs
        """
        ma_data = indicators.get(f"sma_{timeframe}", {})

        score = 0.0
        components = []

        sma_50 = ma_data.get("sma_50", 0)
        sma_200 = ma_data.get("sma_200", 0)
        current = ma_data.get("current", 0)

        if sma_50 > sma_200:
            score += 0.2  # Bullish MA alignment
            components.append("50 > 200 SMA (bullish)")
        elif sma_50 < sma_200:
            score -= 0.2  # Bearish MA alignment
            components.append("50 < 200 SMA (bearish)")

        # Price proximity
        if current and sma_50:
            if current > sma_50:
                score += 0.15
            else:
                score -= 0.15

        score = max(-1, min(1, score))

        return {
            "score": score,
            "confidence": 50,
            "components": components
        }

    def analyze_volume(self, timeframe: str, indicators: Dict) -> Dict:
        """
        Analyze volume confirmation
        Higher volume on up moves = stronger bullish signal
        """
        volume_data = indicators.get(f"volume_{timeframe}", {})

        score = 0.0

        volume_trend = volume_data.get("trend", "neutral")
        if volume_trend == "increasing":
            if volume_data.get("price_direction") == "up":
                score += 0.2  # Volume confirms uptrend
            elif volume_data.get("price_direction") == "down":
                score -= 0.2  # Volume confirms downtrend

        return {
            "score": score,
            "confidence": 40,
            "trend": volume_trend,
            "description": f"Volume {volume_trend}"
        }

    def calculate_consensus(self, predictions: Dict) -> Dict:
        """
        Calculate consensus from all timeframe predictions
        How many agree? What's the overall recommendation?
        """
        signals = {}
        for tf in self.timeframes:
            pred = predictions.get(tf, {})
            signals[tf] = pred.get("signal", "HOLD")

        buy_count = sum(1 for s in signals.values() if s == "BUY")
        sell_count = sum(1 for s in signals.values() if s == "SELL")
        hold_count = sum(1 for s in signals.values() if s == "HOLD")

        # Determine consensus signal
        if buy_count > sell_count and buy_count >= 3:
            consensus_signal = "STRONG_BUY" if buy_count >= 4 else "BUY"
        elif sell_count > buy_count and sell_count >= 3:
            consensus_signal = "STRONG_SELL" if sell_count >= 4 else "SELL"
        else:
            consensus_signal = "HOLD"

        # Average confidence
        confidences = [predictions[tf].get("confidence", 0) for tf in self.timeframes]
        avg_confidence = int(sum(confidences) / len(confidences))

        # Determine which TFs agree
        agreed = [tf for tf, signal in signals.items() if signal in ["BUY", "SELL"]]
        conflicting = [tf for tf, signal in signals.items() if signal == "HOLD"]

        return {
            "signal": consensus_signal,
            "confidence": avg_confidence,
            "buy_votes": buy_count,
            "sell_votes": sell_count,
            "hold_votes": hold_count,
            "agreed_timeframes": agreed,
            "conflicting_timeframes": conflicting,
            "alignment": "STRONG" if max(buy_count, sell_count) >= 4 else "MODERATE"
        }

    def calculate_risk_reward(self, timeframe: str, signal_score: float,
                             support_resistance: Dict) -> float:
        """
        Calculate risk/reward ratio for potential trade
        Based on proximity to support and resistance
        """
        # Simple R:R calculation
        # In real implementation: use actual S/R distances
        base_rr = 2.0

        if abs(signal_score) > 0.7:
            return base_rr * 1.5  # Strong signal = better RR
        elif abs(signal_score) < 0.3:
            return base_rr * 0.7  # Weak signal = worse RR
        else:
            return base_rr

    def calculate_avg_accuracy(self) -> float:
        """Calculate average prediction accuracy across timeframes"""
        total_correct = sum(data["correct"] for data in self.accuracy_by_tf.values())
        total_predictions = sum(data["total"] for data in self.accuracy_by_tf.values())

        if total_predictions == 0:
            return 0.5

        return total_correct / total_predictions

    async def record_trade(self, won: bool, pnl: float):
        """Record trade result and update learning"""
        await super().record_trade(won, pnl)

        # Adjust TF weights based on accuracy
        for tf in self.timeframes:
            if self.accuracy_by_tf[tf]["total"] > 5:
                accuracy = (self.accuracy_by_tf[tf]["correct"] /
                           self.accuracy_by_tf[tf]["total"])

                if accuracy > 0.65:
                    self.tf_weights[tf] = min(1.5, self.tf_weights[tf] * 1.02)
                elif accuracy < 0.45:
                    self.tf_weights[tf] = max(0.6, self.tf_weights[tf] * 0.98)

        logger.info(f"Multi-TF Trade: Won={won}, PnL={pnl:.4f}, "
                   f"Accuracy={self.calculate_avg_accuracy():.1%}")


async def main():
    """Run Bitcoin Multi-Timeframe Predictor Agent"""
    agent = BitcoinMultiframeAgent()
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
