// META ORCHESTRATOR
// Coordinates all agents, forces trading, and ensures execution
// This is the "boss" that makes sure trades actually happen

const tradeExecutionPipeline = require('./tradeExecutionPipeline');
const demoTradingEngine = require('./demoTradingEngine');
const tradeLogger = require('./tradeLogger');
const marketDataFetcher = require('./marketDataFetcher');
const aiBrain = require('./aiBrain');
const ForexAgent = require('../agents/forexAgent');

class MetaOrchestrator {
  constructor() {
    this.agents = [];
    this.minTradesPerDay = 3; // Force at least 3 trades per day in demo
    this.forceTradeThreshold = 2; // Hours without trades before forcing
    this.lastTradeTime = Date.now();
    this.dailyTradeCount = 0;
    this.mode = 'DEMO'; // DEMO or LIVE
    this.executionStats = {
      totalSignals: 0,
      executedTrades: 0,
      rejectedTrades: 0,
      failedTrades: 0
    };
    this.initializeAgents();
  }

  /**
   * Initialize all trading agents
   */
  initializeAgents() {
    // Crypto agents (existing) — agents/index.js exports { agents, ... }
    const { agents: cryptoAgents } = require('../agents');
    if (cryptoAgents.TRADER) this.agents.push(cryptoAgents.TRADER);
    if (cryptoAgents.MARKET_ANALYST) this.agents.push(cryptoAgents.MARKET_ANALYST);
    if (cryptoAgents.ARBITRAGE_SCOUT) this.agents.push(cryptoAgents.ARBITRAGE_SCOUT);
    if (cryptoAgents.GRID_MASTER) this.agents.push(cryptoAgents.GRID_MASTER);

    // Forex agents (new)
    this.agents.push(new ForexAgent('Forex1m', '1m'));
    this.agents.push(new ForexAgent('Forex5m', '5m'));
    this.agents.push(new ForexAgent('Forex15m', '15m'));

    console.log(`[META] Initialized ${this.agents.length} agents`);
  }

  /**
   * MAIN ORCHESTRATION LOOP
   * This method must be called every 30 seconds
   */
  async orchestrateTrading(marketData, portfolio, mode = 'DEMO') {
    this.mode = mode;
    const orchestrationStart = Date.now();

    try {
      console.log(`\n[META] ═══ Orchestration Cycle ${new Date().toISOString()} ═══`);

      // ─────────────────────────────────────────────────────────
      // PHASE 1: Check minimum daily trades
      // ─────────────────────────────────────────────────────────
      const minCheck = this.checkMinimumDailyTrades();
      if (minCheck.forceTrading) {
        console.warn(`[META] ⚠️  FORCE TRADING MODE: ${minCheck.reason}`);
        tradeExecutionPipeline.enableForceTrades();
      }

      // ─────────────────────────────────────────────────────────
      // PHASE 2: Collect signals from all agents
      // ─────────────────────────────────────────────────────────
      const allSignals = [];
      for (const agent of this.agents) {
        try {
          let signal;

          // Crypto agents
          if (agent.name === 'TRADER') {
            const btcKlines = await marketDataFetcher.fetchKlines('BTCUSDT', '1h', 100);
            const rawSignal = await agent.generateSignal(marketData['BTCUSDT'], btcKlines);
            if (rawSignal) {
              signal = {
                decision: rawSignal.signal_type,
                symbol: 'BTCUSDT',
                confidence: rawSignal.conviction,
                entry: rawSignal.entry,
                stopLoss: rawSignal.stop_loss,
                takeProfit: rawSignal.take_profit,
                reason: rawSignal.reasoning
              };
            }
          }
          // Forex agents
          else if (agent.name && agent.name.startsWith('Forex')) {
            const forexSymbol = 'EURUSDT';
            const forexKlines = await marketDataFetcher.fetchKlines(forexSymbol, agent.timeframe, 50);
            const forexQuote = marketData[forexSymbol] || (forexKlines ? { price: forexKlines[forexKlines.length - 1].close } : null);
            if (forexKlines && forexQuote) {
              signal = await agent.analyzeForexPair(forexSymbol, forexKlines, forexQuote);
            }
          }
          // Other agents
          else if (agent.name === 'MARKET_ANALYST') {
            const btcKlines = await marketDataFetcher.fetchKlines('BTCUSDT', '4h', 100);
            const rawSignal = await agent.scan({ 'BTCUSDT': btcKlines });
            if (rawSignal && rawSignal.top_setups && rawSignal.top_setups.length > 0) {
              const best = rawSignal.top_setups[0];
              signal = {
                decision: best.recommendation.includes('BUY') ? 'BUY' : 'HOLD',
                symbol: best.symbol,
                confidence: best.probability,
                reason: best.setup
              };
            }
          }
          else if (agent.name === 'ARBITRAGE_SCOUT') {
            const rawSignal = await agent.scanSpreads(marketData, null);
            if (rawSignal && rawSignal.signal_type === 'ARBITRAGE') {
              signal = {
                decision: 'BUY',
                symbol: rawSignal.best.asset + 'USDT',
                confidence: rawSignal.best.confidence,
                entry: rawSignal.best.buy_price,
                reason: `Arbitrage: ${rawSignal.best.buy_venue} -> ${rawSignal.best.sell_venue}`
              };
            }
          }
          else if (agent.name === 'GRID_MASTER') {
            const btcKlines = await marketDataFetcher.fetchKlines('BTCUSDT', '1h', 100);
            const rawSignal = await agent.setupGrid('BTC', btcKlines);
            if (rawSignal && rawSignal.signal_type === 'GRID_SETUP') {
              signal = {
                decision: 'BUY',
                symbol: 'BTCUSDT',
                confidence: rawSignal.grid.rsi / 100, // Dummy confidence
                entry: rawSignal.grid.current_price,
                reason: `Grid Setup: RSI ${rawSignal.grid.rsi}`
              };
            }
          }

          if (signal && signal.decision !== 'HOLD') {
            allSignals.push({
              agent: agent.name,
              signal,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`[META] Agent ${agent.name} error:`, error.message);
        }
      }

      console.log(`[META] Collected ${allSignals.length} signals from ${this.agents.length} agents`);

      // ─────────────────────────────────────────────────────────
      // PHASE 3: Validate and rank signals
      // ─────────────────────────────────────────────────────────
      const rankedSignals = this.rankSignals(allSignals);
      console.log(`[META] Top signals: ${rankedSignals.slice(0, 3).map(s => `${s.agent}:${s.signal.decision}`).join(', ')}`);

      // ─────────────────────────────────────────────────────────
      // PHASE 3.5: AGI Team Coordination (AI Brain Review)
      // ─────────────────────────────────────────────────────────
      let approvedSignals = rankedSignals;
      if (rankedSignals.length > 0) {
        console.log('[META] AGI Sync: AI Brain reviewing top signals...');
        const brainDecision = await aiBrain.makeDecision(marketData, portfolio, 'COORD');
        
        if (brainDecision.approval_status === 'APPROVED' && brainDecision.signal) {
          console.log(`[META] ✅ AI Brain APPROVED: ${brainDecision.reasoning}`);
          // Inject Brain's recommendation as a top signal
          approvedSignals = [{
            agent: brainDecision.agent_responsible || 'AI_BRAIN',
            signal: {
              decision: brainDecision.decision_type,
              symbol: brainDecision.signal.symbol || 'BTCUSDT',
              confidence: brainDecision.signal.confidence || 0.9,
              entry: brainDecision.signal.entry,
              reason: brainDecision.reasoning
            }
          }, ...rankedSignals];
        } else {
          console.log(`[META] ⚠️ AI Brain Caution: ${brainDecision.reasoning}`);
        }
      }

      // ─────────────────────────────────────────────────────────
      // PHASE 4: Execute top signals through pipeline
      // ─────────────────────────────────────────────────────────
      const executionResults = [];
      for (const rankedSignal of approvedSignals) {
        const result = await this.executeSignal(rankedSignal, marketData, portfolio, mode);
        executionResults.push(result);

        if (result.status === 'APPROVED_AND_EXECUTED') {
          this.executionStats.executedTrades++;
          this.lastTradeTime = Date.now();
          this.dailyTradeCount++;
        } else if (result.status === 'REJECTED') {
          this.executionStats.rejectedTrades++;
        } else if (result.status === 'ERROR') {
          this.executionStats.failedTrades++;
        }

        // Limit to 3 trades per cycle to avoid over-trading
        if (executionResults.filter(r => r.status === 'APPROVED_AND_EXECUTED').length >= 3) {
          break;
        }
      }

      this.executionStats.totalSignals += allSignals.length;

      // ─────────────────────────────────────────────────────────
      // PHASE 5: Update market data on open trades (demo mode)
      // ─────────────────────────────────────────────────────────
      if (mode === 'DEMO') {
        const tradeUpdates = demoTradingEngine.updateOpenTrades(marketData);
        if (tradeUpdates.length > 0) {
          console.log(`[META] Closed ${tradeUpdates.length} trades (SL/TP)`);
        }
      }

      // ─────────────────────────────────────────────────────────
      // PHASE 6: Disable force mode once minimum met
      // ─────────────────────────────────────────────────────────
      if (this.dailyTradeCount >= this.minTradesPerDay) {
        tradeExecutionPipeline.disableForceTrades();
      }

      const executionTime = Date.now() - orchestrationStart;
      console.log(`[META] Cycle complete in ${executionTime}ms`);

      return {
        status: 'ORCHESTRATION_COMPLETE',
        timestamp: new Date().toISOString(),
        signals: allSignals.length,
        executed: executionResults.filter(r => r.status === 'APPROVED_AND_EXECUTED').length,
        rejected: executionResults.filter(r => r.status === 'REJECTED').length,
        dailyTradeCount: this.dailyTradeCount,
        stats: this.executionStats
      };

    } catch (error) {
      console.error('[META] Orchestration error:', error);
      return {
        status: 'ORCHESTRATION_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute a single signal through the pipeline
   */
  async executeSignal(rankedSignal, marketData, portfolio, mode) {
    const { agent, signal } = rankedSignal;

    const tradeSignal = {
      symbol: signal.symbol || 'BTC/USDT',
      side: signal.decision, // BUY or SELL
      entry_price: signal.entry || marketData[signal.symbol]?.price || 0,
      stop_loss: signal.stopLoss || 0,
      take_profit: signal.takeProfit || 0,
      position_size: signal.positionSize || 1000,
      confidence: signal.confidence || 0.5,
      agent
    };

    // Execute through pipeline
    const result = await tradeExecutionPipeline.executeTradePipeline(
      tradeSignal,
      marketData,
      portfolio,
      mode
    );

    return result;
  }

  /**
   * Rank signals by confidence and agent reliability
   */
  rankSignals(signals) {
    // Weight agents by reliability
    const agentWeights = {
      'TRADER': 1.2,
      'MARKET_ANALYST': 1.1,
      'ARBITRAGE_SCOUT': 1.3,
      'GRID_MASTER': 0.9,
      'Forex1m': 0.8,
      'Forex5m': 1.0,
      'Forex15m': 1.1
    };

    return signals
      .map(s => ({
        ...s,
        score: (s.signal.confidence || 0.5) * (agentWeights[s.agent] || 1.0)
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Check if minimum daily trades requirement is met
   */
  checkMinimumDailyTrades() {
    const today = new Date().toDateString();
    const hoursSinceLastTrade = (Date.now() - this.lastTradeTime) / (1000 * 60 * 60);

    if (this.dailyTradeCount < this.minTradesPerDay) {
      if (hoursSinceLastTrade > this.forceTradeThreshold) {
        return {
          forceTrading: true,
          reason: `No trades in ${hoursSinceLastTrade.toFixed(1)}h, need ${this.minTradesPerDay - this.dailyTradeCount} more`
        };
      }
    }

    return { forceTrading: false, reason: 'Daily target met or recent trade' };
  }

  /**
   * Reset daily counters
   */
  resetDailyCounters() {
    this.dailyTradeCount = 0;
    this.lastTradeTime = Date.now();
    console.log('[META] Daily counters reset');
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    const stats = demoTradingEngine.getAccountStats();
    const execPipelineStats = tradeExecutionPipeline.getExecutionStats();

    return {
      mode: this.mode,
      agents: this.agents.length,
      accountEquity: stats.equity,
      openTrades: demoTradingEngine.getOpenTrades().length,
      closedTrades: stats.closedTrades,
      winRate: stats.winRate,
      dailyTradeCount: this.dailyTradeCount,
      executionStats: this.executionStats,
      pipelineStats: execPipelineStats,
      demoAccountStats: stats
    };
  }
}

module.exports = new MetaOrchestrator();
