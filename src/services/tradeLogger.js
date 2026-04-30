// TRADE LOGGER
// Comprehensive logging of all trading decisions
// Debug tool: Shows exactly WHY trades were taken or rejected

const fs = require('fs');
const path = require('path');

class TradeLogger {
  constructor() {
    this.logPath = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
    this.tradeLogs = [];
    this.decisionLogs = [];
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  /**
   * Log a trade execution or rejection
   */
  logTrade(status, signal, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      status, // EXECUTED, REJECTED, ERROR
      signal: {
        symbol: signal.symbol,
        side: signal.side,
        entryPrice: signal.entry_price,
        positionSize: signal.position_size,
        confidence: signal.confidence,
        agent: signal.agent
      },
      result,
      logLevel: status === 'EXECUTED' ? 'INFO' : status === 'REJECTED' ? 'WARN' : 'ERROR'
    };

    this.tradeLogs.push(logEntry);
    this.writeToFile('trades.log', logEntry);
    this.printToConsole(logEntry);
  }

  /**
   * Log agent decision
   */
  logDecision(agent, decision, reasoning) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agent,
      decision, // BUY, SELL, HOLD, ERROR
      reasoning,
      confidence: decision.confidence || 0
    };

    this.decisionLogs.push(logEntry);
    this.writeToFile('decisions.log', logEntry);
  }

  /**
   * Log why a trade was blocked
   */
  logBlockedTrade(signal, blockReason, blockDetails) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      symbol: signal.symbol,
      blockReason,
      blockDetails,
      signal: {
        side: signal.side,
        entryPrice: signal.entry_price,
        positionSize: signal.position_size
      },
      severity: 'BLOCKED'
    };

    this.writeToFile('blocked_trades.log', logEntry);
    console.warn(`[BLOCKED] ${signal.symbol}: ${blockReason}`);
  }

  /**
   * Log execution debug info
   */
  logExecutionDebug(executionId, stage, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      executionId,
      stage, // SIGNAL_VALIDATION, TECHNICAL_CHECK, RISK_CHECK, POSITION_SIZING, EXECUTION
      data
    };

    this.writeToFile('execution_debug.log', logEntry);
  }

  /**
   * Write to file
   */
  writeToFile(filename, logEntry) {
    try {
      const filepath = path.join(this.logPath, filename);
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(filepath, logLine);
    } catch (error) {
      console.error(`Failed to write log to ${filename}:`, error.message);
    }
  }

  /**
   * Print to console with color coding
   */
  printToConsole(logEntry) {
    const colors = {
      INFO: '\x1b[32m', // Green
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m' // Red
    };
    const reset = '\x1b[0m';
    const color = colors[logEntry.logLevel] || reset;

    const output = `${color}[${logEntry.timestamp}] [${logEntry.status}] ${logEntry.signal.symbol} ${logEntry.signal.side}${reset}`;
    console.log(output);
  }

  /**
   * Get recent trades
   */
  getRecentTrades(limit = 20) {
    return this.tradeLogs.slice(-limit);
  }

  /**
   * Get blocked trades analysis
   */
  getBlockedTradesAnalysis() {
    const blockReasons = {};
    for (const log of this.tradeLogs.filter(t => t.status === 'REJECTED')) {
      const reason = log.result?.reason || 'UNKNOWN';
      blockReasons[reason] = (blockReasons[reason] || 0) + 1;
    }
    return blockReasons;
  }

  /**
   * Generate daily report
   */
  generateDailyReport() {
    const today = new Date().toDateString();
    const todaysTrades = this.tradeLogs.filter(
      t => new Date(t.timestamp).toDateString() === today
    );

    const executed = todaysTrades.filter(t => t.status === 'EXECUTED').length;
    const rejected = todaysTrades.filter(t => t.status === 'REJECTED').length;
    const errors = todaysTrades.filter(t => t.status === 'ERROR').length;

    return {
      date: today,
      totalAttempts: todaysTrades.length,
      executed,
      rejected,
      errors,
      executionRate: todaysTrades.length > 0 ? ((executed / todaysTrades.length) * 100).toFixed(2) : 0,
      trades: todaysTrades
    };
  }

  /**
   * Clear logs (optional)
   */
  clearLogs() {
    this.tradeLogs = [];
    this.decisionLogs = [];
  }
}

module.exports = new TradeLogger();
