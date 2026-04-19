// AUTONOMOUS TRADER — 5-second decision loop.
// Uses predictionAgent for signals; manages demo positions with SL/TP; tracks full P&L.
// Designed per user spec: transparent, confidence-gated (>=75%), R:R gated (>=2:1),
// auto SL/TP execution, live trade feed, backtest-grade accuracy.

'use strict';

const predictionAgent = require('./predictionAgent');
const mte = require('./multiTimeframeTradingEngine');

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];
const DECISION_TF = '5m';
const LOOP_MS = 5000;
const MIN_CONFIDENCE = 75;
const MIN_RR = 2.0;
const RISK_PER_TRADE_PCT = 0.05; // 5% of balance
const STARTING_BALANCE = 1000;

class AutonomousTrader {
  constructor() {
    this.mode = 'DEMO';            // 'DEMO' | 'LIVE' (LIVE stubbed — real exchange API would plug in here)
    this.running = false;
    this.startedAt = null;
    this.balance = STARTING_BALANCE;
    this.initialBalance = STARTING_BALANCE;
    this.positions = [];           // { id, symbol, side, entry, size, sl, tp1, tp2, tp1Done, openedAt, confidence, reasoning }
    this.trades = [];              // closed trade records
    this.feed = [];                // live feed lines
    this.timer = null;
    this.nextId = 1;
    this.wins = 0;
    this.losses = 0;
  }

  // ─── Control ───
  start() {
    if (this.running) return { ok: true, alreadyRunning: true };
    this.running = true;
    this.startedAt = Date.now();
    this.log(`🟢 AGENT STARTED · MODE=${this.mode} · BAL=$${this.balance.toFixed(2)}`);
    this.timer = setInterval(() => this.tick().catch(e => this.log(`✖ tick error: ${e.message}`)), LOOP_MS);
    // Run first tick immediately
    this.tick().catch(e => this.log(`✖ tick error: ${e.message}`));
    return { ok: true };
  }

  stop() {
    if (!this.running) return { ok: true, alreadyStopped: true };
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.log(`⏹ AGENT STOPPED · realized P&L=$${(this.balance - this.initialBalance).toFixed(2)}`);
    return { ok: true };
  }

  reset() {
    this.stop();
    this.balance = STARTING_BALANCE;
    this.initialBalance = STARTING_BALANCE;
    this.positions = [];
    this.trades = [];
    this.feed = [];
    this.wins = 0;
    this.losses = 0;
    this.nextId = 1;
    this.log('↺ ACCOUNT RESET');
    return { ok: true };
  }

  setMode(mode) {
    if (!['DEMO', 'LIVE'].includes(mode)) return { ok: false, error: 'Invalid mode' };
    const wasRunning = this.running;
    if (wasRunning) this.stop();
    this.mode = mode;
    this.log(`⇄ MODE → ${mode}`);
    if (wasRunning) this.start();
    return { ok: true, mode };
  }

  // ─── Core loop ───
  async tick() {
    if (!this.running) return;
    // 1. Update open positions against latest market price (SL/TP checks)
    for (const p of [...this.positions]) this.managePosition(p);

    // 2. Scan symbols for new entries
    for (const symbol of SYMBOLS) {
      // Skip if already in a position for this symbol
      if (this.positions.find(p => p.symbol === symbol)) continue;
      const pred = predictionAgent.analyzePair(symbol, DECISION_TF);
      if (!pred) continue;
      this.evaluateEntry(symbol, pred);
    }
  }

  evaluateEntry(symbol, pred) {
    const { signal, confidence, currentPrice, tp1, tp2, stopLoss, riskReward, supportingSignals, scores } = pred;
    if (!signal.includes('BUY') && !signal.includes('SELL')) return; // only trade directional
    if (confidence < MIN_CONFIDENCE) return;
    if (riskReward < MIN_RR) return;

    const side = signal.includes('BUY') ? 'LONG' : 'SHORT';
    const riskDollars = this.balance * RISK_PER_TRADE_PCT;
    const slDistance = Math.abs(currentPrice - stopLoss);
    if (!slDistance || slDistance <= 0) return;
    const size = riskDollars / slDistance; // coins, so slDistance×size = riskDollars

    // Cap exposure at 50% of balance
    if (size * currentPrice > this.balance * 0.5) return;

    const pos = {
      id: this.nextId++,
      symbol,
      side,
      entry: currentPrice,
      size,
      sl: stopLoss,
      tp1, tp2,
      tp1Done: false,
      openedAt: Date.now(),
      confidence,
      reasoning: supportingSignals?.slice(0, 5).join(' · ') ?? '',
      scores,
    };
    this.positions.push(pos);

    this.log(`🟢 ${side === 'LONG' ? 'BUY' : 'SELL'} ${symbol} @ $${currentPrice.toFixed(2)} · SL=$${stopLoss.toFixed(2)} · TP1=$${tp1.toFixed(2)} · TP2=$${tp2.toFixed(2)} · CONF=${confidence}% · R:R=${riskReward.toFixed(2)}:1`);
  }

  managePosition(pos) {
    // Pull latest candle close from MTE (most recent data point)
    const tf = '1m';
    const candles = mte.getCandles(pos.symbol, tf);
    if (!candles || !candles.length) return;
    const price = candles[candles.length - 1].close;

    const isLong = pos.side === 'LONG';

    // Stop Loss
    if ((isLong && price <= pos.sl) || (!isLong && price >= pos.sl)) {
      return this.closePosition(pos, price, 'STOP LOSS');
    }

    // TP1 — close 33%, move SL to breakeven
    if (!pos.tp1Done) {
      if ((isLong && price >= pos.tp1) || (!isLong && price <= pos.tp1)) {
        const partialSize = pos.size * 0.33;
        const partialPnl = this.computePnl(pos, pos.tp1, partialSize);
        this.balance += partialPnl;
        pos.size -= partialSize;
        pos.tp1Done = true;
        pos.sl = pos.entry; // breakeven
        this.log(`📈 TP1 ${pos.symbol} @ $${pos.tp1.toFixed(2)} · partial +$${partialPnl.toFixed(2)} · SL → breakeven`);
        return;
      }
    }

    // TP2 — close remainder
    if ((isLong && price >= pos.tp2) || (!isLong && price <= pos.tp2)) {
      return this.closePosition(pos, pos.tp2, 'TP2');
    }
  }

  closePosition(pos, exitPrice, reason) {
    const pnl = this.computePnl(pos, exitPrice, pos.size);
    this.balance += pnl;
    const isWin = pnl >= 0;
    if (isWin) this.wins++; else this.losses++;
    const trade = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      entry: pos.entry,
      exit: exitPrice,
      size: pos.size,
      pnl,
      pnlPct: (pnl / (pos.entry * (pos.size || 1))) * 100,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      durationMs: Date.now() - pos.openedAt,
      confidence: pos.confidence,
      reason,
      reasoning: pos.reasoning,
      won: isWin,
    };
    this.trades.unshift(trade);
    this.positions = this.positions.filter(p => p.id !== pos.id);
    const icon = isWin ? '✅' : '❌';
    this.log(`${icon} CLOSE ${pos.symbol} @ $${exitPrice.toFixed(2)} · ${reason} · P&L ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${trade.pnlPct.toFixed(2)}%)`);
  }

  computePnl(pos, exitPrice, size) {
    const direction = pos.side === 'LONG' ? 1 : -1;
    return (exitPrice - pos.entry) * size * direction;
  }

  // ─── Introspection ───
  log(line) {
    const ts = new Date().toLocaleTimeString();
    this.feed.unshift(`[${ts}] ${line}`);
    if (this.feed.length > 200) this.feed.length = 200;
  }

  unrealizedPnl() {
    let total = 0;
    for (const pos of this.positions) {
      const candles = mte.getCandles(pos.symbol, '1m');
      if (!candles?.length) continue;
      const price = candles[candles.length - 1].close;
      total += this.computePnl(pos, price, pos.size);
    }
    return total;
  }

  stats() {
    const closed = this.trades.length;
    const winRate = closed ? (this.wins / closed) * 100 : 0;
    const totalPnl = this.balance - this.initialBalance;
    const avgWin = this.trades.filter(t => t.won).reduce((s, t) => s + t.pnl, 0) / (this.wins || 1);
    const avgLoss = this.trades.filter(t => !t.won).reduce((s, t) => s + t.pnl, 0) / (this.losses || 1);
    return {
      mode: this.mode,
      running: this.running,
      startedAt: this.startedAt,
      uptimeSec: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
      balance: +this.balance.toFixed(2),
      initialBalance: this.initialBalance,
      realizedPnl: +totalPnl.toFixed(2),
      unrealizedPnl: +this.unrealizedPnl().toFixed(2),
      totalPnl: +(totalPnl + this.unrealizedPnl()).toFixed(2),
      totalPnlPct: +(((totalPnl + this.unrealizedPnl()) / this.initialBalance) * 100).toFixed(2),
      openPositions: this.positions.length,
      closedTrades: closed,
      wins: this.wins,
      losses: this.losses,
      winRate: +winRate.toFixed(1),
      avgWin: +(avgWin || 0).toFixed(2),
      avgLoss: +(avgLoss || 0).toFixed(2),
      config: { decisionTf: DECISION_TF, loopMs: LOOP_MS, minConfidence: MIN_CONFIDENCE, minRR: MIN_RR, riskPct: RISK_PER_TRADE_PCT * 100 },
    };
  }

  snapshot() {
    const enrichedPositions = this.positions.map(p => {
      const candles = mte.getCandles(p.symbol, '1m');
      const price = candles?.length ? candles[candles.length - 1].close : p.entry;
      const unrealized = this.computePnl(p, price, p.size);
      return { ...p, currentPrice: price, unrealizedPnl: +unrealized.toFixed(2), unrealizedPct: +((unrealized / (p.entry * p.size || 1)) * 100).toFixed(2) };
    });
    return {
      stats: this.stats(),
      positions: enrichedPositions,
      trades: this.trades.slice(0, 50),
      feed: this.feed.slice(0, 80),
    };
  }
}

module.exports = new AutonomousTrader();
