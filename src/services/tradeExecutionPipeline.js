// TRADE EXECUTION PIPELINE
// Guaranteed execution flow: Signal → Validation → Risk Check → Execution → Monitoring
// Designed to actually place trades (or log why they failed)

const tradeLogger = require('./tradeLogger');
const demoTradingEngine = require('./demoTradingEngine');

class TradeExecutionPipeline {
  constructor() {
    this.executionLog = [];
    this.blockedTrades = [];
    this.executedTrades = [];
    this.minTradesPerDay = 5; // Force at least 5 trades/day in demo
    this.forceTradeMode = false; // Enable to place ALL signals
  }

  /**
   * MAIN EXECUTION PIPELINE
   * This is the single source of truth for trade execution
   */
  async executeTradePipeline(signal, marketData, portfolio, mode = 'DEMO') {
    const executionId = this.generateExecutionId();
    const timestamp = new Date().toISOString();

    try {
      // ═══════════════════════════════════════════════════════════
      // STAGE 1: SIGNAL VALIDATION
      // ═══════════════════════════════════════════════════════════
      const signalValidation = this.validateSignal(signal);
      if (!signalValidation.valid) {
        return this.logBlockedTrade(executionId, signal, 'SIGNAL_INVALID', signalValidation.reason);
      }

      // ═══════════════════════════════════════════════════════════
      // STAGE 2: TECHNICAL VALIDATION
      // ═══════════════════════════════════════════════════════════
      const technicalValidation = this.validateTechnical(signal, marketData);
      if (!technicalValidation.valid && !this.forceTradeMode) {
        return this.logBlockedTrade(executionId, signal, 'TECHNICAL_FAILED', technicalValidation.reason);
      }

      // ═══════════════════════════════════════════════════════════
      // STAGE 3: RISK MANAGEMENT CHECKS
      // ═══════════════════════════════════════════════════════════
      const riskValidation = this.validateRisk(signal, portfolio);
      if (!riskValidation.valid && !this.forceTradeMode) {
        return this.logBlockedTrade(executionId, signal, 'RISK_CHECK_FAILED', riskValidation.reason);
      }

      // ═══════════════════════════════════════════════════════════
      // STAGE 4: POSITION SIZING
      // ═══════════════════════════════════════════════════════════
      const positionSize = this.calculatePositionSize(signal, portfolio);
      if (positionSize <= 0) {
        return this.logBlockedTrade(executionId, signal, 'INVALID_POSITION_SIZE', 'Position size calculated as zero');
      }
      signal.position_size = positionSize;

      // ═══════════════════════════════════════════════════════════
      // STAGE 5: EXECUTE TRADE (FINALLY!)
      // ═══════════════════════════════════════════════════════════
      let execution;
      if (mode === 'DEMO') {
        execution = await demoTradingEngine.executeDemoTrade(signal, marketData);
      } else if (mode === 'LIVE') {
        // TODO: Implement live execution
        execution = { status: 'NOT_IMPLEMENTED', reason: 'Live trading not yet configured' };
      } else {
        execution = { status: 'UNKNOWN_MODE', reason: `Unknown mode: ${mode}` };
      }

      // ═══════════════════════════════════════════════════════════
      // STAGE 6: LOG & MONITOR
      // ═══════════════════════════════════════════════════════════
      if (execution.status === 'EXECUTED' || execution.status === 'FORCE_EXECUTED') {
        this.logExecutedTrade(executionId, signal, execution);
        return {
          status: 'APPROVED_AND_EXECUTED',
          execution,
          tradeId: execution.trade?.id,
          timestamp
        };
      } else {
        return this.logBlockedTrade(executionId, signal, 'EXECUTION_FAILED', execution.reason);
      }

    } catch (error) {
      console.error('[PIPELINE ERROR]', error.message);
      return this.logBlockedTrade(executionId, signal, 'PIPELINE_ERROR', error.message);
    }
  }

  /**
   * STAGE 1: Validate signal structure
   */
  validateSignal(signal) {
    if (!signal) return { valid: false, reason: 'Signal is null/undefined' };
    if (!signal.symbol) return { valid: false, reason: 'Missing symbol' };
    if (!signal.side || !['BUY', 'SELL'].includes(signal.side)) {
      return { valid: false, reason: 'Invalid side (must be BUY or SELL)' };
    }
    if (!signal.entry_price || signal.entry_price <= 0) {
      return { valid: false, reason: 'Invalid entry price' };
    }
    if (!signal.confidence || signal.confidence < 0 || signal.confidence > 1) {
      return { valid: false, reason: 'Confidence must be between 0 and 1' };
    }

    return { valid: true, reason: 'Signal structure valid' };
  }

  /**
   * STAGE 2: Validate technical indicators
   */
  validateTechnical(signal, marketData) {
    if (!marketData) return { valid: true, reason: 'No market data (skip technical)' };

    const checks = {
      priceMoving: marketData.price && marketData.price > 0,
      volumePresent: marketData.volume24h && marketData.volume24h > 0,
      indicatorsAvailable: true // Placeholder
    };

    const passedChecks = Object.values(checks).filter(v => v).length;
    const requiredChecks = Math.ceil(Object.values(checks).length * 0.7); // 70% pass rate

    if (passedChecks >= requiredChecks) {
      return { valid: true, reason: `Technical checks passed (${passedChecks}/${Object.values(checks).length})` };
    }

    return { valid: false, reason: `Technical checks failed (${passedChecks}/${Object.values(checks).length})` };
  }

  /**
   * STAGE 3: Risk management validation
   */
  validateRisk(signal, portfolio) {
    // Check 1: Max risk per trade (2%)
    const maxRiskPerTrade = 0.02;
    const accountEquity = portfolio.equity || 10000;
    const maxRiskAmount = accountEquity * maxRiskPerTrade;

    if (!signal.stop_loss) {
      signal.stop_loss = signal.entry_price * 0.98; // Default 2% stop
    }

    const tradeRisk = Math.abs((signal.entry_price - signal.stop_loss) * signal.position_size);
    if (tradeRisk > maxRiskAmount) {
      return { valid: false, reason: `Risk too high: $${tradeRisk} > max $${maxRiskAmount}` };
    }

    // Check 2: Drawdown check
    const maxDrawdown = 0.15; // 15% max
    const currentDrawdown = portfolio.drawdownPercent || 0;
    if (currentDrawdown > maxDrawdown) {
      return { valid: false, reason: `Drawdown too high: ${(currentDrawdown * 100).toFixed(2)}% > ${maxDrawdown * 100}%` };
    }

    // Check 3: Position sizing check
    if (!signal.position_size || signal.position_size <= 0) {
      return { valid: false, reason: 'Position size must be > 0' };
    }

    return { valid: true, reason: 'All risk checks passed' };
  }

  /**
   * STAGE 4: Calculate position size
   */
  calculatePositionSize(signal, portfolio) {
    const equity = portfolio.equity || 10000;
    const maxPositionPercent = 0.05; // 5% per position

    // Default: 1% of equity
    let positionSize = equity * 0.01;

    // Adjust based on confidence
    if (signal.confidence > 0.8) {
      positionSize *= 1.5; // 1.5x for high confidence
    } else if (signal.confidence < 0.5) {
      positionSize *= 0.5; // 0.5x for low confidence
    }

    // Cap at max position percent
    const maxPosition = equity * maxPositionPercent;
    positionSize = Math.min(positionSize, maxPosition);

    return Math.max(10, positionSize); // Min $10 position
  }

  /**
   * Log executed trade
   */
  logExecutedTrade(executionId, signal, execution) {
    const logEntry = {
      executionId,
      timestamp: new Date().toISOString(),
      status: 'EXECUTED',
      signal,
      execution,
      tradeId: execution.trade?.id
    };
    this.executionLog.push(logEntry);
    this.executedTrades.push(logEntry);
    tradeLogger.logTrade('EXECUTED', signal, execution);
  }

  /**
   * Log blocked trade with reason
   */
  logBlockedTrade(executionId, signal, reason, details) {
    const logEntry = {
      executionId,
      timestamp: new Date().toISOString(),
      status: 'REJECTED',
      reason,
      details,
      signal
    };
    this.executionLog.push(logEntry);
    this.blockedTrades.push(logEntry);
    tradeLogger.logTrade('REJECTED', signal, { reason, details });

    return {
      status: 'REJECTED',
      reason,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if minimum daily trades met (force trades if not)
   */
  checkMinimumDailyTrades() {
    const today = new Date().toDateString();
    const todaysTrades = this.executedTrades.filter(
      t => new Date(t.timestamp).toDateString() === today
    );

    const tradeDeficit = this.minTradesPerDay - todaysTrades.length;
    if (tradeDeficit > 0) {
      return {
        status: 'BELOW_MINIMUM',
        tradesNeeded: tradeDeficit,
        message: `Need ${tradeDeficit} more trades today to meet minimum of ${this.minTradesPerDay}`
      };
    }

    return {
      status: 'MINIMUM_MET',
      tradesExecuted: todaysTrades.length,
      message: `Daily minimum met: ${todaysTrades.length} trades`
    };
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const totalAttempts = this.executionLog.length;
    const executed = this.executedTrades.length;
    const rejected = this.blockedTrades.length;
    const executionRate = totalAttempts > 0 ? (executed / totalAttempts) * 100 : 0;

    // Rejection reasons
    const rejectionReasons = {};
    for (const trade of this.blockedTrades) {
      rejectionReasons[trade.reason] = (rejectionReasons[trade.reason] || 0) + 1;
    }

    return {
      totalAttempts,
      executed,
      rejected,
      executionRate: parseFloat(executionRate.toFixed(2)),
      rejectionReasons,
      recentRejections: this.blockedTrades.slice(-10)
    };
  }

  /**
   * Enable force trade mode (for testing)
   */
  enableForceTrades() {
    this.forceTradeMode = true;
    console.warn('[FORCE TRADE MODE] Enabled - will place ALL trades regardless of validation');
  }

  disableForceTrades() {
    this.forceTradeMode = false;
  }

  /**
   * Helper
   */
  generateExecutionId() {
    return `EXEC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new TradeExecutionPipeline();
