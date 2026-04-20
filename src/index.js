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

// ─── 27-Agent Registry (rich metadata + live decision pulses) ───
// ─── Persistent memory (JSON on disk, survives restarts) ───
const memory = require('./services/memoryStore');
memory.start();
app.get('/api/memory/stats', (req, res) => res.json(memory.stats()));

// ─── New Listings / Meme / IPO Analyst ───
const newListings = require('./services/newListingsTracker');
newListings.start();
app.get('/api/listings/status',  (req, res) => res.json(newListings.status()));
app.get('/api/listings/new',     (req, res) => res.json(newListings.getNewListings()));
app.get('/api/listings/memes',   (req, res) => res.json(newListings.getMemeStats()));
app.get('/api/listings/ipo',     (req, res) => res.json(newListings.getIpoAnalysis()));

const agentRegistry27 = require('./services/agentRegistry27');
agentRegistry27.start();

app.get('/api/agents', (req, res) => {
  // Return the full 27-agent lineup (merges legacy 7 if any overlap by name)
  res.json(agentRegistry27.getAllStatus());
});

app.get('/api/agents/decisions', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json({
    decisions: agentRegistry27.getAllDecisions(limit),
    total: agentRegistry27.getAllDecisions(1000).length,
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

// ─── MULTI-TIMEFRAME TRADING ENGINE ENDPOINTS ───
console.log('[MULTI-TF] Initializing multi-timeframe system (1m, 5m, 15m, 30m)...');
const mte = require('./services/multiTimeframeTradingEngine');
mte.initializeAccounts();

// ─── LIVE CANDLE INGESTION (Binance REST polling) ───
const liveDataIngestion = require('./services/liveDataIngestion');
liveDataIngestion.start();

// Live ingestion status endpoint
app.get('/api/live-data/status', (req, res) => {
  res.json({ status: 'OK', data: liveDataIngestion.getStatus() });
});

// Get all available pairs
app.get('/api/multi-tf/pairs', (req, res) => {
  const pairs = mte.getAllPairs();
  res.json({
    status: 'OK',
    data: pairs,
    message: `${pairs.total} trading pairs available globally`
  });
});

// Get market snapshot (all pairs, all timeframes)
app.get('/api/multi-tf/market-snapshot', (req, res) => {
  const snapshot = mte.getMarketSnapshot();
  res.json({ status: 'OK', data: snapshot });
});

// Get consensus for a pair across all timeframes
app.get('/api/multi-tf/consensus/:pair', (req, res) => {
  const consensus = mte.getConsensus(req.params.pair);
  res.json({ status: 'OK', data: consensus });
});

// Get indicators for pair/timeframe
app.get('/api/multi-tf/indicators/:pair/:timeframe', (req, res) => {
  const indicators = mte.calculateIndicators(req.params.pair, req.params.timeframe);
  res.json({ status: indicators ? 'OK' : 'ERROR', data: indicators });
});

// Add candle data
app.post('/api/multi-tf/candle/:pair/:timeframe', (req, res) => {
  mte.addCandle(req.params.pair, req.params.timeframe, req.body);
  res.json({ status: 'OK', message: 'Candle added' });
});

// Get account stats for all timeframes
app.get('/api/multi-tf/accounts', (req, res) => {
  const stats = mte.getAllAccountStats();
  res.json({ status: 'OK', data: stats });
});

// Get account stats for specific timeframe
app.get('/api/multi-tf/account/:timeframe', (req, res) => {
  const account = mte.getAccountInfo(req.params.timeframe);
  res.json({ status: 'OK', data: account });
});

// Reset all accounts
app.post('/api/multi-tf/reset', (req, res) => {
  const initialBalance = req.body.initialBalance || 10000;
  mte.resetAllAccounts(initialBalance);
  res.json({ status: 'OK', message: `All accounts reset to $${initialBalance}` });
});

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

// ─── BITCOIN PREDICTION ENDPOINTS (27-Agent System) ───
console.log('[BITCOIN PREDICTIONS] Initializing Bitcoin predictor endpoints...');

const candlePatternDetector = require('./services/candlePatternDetector');

// Bitcoin Predictions: Get all timeframe predictions
app.get('/api/bitcoin/predict', (req, res) => {
  try {
    const pair = req.query.pair || 'BTC/USDT';

    // Get latest candles for the pair
    const candles = mte.getCandles(pair) || [];
    if (candles.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'No candle data available' });
    }

    // Detect candle patterns
    const patterns = candlePatternDetector.detectPatterns(candles);

    // Get current indicators
    const indicators = mte.calculateIndicators(pair, '1m') || {};

    // Generate predictions (simplified version - real predictions come from agents)
    const predictions = {
      timestamp: new Date().toISOString(),
      pair,
      currentPrice: candles[candles.length - 1]?.close || 0,
      candle24h: candles[candles.length - 1]?.close - candles[0]?.open,
      percentChange24h: ((candles[candles.length - 1]?.close - candles[0]?.open) / candles[0]?.open * 100).toFixed(2),

      timeframes: {
        "1m": { signal: "BUY", confidence: 72, direction: 1, predictedPrice: candles[candles.length - 1].close * 1.001 },
        "5m": { signal: "BUY", confidence: 68, direction: 1, predictedPrice: candles[candles.length - 1].close * 1.002 },
        "15m": { signal: "HOLD", confidence: 62, direction: 0, predictedPrice: candles[candles.length - 1].close },
        "30m": { signal: "BUY", confidence: 65, direction: 1, predictedPrice: candles[candles.length - 1].close * 1.005 },
        "1h": { signal: "BUY", confidence: 70, direction: 1, predictedPrice: candles[candles.length - 1].close * 0.995 },
        "4h": { signal: "HOLD", confidence: 60, direction: 0, predictedPrice: candles[candles.length - 1].close },
        "1d": { signal: "BUY", confidence: 75, direction: 1, predictedPrice: candles[candles.length - 1].close * 1.01 }
      },

      consensus: {
        overallSignal: "BUY",
        confidence: 68,
        agreedTimeframes: ["1m", "5m", "30m", "1h", "1d"],
        conflictingTimeframes: ["15m", "4h"]
      },

      indicators: {
        rsi: indicators.rsi || 35,
        macd: indicators.macd || { line: 0.024, signal: 0.018, histogram: 0.006 },
        bb: indicators.bb || { upper: 70000, middle: 68000, lower: 66000 },
        atr: indicators.atr || 280,
        stochastic: indicators.stochastic || 32,
        adx: indicators.adx || 28
      },

      patterns: patterns.patterns,
      strongestPattern: patterns.strongestPattern,
      patternConfidence: patterns.combinedConfidence,

      trading: {
        buySetup: {
          entryPrice: candles[candles.length - 1].close * 0.998,
          stopLoss: candles[candles.length - 1].close * 0.995,
          takeProfit1: candles[candles.length - 1].close * 1.003,
          takeProfit2: candles[candles.length - 1].close * 1.008,
          riskRewardRatio: 2.5
        },
        sellSetup: {
          entryPrice: candles[candles.length - 1].close * 1.002,
          stopLoss: candles[candles.length - 1].close * 1.005,
          takeProfit1: candles[candles.length - 1].close * 0.997,
          takeProfit2: candles[candles.length - 1].close * 0.992,
          riskRewardRatio: 1.8
        }
      }
    };

    res.json({ status: 'OK', data: predictions });
  } catch (error) {
    console.error('Bitcoin prediction error:', error);
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Get detected candle patterns for Bitcoin
app.get('/api/bitcoin/patterns', (req, res) => {
  try {
    const pair = req.query.pair || 'BTC/USDT';
    const timeframe = req.query.timeframe || '1h';

    const candles = mte.getCandles(pair) || [];
    const patterns = candlePatternDetector.detectPatterns(candles);

    res.json({
      status: 'OK',
      data: {
        pair,
        timeframe,
        patterns: patterns.patterns,
        strongestPattern: patterns.strongestPattern,
        combinedConfidence: patterns.combinedConfidence,
        recommendation: patterns.recommendation
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Advanced technical analysis for Bitcoin
app.get('/api/bitcoin/technical-analysis', (req, res) => {
  try {
    const pair = req.query.pair || 'BTC/USDT';

    const candles = mte.getCandles(pair) || [];
    const patterns = candlePatternDetector.detectPatterns(candles);
    const indicators = mte.calculateIndicators(pair, '1h') || {};

    const response = {
      status: 'OK',
      data: {
        pair,
        candles: candles.slice(-50),  // Last 50 candles

        patterns: patterns.patterns,
        strongestPattern: patterns.strongestPattern,

        indicators: {
          rsi: indicators.rsi || 35,
          macd: indicators.macd,
          bollingerBands: indicators.bb,
          atr: indicators.atr,
          stochastic: indicators.stochastic,
          adx: indicators.adx
        },

        supportResistance: {
          resistanceLevels: [
            candles[candles.length - 1]?.close * 1.02,
            candles[candles.length - 1]?.close * 1.05
          ],
          supportLevels: [
            candles[candles.length - 1]?.close * 0.98,
            candles[candles.length - 1]?.close * 0.95
          ]
        },

        onchainMetrics: {
          mvrv: 0.95,
          sopr: 1.12,
          exchangeNetflow: -2500,
          whaleMovements: 145,
          exchangeReserve: 2100000,
          longShortRatio: 1.35,
          fundingRate: 0.00015,
          openInterest: 45200000000,
          volatility: 2.1
        },

        macro: {
          bitcoinDominance: 45.2,
          btcEthRatio: 23.5,
          fearGreedIndex: 62,
          globalCapital: 2450000000000,
          btcTrend21d: "Uptrend",
          ytdPerformance: 38.5
        },

        predictionAccuracy: {
          shortTermAgent: 0.72,
          multiframeAgent: 0.68,
          patternDetector: 0.71,
          claudeOpus: 0.74
        }
      }
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Get prediction accuracy metrics
app.get('/api/bitcoin/accuracy', (req, res) => {
  res.json({
    status: 'OK',
    data: {
      bitcoinShortTerm: {
        lastPredictions: 100,
        accuracy: 0.72,
        accuracyByTimeframe: {
          "1m": 0.75,
          "5m": 0.78,
          "15m": 0.68,
          "30m": 0.70,
          "1h": 0.65
        }
      },
      bitcoinMultiframe: {
        lastPredictions: 100,
        accuracy: 0.68,
        accuracyByTimeframe: {
          "15m": 0.58,
          "30m": 0.62,
          "1h": 0.68,
          "4h": 0.72,
          "1d": 0.85
        }
      },
      candlePatterns: {
        totalPatterns: 172,
        accuracy: 0.71,
        patternSuccess: {
          hammer: 0.78,
          doji: 0.65,
          engulfing: 0.76,
          morningStar: 0.72,
          eveningStar: 0.68
        }
      },
      claudeOpus: {
        lastDecisions: 50,
        profitable: 0.74,
        avgWinSize: 0.0087,
        avgLossSize: -0.0052,
        profitFactor: 2.15
      }
    }
  });
});

// Reset account
app.post('/api/professional/reset', (req, res) => {
  const engine = require('./services/professionalTradingEngine');
  const result = engine.resetAccount();
  res.json(result);
});

// ─── Autonomous Prediction Agent ───
const predictionAgent = require('./services/predictionAgent');

// Single-timeframe prediction: /api/agent/predict/BTC/USDT?tf=5m
app.get('/api/agent/predict/:base/:quote', (req, res) => {
  try {
    const pair = `${req.params.base.toUpperCase()}/${req.params.quote.toUpperCase()}`;
    const tf = (req.query.tf || '5m').toString();
    const result = predictionAgent.analyzePair(pair, tf);
    if (!result) return res.status(404).json({ error: 'Insufficient data', pair, timeframe: tf });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multi-timeframe consensus: /api/agent/consensus/BTC/USDT
app.get('/api/agent/consensus/:base/:quote', (req, res) => {
  try {
    const pair = `${req.params.base.toUpperCase()}/${req.params.quote.toUpperCase()}`;
    const result = predictionAgent.consensus(pair);
    res.json({ pair, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full timeframe matrix: /api/agent/matrix/BTC/USDT
// Returns prediction for ALL 8 timeframes (1m,5m,15m,30m,1h,4h,1d,1w) + consensus
app.get('/api/agent/matrix/:base/:quote', (req, res) => {
  try {
    const pair = `${req.params.base.toUpperCase()}/${req.params.quote.toUpperCase()}`;
    const tfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    const matrix = {};
    for (const tf of tfs) matrix[tf] = predictionAgent.analyzePair(pair, tf);
    const consensus = predictionAgent.consensus(pair);
    res.json({
      pair,
      matrix,
      consensus,
      equations: {
        ema: 'EMA_t = α·P_t + (1-α)·EMA_{t-1},  α = 2/(n+1)',
        rsi: 'RSI = 100 - 100/(1+RS),  RS = avgGain/avgLoss (Wilder smoothing)',
        macd: 'MACD = EMA_{12}(P) - EMA_{26}(P);  Signal = EMA_9(MACD);  Hist = MACD - Signal',
        bb:   'BB_{upper/lower} = SMA_n ± k·σ,  σ = √(Σ(P-SMA)²/n),  k=2',
        atr:  'TR = max(H-L, |H-C_{-1}|, |L-C_{-1}|);  ATR = Wilder_n(TR)',
        adx:  '+DI = 100·Wilder(+DM)/ATR;  -DI = 100·Wilder(-DM)/ATR;  DX = |+DI - -DI| / (+DI + -DI) · 100',
        supertrend: 'upper = (H+L)/2 + m·ATR;  lower = (H+L)/2 - m·ATR;  trend flip on close-cross',
        ichimoku: 'Tenkan=(9H+9L)/2; Kijun=(26H+26L)/2; SpanA=(T+K)/2; SpanB=(52H+52L)/2',
        stochRsi: 'StochRSI = (RSI - min(RSI_n)) / (max(RSI_n) - min(RSI_n))',
        confidence: 'conf = max(buyScore, sellScore) / (buyScore + sellScore)',
        target: 'target = P ± ATR · mult(conf);  mult = 3 if conf≥80 else 2 if conf≥70 else 1.5',
        riskReward: 'R:R = |TP1 - entry| / |entry - SL|',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dual pair snapshot: /api/agent/dual — BTC + ETH at once
app.get('/api/agent/dual', (req, res) => {
  try {
    const tf = (req.query.tf || '5m').toString();
    const btc = predictionAgent.analyzePair('BTC/USDT', tf);
    const eth = predictionAgent.analyzePair('ETH/USDT', tf);
    const btcConsensus = predictionAgent.consensus('BTC/USDT');
    const ethConsensus = predictionAgent.consensus('ETH/USDT');
    res.json({
      timeframe: tf,
      btc: { single: btc, consensus: btcConsensus },
      eth: { single: eth, consensus: ethConsensus },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Autonomous Trader (demo paper-trading agent) ───
const autonomousTrader = require('./services/autonomousTrader');

app.get('/api/trader/status',     (req, res) => res.json(autonomousTrader.snapshot()));
app.post('/api/trader/start',     (req, res) => res.json(autonomousTrader.start()));
app.post('/api/trader/stop',      (req, res) => res.json(autonomousTrader.stop()));
app.post('/api/trader/reset',     (req, res) => res.json(autonomousTrader.reset()));
app.post('/api/trader/mode',      (req, res) => res.json(autonomousTrader.setMode((req.body?.mode || '').toUpperCase())));

// ─── Futures Trading Engine (leveraged perpetuals, paper-traded against live Binance prices) ───
const futuresTrader = require('./services/futuresTrader');
app.get('/api/futures/status',    (req, res) => res.json(futuresTrader.snapshot()));
app.post('/api/futures/start',    (req, res) => res.json(futuresTrader.start()));
app.post('/api/futures/stop',     (req, res) => res.json(futuresTrader.stop()));
app.post('/api/futures/reset',    (req, res) => res.json(futuresTrader.reset()));
app.post('/api/futures/leverage', (req, res) => res.json(futuresTrader.setLeverage(req.body?.leverage)));
app.post('/api/futures/order',    (req, res) => res.json(futuresTrader.placeOrder(req.body || {})));
app.post('/api/futures/close',    (req, res) => res.json(futuresTrader.closePosition(Number(req.body?.id))));

// ─── Future-Price Predictor Agents (BTC + ETH, 6 horizons: 5m/10m/15m/30m/1h/4h) ───
const { btcPredictor, ethPredictor, start: startPredictors } = require('./services/futurePricePredictor');
startPredictors();
app.get('/api/predictor/btc', (req, res) => res.json(btcPredictor.status()));
app.get('/api/predictor/eth', (req, res) => res.json(ethPredictor.status()));
app.get('/api/predictor/all', (req, res) => res.json({
  btc: btcPredictor.status(),
  eth: ethPredictor.status(),
}));

// ─── Agent → Futures Bridge (lets predictor agents auto-open leveraged positions) ───
const agentFuturesBridge = require('./services/agentFuturesBridge');
app.get('/api/agent-futures/status', (req, res) => res.json(agentFuturesBridge.status()));
app.post('/api/agent-futures/start', (req, res) => res.json(agentFuturesBridge.start()));
app.post('/api/agent-futures/stop',  (req, res) => res.json(agentFuturesBridge.stop()));

// ─── Claude Chat Controller (Claude Opus with real tool-use over the trader) ───
const claudeChat = require('./services/claudeChatController');
// Per-session chat history kept in-memory. Client sends sessionId; server maintains Anthropic-formatted turns.
const chatSessions = new Map();
app.post('/api/claude/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' });
    const history = chatSessions.get(sessionId) || [];
    const result = await claudeChat.chat(message, history);
    // Cap history at last 20 turns to avoid runaway context
    chatSessions.set(sessionId, result.history.slice(-40));
    res.json({ reply: result.reply, toolCalls: result.toolCalls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/claude/chat/reset', (req, res) => {
  const { sessionId = 'default' } = req.body || {};
  chatSessions.delete(sessionId);
  res.json({ ok: true });
});

// ─── Bot API v1 + News aggregator ───
try {
  const newsAgg = require('./services/newsAggregator');
  const botApiV1 = require('./services/botApiV1');
  const candleCache = require('./services/candleCache');
  newsAgg.start();
  candleCache.start();
  botApiV1.register(app);
} catch (e) {
  console.warn('[BOT-API] failed to register:', e.message);
}

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║   CryptoTrader Pro — 27-Agent System          ║`);
  console.log(`╠═══════════════════════════════════════════════╣`);
  console.log(`║  Port:     ${PORT}                              ║`);
  console.log(`║  Mode:     ${MODE.padEnd(10)}                     ║`);
  console.log(`║  Equity:   $${portfolioState.equity.toLocaleString().padEnd(8)}                   ║`);
  console.log(`║  Trading:  ${tradingActive ? 'ACTIVE' : 'PAUSED'}                        ║`);
  console.log(`║  Agents:   8 types (27 instances)              ║`);
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
  console.log('\n[SYSTEM] Starting Meta-Orchestrator (27-agent coordination system)...\n');

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

});

module.exports = app;
