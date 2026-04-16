require('dotenv').config();
const express = require('express');
const cors = require('cors');
const claudeOrchestrator = require('./services/claudeOrchestrator');
const marketDataFetcher = require('./services/marketDataFetcher');
const tradeExecutor = require('./services/tradeExecutor');
const { agents, getAllStatus, getAllDecisions } = require('./agents');
const riskCalculator = require('./utils/riskCalculator');
const performanceMetrics = require('./utils/performanceMetrics');

// NEW: Advanced trading systems
const metaOrchestrator = require('./services/metaOrchestrator');
const demoTradingEngine = require('./services/demoTradingEngine');
const tradeLogger = require('./services/tradeLogger');
const tradeExecutionPipeline = require('./services/tradeExecutionPipeline');
const backtester = require('./services/backtester');
const performanceAnalyzer = require('./services/performanceAnalyzer');
const strategyConfig = require('./services/strategyConfig');

const app = express();
app.use(express.json());
app.use(cors({ origin: ['http://localhost:3001', 'http://localhost:3002'] }));

const PORT = process.env.API_PORT || 3002;
const MODE = process.env.MODE || 'DEMO';
let tradingActive = MODE === 'LIVE' || MODE === 'LIVE_SMALL';

let portfolioState = {
  equity: parseFloat(process.env.INITIAL_EQUITY || 10000),
  positions: [],
  cash: parseFloat(process.env.INITIAL_EQUITY || 10000),
  mode: MODE,
  drawdown: 0,
  peakEquity: parseFloat(process.env.INITIAL_EQUITY || 10000),
  correlation: 0.5,
  leverage: 1.0,
};

let decisionLog = [];

// ─── Main Trading Loop (every 30s) ───
async function tradingLoop() {
  if (!tradingActive && MODE !== 'DEMO') return;

  try {
    const ts = new Date().toISOString();
    console.log(`[${ts}] Trading cycle started...`);

    // 1. Fetch market data
    const marketData = await marketDataFetcher.fetchRealTimeQuotes();
    if (!marketData) {
      console.warn('Market data fetch failed, skipping cycle');
      return;
    }

    // 2. Get portfolio balance
    const balance = await tradeExecutor.getPortfolioBalance();
    if (balance) portfolioState.positions = balance;

    // 3. Record equity for risk metrics
    riskCalculator.recordEquity(portfolioState.equity);
    portfolioState.drawdown = riskCalculator.currentDrawdown(portfolioState.equity);

    // 4. Check drawdown emergency brake
    if (portfolioState.drawdown > 0.15) {
      console.warn('EMERGENCY: Drawdown > 15% — halting all trading');
      tradingActive = false;
      return;
    }

    // 5. Activate recovery mode if needed
    if (portfolioState.drawdown > 0.10 && !agents.RISK_MANAGER.recoveryMode) {
      agents.RISK_MANAGER.activateRecovery();
    } else if (portfolioState.drawdown < 0.05 && agents.RISK_MANAGER.recoveryMode) {
      agents.RISK_MANAGER.deactivateRecovery();
    }

    // 6. Run Market Analyst scan (every cycle for demo, every 4H in prod)
    const btcKlines = await marketDataFetcher.fetchKlines('BTCUSDT', '4h', 200);
    const regime = agents.MARKET_ANALYST.detectRegime(btcKlines);
    console.log(`Market regime: ${regime}`);

    // 7. Check grid exits
    agents.GRID_MASTER.checkGridExits(marketData);

    // 8. Portfolio health check
    agents.PORTFOLIO_MANAGER.checkHealth(portfolioState.positions, portfolioState.equity);

    // 9. Arbitrage scan (every cycle)
    agents.ARBITRAGE_SCOUT.scanSpreads(marketData, null);

    // 10. Ask Claude orchestrator for main decision
    console.log('Requesting decision from Claude orchestrator...');
    const decision = await claudeOrchestrator.makeDecision(
      marketData,
      { ...portfolioState, regime, risk: riskCalculator.getMetrics(portfolioState.equity) },
      'SIGNAL'
    );

    // Log decision
    decisionLog.push({
      timestamp: ts,
      decision_type: decision.decision_type || 'HOLD',
      agent: decision.agent_responsible || 'ORCHESTRATOR',
      confidence: decision.confidence || 0,
      status: decision.approval_status || 'UNKNOWN',
      reasoning: decision.reasoning || '',
      regime,
    });
    if (decisionLog.length > 500) decisionLog = decisionLog.slice(-500);

    // 11. Risk Manager evaluation
    if (decision.signal && decision.approval_status !== 'REJECTED') {
      const riskApproval = agents.RISK_MANAGER.evaluate(decision.signal || decision, portfolioState);
      console.log(`Risk Manager: ${riskApproval.status}`);

      // 12. Execute if approved
      if (riskApproval.status !== 'REJECTED') {
        const orderPrep = agents.ORDER_EXECUTOR.prepareOrder(decision.signal || decision, riskApproval);
        console.log(`Order prepared: ${orderPrep.status}`);

        const execution = await tradeExecutor.executeTrade(decision);
        agents.ORDER_EXECUTOR.logExecution(execution);

        if (execution.status === 'EXECUTED') {
          console.log(`EXECUTED: ${decision.decision_type} ${decision.signal?.symbol || ''}`);
        }
      }
    } else {
      console.log(`Decision: ${decision.approval_status || 'HOLD'} — ${(decision.reasoning || 'No signal').substring(0, 80)}`);
    }
  } catch (error) {
    console.error('Trading loop error:', error.message);
  }
}

// ─── API Endpoints ───

app.get('/api/portfolio', (req, res) => {
  res.json({
    ...portfolioState,
    risk: riskCalculator.getMetrics(portfolioState.equity),
    performance: performanceMetrics.getMetrics(30),
  });
});

app.get('/api/agents', (req, res) => {
  res.json(getAllStatus());
});

app.get('/api/agents/decisions', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json({
    decisions: decisionLog.slice(-limit),
    agent_decisions: getAllDecisions(limit),
    total: decisionLog.length,
  });
});

app.get('/api/execution-log', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(tradeExecutor.getRecentExecutions(limit));
});

app.get('/api/market', async (req, res) => {
  const data = await marketDataFetcher.fetchRealTimeQuotes();
  res.json(data || { error: 'Failed to fetch' });
});

app.get('/api/risk', (req, res) => {
  res.json(riskCalculator.getMetrics(portfolioState.equity));
});

app.get('/api/performance', (req, res) => {
  const period = parseInt(req.query.period) || 30;
  res.json({
    overall: performanceMetrics.getMetrics(period),
    byStrategy: performanceMetrics.byStrategy(),
  });
});

app.get('/api/arbitrage', (req, res) => {
  res.json(agents.ARBITRAGE_SCOUT.getOpportunityStats());
});

app.get('/api/grids', (req, res) => {
  res.json(agents.GRID_MASTER.activeGrids);
});

app.post('/api/mode', (req, res) => {
  const { mode, initial_equity } = req.body;
  tradingActive = mode === 'LIVE' || mode === 'LIVE_SMALL';
  portfolioState.mode = mode;
  if (initial_equity) {
    portfolioState.equity = initial_equity;
    portfolioState.cash = initial_equity;
    portfolioState.peakEquity = initial_equity;
  }
  res.json({ status: 'OK', mode, equity: portfolioState.equity });
});

app.post('/api/emergency-stop', (req, res) => {
  tradingActive = false;
  console.warn('EMERGENCY STOP activated');
  res.json({ status: 'HALTED', message: 'All trading stopped', timestamp: new Date().toISOString() });
});

app.post('/api/resume', (req, res) => {
  if (portfolioState.drawdown > 0.15) {
    return res.json({ status: 'BLOCKED', message: 'Cannot resume: drawdown > 15%. Reduce positions first.' });
  }
  tradingActive = true;
  console.log('Trading resumed');
  res.json({ status: 'ACTIVE', message: 'Trading resumed' });
});

app.get('/api/status', (req, res) => {
  res.json({
    mode: portfolioState.mode,
    tradingActive,
    equity: portfolioState.equity,
    drawdown: parseFloat((portfolioState.drawdown * 100).toFixed(2)),
    decisions: decisionLog.length,
    executions: tradeExecutor.getExecutionLog().length,
    agents: getAllStatus().length,
    recoveryMode: agents.RISK_MANAGER.recoveryMode,
    uptime: process.uptime(),
  });
});

// ═════════════════════════════════════════════════════════════
// NEW: DEMO TRADING ENGINE ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.get('/api/demo/account', (req, res) => {
  const stats = demoTradingEngine.getAccountStats();
  res.json({
    status: 'OK',
    account: {
      balance: portfolioState.balance,
      equity: stats.equity,
      cash: stats.cash,
      pnl: stats.totalPnL,
      openTrades: stats.openTrades,
      closedTrades: stats.closedTrades,
      winRate: stats.winRate,
      maxDrawdown: stats.maxDrawdown,
      profitFactor: stats.profitFactor,
      totalTradesExecuted: stats.totalTradesExecuted
    }
  });
});

app.get('/api/demo/open-trades', (req, res) => {
  const openTrades = demoTradingEngine.getOpenTrades();
  res.json({
    status: 'OK',
    count: openTrades.length,
    trades: openTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice,
      pnl: t.pnl,
      pnlPercent: t.pnlPercent,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      openTime: t.entryTime,
      agent: t.agent
    }))
  });
});

app.get('/api/demo/closed-trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const closedTrades = demoTradingEngine.getClosedTrades(limit);
  res.json({
    status: 'OK',
    count: closedTrades.length,
    trades: closedTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      pnl: t.pnl,
      pnlPercent: t.pnlPercent,
      openTime: t.entryTime,
      closeTime: t.exitTime,
      reason: t.exitReason
    }))
  });
});

app.post('/api/demo/reset', (req, res) => {
  const initialBalance = req.body.initialBalance || 10000;
  demoTradingEngine.resetDemoAccount(initialBalance);
  res.json({
    status: 'RESET',
    initialBalance,
    timestamp: new Date().toISOString()
  });
});

// ═════════════════════════════════════════════════════════════
// NEW: EXECUTION PIPELINE ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.get('/api/execution/stats', (req, res) => {
  const stats = tradeExecutionPipeline.getExecutionStats();
  res.json({
    status: 'OK',
    stats
  });
});

app.get('/api/execution/blocked-trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json({
    status: 'OK',
    blockedTrades: tradeExecutionPipeline.blockedTrades.slice(-limit)
  });
});

app.post('/api/execution/force-trades', (req, res) => {
  const enable = req.body.enable !== false;
  if (enable) {
    tradeExecutionPipeline.enableForceTrades();
    res.json({ status: 'FORCE_TRADES_ENABLED', message: 'Will execute ALL signals' });
  } else {
    tradeExecutionPipeline.disableForceTrades();
    res.json({ status: 'FORCE_TRADES_DISABLED', message: 'Normal validation enabled' });
  }
});

// ═════════════════════════════════════════════════════════════
// NEW: META ORCHESTRATOR ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.get('/api/meta/status', (req, res) => {
  const status = metaOrchestrator.getStatus();
  res.json({
    status: 'OK',
    orchestrator: status
  });
});

app.post('/api/meta/reset-daily', (req, res) => {
  metaOrchestrator.resetDailyCounters();
  res.json({
    status: 'RESET',
    message: 'Daily trade counters reset',
    timestamp: new Date().toISOString()
  });
});

// ═════════════════════════════════════════════════════════════
// NEW: TRADE LOGGER ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.get('/api/logs/trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const recentTrades = tradeLogger.getRecentTrades(limit);
  res.json({
    status: 'OK',
    count: recentTrades.length,
    trades: recentTrades
  });
});

app.get('/api/logs/report', (req, res) => {
  const report = tradeLogger.generateDailyReport();
  res.json({
    status: 'OK',
    report
  });
});

app.get('/api/logs/blocked-reasons', (req, res) => {
  const analysis = tradeLogger.getBlockedTradesAnalysis();
  res.json({
    status: 'OK',
    blockedReasons: analysis
  });
});

// ═════════════════════════════════════════════════════════════
// NEW: BACKTESTING ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.post('/api/backtest/run', async (req, res) => {
  const { strategyName, agentType, historicalData, config } = req.body;

  if (!strategyName || !agentType || !historicalData || historicalData.length < 100) {
    return res.status(400).json({
      status: 'ERROR',
      reason: 'Need: strategyName, agentType, historicalData (100+ points)'
    });
  }

  const result = await backtester.backtest(strategyName, agentType, historicalData, config || {});
  res.json({ status: 'OK', result });
});

app.get('/api/backtest/results', (req, res) => {
  const results = backtester.getResults();
  res.json({
    status: 'OK',
    totalBacktests: results.length,
    results: results.slice(0, 20) // Last 20
  });
});

app.get('/api/backtest/comparison', (req, res) => {
  const comparison = backtester.compareAgents();
  res.json({
    status: 'OK',
    comparison,
    bestAgent: comparison[0]?.agent,
    bestWinRate: comparison[0]?.winRate
  });
});

// ═════════════════════════════════════════════════════════════
// NEW: PERFORMANCE ANALYSIS ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.post('/api/analysis/trades', async (req, res) => {
  const { trades } = req.body;

  if (!trades || !Array.isArray(trades) || trades.length === 0) {
    return res.status(400).json({
      status: 'ERROR',
      reason: 'Need array of trades with pnl field'
    });
  }

  const metrics = await performanceAnalyzer.analyzeTrades(trades);
  res.json({
    status: 'OK',
    metrics,
    report: performanceAnalyzer.generateReport(metrics)
  });
});

app.get('/api/analysis/demo', async (req, res) => {
  const closedTrades = demoTradingEngine.getClosedTrades();
  const metrics = await performanceAnalyzer.analyzeTrades(
    closedTrades.map(t => ({ pnl: t.pnl }))
  );

  res.json({
    status: 'OK',
    metrics,
    report: performanceAnalyzer.generateReport(metrics)
  });
});

app.post('/api/analysis/compare', (req, res) => {
  const { metrics1, metrics2 } = req.body;

  if (!metrics1 || !metrics2) {
    return res.status(400).json({
      status: 'ERROR',
      reason: 'Need metrics1 and metrics2 objects'
    });
  }

  const comparison = performanceAnalyzer.compare(metrics1, metrics2);
  res.json({
    status: 'OK',
    comparison
  });
});

// ═════════════════════════════════════════════════════════════
// NEW: STRATEGY CONFIGURATION ENDPOINTS
// ═════════════════════════════════════════════════════════════

app.get('/api/strategies', (req, res) => {
  const strategies = strategyConfig.listStrategies();
  res.json({
    status: 'OK',
    count: strategies.length,
    strategies
  });
});

app.get('/api/strategies/:name', (req, res) => {
  const strategy = strategyConfig.getStrategy(req.params.name);
  if (!strategy) {
    return res.status(404).json({ error: 'Strategy not found' });
  }

  const params = strategyConfig.getParameters(req.params.name);
  res.json({
    status: 'OK',
    strategy: req.params.name,
    name: strategy.name,
    type: strategy.type,
    agent: strategy.agent,
    enabled: strategy.enabled,
    parameters: params
  });
});

app.post('/api/strategies/:name/parameter', (req, res) => {
  const { paramName, value } = req.body;

  if (!paramName || value === undefined) {
    return res.status(400).json({
      status: 'ERROR',
      reason: 'Need paramName and value'
    });
  }

  const result = strategyConfig.updateParameter(req.params.name, paramName, value);
  res.json(result);
});

app.get('/api/strategies/:name/parameters', (req, res) => {
  const params = strategyConfig.getParameters(req.params.name);
  if (!params) {
    return res.status(404).json({ error: 'Strategy not found' });
  }

  res.json({
    status: 'OK',
    strategy: req.params.name,
    parameters: params
  });
});

app.post('/api/strategies/:name/reset', (req, res) => {
  const result = strategyConfig.resetStrategy(req.params.name);
  res.json(result);
});

app.post('/api/strategies/:name/toggle', (req, res) => {
  const { enabled } = req.body;

  if (enabled === undefined) {
    return res.status(400).json({
      status: 'ERROR',
      reason: 'Need enabled boolean'
    });
  }

  const result = strategyConfig.toggleStrategy(req.params.name, enabled);
  res.json(result);
});

app.get('/api/strategies/:name/recommended', (req, res) => {
  const regime = req.query.regime || 'RANGING';
  const recommended = strategyConfig.getRecommendedParams(req.params.name, regime);

  if (!recommended) {
    return res.status(404).json({ error: 'Strategy not found' });
  }

  res.json({
    status: 'OK',
    strategy: req.params.name,
    regime,
    recommended
  });
});

app.post('/api/strategies/:name/suggestions', (req, res) => {
  const { backtestResults } = req.body;

  if (!backtestResults) {
    return res.status(400).json({
      status: 'ERROR',
      reason: 'Need backtestResults object'
    });
  }

  const suggestions = strategyConfig.getSuggestions(req.params.name, backtestResults);

  if (!suggestions) {
    return res.status(404).json({ error: 'Strategy not found' });
  }

  res.json({
    status: 'OK',
    strategy: req.params.name,
    suggestions
  });
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║   CryptoTrader Pro — 25-Agent System          ║`);
  console.log(`╠═══════════════════════════════════════════════╣`);
  console.log(`║  Port:     ${PORT}                              ║`);
  console.log(`║  Mode:     ${MODE.padEnd(10)}                     ║`);
  console.log(`║  Equity:   $${portfolioState.equity.toLocaleString().padEnd(8)}                   ║`);
  console.log(`║  Trading:  ${tradingActive ? 'ACTIVE' : 'PAUSED'}                        ║`);
  console.log(`║  Agents:   7 types (25 instances)              ║`);
  console.log(`║  Strategies: 5 active                          ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);

  console.log('Agents loaded:', Object.keys(agents).join(', '));
  console.log('Risk limits: 15% max drawdown, 2% per-trade, 3x max leverage');
  console.log('');

  // Start trading loop (every 30 seconds)
  setInterval(tradingLoop, 30000);

  // Initial run after 2 second warmup
  setTimeout(tradingLoop, 2000);

  // ─── ADVANCED: Meta-Orchestrator Trading Loop ───
  // This is the NEW improved trading system that actually executes trades
  console.log('\n[SYSTEM] Starting Meta-Orchestrator (25-agent coordination system)...\n');

  async function metaOrchestratorLoop() {
    try {
      const marketData = await marketDataFetcher.fetchRealTimeQuotes();
      if (!marketData) return;

      const balance = await tradeExecutor.getPortfolioBalance();
      const portfolio = {
        equity: portfolioState.equity,
        positions: portfolioState.positions,
        drawdownPercent: portfolioState.drawdown,
        risk: riskCalculator.getMetrics(portfolioState.equity)
      };

      // Run meta orchestrator
      const result = await metaOrchestrator.orchestrateTrading(marketData, portfolio, MODE);

      // Update portfolio state
      const demoStats = demoTradingEngine.getAccountStats();
      portfolioState.equity = demoStats.equity;
      portfolioState.pnl = demoStats.totalPnL;

    } catch (error) {
      console.error('[META] Loop error:', error.message);
    }
  }

  // Run meta orchestrator every 30 seconds
  setInterval(metaOrchestratorLoop, 30000);
  setTimeout(metaOrchestratorLoop, 1000);

  // ─── PROFESSIONAL TRADING ENGINE ENDPOINTS ───
  console.log('[PROFESSIONAL] Initializing professional trading system...');

  // Get account info
  app.get('/api/professional/account', (req, res) => {
    const accountInfo = require('./services/professionalTradingEngine').getAccountInfo();
    res.json({ status: 'OK', data: accountInfo });
  });

  // Get equity chart
  app.get('/api/professional/equity-chart', (req, res) => {
    const chart = require('./services/professionalTradingEngine').getEquityChart();
    res.json({ status: 'OK', data: chart });
  });

  // Create order (MARKET, LIMIT, STOP)
  app.post('/api/professional/order', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const result = engine.createOrder(req.body);
    res.json(result);
  });

  // Execute limit order
  app.post('/api/professional/order/:orderId/execute', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const result = engine.executeLimitOrder(req.params.orderId);
    res.json(result);
  });

  // Get open positions
  app.get('/api/professional/positions', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const positions = engine.getOpenPositions();
    res.json({ status: 'OK', data: positions, count: positions.length });
  });

  // Close position
  app.post('/api/professional/position/:positionId/close', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const { exitPrice, reason } = req.body;
    const result = engine.closePosition(req.params.positionId, exitPrice, reason);
    res.json(result);
  });

  // Update market data
  app.post('/api/professional/market/:symbol', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const { price, bid, ask, spread } = req.body;
    const result = engine.updateMarketData(req.params.symbol, price, bid, ask, spread);
    // Also update open positions
    engine.updatePositionPrices(result);
    res.json({ status: 'OK', data: result });
  });

  // Get trade history
  app.get('/api/professional/trades', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const history = engine.getTradeHistory();
    res.json({ status: 'OK', data: history });
  });

  // Get risk status
  app.get('/api/professional/risk', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const risk = engine.getRiskStatus();
    res.json({ status: 'OK', data: risk });
  });

  // Set risk limits
  app.post('/api/professional/risk-limits', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const result = engine.setRiskLimits(req.body);
    res.json(result);
  });

  // Record history snapshot
  app.post('/api/professional/record-snapshot', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    engine.recordHistory();
    res.json({ status: 'OK', message: 'Snapshot recorded' });
  });

  // Reset account
  app.post('/api/professional/reset', (req, res) => {
    const engine = require('./services/professionalTradingEngine');
    const result = engine.resetAccount();
    res.json(result);
  });
});

module.exports = app;
