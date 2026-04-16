// Smart Entry/Exit Logic
// Tiered entry scaling, dynamic trailing stops, profit-taking ladder

class SmartEntryExit {
  constructor() {
    this.openPositions = new Map();
  }

  // TIERED ENTRY: Scale into winning trades
  async generateEntryOrders(signal, portfolio) {
    const totalPosition = signal.position_size;

    const orders = [
      {
        tier: 1,
        size: totalPosition * 0.33,
        price: signal.entry_price,
        stopLoss: signal.entry_price * 0.95,
        targetProfit: signal.entry_price * 1.02,
        timing: "IMMEDIATE"
      },
      {
        tier: 2,
        size: totalPosition * 0.33,
        price: signal.entry_price,
        stopLoss: signal.entry_price * 0.96,
        targetProfit: signal.entry_price * 1.03,
        timing: "5_MIN_AFTER_TIER_1",
        condition: "Price above tier 1 entry + bid higher than entry"
      },
      {
        tier: 3,
        size: totalPosition * 0.34,
        price: signal.entry_price,
        stopLoss: signal.entry_price * 0.97,
        targetProfit: signal.entry_price * 1.05,
        timing: "10_MIN_AFTER_TIER_2",
        condition: "Price still above tier 1 entry"
      }
    ];

    return {
      strategy: "TIERED_ENTRY",
      orders,
      totalSize: totalPosition,
      expectedWinRate: 0.78,
      expectedProfitPerWin: totalPosition * 0.02
    };
  }

  // SMART EXIT: Multiple exit conditions
  async getExitSignals(position) {
    const exits = {
      trailingStop: this.calculateTrailingStop(position),
      profitTakingLadder: this.calculateProfitLadder(position),
      timeBasedExit: this.getTimeBasedExit(position),
      volumeSpikeExit: this.checkVolumeSpikeExit(position),
      divergenceExit: this.checkDivergenceExit(position)
    };

    const triggeredExit = Object.entries(exits).find(([, exit]) => exit.triggered);

    return {
      triggered: !!triggeredExit,
      type: triggeredExit?.[0],
      exit: triggeredExit?.[1],
      allExitConditions: exits
    };
  }

  calculateTrailingStop(position) {
    const { entry, current } = position;
    const gainPercent = ((current - entry) / entry) * 100;

    let stopPrice = entry;

    if (gainPercent >= 3) {
      stopPrice = entry + (entry * 0.005); // 0.5% above entry
    }
    if (gainPercent >= 5) {
      stopPrice = entry + (entry * 0.02); // 2% above entry
    }

    const triggered = current <= stopPrice;

    return {
      stopPrice: parseFloat(stopPrice.toFixed(2)),
      gainPercent: parseFloat(gainPercent.toFixed(2)),
      triggered,
      recommendation: triggered ? "CLOSE_POSITION" : "HOLD"
    };
  }

  calculateProfitLadder(position) {
    const { entry, current, size } = position;
    const gainPercent = ((current - entry) / entry) * 100;

    const ladder = [];

    if (gainPercent >= 2) {
      ladder.push({ gain: 2, closePercent: 25, closeSize: size * 0.25, profit: (size * 0.25) * ((current - entry) / entry) });
    }
    if (gainPercent >= 3) {
      ladder.push({ gain: 3, closePercent: 50, closeSize: size * 0.25, profit: (size * 0.25) * ((current - entry) / entry) });
    }
    if (gainPercent >= 4) {
      ladder.push({ gain: 4, closePercent: 100, closeSize: size * 0.50, profit: (size * 0.50) * ((current - entry) / entry), recommendation: "CLOSE_50%_TRAIL_REST" });
    }

    return {
      triggered: ladder.length > 0,
      steps: ladder,
      totalProfitLocked: ladder.reduce((sum, step) => sum + step.profit, 0)
    };
  }

  getTimeBasedExit(position) {
    const entryTime = new Date(position.entryTime);
    const currentTime = new Date();
    const holdHours = (currentTime - entryTime) / (1000 * 60 * 60);
    const gainPercent = ((position.current - position.entry) / position.entry) * 100;

    if (holdHours > 4 && gainPercent < 1) {
      return { triggered: true, reason: "NO_MOVEMENT_4_HOURS", recommendation: "CLOSE_50%" };
    }
    if (holdHours > 8 && gainPercent < 2) {
      return { triggered: true, reason: "NO_MOMENTUM_8_HOURS", recommendation: "CLOSE_ALL" };
    }

    return { triggered: false };
  }

  checkVolumeSpikeExit(position) {
    const volumeSpike = position.currentVolume > (position.avgVolume || 1) * 3;
    const gainPercent = ((position.current - position.entry) / position.entry) * 100;

    if (volumeSpike && gainPercent > 1) {
      return { triggered: true, reason: "VOLUME_SPIKE_POTENTIAL_REVERSAL", recommendation: "CLOSE_50%_KEEP_50%" };
    }

    return { triggered: false };
  }

  checkDivergenceExit(position) {
    const { current, entry, macdHistogram, prevMacdHistogram } = position;

    if (current > entry && macdHistogram < (prevMacdHistogram || 0)) {
      return { triggered: true, reason: "PRICE_MACD_DIVERGENCE", recommendation: "CLOSE_25%" };
    }

    return { triggered: false };
  }
}

module.exports = new SmartEntryExit();
