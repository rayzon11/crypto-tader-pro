// Futures Trading Engine — leveraged perpetual futures on top of Binance live prices.
// Paper trading by default. Tracks margin, liquidation price, funding payments.
//
// Key differences from spot autonomousTrader:
// - Supports leverage (1x to 125x) with initial margin = notional/leverage
// - Tracks liquidation price based on maintenance margin (0.5% for most crypto perps)
// - Charges funding every 8h (simulated from typical funding schedules)
// - Supports LONG and SHORT (already did) but now with real leverage math

'use strict';

const mte = require('./multiTimeframeTradingEngine');
const predictionAgent = require('./predictionAgent');
const memory = require('./memoryStore');

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];
const LOOP_MS = 5000;
const MIN_CONFIDENCE = 75;
const MIN_RR = 2.0;
const RISK_PER_TRADE_PCT = 0.02; // 2% of account (more conservative — leverage amplifies)
const MAINT_MARGIN_PCT = 0.005;  // 0.5% maintenance margin (Binance tier-1 for BTC/ETH)
const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours
const STARTING_BALANCE = 10000;
const DEFAULT_LEVERAGE = 10;

class FuturesTrader {
  constructor() {
    this.mode = 'DEMO';
    this.running = false;
    this.balance = STARTING_BALANCE;
    this.initialBalance = STARTING_BALANCE;
    this.positions = [];
    this.trades = [];
    this.feed = [];
    this.timer = null;
    this.fundingTimer = null;
    this.nextId = 1;
    this.wins = 0;
    this.losses = 0;
    this.defaultLeverage = DEFAULT_LEVERAGE;
    this.startedAt = null;
    this.fundingPaid = 0;

    // ─ Restore from persistent memory ─
    const saved = memory.get('futuresTrader');
    if (saved) {
      this.balance = Number.isFinite(saved.balance) ? saved.balance : STARTING_BALANCE;
      this.initialBalance = Number.isFinite(saved.initialBalance) ? saved.initialBalance : STARTING_BALANCE;
      this.positions = Array.isArray(saved.positions) ? saved.positions : [];
      this.trades = Array.isArray(saved.trades) ? saved.trades : [];
      this.wins = saved.wins || 0;
      this.losses = saved.losses || 0;
      this.fundingPaid = saved.fundingPaid || 0;
      this.nextId = saved.nextId || 1;
      this.defaultLeverage = saved.defaultLeverage || DEFAULT_LEVERAGE;
      console.log(`[FUTURES] restored from memory · bal=$${this.balance.toFixed(2)} · ${this.positions.length} open · ${this.trades.length} closed`);
    }
    memory.subscribe('futuresTrader', () => ({
      balance: this.balance,
      initialBalance: this.initialBalance,
      positions: this.positions,
      trades: this.trades.slice(-200),
      wins: this.wins, losses: this.losses,
      fundingPaid: this.fundingPaid,
      nextId: this.nextId,
      defaultLeverage: this.defaultLeverage,
    }));
  }

  start() {
    if (this.running) return { ok: true, alreadyRunning: true };
    this.running = true;
    this.startedAt = Date.now();
    this.log(`🟢 FUTURES ENGINE STARTED · MODE=${this.mode} · LEV=${this.defaultLeverage}x · BAL=$${this.balance.toFixed(2)}`);
    this.timer = setInterval(() => this.tick().catch(e => this.log(`✖ tick: ${e.message}`)), LOOP_MS);
    this.fundingTimer = setInterval(() => this.chargeFunding(), FUNDING_INTERVAL_MS);
    this.tick().catch(() => {});
    return { ok: true };
  }

  stop() {
    if (!this.running) return { ok: true, alreadyStopped: true };
    this.running = false;
    clearInterval(this.timer); this.timer = null;
    clearInterval(this.fundingTimer); this.fundingTimer = null;
    this.log(`⏹ FUTURES ENGINE STOPPED · P&L=$${(this.balance - this.initialBalance).toFixed(2)}`);
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
    this.fundingPaid = 0;
    this.log('↺ FUTURES ACCOUNT RESET');
    return { ok: true };
  }

  setLeverage(lev) {
    const l = Math.max(1, Math.min(125, Number(lev) || DEFAULT_LEVERAGE));
    this.defaultLeverage = l;
    this.log(`⚙ DEFAULT LEVERAGE SET TO ${l}x`);
    return { ok: true, leverage: l };
  }

  // ─── Manual order (for UI / Claude tool-use) ───
  placeOrder({ symbol, side, leverage, sizeUsd }) {
    if (!SYMBOLS.includes(symbol)) return { ok: false, error: 'Symbol not supported' };
    if (!['LONG', 'SHORT'].includes(side)) return { ok: false, error: 'side must be LONG or SHORT' };
    const lev = Math.max(1, Math.min(125, Number(leverage) || this.defaultLeverage));
    const notional = Math.max(10, Number(sizeUsd) || 100);
    const price = this.getPrice(symbol);
    if (!price) return { ok: false, error: 'No live price' };

    const margin = notional / lev;
    if (margin > this.balance * 0.9) return { ok: false, error: `Insufficient margin. Need $${margin.toFixed(2)}` };

    const size = notional / price;
    const sl = side === 'LONG' ? price * 0.98 : price * 1.02;
    const tp1 = side === 'LONG' ? price * 1.02 : price * 0.98;
    const tp2 = side === 'LONG' ? price * 1.05 : price * 0.95;
    const liqPrice = this.calcLiquidation(price, lev, side);

    const pos = {
      id: this.nextId++,
      symbol, side,
      entry: price,
      size,
      notional,
      leverage: lev,
      margin,
      sl, tp1, tp2,
      tp1Done: false,
      liqPrice,
      openedAt: Date.now(),
      confidence: 'MANUAL',
      reasoning: `Manual ${side} @ ${lev}x via UI`,
    };
    this.balance -= margin;
    this.positions.push(pos);
    this.log(`🟢 ${side} ${symbol} @ $${price.toFixed(2)} · LEV=${lev}x · notional=$${notional.toFixed(0)} · margin=$${margin.toFixed(2)} · LIQ=$${liqPrice.toFixed(2)}`);
    return { ok: true, position: pos };
  }

  closePosition(posId) {
    const pos = this.positions.find(p => p.id === posId);
    if (!pos) return { ok: false, error: 'Position not found' };
    const price = this.getPrice(pos.symbol);
    if (!price) return { ok: false, error: 'No live price' };
    this._closePosition(pos, price, 'MANUAL CLOSE');
    return { ok: true };
  }

  // ─── Core loop: scan + manage ───
  async tick() {
    if (!this.running) return;
    for (const p of [...this.positions]) this.managePosition(p);
    for (const sym of SYMBOLS) {
      if (this.positions.find(p => p.symbol === sym)) continue;
      try {
        const pred = predictionAgent.analyzePair(sym, '5m');
        if (pred) this.evaluateEntry(sym, pred);
      } catch {}
    }
  }

  evaluateEntry(symbol, pred) {
    const { signal, confidence, currentPrice, tp1, tp2, stopLoss, riskReward, supportingSignals } = pred;
    if (!signal.includes('BUY') && !signal.includes('SELL')) return;
    if (confidence < MIN_CONFIDENCE) return;
    if (riskReward < MIN_RR) return;

    const side = signal.includes('BUY') ? 'LONG' : 'SHORT';
    const riskDollars = this.balance * RISK_PER_TRADE_PCT;
    const slDist = Math.abs(currentPrice - stopLoss);
    if (!slDist) return;

    // Leverage chosen from confidence
    const lev = confidence >= 85 ? 20 : confidence >= 80 ? 15 : 10;
    const size = riskDollars / slDist;
    const notional = size * currentPrice;
    const margin = notional / lev;

    if (margin > this.balance * 0.3) return; // cap margin per trade

    const liqPrice = this.calcLiquidation(currentPrice, lev, side);
    const pos = {
      id: this.nextId++,
      symbol, side,
      entry: currentPrice,
      size, notional,
      leverage: lev,
      margin,
      sl: stopLoss, tp1, tp2,
      tp1Done: false,
      liqPrice,
      openedAt: Date.now(),
      confidence,
      reasoning: supportingSignals?.slice(0, 5).join(' · ') ?? '',
    };
    this.balance -= margin;
    this.positions.push(pos);
    this.log(`🟢 AUTO ${side} ${symbol} @ $${currentPrice.toFixed(2)} · LEV=${lev}x · CONF=${confidence}% · LIQ=$${liqPrice.toFixed(2)}`);
  }

  managePosition(pos) {
    const price = this.getPrice(pos.symbol);
    if (!price) return;
    const isLong = pos.side === 'LONG';

    // Liquidation check (priority over SL)
    if ((isLong && price <= pos.liqPrice) || (!isLong && price >= pos.liqPrice)) {
      return this._liquidate(pos, price);
    }
    // SL
    if ((isLong && price <= pos.sl) || (!isLong && price >= pos.sl)) {
      return this._closePosition(pos, price, 'STOP LOSS');
    }
    // TP1 — partial 33% + move SL to breakeven
    if (!pos.tp1Done && ((isLong && price >= pos.tp1) || (!isLong && price <= pos.tp1))) {
      const partial = pos.size * 0.33;
      const pnl = this.computePnl(pos, pos.tp1, partial);
      this.balance += pnl;
      pos.size -= partial;
      pos.notional = pos.size * pos.entry;
      pos.tp1Done = true;
      pos.sl = pos.entry;
      this.log(`📈 TP1 ${pos.symbol} @ $${pos.tp1.toFixed(2)} · partial +$${pnl.toFixed(2)} · SL→breakeven`);
      return;
    }
    // TP2 — full close
    if ((isLong && price >= pos.tp2) || (!isLong && price <= pos.tp2)) {
      return this._closePosition(pos, pos.tp2, 'TP2');
    }
  }

  _closePosition(pos, exitPrice, reason) {
    const pnl = this.computePnl(pos, exitPrice, pos.size);
    this.balance += pos.margin + pnl; // return margin + pnl
    const won = pnl >= 0;
    won ? this.wins++ : this.losses++;
    this.trades.unshift({
      id: pos.id, symbol: pos.symbol, side: pos.side, leverage: pos.leverage,
      entry: pos.entry, exit: exitPrice, size: pos.size, notional: pos.notional,
      pnl, pnlPct: (pnl / pos.margin) * 100,
      openedAt: pos.openedAt, closedAt: Date.now(),
      durationMs: Date.now() - pos.openedAt,
      confidence: pos.confidence, reason, reasoning: pos.reasoning, won,
    });
    this.positions = this.positions.filter(p => p.id !== pos.id);
    const icon = won ? '✅' : '❌';
    this.log(`${icon} CLOSE ${pos.symbol} ${pos.leverage}x @ $${exitPrice.toFixed(2)} · ${reason} · P&L ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${((pnl / pos.margin) * 100).toFixed(2)}% on margin)`);
  }

  _liquidate(pos, price) {
    // Total loss of margin (plus a bit extra for slippage in reality)
    this.losses++;
    this.trades.unshift({
      id: pos.id, symbol: pos.symbol, side: pos.side, leverage: pos.leverage,
      entry: pos.entry, exit: price, size: pos.size, notional: pos.notional,
      pnl: -pos.margin, pnlPct: -100,
      openedAt: pos.openedAt, closedAt: Date.now(),
      durationMs: Date.now() - pos.openedAt,
      confidence: pos.confidence, reason: 'LIQUIDATED', reasoning: pos.reasoning, won: false,
    });
    this.positions = this.positions.filter(p => p.id !== pos.id);
    this.log(`💥 LIQUIDATED ${pos.symbol} ${pos.leverage}x @ $${price.toFixed(2)} · lost $${pos.margin.toFixed(2)} margin`);
  }

  chargeFunding() {
    if (this.positions.length === 0) return;
    // Simulate funding: typical BTC perp is ±0.01% every 8h. Random per position.
    for (const pos of this.positions) {
      const fundingRate = (Math.random() - 0.5) * 0.0002; // ±0.01%
      const fund = pos.notional * fundingRate;
      // LONG pays positive funding, SHORT receives it (typical convention)
      const delta = pos.side === 'LONG' ? -fund : fund;
      this.balance += delta;
      this.fundingPaid += -delta;
      this.log(`💸 FUNDING ${pos.symbol} ${pos.side}: ${delta >= 0 ? '+' : ''}$${delta.toFixed(4)} (rate ${(fundingRate * 100).toFixed(4)}%)`);
    }
  }

  // ─── Helpers ───
  calcLiquidation(entry, leverage, side) {
    // Simplified isolated-margin liquidation formula:
    // Long:  liq = entry · (1 - 1/lev + maintMargin)
    // Short: liq = entry · (1 + 1/lev - maintMargin)
    if (side === 'LONG') return entry * (1 - 1 / leverage + MAINT_MARGIN_PCT);
    return entry * (1 + 1 / leverage - MAINT_MARGIN_PCT);
  }

  getPrice(symbol) {
    try {
      const candles = mte.getCandles(symbol, '1m');
      if (candles?.length) return candles[candles.length - 1].close;
    } catch {}
    return null;
  }

  computePnl(pos, exitPrice, size) {
    const dir = pos.side === 'LONG' ? 1 : -1;
    return (exitPrice - pos.entry) * size * dir;
  }

  unrealizedPnl() {
    let t = 0;
    for (const pos of this.positions) {
      const price = this.getPrice(pos.symbol);
      if (price) t += this.computePnl(pos, price, pos.size);
    }
    return t;
  }

  log(line) {
    this.feed.unshift(`[${new Date().toLocaleTimeString()}] ${line}`);
    if (this.feed.length > 200) this.feed.length = 200;
  }

  snapshot() {
    const enriched = this.positions.map(p => {
      const price = this.getPrice(p.symbol) || p.entry;
      const unrealized = this.computePnl(p, price, p.size);
      const distLiqPct = p.side === 'LONG'
        ? ((price - p.liqPrice) / price) * 100
        : ((p.liqPrice - price) / price) * 100;
      return {
        ...p,
        currentPrice: price,
        unrealizedPnl: +unrealized.toFixed(2),
        unrealizedPct: +((unrealized / p.margin) * 100).toFixed(2),
        distToLiqPct: +distLiqPct.toFixed(2),
      };
    });
    const closed = this.trades.length;
    const winRate = closed ? (this.wins / closed) * 100 : 0;
    const totalPnl = this.balance - this.initialBalance + enriched.reduce((s, p) => s + p.margin, 0) - this.initialBalance + this.initialBalance;
    // simpler — total equity = free balance + locked margin + unrealized
    const totalMargin = enriched.reduce((s, p) => s + p.margin, 0);
    const equity = this.balance + totalMargin + this.unrealizedPnl();
    return {
      stats: {
        mode: this.mode,
        running: this.running,
        startedAt: this.startedAt,
        uptimeSec: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
        freeBalance: +this.balance.toFixed(2),
        lockedMargin: +totalMargin.toFixed(2),
        equity: +equity.toFixed(2),
        initialBalance: this.initialBalance,
        realizedPnl: +(this.balance + totalMargin - this.initialBalance).toFixed(2),
        unrealizedPnl: +this.unrealizedPnl().toFixed(2),
        totalPnl: +(equity - this.initialBalance).toFixed(2),
        totalPnlPct: +(((equity - this.initialBalance) / this.initialBalance) * 100).toFixed(2),
        openPositions: this.positions.length,
        closedTrades: closed,
        wins: this.wins,
        losses: this.losses,
        winRate: +winRate.toFixed(1),
        defaultLeverage: this.defaultLeverage,
        fundingPaid: +this.fundingPaid.toFixed(4),
        config: { loopMs: LOOP_MS, minConfidence: MIN_CONFIDENCE, minRR: MIN_RR, riskPct: RISK_PER_TRADE_PCT * 100 },
      },
      positions: enriched,
      trades: this.trades.slice(0, 50),
      feed: this.feed.slice(0, 80),
    };
  }
}

module.exports = new FuturesTrader();
