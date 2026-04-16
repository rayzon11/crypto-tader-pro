/**
 * CANDLE PATTERN DETECTOR
 * Detects 8 fundamental candlestick patterns with ML-style confidence scoring
 * Integrated with multi-timeframe trading engine for Bitcoin and all pairs
 */

class CandlePatternDetector {
  constructor() {
    this.patterns = {
      hammer: { name: 'Hammer', direction: 'UP', description: 'Bullish reversal' },
      doji: { name: 'Doji', direction: 'NEUTRAL', description: 'Indecision' },
      engulfing: { name: 'Engulfing', direction: 'VARIES', description: 'Reversal' },
      morningStar: { name: 'Morning Star', direction: 'UP', description: 'Bullish reversal' },
      eveningStar: { name: 'Evening Star', direction: 'DOWN', description: 'Bearish reversal' },
      harami: { name: 'Harami', direction: 'VARIES', description: 'Exhaustion' },
      piercingLine: { name: 'Piercing Line', direction: 'UP', description: 'Bullish reversal' },
      darkCloudCover: { name: 'Dark Cloud Cover', direction: 'DOWN', description: 'Bearish reversal' }
    };
  }

  /**
   * Detect all patterns in candle array
   * @param {Array} candles - OHLCV candles (min 5 candles)
   * @returns {Object} { patterns: Array, strongestPattern: Object, combinedConfidence: Number, recommendation: String }
   */
  detectPatterns(candles) {
    if (!candles || candles.length < 5) {
      return { patterns: [], strongestPattern: null, combinedConfidence: 0, recommendation: 'HOLD' };
    }

    const detectedPatterns = [];

    // Detect 1-candle patterns
    const hammerResult = this.detectHammer(candles);
    if (hammerResult) detectedPatterns.push(hammerResult);

    const dojiResult = this.detectDoji(candles);
    if (dojiResult) detectedPatterns.push(dojiResult);

    // Detect 2-candle patterns
    const engulfingResult = this.detectEngulfing(candles);
    if (engulfingResult) detectedPatterns.push(engulfingResult);

    const piercingResult = this.detectPiercingLine(candles);
    if (piercingResult) detectedPatterns.push(piercingResult);

    const darkCloudResult = this.detectDarkCloudCover(candles);
    if (darkCloudResult) detectedPatterns.push(darkCloudResult);

    // Detect 3-candle patterns
    const morningStarResult = this.detectMorningStar(candles);
    if (morningStarResult) detectedPatterns.push(morningStarResult);

    const eveningStarResult = this.detectEveningStar(candles);
    if (eveningStarResult) detectedPatterns.push(eveningStarResult);

    const haramiResult = this.detectHarami(candles);
    if (haramiResult) detectedPatterns.push(haramiResult);

    // Calculate aggregate metrics
    const strongestPattern = detectedPatterns.length > 0
      ? detectedPatterns.reduce((max, p) => p.confidence > max.confidence ? p : max)
      : null;

    const avgConfidence = detectedPatterns.length > 0
      ? detectedPatterns.reduce((sum, p) => sum + p.confidence, 0) / detectedPatterns.length
      : 0;

    // Determine recommendation based on pattern consensus
    let recommendation = 'HOLD';
    const bullishPatterns = detectedPatterns.filter(p => p.direction === 'UP').length;
    const bearishPatterns = detectedPatterns.filter(p => p.direction === 'DOWN').length;
    const neutralPatterns = detectedPatterns.filter(p => p.direction === 'NEUTRAL').length;

    if (bullishPatterns > bearishPatterns && avgConfidence > 65) {
      recommendation = 'BUY';
    } else if (bearishPatterns > bullishPatterns && avgConfidence > 65) {
      recommendation = 'SELL';
    }

    return {
      patterns: detectedPatterns.sort((a, b) => b.confidence - a.confidence),
      strongestPattern,
      combinedConfidence: Math.round(avgConfidence),
      recommendation,
      bullishCount: bullishPatterns,
      bearishCount: bearishPatterns,
      neutralCount: neutralPatterns
    };
  }

  /**
   * HAMMER PATTERN
   * Bullish reversal: Long lower wick, small body at top
   * - Open, Close near high
   * - Lower wick 2x+ the body height
   */
  detectHammer(candles) {
    const current = candles[candles.length - 1];
    const body = Math.abs(current.close - current.open);
    const totalRange = current.high - current.low;
    const lowerWick = Math.min(current.open, current.close) - current.low;
    const upperWick = current.high - Math.max(current.open, current.close);

    // Pattern criteria
    if (body < totalRange * 0.3 && lowerWick >= body * 2 && upperWick < body * 0.5) {
      let confidence = 75;
      // Boost confidence if previous candle is bearish
      if (candles.length >= 2 && candles[candles.length - 2].close < candles[candles.length - 2].open) {
        confidence = 85;
      }
      return {
        name: 'Hammer',
        direction: 'UP',
        confidence,
        timestamp: current.timestamp,
        description: `Body: ${body.toFixed(2)}, Lower Wick: ${lowerWick.toFixed(2)}`
      };
    }
    return null;
  }

  /**
   * DOJI PATTERN
   * Indecision: Open ≈ Close, long wicks both sides
   * Indicates uncertainty in market
   */
  detectDoji(candles) {
    const current = candles[candles.length - 1];
    const body = Math.abs(current.close - current.open);
    const totalRange = current.high - current.low;

    // Pattern criteria: body is <5% of total range
    if (body < totalRange * 0.05) {
      const upperWick = current.high - Math.max(current.open, current.close);
      const lowerWick = Math.min(current.open, current.close) - current.low;

      let confidence = 80;
      // Higher confidence if both wicks are roughly equal length
      if (Math.abs(upperWick - lowerWick) < totalRange * 0.1) {
        confidence = 90;
      }

      return {
        name: 'Doji',
        direction: 'NEUTRAL',
        confidence,
        timestamp: current.timestamp,
        description: `Upper Wick: ${upperWick.toFixed(2)}, Lower Wick: ${lowerWick.toFixed(2)}`
      };
    }
    return null;
  }

  /**
   * ENGULFING PATTERN
   * 2-candle reversal: Current body completely engulfs previous body
   */
  detectEngulfing(candles) {
    if (candles.length < 2) return null;

    const previous = candles[candles.length - 2];
    const current = candles[candles.length - 1];

    const prevBody = Math.abs(previous.close - previous.open);
    const currBody = Math.abs(current.close - current.open);

    // Current body must be larger than previous
    if (currBody <= prevBody * 1.2) return null;

    const prevOpen = Math.min(previous.open, previous.close);
    const prevClose = Math.max(previous.open, previous.close);
    const currOpen = Math.min(current.open, current.close);
    const currClose = Math.max(current.open, current.close);

    // Current body must engulf previous body
    const engulfs = currOpen <= prevOpen && currClose >= prevClose;

    if (engulfs) {
      const isBullish = current.close > current.open && previous.close < previous.open;
      const isBearish = current.close < current.open && previous.close > previous.open;

      if (isBullish || isBearish) {
        return {
          name: 'Engulfing',
          direction: isBullish ? 'UP' : 'DOWN',
          confidence: 75,
          timestamp: current.timestamp,
          description: `${isBullish ? 'Bullish' : 'Bearish'} Engulfing`
        };
      }
    }
    return null;
  }

  /**
   * PIERCING LINE PATTERN
   * Bullish reversal:
   * - First candle: Large bearish
   * - Second candle: Opens below, closes above midpoint of first
   */
  detectPiercingLine(candles) {
    if (candles.length < 2) return null;

    const first = candles[candles.length - 2];
    const second = candles[candles.length - 1];

    // First must be bearish
    if (first.close >= first.open) return null;

    // Second must be bullish
    if (second.close <= second.open) return null;

    const firstMidpoint = (first.open + first.close) / 2;
    const firstOpen = Math.max(first.open, first.close);

    // Second opens below first's close, closes above midpoint
    if (second.open < first.close && second.close > firstMidpoint && second.close < firstOpen) {
      return {
        name: 'Piercing Line',
        direction: 'UP',
        confidence: 72,
        timestamp: second.timestamp,
        description: `Opened ${((first.close - second.open) / first.close * 100).toFixed(1)}% below, closed above midpoint`
      };
    }
    return null;
  }

  /**
   * DARK CLOUD COVER PATTERN
   * Bearish reversal:
   * - First candle: Large bullish
   * - Second candle: Opens above, closes below midpoint of first
   */
  detectDarkCloudCover(candles) {
    if (candles.length < 2) return null;

    const first = candles[candles.length - 2];
    const second = candles[candles.length - 1];

    // First must be bullish
    if (first.close <= first.open) return null;

    // Second must be bearish
    if (second.close >= second.open) return null;

    const firstMidpoint = (first.open + first.close) / 2;
    const firstClose = Math.max(first.open, first.close);

    // Second opens above first's close, closes below midpoint
    if (second.open > first.close && second.close < firstMidpoint && second.close > Math.min(first.open, first.close)) {
      return {
        name: 'Dark Cloud Cover',
        direction: 'DOWN',
        confidence: 70,
        timestamp: second.timestamp,
        description: `Opened ${((second.open - first.close) / first.close * 100).toFixed(1)}% above, closed below midpoint`
      };
    }
    return null;
  }

  /**
   * MORNING STAR PATTERN
   * Bullish reversal (3 candles):
   * - Candle 1: Large bearish
   * - Candle 2: Small body (gap down)
   * - Candle 3: Large bullish
   */
  detectMorningStar(candles) {
    if (candles.length < 3) return null;

    const first = candles[candles.length - 3];
    const second = candles[candles.length - 2];
    const third = candles[candles.length - 1];

    // First must be bearish
    if (first.close >= first.open) return null;

    // Second must have small body (indecision)
    const secondBody = Math.abs(second.close - second.open);
    const firstBody = Math.abs(first.close - first.open);
    if (secondBody > firstBody * 0.5) return null;

    // Third must be bullish
    if (third.close <= third.open) return null;

    // Second should gap down from first
    const secondHigh = Math.max(second.open, second.close);
    const firstLow = Math.min(first.open, first.close);
    const hasGap = secondHigh < firstLow;

    // Third should close well into first's body
    const thirdClose = third.close;
    const firstMidpoint = (first.open + first.close) / 2;
    const thirdIntoFirst = thirdClose > firstMidpoint;

    if (hasGap && thirdIntoFirst) {
      return {
        name: 'Morning Star',
        direction: 'UP',
        confidence: 76,
        timestamp: third.timestamp,
        description: 'Bullish 3-candle reversal pattern'
      };
    }
    return null;
  }

  /**
   * EVENING STAR PATTERN
   * Bearish reversal (3 candles):
   * - Candle 1: Large bullish
   * - Candle 2: Small body (gap up)
   * - Candle 3: Large bearish
   */
  detectEveningStar(candles) {
    if (candles.length < 3) return null;

    const first = candles[candles.length - 3];
    const second = candles[candles.length - 2];
    const third = candles[candles.length - 1];

    // First must be bullish
    if (first.close <= first.open) return null;

    // Second must have small body
    const secondBody = Math.abs(second.close - second.open);
    const firstBody = Math.abs(first.close - first.open);
    if (secondBody > firstBody * 0.5) return null;

    // Third must be bearish
    if (third.close >= third.open) return null;

    // Second should gap up from first
    const secondLow = Math.min(second.open, second.close);
    const firstHigh = Math.max(first.open, first.close);
    const hasGap = secondLow > firstHigh;

    // Third should close well into first's body
    const thirdClose = third.close;
    const firstMidpoint = (first.open + first.close) / 2;
    const thirdIntoFirst = thirdClose < firstMidpoint;

    if (hasGap && thirdIntoFirst) {
      return {
        name: 'Evening Star',
        direction: 'DOWN',
        confidence: 74,
        timestamp: third.timestamp,
        description: 'Bearish 3-candle reversal pattern'
      };
    }
    return null;
  }

  /**
   * HARAMI PATTERN
   * Trend exhaustion (2 candles):
   * - First: Large body
   * - Second: Small body completely inside first body
   */
  detectHarami(candles) {
    if (candles.length < 2) return null;

    const first = candles[candles.length - 2];
    const second = candles[candles.length - 1];

    const firstBody = Math.abs(first.close - first.open);
    const secondBody = Math.abs(second.close - second.open);

    // Second body must be much smaller
    if (secondBody > firstBody * 0.5) return null;

    const firstOpen = Math.min(first.open, first.close);
    const firstClose = Math.max(first.open, first.close);
    const secondOpen = Math.min(second.open, second.close);
    const secondClose = Math.max(second.open, second.close);

    // Second must be inside first
    const isInside = secondOpen >= firstOpen && secondClose <= firstClose;

    if (isInside) {
      // Determine direction based on second candle color
      const isBullish = second.close > second.open;
      const isBearish = second.close < second.open;

      const direction = isBullish ? 'UP' : isBearish ? 'DOWN' : 'NEUTRAL';

      return {
        name: 'Harami',
        direction,
        confidence: 68,
        timestamp: second.timestamp,
        description: `Harami pattern - trend exhaustion signal`
      };
    }
    return null;
  }
}

module.exports = new CandlePatternDetector();
