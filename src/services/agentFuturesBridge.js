/**
 * Agent → Futures Bridge
 * ──────────────────────
 * When a predictor agent emits a YES verdict at any horizon, this bridge opens
 * a leveraged position on the futures trader with leverage scaled to confidence
 * and sized to the horizon. Mirrors how Bloomberg/Citadel auto-route algo signals.
 *
 *   conf ≥ 0.85  →  25x lev
 *   conf ≥ 0.75  →  15x lev
 *   conf ≥ 0.65  →  8x lev
 *
 * Cooldown: one open position per (agent, symbol) at a time.
 */
const { btcPredictor, ethPredictor } = require('./futurePricePredictor');
const futuresTrader = require('./futuresTrader');

const MIN_MOVE_PCT = 0.10;   // need >0.10% expected move to bother
const BASE_SIZE_USD = 250;   // $250 notional per agent trade
const AGENT_POS_TAG = new Map(); // agentName → Set of symbols currently held

let enabled = false;
let interval = null;
const log = [];
function record(line) {
  const entry = { ts: Date.now(), line };
  log.push(entry);
  if (log.length > 500) log.shift();
  console.log(`[AGENT-FUTURES] ${line}`);
}

function levFromConf(conf) {
  if (conf >= 0.85) return 25;
  if (conf >= 0.75) return 15;
  if (conf >= 0.65) return 8;
  return 0;
}

function pickPrimaryHorizon(horizons = []) {
  // Prefer 15m verdict, fall back to 45m, then 5m
  return (
    horizons.find(h => h.horizon === '15m' && h.verdict === 'YES') ||
    horizons.find(h => h.horizon === '45m' && h.verdict === 'YES') ||
    horizons.find(h => h.horizon === '5m'  && h.verdict === 'YES') ||
    null
  );
}

function heldBy(agentName, symbol) {
  const set = AGENT_POS_TAG.get(agentName);
  return set && set.has(symbol);
}
function markHeld(agentName, symbol) {
  if (!AGENT_POS_TAG.has(agentName)) AGENT_POS_TAG.set(agentName, new Set());
  AGENT_POS_TAG.get(agentName).add(symbol);
}
function clearHeld(agentName, symbol) {
  AGENT_POS_TAG.get(agentName)?.delete(symbol);
}

function reconcileHolds() {
  // If any tagged symbol no longer exists in futures positions, free the tag
  const livePosSymbols = new Set(futuresTrader.positions?.map(p => p.symbol) || []);
  AGENT_POS_TAG.forEach((set, agent) => {
    [...set].forEach(sym => {
      if (!livePosSymbols.has(sym)) set.delete(sym);
    });
  });
}

function considerAgent(agent) {
  const status = agent.status();
  const horizons = status?.forecast?.horizons || [];
  const symbol = status?.symbol === 'BTCUSDT' ? 'BTC/USDT'
               : status?.symbol === 'ETHUSDT' ? 'ETH/USDT'
               : null;
  if (!symbol) return;
  if (heldBy(agent.name, symbol)) return;

  const hz = pickPrimaryHorizon(horizons);
  if (!hz) return;
  if (Math.abs(hz.pct) < MIN_MOVE_PCT) return;

  const lev = levFromConf(hz.confidence);
  if (!lev) return;

  const side = hz.side === 'LONG' || hz.side === 'SHORT' ? hz.side : (hz.pct >= 0 ? 'LONG' : 'SHORT');
  const sizeUsd = BASE_SIZE_USD * Math.min(2, hz.confidence / 0.7);

  const res = futuresTrader.placeOrder({ symbol, side, leverage: lev, sizeUsd });
  if (res.ok) {
    // Tag the position with the originating agent
    if (res.position) {
      res.position.confidence = `${Math.round(hz.confidence * 100)}%`;
      res.position.reasoning = `${agent.name} @ T+${hz.horizon}: ${hz.reason}`;
      res.position.agent = agent.name;
    }
    markHeld(agent.name, symbol);
    record(`${agent.name} → ${side} ${symbol} ${lev}x @ ${hz.confidence.toFixed(2)}conf · T+${hz.horizon} exp ${hz.pct.toFixed(2)}%`);
  } else {
    record(`${agent.name} REJECTED ${symbol}: ${res.error}`);
  }
}

function tick() {
  if (!enabled) return;
  reconcileHolds();
  try { considerAgent(btcPredictor); } catch (e) { record(`btc err: ${e.message}`); }
  try { considerAgent(ethPredictor); } catch (e) { record(`eth err: ${e.message}`); }
}

function start() {
  if (enabled) return { ok: true, alreadyRunning: true };
  enabled = true;
  // Also make sure the futures trader core loop is running to manage TP/SL/liq
  if (!futuresTrader.running) futuresTrader.start();
  interval = setInterval(tick, 10_000);
  tick();
  record('BRIDGE STARTED · agents may now open leveraged positions');
  return { ok: true };
}
function stop() {
  enabled = false;
  if (interval) clearInterval(interval);
  interval = null;
  record('BRIDGE STOPPED');
  return { ok: true };
}
function status() {
  return {
    enabled,
    heldByAgent: Object.fromEntries(
      [...AGENT_POS_TAG.entries()].map(([k, v]) => [k, [...v]])
    ),
    recentLog: log.slice(-50),
  };
}

module.exports = { start, stop, status };
