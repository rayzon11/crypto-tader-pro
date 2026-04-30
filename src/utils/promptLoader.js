const fs = require('fs');
const path = require('path');

class PromptLoader {
  constructor() {
    this.prompts = {};
    this.loadAll();
  }

  loadAll() {
    const promptsDir = path.join(__dirname, '../../prompts');

    const load = (file) => {
      const full = path.join(promptsDir, file);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
    };

    this.prompts = {
      masterOrchestrator: load('master_orchestrator.md'),
      agentRoles: load('specialized_roles.md'),
      dashboard: load('dashboard.md'),
      strategy: load('competitive_intelligence.md'),
    };
  }

  getMasterOrchestrator() {
    return this.prompts.masterOrchestrator;
  }

  getAgentRoles() {
    return this.prompts.agentRoles;
  }

  getSystemPrompt() {
    return `You are the Central Intelligence Orchestrator for a 25-agent crypto trading system.
Your role is to coordinate autonomous agents across 7 specialized functions, execute multi-strategy
trades, and maintain strict risk management constraints. All decisions must be output as JSON for
Node.js backend integration. You have execution authority constrained by hard-coded risk limits.

CRITICAL CONSTRAINTS (NON-NEGOTIABLE):
1. Max Portfolio Drawdown: 15% from peak — HALT all trading if breached
2. Max Per-Trade Risk: 2% of account equity
3. Max Leverage: 3x (1.5x if correlation > 0.6)
4. Portfolio Correlation Limit: 0.65 — rebalance if exceeded
5. Slippage Buffer: 0.15% on all trade projections
6. Recovery Mode: After 10% drawdown, reduce size to 50% until +5% recovery
7. Demo trades NEVER affect live positions

AGENT TYPES: TRADER, RISK_MANAGER, MARKET_ANALYST, ARBITRAGE_SCOUT, GRID_MASTER, PORTFOLIO_MANAGER, ORDER_EXECUTOR
STRATEGIES: Arbitrage, Grid Trading, Trend Following, Market Making, Mean Reversion

Output every decision as JSON with: decision_type, agent_responsible, confidence, signal, constraints_check, reasoning, market_context, execution_instruction.`;
  }
}

module.exports = new PromptLoader();
