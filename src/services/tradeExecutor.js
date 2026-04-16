// Trade Executor Service
// Executes approved trades on Binance (testnet or live)
// Limit orders only — never market orders

class TradeExecutor {
  constructor() {
    this.client = null;
    this.executionLog = [];
    this.initClient();
  }

  initClient() {
    try {
      const Binance = require('binance-api-node').default;
      this.client = Binance({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_SECRET,
        testnet: process.env.BINANCE_TESTNET === 'true',
      });
      console.log(`Binance client initialized (testnet: ${process.env.BINANCE_TESTNET === 'true'})`);
    } catch (error) {
      console.warn('Binance client not initialized:', error.message);
      console.warn('Trade execution will be simulated (demo mode).');
    }
  }

  async executeTrade(decision) {
    try {
      if (decision.approval_status !== 'APPROVED') {
        return { status: 'REJECTED', reason: decision.reasoning };
      }

      const { signal } = decision;
      if (!signal) return { status: 'REJECTED', reason: 'No signal in decision' };

      // Demo mode — simulate execution
      if (!this.client || process.env.MODE === 'DEMO') {
        return this.simulateExecution(decision);
      }

      // Live execution
      const { symbol, entry_price, position_size } = signal;
      const adjustedPrice = entry_price * 1.0005; // 0.05% slippage buffer

      const order = await this.client.order({
        symbol: symbol.replace('/', ''),
        side: decision.decision_type === 'BUY' ? 'BUY' : 'SELL',
        quantity: String(position_size),
        price: adjustedPrice.toFixed(2),
        type: 'LIMIT',
        timeInForce: 'GTC',
      });

      const execution = {
        timestamp: new Date().toISOString(),
        order_id: order.orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: parseFloat(order.origQty),
        price: parseFloat(order.price),
        status: order.status,
        slippage: ((adjustedPrice - entry_price) / entry_price * 100).toFixed(4) + '%',
      };

      this.executionLog.push(execution);
      return { status: 'EXECUTED', order, execution };
    } catch (error) {
      console.error('Trade execution failed:', error.message);
      return { status: 'FAILED', error: error.message };
    }
  }

  simulateExecution(decision) {
    const { signal } = decision;
    const slippage = (Math.random() * 0.002); // 0-0.2% random slippage
    const actualPrice = signal.entry_price * (1 + (decision.decision_type === 'BUY' ? slippage : -slippage));

    const execution = {
      timestamp: new Date().toISOString(),
      order_id: `DEMO_${Date.now()}`,
      symbol: signal.symbol,
      side: decision.decision_type,
      quantity: signal.position_size,
      target_price: signal.entry_price,
      actual_price: parseFloat(actualPrice.toFixed(2)),
      slippage: (slippage * 100).toFixed(4) + '%',
      status: 'FILLED',
      mode: 'DEMO',
    };

    this.executionLog.push(execution);
    return { status: 'EXECUTED', execution };
  }

  async getPortfolioBalance() {
    if (!this.client || process.env.MODE === 'DEMO') {
      return this.getDemoBalance();
    }

    try {
      const account = await this.client.accountInfo();
      const balances = {};
      for (const bal of account.balances) {
        const free = parseFloat(bal.free);
        const locked = parseFloat(bal.locked);
        if (free > 0 || locked > 0) {
          balances[bal.asset] = { free, locked, total: free + locked };
        }
      }
      return balances;
    } catch (error) {
      console.error('Failed to get portfolio balance:', error.message);
      return null;
    }
  }

  getDemoBalance() {
    const equity = parseFloat(process.env.INITIAL_EQUITY || 10000);
    return {
      USDT: { free: equity * 0.3, locked: 0, total: equity * 0.3 },
      BTC: { free: 0.05, locked: 0, total: 0.05 },
      ETH: { free: 0.25, locked: 0, total: 0.25 },
      SOL: { free: 1.5, locked: 0, total: 1.5 },
    };
  }

  async getOpenOrders() {
    if (!this.client || process.env.MODE === 'DEMO') return [];
    try {
      return await this.client.openOrders();
    } catch (error) {
      console.error('Failed to get open orders:', error.message);
      return [];
    }
  }

  getExecutionLog() {
    return this.executionLog;
  }

  getRecentExecutions(limit = 10) {
    return this.executionLog.slice(-limit);
  }
}

module.exports = new TradeExecutor();
