// METATRADER 5 CONNECTOR
// Live integration with MT5 for Forex trading
// Executes real trades on connected MT5 account

const axios = require('axios');

class MT5Connector {
  constructor() {
    this.connected = false;
    this.accountId = null;
    this.mt5Host = process.env.MT5_HOST || 'localhost:5000'; // Python mt5 bridge
    this.apiKey = process.env.MT5_API_KEY || '';
    this.demoMode = true;
    this.openTrades = new Map();
  }

  /**
   * Initialize MT5 connection
   */
  async connect() {
    try {
      const response = await axios.post(`http://${this.mt5Host}/api/connect`, {
        apiKey: this.apiKey,
        demoAccount: this.demoMode
      }, { timeout: 5000 });

      this.connected = response.data.connected;
      this.accountId = response.data.accountId;

      console.log(`[MT5] Connected to account: ${this.accountId} (Demo: ${this.demoMode})`);
      return { status: 'CONNECTED', accountId: this.accountId };
    } catch (error) {
      console.error('[MT5] Connection failed:', error.message);
      return { status: 'FAILED', reason: error.message };
    }
  }

  /**
   * Execute trade on MT5
   */
  async executeForexTrade(signal) {
    if (!this.connected) {
      return { status: 'ERROR', reason: 'Not connected to MT5' };
    }

    try {
      const orderRequest = {
        symbol: signal.symbol, // e.g., "EURUSD"
        side: signal.side, // BUY or SELL
        volume: signal.volume || 0.1,
        entryPrice: signal.entry_price,
        stopLoss: signal.stop_loss,
        takeProfit: signal.take_profit,
        slippage: 50, // max 50 pips slippage
        comment: signal.reason || 'Auto trade'
      };

      const response = await axios.post(`http://${this.mt5Host}/api/trade`, orderRequest, {
        timeout: 10000
      });

      if (response.data.status === 'EXECUTED') {
        const trade = {
          ticketId: response.data.ticketId,
          symbol: signal.symbol,
          side: signal.side,
          volume: signal.volume,
          entryPrice: response.data.entryPrice,
          stopLoss: signal.stop_loss,
          takeProfit: signal.take_profit,
          openTime: new Date().toISOString(),
          status: 'OPEN'
        };

        this.openTrades.set(response.data.ticketId, trade);
        return { status: 'EXECUTED', trade };
      }

      return { status: 'REJECTED', reason: response.data.reason };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Close trade on MT5
   */
  async closeForexTrade(ticketId, closePrice) {
    if (!this.connected) {
      return { status: 'ERROR', reason: 'Not connected to MT5' };
    }

    try {
      const response = await axios.post(`http://${this.mt5Host}/api/close`, {
        ticketId,
        closePrice,
        slippage: 50
      }, { timeout: 10000 });

      if (response.data.status === 'CLOSED') {
        const trade = this.openTrades.get(ticketId);
        if (trade) {
          trade.closePrice = closePrice;
          trade.closeTime = new Date().toISOString();
          trade.pnl = response.data.pnl;
          trade.pnlPercent = response.data.pnlPercent;
          trade.status = 'CLOSED';
        }

        return {
          status: 'CLOSED',
          ticketId,
          pnl: response.data.pnl,
          pnlPercent: response.data.pnlPercent
        };
      }

      return { status: 'FAILED', reason: response.data.reason };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Get account info from MT5
   */
  async getAccountInfo() {
    if (!this.connected) {
      return { status: 'ERROR', reason: 'Not connected to MT5' };
    }

    try {
      const response = await axios.get(`http://${this.mt5Host}/api/account`, {
        timeout: 5000
      });

      return {
        status: 'OK',
        balance: response.data.balance,
        equity: response.data.equity,
        margin: response.data.margin,
        marginFree: response.data.marginFree,
        marginLevel: response.data.marginLevel,
        trades: response.data.trades,
        positions: response.data.positions
      };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Get current prices on MT5
   */
  async getSymbolPrices(symbols) {
    if (!this.connected) {
      return { status: 'ERROR', reason: 'Not connected to MT5' };
    }

    try {
      const response = await axios.post(`http://${this.mt5Host}/api/prices`, {
        symbols: Array.isArray(symbols) ? symbols : [symbols]
      }, { timeout: 5000 });

      return {
        status: 'OK',
        prices: response.data.prices
      };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Get historical klines from MT5
   */
  async getSymbolKlines(symbol, timeframe, count = 100) {
    if (!this.connected) {
      return { status: 'ERROR', reason: 'Not connected to MT5' };
    }

    try {
      const response = await axios.post(`http://${this.mt5Host}/api/klines`, {
        symbol,
        timeframe,
        count
      }, { timeout: 10000 });

      return {
        status: 'OK',
        klines: response.data.klines
      };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Get open positions
   */
  async getOpenPositions() {
    return {
      status: 'OK',
      positions: Array.from(this.openTrades.values()).filter(t => t.status === 'OPEN')
    };
  }

  /**
   * Disconnect from MT5
   */
  async disconnect() {
    try {
      await axios.post(`http://${this.mt5Host}/api/disconnect`, {}, { timeout: 5000 });
      this.connected = false;
      console.log('[MT5] Disconnected');
      return { status: 'DISCONNECTED' };
    } catch (error) {
      return { status: 'ERROR', reason: error.message };
    }
  }

  /**
   * Switch between demo/live
   */
  async switchMode(demoMode) {
    this.demoMode = demoMode;
    return { status: 'OK', mode: demoMode ? 'DEMO' : 'LIVE' };
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = new MT5Connector();
