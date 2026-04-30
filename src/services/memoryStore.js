/**
 * Persistent Memory Store
 * ───────────────────────
 * Gives the whole system long-term memory by writing compact JSON snapshots
 * to disk every 15s and loading them on boot. Used by:
 *   • futurePricePredictor   — forecast history + MAPE accumulator
 *   • futuresTrader          — balance, closed trades, stats
 *   • agentRegistry27        — agent P&L, wins/losses, decisions
 *   • agentFuturesBridge     — which agent currently holds which symbol
 *
 * Storage: single file `data/memory.json` at repo root (auto-created).
 * Atomic writes via temp-file rename. Corrupt file on startup → ignored with warning.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'memory.json');
const TMP = path.join(DATA_DIR, 'memory.json.tmp');

class MemoryStore {
  constructor() {
    this.store = {};
    this.subscribers = new Map();   // namespace → () => snapshot
    this.dirty = false;
    this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(FILE)) {
        const raw = fs.readFileSync(FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.store = parsed && typeof parsed === 'object' ? parsed : {};
        console.log(`[MEMORY] Loaded ${Object.keys(this.store).length} namespaces from ${FILE}`);
      } else {
        this.store = {};
      }
    } catch (e) {
      console.warn(`[MEMORY] Could not load ${FILE}: ${e.message} — starting fresh`);
      this.store = {};
    }
  }

  /** Read a namespace's saved blob (or default). */
  get(namespace, def = null) {
    return this.store[namespace] ?? def;
  }

  /** Write a namespace immediately and mark dirty for next flush. */
  set(namespace, value) {
    this.store[namespace] = value;
    this.dirty = true;
  }

  /** Register a snapshot function called on every flush. */
  subscribe(namespace, snapshotFn) {
    this.subscribers.set(namespace, snapshotFn);
  }

  /** Pull fresh snapshots from subscribers, then persist. */
  flush() {
    try {
      for (const [ns, fn] of this.subscribers) {
        try {
          const snap = fn();
          if (snap !== undefined) this.store[ns] = snap;
        } catch (e) {
          console.warn(`[MEMORY] subscriber ${ns} failed: ${e.message}`);
        }
      }
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(TMP, JSON.stringify(this.store));
      fs.renameSync(TMP, FILE);
      this.dirty = false;
    } catch (e) {
      console.error(`[MEMORY] flush failed: ${e.message}`);
    }
  }

  start(intervalMs = 15_000) {
    if (this._timer) return;
    this._timer = setInterval(() => this.flush(), intervalMs);
    // Also flush on graceful exit
    const final = () => { try { this.flush(); } catch {} };
    process.on('SIGINT',  () => { final(); process.exit(0); });
    process.on('SIGTERM', () => { final(); process.exit(0); });
    process.on('beforeExit', final);
    console.log('[MEMORY] Auto-persist started (every 15s + on exit)');
  }

  stats() {
    return {
      namespaces: Object.keys(this.store),
      subscribers: [...this.subscribers.keys()],
      fileExists: fs.existsSync(FILE),
      filePath: FILE,
      sizeBytes: fs.existsSync(FILE) ? fs.statSync(FILE).size : 0,
    };
  }
}

module.exports = new MemoryStore();
