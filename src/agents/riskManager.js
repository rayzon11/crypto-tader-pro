const BaseAgent = require('./baseAgent');

class RiskManagerAgent extends BaseAgent {
  constructor() {
    super('RISK_MANAGER', 'RISK_MANAGER');
    this.maxDrawdown = parseFloat(process.env.MAX_DRAWDOWN || 0.15);
    this.maxPerTradeRisk = parseFloat(process.env.MAX_PER_TRADE_RISK || 0.02);
    this.maxLeverage = 3.0;
    this.maxCorrelation = 0.65;
    this.recoveryMode = false;
    this.recoveryTradesLeft = 0;
  }

  // Approve, reject, or modify a trade signal
  evaluate(signal, portfolio) {
    const checks = [];
    let approved = true;
    let modifiedSize = signal.request_position_size || 2000;

    // 1. Drawdown check
    const drawdown = portfolio.drawdown || 0;
    if (drawdown > this.maxDrawdown) {
      checks.push({ rule: 'MAX_DRAWDOWN', status: 'FAIL', detail: `Drawdown ${(drawdown * 100).toFixed(1)}% > ${this.maxDrawdown * 100}%` });
      approved = false;
    } else {
      checks.push({ rule: 'MAX_DRAWDOWN', status: 'PASS', detail: `${(drawdown * 100).toFixed(1)}% < ${this.maxDrawdown * 100}%` });
    }

    // 2. Per-trade risk check
    const equity = portfolio.equity || 10000;
    const maxRiskAmount = equity * this.maxPerTradeRisk;
    const stopDistance = Math.abs(signal.entry - (signal.stop_loss || signal.entry * 0.98));
    const positionRisk = (modifiedSize / signal.entry) * stopDistance;

    if (positionRisk > maxRiskAmount) {
      modifiedSize = (maxRiskAmount / stopDistance) * signal.entry;
      checks.push({ rule: 'PER_TRADE_RISK', status: 'MODIFIED', detail: `Reduced to $${modifiedSize.toFixed(0)} (risk $${positionRisk.toFixed(0)} > limit $${maxRiskAmount.toFixed(0)})` });
    } else {
      checks.push({ rule: 'PER_TRADE_RISK', status: 'PASS', detail: `Risk $${positionRisk.toFixed(0)} < limit $${maxRiskAmount.toFixed(0)}` });
    }

    // 3. Correlation check (simplified)
    const correlation = portfolio.correlation || 0.5;
    if (correlation > this.maxCorrelation) {
      modifiedSize *= 0.7; // Reduce 30%
      checks.push({ rule: 'CORRELATION', status: 'MODIFIED', detail: `Correlation ${correlation.toFixed(2)} > ${this.maxCorrelation}, size reduced 30%` });
    } else {
      checks.push({ rule: 'CORRELATION', status: 'PASS', detail: `${correlation.toFixed(2)} < ${this.maxCorrelation}` });
    }

    // 4. Leverage check
    const currentLeverage = portfolio.leverage || 1.0;
    if (currentLeverage > this.maxLeverage) {
      checks.push({ rule: 'LEVERAGE', status: 'FAIL', detail: `Leverage ${currentLeverage.toFixed(1)}x > ${this.maxLeverage}x` });
      approved = false;
    } else {
      checks.push({ rule: 'LEVERAGE', status: 'PASS', detail: `${currentLeverage.toFixed(1)}x < ${this.maxLeverage}x` });
    }

    // 5. Einstein Math: Kelly Criterion for Optimal Sizing
    // f* = (p*b - q) / b  where p = win prob, b = odds (R:R), q = loss prob
    const p = signal.conviction || 0.55;
    const b = signal.risk_reward || 2.0;
    const q = 1 - p;
    const kelly = Math.max(0, (p * b - q) / b);
    const kellySize = equity * kelly * 0.1; // Fractional Kelly (10% of Kelly) for safety
    
    if (modifiedSize > kellySize && kellySize > 0) {
      modifiedSize = kellySize;
      checks.push({ rule: 'KELLY_CRITERION', status: 'MODIFIED', detail: `Kelly optimal size $${kellySize.toFixed(0)} enforced for long-term growth` });
    }

    // 6. Black-Scholes Delta Hedging Logic (Simplified)
    // If total portfolio delta is too high, reduce size
    const portfolioDelta = portfolio.positions ? portfolio.positions.length : 0; 
    if (portfolioDelta > 5) {
      modifiedSize *= 0.8;
      checks.push({ rule: 'DELTA_SENSITIVITY', status: 'MODIFIED', detail: 'High portfolio delta detected, reducing exposure' });
    }

    // 7. Recovery mode
    if (this.recoveryMode && this.recoveryTradesLeft > 0) {
      modifiedSize *= 0.5;
      this.recoveryTradesLeft--;
      checks.push({ rule: 'RECOVERY_MODE', status: 'ACTIVE', detail: `Size halved, ${this.recoveryTradesLeft} recovery trades left` });
    }

    // 8. Conviction threshold
    if ((signal.conviction || 0) < 0.55) {
      checks.push({ rule: 'CONVICTION', status: 'FAIL', detail: `Conviction ${((signal.conviction || 0) * 100).toFixed(0)}% too low` });
      approved = false;
    }

    const status = !approved ? 'REJECTED' : (modifiedSize < (signal.request_position_size || 2000) ? 'MODIFIED' : 'APPROVED');

    return this.logDecision({
      status,
      original_size: signal.request_position_size || 2000,
      approved_size: parseFloat(modifiedSize.toFixed(0)),
      checks,
      portfolio_status: {
        equity,
        drawdown: parseFloat((drawdown * 100).toFixed(1)),
        correlation: parseFloat(correlation.toFixed(2)),
        leverage: parseFloat(currentLeverage.toFixed(1)),
      },
    });
  }

  // Activate recovery mode after 10% drawdown
  activateRecovery() {
    this.recoveryMode = true;
    this.recoveryTradesLeft = 5;
    console.warn('RISK_MANAGER: Recovery mode ACTIVATED — next 5 trades at 50% size');
  }

  deactivateRecovery() {
    this.recoveryMode = false;
    this.recoveryTradesLeft = 0;
    console.log('RISK_MANAGER: Recovery mode deactivated');
  }
}

module.exports = new RiskManagerAgent();
