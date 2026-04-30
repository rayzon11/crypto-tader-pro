// DEMO TRADING ENGINE
// Full paper trading simulator with real market data
// Executes fake trades to test strategy before live trading

const crypto = require('crypto');

class DemoTradingEngine {
  constructor() {
    this.demoAccount = {
      balance: 10000,
      equity: 10000,
      positions: new Map(),
      closedTrades: [],
      openTrades: [],
      cash: 10000,
      trades: [],
      pnl: 0,
      maxDrawdown: 0,
      peakEquity: 10000,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
    };
    this.tradeCounter = 0;
    this.lastUpdateTime = Date.now();
  }

  /**
   * MAIN: Execute a trade in demo mode
   */
  async executeDemoTrade(signal, marketData) {
    try {
      // 1. Validate signal
      if (!signal || !signal.symbol || !signal.side) {
        return { status: 'REJECTED', reason: 'Invalid signal structure' };
      }

      // 2. Check if position size is valid
      if (signal.position_size <= 0) {
        return { status: 'REJECTED', reason: 'Position size must be > 0' };
      }

      // 3. Check available cash
      const cashRequired = signal.position_size;
      if (this.demoAccount.cash < cashRequired) {
        return {
          status: 'REJECTED',
          reason: `Insufficient cash: need $${cashRequired}, have $${this.demoAccount.cash}`
        };
      }

      // 4. Generate trade
      const trade = this.generateTrade(signal, marketData);

      // 5. Record trade
      this.demoAccount.openTrades.push(trade);
      this.demoAccount.cash -= cashRequired;
      this.demoAccount.positions.set(trade.id, trade);
      this.demoAccount.trades.push(trade);
      this.tradeCounter++;

      return {
        status: 'EXECUTED',
        trade,
        message: `Demo trade #${this.tradeCounter} executed`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Generate a trade object
   */
  generateTrade(signal, marketData) {
    const tradeId = `DEMO_${this.tradeCounter}_${crypto.randomBytes(4).toString('hex')}`;

    return {
      id: tradeId,
      symbol: signal.symbol,
      side: signal.side, // BUY or SELL
      entryPrice: signal.entry_price || marketData?.price || 0,
      quantity: signal.position_size || 1,
      size: signal.position_size || 1,
      stopLoss: signal.stop_loss || (signal.entry_price * 0.98),
      takeProfit: signal.take_profit || (signal.entry_price * 1.05),
      entryTime: new Date().toISOString(),
      exitTime: null,
      status: 'OPEN',
      pnl: 0,
      pnlPercent: 0,
      currentPrice: signal.entry_price || marketData?.price || 0,
      confidence: signal.confidence || 0.5,
      agent: signal.agent || 'UNKNOWN',
      reason: signal.reason || 'Automated signal',
    };
  }

  /**
   * Close a trade at specified price
   */
  closeDemoTrade(tradeId, exitPrice, reason = 'Manual close') {
    const trade = this.demoAccount.positions.get(tradeId);
    if (!trade) {
      return { status: 'ERROR', reason: 'Trade not found' };
    }

    const pnl = (exitPrice - trade.entryPrice) * trade.quantity;
    const pnlPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;

    trade.exitPrice = exitPrice;
    trade.exitTime = new Date().toISOString();
    trade.status = 'CLOSED';
    trade.pnl = pnl;
    trade.pnlPercent = pnlPercent;
    trade.exitReason = reason;

    // Update account
    this.demoAccount.cash += trade.quantity; // Return position value
    this.demoAccount.cash += pnl; // Add/subtract P&L
    this.demoAccount.equity = this.demoAccount.balance + this.demoAccount.cash;
    this.demoAccount.pnl += pnl;

    // Track win/loss
    if (pnl > 0) {
      this.demoAccount.winCount++;
    } else if (pnl < 0) {
      this.demoAccount.lossCount++;
    }

    // Update win rate
    const totalTrades = this.demoAccount.winCount + this.demoAccount.lossCount;
    this.demoAccount.winRate = totalTrades > 0 ? (this.demoAccount.winCount / totalTrades) * 100 : 0;

    // Update max drawdown
    if (this.demoAccount.equity > this.demoAccount.peakEquity) {
      this.demoAccount.peakEquity = this.demoAccount.equity;
    }
    const drawdown = (this.demoAccount.peakEquity - this.demoAccount.equity) / this.demoAccount.peakEquity;
    if (drawdown > this.demoAccount.maxDrawdown) {
      this.demoAccount.maxDrawdown = drawdown;
    }

    // Move to closed trades
    this.demoAccount.openTrades = this.demoAccount.openTrades.filter(t => t.id !== tradeId);
    this.demoAccount.closedTrades.push(trade);
    this.demoAccount.positions.delete(tradeId);

    return {
      status: 'CLOSED',
      trade,
      pnl,
      pnlPercent,
      accountEquity: this.demoAccount.equity
    };
  }

  /**
   * Update open trades with current market data
   */
  updateOpenTrades(marketData) {
    const updates = [];

    for (const trade of this.demoAccount.openTrades) {
      // Skip if symbol doesn't match
      if (marketData[trade.symbol]?.price === undefined) continue;

      const currentPrice = marketData[trade.symbol].price;
      const pnl = (currentPrice - trade.entryPrice) * trade.quantity;
      const pnlPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;

      trade.currentPrice = currentPrice;
      trade.pnl = pnl;
      trade.pnlPercent = pnlPercent;

      // Check stop loss
      if (currentPrice <= trade.stopLoss) {
        updates.push(this.closeDemoTrade(trade.id, trade.stopLoss, 'STOP_LOSS'));
      }

      // Check take profit
      else if (currentPrice >= trade.takeProfit) {
        updates.push(this.closeDemoTrade(trade.id, trade.takeProfit, 'TAKE_PROFIT'));
      }
    }

    // Recalculate equity
    let totalPnl = 0;
    for (const trade of this.demoAccount.openTrades) {
      totalPnl += trade.pnl;
    }
    this.demoAccount.equity = this.demoAccount.balance + this.demoAccount.cash + totalPnl;

    return updates;
  }

  /**
   * Force trade mode: Place trade regardless of conditions (for testing)
   */
  async forceExecuteTrade(signal, marketData) {
    // Bypass all validation
    const trade = this.generateTrade(signal, marketData);
    this.demoAccount.openTrades.push(trade);
    this.demoAccount.positions.set(trade.id, trade);
    this.demoAccount.trades.push(trade);
    this.tradeCounter++;

    return {
      status: 'FORCE_EXECUTED',
      trade,
      message: `FORCE TRADE #${this.tradeCounter} - bypassed all validation`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get account stats
   */
  getAccountStats() {
    const totalTrades = this.demoAccount.closedTrades.length;
    const totalPnl = this.demoAccount.pnl;
    const avgWin = this.demoAccount.winCount > 0
      ? this.demoAccount.closedTrades
          .filter(t => t.pnl > 0)
          .reduce((sum, t) => sum + t.pnl, 0) / this.demoAccount.winCount
      : 0;
    const avgLoss = this.demoAccount.lossCount > 0
      ? this.demoAccount.closedTrades
          .filter(t => t.pnl < 0)
          .reduce((sum, t) => sum + t.pnl, 0) / this.demoAccount.lossCount
      : 0;

    return {
      accountBalance: this.demoAccount.balance,
      equity: this.demoAccount.equity,
      cash: this.demoAccount.cash,
      totalPnL: totalPnl,
      openTrades: this.demoAccount.openTrades.length,
      closedTrades: totalTrades,
      winCount: this.demoAccount.winCount,
      lossCount: this.demoAccount.lossCount,
      winRate: parseFloat(this.demoAccount.winRate.toFixed(2)),
      avgWinSize: parseFloat(avgWin.toFixed(2)),
      avgLossSize: parseFloat(avgLoss.toFixed(2)),
      maxDrawdown: parseFloat((this.demoAccount.maxDrawdown * 100).toFixed(2)),
      profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
      totalTradesExecuted: this.tradeCounter
    };
  }

  /**
   * Get all open trades
   */
  getOpenTrades() {
    return this.demoAccount.openTrades;
  }

  /**
   * Get closed trades
   */
  getClosedTrades(limit = 20) {
    return this.demoAccount.closedTrades.slice(-limit);
  }

  /**
   * Reset demo account
   */
  resetDemoAccount(initialBalance = 10000) {
    this.demoAccount = {
      balance: initialBalance,
      equity: initialBalance,
      positions: new Map(),
      closedTrades: [],
      openTrades: [],
      cash: initialBalance,
      trades: [],
      pnl: 0,
      maxDrawdown: 0,
      peakEquity: initialBalance,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
    };
    this.tradeCounter = 0;
  }
}

module.exports = new DemoTradingEngine();
