"use client";
/**
 * candleHub — one WebSocket + one REST fetch per (pair, tf), shared
 * across all mounted charts. Turns N chart instances into 1 network
 * connection. Cached in memory + sessionStorage so navigation is
 * instant (zero paint flash).
 *
 * Why this exists:
 *   Previously every chart component owned its own WS + REST. Switching
 *   pages tore down and rebuilt the pipeline, causing the "CONNECTING"
 *   state to flash for 1-2s. This hub keeps connections alive as long
 *   as at least one subscriber is listening.
 */

import type { OHLCV } from "@/components/CandleChart";

type Listener = (candles: OHLCV[]) => void;

export interface TickerState {
  price: number | null;
  change24h: number | null;
  lastTickAt: number;
}
type TickerListener = (t: TickerState) => void;

interface StreamState {
  key: string;
  pair: string;
  tf: string;
  candles: OHLCV[];
  listeners: Set<Listener>;
  ws: WebSocket | null;
  wsConnected: boolean;
  connectedListeners: Set<(c: boolean) => void>;
  tickerListeners: Set<TickerListener>;
  ticker: TickerState;
  reconnectTimer: any;
  refCount: number;
  lastFetchAt: number;
  loaded: boolean;
}

const streams = new Map<string, StreamState>();

function sym(pair: string) { return pair.replace("/", "").toUpperCase(); }
function lower(pair: string) { return pair.replace("/", "").toLowerCase(); }
function storeKey(pair: string, tf: string) { return `cb:candles:${sym(pair)}:${tf}:v2`; }
function memKey(pair: string, tf: string) { return `${sym(pair)}:${tf}`; }

function loadCache(pair: string, tf: string): OHLCV[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = sessionStorage.getItem(storeKey(pair, tf));
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.candles)) return [];
    if (Date.now() - p.t > 30 * 60 * 1000) return []; // 30min TTL
    return p.candles;
  } catch { return []; }
}

function saveCache(pair: string, tf: string, candles: OHLCV[]) {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(storeKey(pair, tf), JSON.stringify({
      t: Date.now(), candles: candles.slice(-500),
    }));
  } catch {}
}

async function fetchKlines(pair: string, tf: string, limit: number): Promise<OHLCV[]> {
  const s = sym(pair);
  const url = `https://api.binance.com/api/v3/klines?symbol=${s}&interval=${tf}&limit=${limit}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const arr: any[] = await r.json();
    return arr.map(k => ({
      timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
    }));
  } catch { return []; }
}

function emit(s: StreamState) {
  for (const l of s.listeners) l(s.candles);
}
function emitConnected(s: StreamState) {
  for (const l of s.connectedListeners) l(s.wsConnected);
}
function emitTicker(s: StreamState) {
  for (const l of s.tickerListeners) l(s.ticker);
}

function openWS(s: StreamState) {
  if (s.ws) return;
  const url = `wss://stream.binance.com:9443/stream?streams=${lower(s.pair)}@kline_${s.tf}/${lower(s.pair)}@ticker`;
  try {
    const ws = new WebSocket(url);
    s.ws = ws;
    ws.onopen = () => { s.wsConnected = true; emitConnected(s); };
    ws.onclose = () => {
      s.wsConnected = false;
      emitConnected(s);
      s.ws = null;
      if (s.refCount > 0) s.reconnectTimer = setTimeout(() => openWS(s), 1500);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const d = msg?.data;
        if (!d) return;
        if (d.e === "kline" && d.k) {
          const k = d.k;
          const tick: OHLCV = {
            timestamp: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v,
          };
          const last = s.candles[s.candles.length - 1];
          if (last && last.timestamp === tick.timestamp) {
            s.candles = [...s.candles.slice(0, -1), tick];
          } else if (!last || tick.timestamp > last.timestamp) {
            s.candles = [...s.candles, tick].slice(-500);
          } else return;
          s.ticker = { price: tick.close, change24h: s.ticker.change24h, lastTickAt: Date.now() };
          emit(s);
          emitTicker(s);
        } else if (d.e === "24hrTicker") {
          s.ticker = { price: +d.c, change24h: +d.P, lastTickAt: Date.now() };
          emitTicker(s);
        }
      } catch {}
    };
  } catch {
    s.reconnectTimer = setTimeout(() => openWS(s), 1500);
  }
}

async function bootstrap(s: StreamState) {
  // Already have cache? emit immediately.
  if (s.candles.length === 0) {
    const cached = loadCache(s.pair, s.tf);
    if (cached.length > 0) {
      s.candles = cached;
      emit(s);
    }
  }
  // Skip REST if we fetched in the last 10s (another sub just did it)
  if (Date.now() - s.lastFetchAt < 10_000 && s.candles.length > 100) return;
  s.lastFetchAt = Date.now();

  // Fast pass: 200 bars
  const fast = await fetchKlines(s.pair, s.tf, 200);
  if (fast.length > 0) {
    s.candles = fast;
    s.loaded = true;
    saveCache(s.pair, s.tf, fast);
    emit(s);
  }
  // Slow pass: backfill to 500
  const full = await fetchKlines(s.pair, s.tf, 500);
  if (full.length > 0) {
    s.candles = full;
    s.loaded = true;
    saveCache(s.pair, s.tf, full);
    emit(s);
  }
}

export function subscribe(
  pair: string,
  tf: string,
  onCandles: Listener,
  onConnected?: (c: boolean) => void,
  onTicker?: TickerListener
): () => void {
  const k = memKey(pair, tf);
  let s = streams.get(k);
  if (!s) {
    s = {
      key: k, pair, tf,
      candles: loadCache(pair, tf),
      listeners: new Set(), connectedListeners: new Set(), tickerListeners: new Set(),
      ticker: { price: null, change24h: null, lastTickAt: 0 },
      ws: null, wsConnected: false, reconnectTimer: null,
      refCount: 0, lastFetchAt: 0, loaded: false,
    };
    streams.set(k, s);
  }
  s.listeners.add(onCandles);
  if (onConnected) s.connectedListeners.add(onConnected);
  if (onTicker) s.tickerListeners.add(onTicker);
  s.refCount++;

  // Deliver what we have immediately
  if (s.candles.length > 0) onCandles(s.candles);
  if (onConnected) onConnected(s.wsConnected);
  if (onTicker) onTicker(s.ticker);

  // Ensure pipeline is running
  if (!s.loaded) bootstrap(s);
  if (!s.ws) openWS(s);

  return () => {
    if (!s) return;
    s.listeners.delete(onCandles);
    if (onConnected) s.connectedListeners.delete(onConnected);
    if (onTicker) s.tickerListeners.delete(onTicker);
    s.refCount--;
    if (s.refCount <= 0) {
      // Keep for 30s grace so rapid nav doesn't thrash the WS
      setTimeout(() => {
        if (s && s.refCount <= 0) {
          try { s.ws?.close(); } catch {}
          if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
          streams.delete(s.key);
        }
      }, 30_000);
    }
  };
}

/** Pre-warm a pair so when the user navigates, the chart is already ready */
export function prefetch(pair: string, tf: string) {
  const k = memKey(pair, tf);
  if (streams.has(k)) return;
  const s: StreamState = {
    key: k, pair, tf,
    candles: loadCache(pair, tf),
    listeners: new Set(), connectedListeners: new Set(), tickerListeners: new Set(),
    ticker: { price: null, change24h: null, lastTickAt: 0 },
    ws: null, wsConnected: false, reconnectTimer: null,
    refCount: 0, lastFetchAt: 0, loaded: false,
  };
  streams.set(k, s);
  bootstrap(s);
  // Schedule teardown if no one subscribes in 60s
  setTimeout(() => {
    if (s.refCount === 0) {
      try { s.ws?.close(); } catch {}
      streams.delete(k);
    }
  }, 60_000);
}
