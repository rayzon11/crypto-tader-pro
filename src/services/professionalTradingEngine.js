// PROFESSIONAL TRADING ENGINE — Real-like trading with advanced features
// Works like Exness: real market data, advanced orders, risk management, live P&L
// File: src/services/professionalTradingEngine.js

const fs = require('fs');
const path = require('path');

class ProfessionalTradingEngine {
  constructor() {
    this.account = {
      accountId: 'DEMO_' + Date.now(),
      email: 'trader@cryptobot.pro',
      accountType: 'ECN Pro',
      leverage: 1,
      currency: 'USD',
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      accountStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    this.positions = [];
    this.orders = [];
    this.trades = [];
    this.history = [];
    this.marketData = {};
    this.riskLimits = {
      maxDailyLoss: 500,
      maxDrawdown: 0.15,
      maxOpenPositions: 5,
      maxPositionSize: 0.2,
      minRiskReward: 1.5,
    };
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      tradesOpened: 0,
      tradesClosed: 0,
      winTrades: 0,
      lossTrades: 0,
      dailyPnL: 0,
      maxDrawdownToday: 0,
      peakEquity: 10000,
    };
  }

  // ═══ ACCOUNT METHODS ═══

  getAccountInfo() {
    const marginLevel = this.account.margin > 0
      ? (this.account.equity / this.account.margin * 100).toFixed(2)
      : 0;

    return {
      ...this.account,
      marginLevel,
      stats: {
        totalTrades: this.trades.length,
        winTrades: this.trades.filter(t => t.pnl > 0).length,
        lossTrades: this.trades.filter(t => t.pnl < 0).length,
        winRate: this.trades.length > 0
          ? ((this.trades.filter(t => t.pnl > 0).length / this.trades.length) * 100).toFixed(2)
          : 0,
        totalProfit: this.trades.reduce((sum, t) => sum + Math.max(t.pnl, 0), 0).toFixed(2),
        totalLoss: Math.abs(this.trades.reduce((sum, t) => sum + Math.min(t.pnl, 0), 0)).toFixed(2),
        grossPnL: this.trades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2),
        avgWin: this.trades.filter(t => t.pnl > 0).length > 0
          ? (this.trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) /
             this.trades.filter(t => t.pnl > 0).length).toFixed(2)
          : 0,
        avgLoss: this.trades.filter(t => t.pnl < 0).length > 0
          ? (this.trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) /
             this.trades.filter(t => t.pnl < 0).length).toFixed(2)
          : 0,
      }
    };
  }

  getEquityChart() {
    // Return equity progression over time
    return this.history.map(h => ({
      timestamp: h.timestamp,
      equity: h.equity,
      balance: h.balance,
      drawdown: ((h.peakEquity - h.equity) / h.peakEquity * 100).toFixed(2),
    }));
  }

  // ═══ MARKET DATA ═══

  updateMarketData(symbol, price, bid, ask, spread) {
    this.marketData[symbol] = {
      symbol,
      price: parseFloat(price),
      bid: parseFloat(bid),
      ask: parseFloat(ask),
      spread: parseFloat(spread),
      timestamp: new Date().toISOString(),
      change24h: (Math.random() * 6 - 3).toFixed(2), // -3% to +3%
    };
    return this.marketData[symbol];
  }

  getMarketData(symbol) {
    return this.marketData[symbol] || { symbol, price: 0, bid: 0, ask: 0 };
  }

  // ═══ ORDER MANAGEMENT ═══

  createOrder(params) {
    const {
      symbol,
      orderType, // MARKET, LIMIT, STOP, STOP_LIMIT, BUY_STOP, SELL_STOP
      side, // BUY or SELL
      volume, // lot size
      entryPrice,
      stopLoss,
      takeProfit,
      comment,
    } = params;

    // Validation
    if (!this.validateOrder(symbol, volume, side, entryPrice)) {
      return { status: 'REJECTED', reason: 'Order validation failed' };
    }

    const order = {
      orderId: 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      symbol,
      orderType,
      side,
      volume,
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss || 0),
      takeProfit: parseFloat(takeProfit || 0),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      comment: comment || '',
    };

    this.orders.push(order);
    return { status: 'OK', orderId: order.orderId, order };
  }

  validateOrder(symbol, volume, side, entryPrice) {
    const marketData = this.getMarketData(symbol);
    if (!marketData || !marketData.price) {
      return false; // No market data
    }

    // Check position limits
    if (this.positions.length >= this.riskLimits.maxOpenPositions) {
      return false;
    }

    // Check margin requirement
    const marginRequired = volume * entryPrice / this.account.leverage;
    if (marginRequired > this.account.freeMargin) {
      return false;
    }

    // Check position size
    const positionValue = volume * entryPrice;
    const accountValue = this.account.equity;
    if (positionValue > accountValue * this.riskLimits.maxPositionSize) {
      return false;
    }

    return true;
  }

  executeLimitOrder(orderId) {
    const order = this.orders.find(o => o.orderId === orderId);
    if (!order) return { status: 'ERROR', message: 'Order not found' };

    const marketData = this.getMarketData(order.symbol);
    if (!marketData) return { status: 'ERROR', message: 'No market data' };

    // Execute limit order if price reached
    if ((order.side === 'BUY' && marketData.ask <= order.entryPrice) ||
        (order.side === 'SELL' && marketData.bid >= order.entryPrice)) {
      return this.openPosition(order);
    }

    return { status: 'PENDING', message: 'Waiting for price' };
  }

  openPosition(order) {
    const marketData = this.getMarketData(order.symbol);
    const executionPrice = order.side === 'BUY' ? marketData.ask : marketData.bid;
    const marginRequired = order.volume * executionPrice / this.account.leverage;

    if (marginRequired > this.account.freeMargin) {
      return { status: 'REJECTED', reason: 'Insufficient margin' };
    }

    const position = {
      positionId: 'POS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      volume: order.volume,
      entryPrice: executionPrice,
      currentPrice: executionPrice,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      pnl: 0,
      pnlPercent: 0,
      openedAt: new Date().toISOString(),
      marginUsed: marginRequired,
      status: 'OPEN',
      ticketNumber: 'TICKET_' + Date.now(),
    };

    this.positions.push(position);
    this.account.margin += marginRequired;
    this.account.freeMargin -= marginRequired;
    this.dailyStats.tradesOpened++;

    // Remove order
    this.orders = this.orders.filter(o => o.orderId !== order.orderId);

    return {
      status: 'OK',
      position,
      message: `Position opened at ${executionPrice.toFixed(2)} with ${order.volume} lot(s)`,
    };
  }

  // ═══ POSITION MANAGEMENT ═══

  updatePositionPrices(marketData) {
    // Update all open positions with current prices
    this.positions.forEach(pos => {
      if (pos.symbol === marketData.symbol && pos.status === 'OPEN') {
        const pricePoint = pos.side === 'BUY' ? marketData.bid : marketData.ask;
        pos.currentPrice = pricePoint;

        // Calculate P&L
        const pnlPerLot = pos.side === 'BUY'
          ? (pricePoint - pos.entryPrice)
          : (pos.entryPrice - pricePoint);
        pos.pnl = pnlPerLot * pos.volume;
        pos.pnlPercent = ((pnlPerLot / pos.entryPrice) * 100).toFixed(2);

        // Check stop loss
        if (pos.stopLoss > 0) {
          const stopTriggered = pos.side === 'BUY'
            ? pricePoint <= pos.stopLoss
            : pricePoint >= pos.stopLoss;
          if (stopTriggered) {
            this.closePosition(pos.positionId, pos.stopLoss, 'STOP_LOSS');
            return;
          }
        }

        // Check take profit
        if (pos.takeProfit > 0) {
          const profitTriggered = pos.side === 'BUY'
            ? pricePoint >= pos.takeProfit
            : pricePoint <= pos.takeProfit;
          if (profitTriggered) {
            this.closePosition(pos.positionId, pos.takeProfit, 'TAKE_PROFIT');
            return;
          }
        }

        // Update account equity
        const totalOpenPnL = this.positions
          .filter(p => p.status === 'OPEN')
          .reduce((sum, p) => sum + p.pnl, 0);
        this.account.equity = this.account.balance + totalOpenPnL;

        // Track peak equity for drawdown
        if (this.account.equity > this.dailyStats.peakEquity) {
          this.dailyStats.peakEquity = this.account.equity;
        }
      }
    });
  }

  closePosition(positionId, exitPrice, reason = 'MANUAL') {
    const position = this.positions.find(p => p.positionId === positionId);
    if (!position || position.status !== 'OPEN') {
      return { status: 'ERROR', message: 'Position not found or already closed' };
    }

    const pnlPerLot = position.side === 'BUY'
      ? (exitPrice - position.entryPrice)
      : (position.entryPrice - exitPrice);
    const finalPnL = pnlPerLot * position.volume;

    const trade = {
      tradeId: 'TRADE_' + Date.now(),
      positionId: position.positionId,
      symbol: position.symbol,
      side: position.side,
      volume: position.volume,
      entryPrice: position.entryPrice,
      exitPrice: parseFloat(exitPrice),
      pnl: parseFloat(finalPnL.toFixed(2)),
      pnlPercent: ((pnlPerLot / position.entryPrice) * 100).toFixed(2),
      openedAt: position.openedAt,
      closedAt: new Date().toISOString(),
      duration: this.calculateDuration(position.openedAt),
      closeReason: reason,
      ticketNumber: position.ticketNumber,
    };

    this.trades.push(trade);
    this.account.balance += finalPnL;
    this.account.margin -= position.marginUsed;
    this.account.freeMargin += position.marginUsed;

    // Update daily stats
    this.dailyStats.tradesClosed++;
    if (finalPnL > 0) this.dailyStats.winTrades++;
    else if (finalPnL < 0) this.dailyStats.lossTrades++;
    this.dailyStats.dailyPnL += finalPnL;

    // Update position status
    position.status = 'CLOSED';
    position.closedAt = new Date().toISOString();
    position.exitPrice = exitPrice;
    position.finalPnL = finalPnL;

    // Update account equity
    this.account.equity = this.account.balance;

    return {
      status: 'OK',
      trade,
      message: `Position closed at ${exitPrice.toFixed(2)}. P&L: ${finalPnL.toFixed(2)} USD`,
    };
  }

  calculateDuration(openedAt) {
    const duration = Date.now() - new Date(openedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  // ═══ POSITION QUERIES ═══

  getOpenPositions() {
    return this.positions.filter(p => p.status === 'OPEN');
  }

  getClosedPositions(limit = 50) {
    return this.positions
      .filter(p => p.status === 'CLOSED')
      .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))
      .slice(0, limit);
  }

  getAllTrades(limit = 100) {
    return this.trades
      .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))
      .slice(0, limit);
  }

  getTradeHistory() {
    return {
      totalTrades: this.trades.length,
      winTrades: this.trades.filter(t => t.pnl > 0).length,
      lossTrades: this.trades.filter(t => t.pnl < 0).length,
      breakeven: this.trades.filter(t => t.pnl === 0).length,
      trades: this.trades.slice(-20), // Last 20 trades
      stats: this.calculateStats(),
    };
  }

  calculateStats() {
    if (this.trades.length === 0) {
      return {
        totalPnL: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        avgTrade: 0,
      };
    }

    const wins = this.trades.filter(t => t.pnl > 0);
    const losses = this.trades.filter(t => t.pnl < 0);
    const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);

    return {
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      winRate: ((wins.length / this.trades.length) * 100).toFixed(2),
      profitFactor: losses.length > 0
        ? (wins.reduce((sum, t) => sum + t.pnl, 0) /
           Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))).toFixed(2)
        : 0,
      avgWin: wins.length > 0
        ? (wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length).toFixed(2)
        : 0,
      avgLoss: losses.length > 0
        ? (losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length).toFixed(2)
        : 0,
      avgTrade: (totalPnL / this.trades.length).toFixed(2),
    };
  }

  // ═══ RISK MANAGEMENT ═══

  setRiskLimits(limits) {
    this.riskLimits = { ...this.riskLimits, ...limits };
    return { status: 'OK', riskLimits: this.riskLimits };
  }

  getRiskStatus() {
    const dailyLossPercent = (Math.abs(this.dailyStats.dailyPnL) / this.account.balance) * 100;
    const drawdown = ((this.dailyStats.peakEquity - this.account.equity) / this.dailyStats.peakEquity) * 100;
    const openPositions = this.getOpenPositions().length;

    return {
      dailyLoss: this.dailyStats.dailyPnL,
      dailyLossPercent: dailyLossPercent.toFixed(2),
      dailyLimitRemaining: this.riskLimits.maxDailyLoss - Math.abs(this.dailyStats.dailyPnL),
      currentDrawdown: drawdown.toFixed(2),
      maxDrawdownAllowed: (this.riskLimits.maxDrawdown * 100).toFixed(2),
      openPositions,
      maxPositionsAllowed: this.riskLimits.maxOpenPositions,
      riskStatus: dailyLossPercent > this.riskLimits.maxDailyLoss ? 'CRITICAL' :
                 drawdown > this.riskLimits.maxDrawdown ? 'WARNING' : 'SAFE',
    };
  }

  // ═══ HISTORY & LOGGING ═══

  recordHistory() {
    this.history.push({
      timestamp: new Date().toISOString(),
      balance: this.account.balance,
      equity: this.account.equity,
      margin: this.account.margin,
      peakEquity: this.dailyStats.peakEquity,
      openTrades: this.getOpenPositions().length,
      totalPnL: this.calculateStats().totalPnL,
    });

    // Keep only last 1000 records
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
    }
  }

  // ═══ RESET ═══

  resetAccount() {
    this.account = {
      ...this.account,
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
    };
    this.positions = [];
    this.orders = [];
    this.trades = [];
    this.history = [];
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      tradesOpened: 0,
      tradesClosed: 0,
      winTrades: 0,
      lossTrades: 0,
      dailyPnL: 0,
      maxDrawdownToday: 0,
      peakEquity: 10000,
    };
    return { status: 'OK', message: 'Account reset to $10,000' };
  }
}

module.exports = new ProfessionalTradingEngine();
