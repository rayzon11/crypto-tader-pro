"use client";
/**
 * Global Live-Data Store
 * ──────────────────────
 * Singleton that keeps every candle, ticker, and derived metric in memory
 * for the whole app lifetime — even across route changes. Backed by
 * sessionStorage so a page reload restores state in <10ms instead of
 * re-downloading hundreds of candles.
 *
 * Any component subscribes via `useLiveCandles(pair, tf)` / `useLiveTickers(pairs)`.
 * Only one WebSocket per (pair, tf) is opened — refcounted.
 */

import { useEffect, useState } from "react";

// ───────────────────────── types ─────────────────────────
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number }
export interface Ticker {
  price: number; change24h: number; volume: number; quoteVolume: number;
  high24h: number; low24h: number; bid: number; ask: number; ts: number;
}

// ───────────────────────── storage ─────────────────────────
const SS_KEY = "cb:liveStore:v1";
type Snapshot = {
  candles: Record<string, Candle[]>;           // key = `${pair}|${tf}`
  tickers: Record<string, Ticker>;              // key = pair
  ts: number;
};

function loadSnap(): Snapshot {
  if (typeof window === "undefined") return { candles: {}, tickers: {}, ts: 0 };
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return { candles: {}, tickers: {}, ts: 0 };
    const parsed = JSON.parse(raw) as Snapshot;
    if (Date.now() - (parsed.ts || 0) > 10 * 60_000) return { candles: {}, tickers: {}, ts: 0 };
    return parsed;
  } catch { return { candles: {}, tickers: {}, ts: 0 }; }
}
let _writeTimer: any = null;
function scheduleWrite() {
  if (_writeTimer) return;
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    try {
      const snap: Snapshot = { candles: store.candles, tickers: store.tickers, ts: Date.now() };
      sessionStorage.setItem(SS_KEY, JSON.stringify(snap));
    } catch {}
  }, 1500);
}

// ───────────────────────── core store ─────────────────────────
type Listener<T> = (val: T) => void;
class LiveStore {
  candles: Record<string, Candle[]> = {};
  tickers: Record<string, Ticker> = {};
  private candleListeners = new Map<string, Set<Listener<Candle[]>>>();
  private tickerListeners = new Set<Listener<Record<string, Ticker>>>();
  private klineSockets = new Map<string, { ws: WebSocket; refs: number }>();
  private tickerSocket: { ws: WebSocket; pairs: Set<string> } | null = null;
  private tickerBootstrapped = new Set<string>();

  constructor() {
    const snap = loadSnap();
    this.candles = snap.candles || {};
    this.tickers = snap.tickers || {};
  }

  // ═════════ CANDLES ═════════
  subscribeCandles(pair: string, tf: string, cb: Listener<Candle[]>): () => void {
    const key = `${pair}|${tf}`;
    if (!this.candleListeners.has(key)) this.candleListeners.set(key, new Set());
    this.candleListeners.get(key)!.add(cb);
    // Hydrate from cache immediately
    if (this.candles[key]?.length) cb(this.candles[key]);
    this._ensureCandleStream(pair, tf, key);
    return () => {
      this.candleListeners.get(key)?.delete(cb);
      this._releaseCandleStream(pair, tf, key);
    };
  }

  private async _bootstrap(pair: string, tf: string, key: string) {
    try {
      const sym = pair.replace("/", "").toUpperCase();
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=500`);
      const data = await r.json();
      if (!Array.isArray(data)) return;
      const fresh: Candle[] = data.map((k: any[]) => ({
        timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
      }));
      // Merge with any WS ticks that already arrived
      const existing = this.candles[key] || [];
      const lastRest = fresh[fresh.length - 1]?.timestamp ?? 0;
      const tailWs = existing.filter(c => c.timestamp > lastRest);
      this.candles[key] = [...fresh, ...tailWs];
      this._emitCandles(key);
      scheduleWrite();
    } catch {}
  }

  private _ensureCandleStream(pair: string, tf: string, key: string) {
    const existing: { ws: WebSocket; refs: number } | undefined = this.klineSockets.get(key);
    if (existing) { existing.refs++; return; }
    // Bootstrap if we don't have enough candles
    if (!this.candles[key] || this.candles[key].length < 100) this._bootstrap(pair, tf, key);

    const sym = pair.replace("/", "").toLowerCase();
    const url = `wss://stream.binance.com:9443/ws/${sym}@kline_${tf}`;
    let closed = false, backoff = 1500;
    let ws: WebSocket;
    const connect = () => {
      if (closed) return;
      ws = new WebSocket(url);
      ws.onopen = () => { backoff = 1500; };
      ws.onclose = () => { if (!closed) setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30_000); };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg.k; if (!k) return;
          const tick: Candle = { timestamp: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
          const arr = this.candles[key] || [];
          const last = arr[arr.length - 1];
          if (last && last.timestamp === tick.timestamp) {
            arr[arr.length - 1] = tick;
          } else if (!last || tick.timestamp > last.timestamp) {
            arr.push(tick);
            if (arr.length > 1000) arr.shift();
          }
          this.candles[key] = arr;
          this._emitCandles(key);
          scheduleWrite();
        } catch {}
      };
      this.klineSockets.set(key, { ws, refs: 1 });
    };
    connect();
    this.klineSockets.set(key, { ws: ws! as any, refs: 1 });
    // ensure closed flag follows the entry
    (this.klineSockets.get(key) as any).close = () => { closed = true; try { ws?.close(); } catch {} };
  }

  private _releaseCandleStream(_pair: string, _tf: string, key: string) {
    const entry = this.klineSockets.get(key) as any;
    if (!entry) return;
    entry.refs--;
    if (entry.refs <= 0) {
      entry.close?.();
      this.klineSockets.delete(key);
    }
  }

  private _emitCandles(key: string) {
    const arr = this.candles[key];
    const listeners = this.candleListeners.get(key);
    if (listeners) listeners.forEach(cb => { try { cb([...arr]); } catch {} });
  }

  // ═════════ TICKERS ═════════
  subscribeTickers(pairs: string[], cb: Listener<Record<string, Ticker>>): () => void {
    this.tickerListeners.add(cb);
    // Immediate hydration with whatever we have
    cb({ ...this.tickers });
    this._ensureTickerStream(pairs);
    return () => {
      this.tickerListeners.delete(cb);
      // Tickers are persistent per-session — we don't tear down the single multi-stream
    };
  }

  private async _bootstrapTickers(pairs: string[]) {
    try {
      const need = pairs.filter(p => !this.tickerBootstrapped.has(p));
      if (!need.length) return;
      need.forEach(p => this.tickerBootstrapped.add(p));
      const symbols = need.map(p => `"${p.replace("/", "")}"`).join(",");
      const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`);
      const data = await r.json();
      if (!Array.isArray(data)) return;
      for (const d of data) {
        const pair = need.find(p => p.replace("/", "") === d.symbol);
        if (!pair) continue;
        this.tickers[pair] = {
          price: +d.lastPrice, change24h: +d.priceChangePercent,
          volume: +d.volume, quoteVolume: +d.quoteVolume,
          high24h: +d.highPrice, low24h: +d.lowPrice,
          bid: +d.bidPrice, ask: +d.askPrice, ts: Date.now(),
        };
      }
      this._emitTickers();
      scheduleWrite();
    } catch {}
  }

  private _ensureTickerStream(pairs: string[]) {
    this._bootstrapTickers(pairs);
    const existingPairs = this.tickerSocket?.pairs ?? new Set<string>();
    const merged = new Set([...existingPairs, ...pairs]);
    if (this.tickerSocket && merged.size === existingPairs.size) return; // no new pairs

    // (Re)open the combined stream covering all requested pairs
    if (this.tickerSocket) {
      try { this.tickerSocket.ws.close(); } catch {}
      this.tickerSocket = null;
    }
    const streams = [...merged].map(p => p.replace("/", "").toLowerCase() + "@ticker").join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    let closed = false, backoff = 1500;
    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(url);
      ws.onclose = () => { if (!closed) setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30_000); };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data); const d = msg.data; if (!d) return;
          const pair = [...merged].find(p => p.replace("/", "").toUpperCase() === (d.s as string).toUpperCase());
          if (!pair) return;
          this.tickers[pair] = {
            price: +d.c, change24h: +d.P, volume: +d.v, quoteVolume: +d.q,
            high24h: +d.h, low24h: +d.l, bid: +d.b, ask: +d.a, ts: Date.now(),
          };
          this._emitTickers();
        } catch {}
      };
      this.tickerSocket = { ws, pairs: merged };
    };
    connect();
  }

  private _emitTickersTimer: any = null;
  private _emitTickers() {
    // throttle ticker emits to 10/sec to avoid overwhelming render loop
    if (this._emitTickersTimer) return;
    this._emitTickersTimer = setTimeout(() => {
      this._emitTickersTimer = null;
      const snap = { ...this.tickers };
      this.tickerListeners.forEach(cb => { try { cb(snap); } catch {} });
      scheduleWrite();
    }, 100);
  }
}

// ───────────────────────── global singleton ─────────────────────────
let store: LiveStore;
if (typeof window !== "undefined") {
  const w = window as any;
  if (!w.__cb_liveStore) w.__cb_liveStore = new LiveStore();
  store = w.__cb_liveStore;
} else {
  store = new LiveStore();
}

// ───────────────────────── React hooks ─────────────────────────
export function useLiveCandles(pair: string, tf: string) {
  const [candles, setCandles] = useState<Candle[]>(() => store.candles[`${pair}|${tf}`] || []);
  useEffect(() => {
    setCandles(store.candles[`${pair}|${tf}`] || []);
    const off = store.subscribeCandles(pair, tf, (arr) => setCandles(arr));
    return off;
  }, [pair, tf]);
  return candles;
}

export function useLiveTickers(pairs: string[]) {
  const key = pairs.join(",");
  const [tickers, setTickers] = useState<Record<string, Ticker>>(() => ({ ...store.tickers }));
  useEffect(() => {
    const off = store.subscribeTickers(pairs, (t) => setTickers(t));
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return tickers;
}

export function liveStoreStats() {
  return {
    candleKeys: Object.keys(store.candles),
    tickerCount: Object.keys(store.tickers).length,
    candleRows: Object.values(store.candles).reduce((s, a) => s + a.length, 0),
  };
}
