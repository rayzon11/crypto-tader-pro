/**
 * candleCache — lightweight JSON-file-backed candle store
 * ────────────────────────────────────────────────────────
 * A deliberate substitution for Postgres: for a single-node terminal
 * we don't need a DB server. This gives O(1) in-memory reads, append-
 * only JSON lines on disk, ~100k candles/pair before needing rotation.
 *
 * If you later want Postgres, swap the `writeRow`/`readAll` functions
 * for a `pg` client — the callsites won't change.
 *
 * Storage layout:  data/candles/<SYMBOL>_<TF>.jsonl
 * Row format:      {t,o,h,l,c,v}\n
 *
 * API:
 *   cache.put(symbol, tf, candles[])     — append or upsert by timestamp
 *   cache.get(symbol, tf, limit=500)     — last N rows, newest-last
 *   cache.range(symbol, tf, from, to)    — timestamp window
 *   cache.stats()                        — { pairs, totalRows, sizeBytes }
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'candles');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// In-memory index: "SYM:TF" -> array of {t,o,h,l,c,v}
const mem = new Map();
// Dirty flags to batch writes
const dirty = new Set();

function key(symbol, tf) { return `${symbol.toUpperCase()}:${tf}`; }
function filePath(symbol, tf) {
  return path.join(DATA_DIR, `${symbol.toUpperCase()}_${tf}.jsonl`);
}

function loadFromDisk(symbol, tf) {
  const fp = filePath(symbol, tf);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const rows = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch {}
    }
    rows.sort((a, b) => a.t - b.t);
    return rows;
  } catch { return []; }
}

function ensureLoaded(symbol, tf) {
  const k = key(symbol, tf);
  if (!mem.has(k)) mem.set(k, loadFromDisk(symbol, tf));
  return mem.get(k);
}

function put(symbol, tf, candles) {
  if (!Array.isArray(candles) || candles.length === 0) return 0;
  const arr = ensureLoaded(symbol, tf);
  const byT = new Map(arr.map(r => [r.t, r]));
  let added = 0;
  for (const c of candles) {
    const row = {
      t: +c.timestamp || +c.t || +c.time,
      o: +c.open ?? +c.o,
      h: +c.high ?? +c.h,
      l: +c.low  ?? +c.l,
      c: +c.close ?? +c.c,
      v: +c.volume ?? +c.v ?? 0,
    };
    if (!Number.isFinite(row.t)) continue;
    if (!byT.has(row.t)) added++;
    byT.set(row.t, row);
  }
  const merged = [...byT.values()].sort((a, b) => a.t - b.t);
  // cap each pair at 100k candles
  const capped = merged.length > 100_000 ? merged.slice(-100_000) : merged;
  mem.set(key(symbol, tf), capped);
  dirty.add(key(symbol, tf));
  return added;
}

function get(symbol, tf, limit = 500) {
  const arr = ensureLoaded(symbol, tf);
  if (limit <= 0 || limit >= arr.length) return arr.slice();
  return arr.slice(-limit);
}

function range(symbol, tf, from, to) {
  const arr = ensureLoaded(symbol, tf);
  return arr.filter(r => r.t >= from && r.t <= to);
}

function flushPair(k) {
  const [symbol, tf] = k.split(':');
  const arr = mem.get(k);
  if (!arr) return;
  const fp = filePath(symbol, tf);
  try {
    const body = arr.map(r => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(fp + '.tmp', body);
    fs.renameSync(fp + '.tmp', fp);
  } catch (e) {
    console.warn('[CANDLE-CACHE] flush failed for', k, e.message);
  }
}

function flushAll() {
  for (const k of dirty) flushPair(k);
  dirty.clear();
}

function stats() {
  let totalRows = 0;
  let sizeBytes = 0;
  for (const arr of mem.values()) totalRows += arr.length;
  try {
    for (const f of fs.readdirSync(DATA_DIR)) {
      try { sizeBytes += fs.statSync(path.join(DATA_DIR, f)).size; } catch {}
    }
  } catch {}
  return { pairs: mem.size, totalRows, sizeBytes, dataDir: DATA_DIR };
}

// Auto-flush every 15s + on exit
let flushTimer = null;
function start() {
  if (flushTimer) return;
  flushTimer = setInterval(flushAll, 15_000);
  process.on('exit', flushAll);
  process.on('SIGINT', () => { flushAll(); process.exit(0); });
  console.log('[CANDLE-CACHE] started · dir=' + DATA_DIR);
}

module.exports = { start, put, get, range, flushAll, stats };
