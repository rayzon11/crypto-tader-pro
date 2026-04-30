const BaseAgent = require('./baseAgent');

class OrderExecutorAgent extends BaseAgent {
  constructor() {
    super('ORDER_EXECUTOR', 'ORDER_EXECUTOR');
    this.fillRate = 0;
    this.avgSlippage = 0;
    this.totalOrders = 0;
    this.filledOrders = 0;
  }

  // Execute an approved order (called by tradeExecutor service)
  prepareOrder(signal, riskApproval) {
    if (riskApproval.status === 'REJECTED') {
      return this.logDecision({
        status: 'REJECTED',
        reason: 'Risk Manager rejected',
        signal,
      });
    }

    const positionSize = riskApproval.approved_size || signal.request_position_size || 1000;
    const entryPrice = signal.entry;
    const slippageBuffer = 0.0005; // 0.05%
    const limitPrice = signal.signal_type === 'BUY'
      ? entryPrice * (1 + slippageBuffer)
      : entryPrice * (1 - slippageBuffer);

    const quantity = positionSize / entryPrice;

    const orderParams = {
      symbol: signal.symbol,
      side: signal.signal_type,
      type: 'LIMIT',
      price: parseFloat(limitPrice.toFixed(2)),
      quantity: parseFloat(quantity.toFixed(6)),
      positionSize: parseFloat(positionSize.toFixed(2)),
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      time_in_force: 'GTC',
      timeout_seconds: 30,
    };

    return this.logDecision({
      status: 'PREPARED',
      order: orderParams,
      risk_approval: riskApproval.status,
    });
  }

  // Log execution result
  logExecution(result) {
    this.totalOrders++;
    if (result.status === 'FILLED' || result.status === 'EXECUTED') {
      this.filledOrders++;
    }
    this.fillRate = this.filledOrders / this.totalOrders;

    if (result.slippage) {
      const slipPct = parseFloat(result.slippage);
      this.avgSlippage = (this.avgSlippage * (this.totalOrders - 1) + slipPct) / this.totalOrders;
    }

    return this.logDecision({
      execution_result: result.status,
      fill_rate: parseFloat((this.fillRate * 100).toFixed(1)),
      avg_slippage: parseFloat(this.avgSlippage.toFixed(4)),
      total_orders: this.totalOrders,
      quality: this.avgSlippage < 0.1 ? 'EXCELLENT' : this.avgSlippage < 0.2 ? 'GOOD' : 'DEGRADED',
    });
  }

  getMetrics() {
    return {
      fill_rate: parseFloat((this.fillRate * 100).toFixed(1)),
      avg_slippage: parseFloat(this.avgSlippage.toFixed(4)),
      total_orders: this.totalOrders,
      filled_orders: this.filledOrders,
    };
  }
}

module.exports = new OrderExecutorAgent();
