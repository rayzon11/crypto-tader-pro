"use client";

import { useEffect, useRef, useState } from "react";
import type { OHLCV } from "@/components/CandleChart";

/**
 * Three-stage candle loader for snappy UX:
 *   Stage A (~0ms):  paint last-known candles from sessionStorage
 *                    so the chart appears instantly on nav / reload
 *   Stage B (<300ms): fast REST bootstrap (200 bars) — refreshes prices
 *   Stage C (<2s):    REST backfill to 500 bars + WS @kline for live ticks
 *
 * Previously the chart showed "CONNECTING" for 1–2s while the WS opened.
 * Now as soon as Stage A or B lands, candles are visible. The "CONNECTING"
 * badge flips to "LIVE · REST" immediately and to "LIVE · WS" once the
 * socket opens.
 */

function toSymbol(pair: string) {
  return pair.replace("/", "").toUpperCase();
}
function toStream(pair: string) {
  return pair.replace("/", "").toLowerCase();
}
function cacheKey(pair: string, tf: string) {
  return `cb:candles:${toSymbol(pair)}:${tf}:v1`;
}

async function fetchKlines(pair: string, tf: string, limit = 500): Promise<OHLCV[]> {
  const sym = toSymbol(pair);
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${limit}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const arr: any[] = await r.json();
    return arr.map((k) => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch {
    return [];
  }
}

function loadCache(pair: string, tf: string): OHLCV[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = sessionStorage.getItem(cacheKey(pair, tf));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.candles)) return [];
    // Accept cache up to 30 min old — WS will correct it
    if (Date.now() - parsed.t > 30 * 60 * 1000) return [];
    return parsed.candles;
  } catch { return []; }
}
function saveCache(pair: string, tf: string, candles: OHLCV[]) {
  try {
    if (typeof window === "undefined") return;
    // keep last 500 to cap size
    const trimmed = candles.slice(-500);
    sessionStorage.setItem(cacheKey(pair, tf), JSON.stringify({ t: Date.now(), candles: trimmed }));
  } catch {}
}

export interface UseBinanceChart {
  candles: OHLCV[];
  price: number | null;
  change24h: number | null;
  connected: boolean;
  error: string | null;
  lastTickAt: number;
}

export function useBinanceChart(pair: string, timeframe: string): UseBinanceChart {
  // Seed candles SYNCHRONOUSLY from cache so the chart paints on first render
  const [candles, setCandles] = useState<OHLCV[]>(() => loadCache(pair, timeframe));
  const [price, setPrice] = useState<number | null>(() => {
    const c = loadCache(pair, timeframe);
    return c.length ? c[c.length - 1].close : null;
  });
  const [change24h, setChange24h] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTickAt, setLastTickAt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);
  const candlesRef = useRef<OHLCV[]>(candles);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    candlesRef.current = candles;
    // debounced cache save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCache(pair, timeframe, candles), 800);
  }, [candles, pair, timeframe]);

  useEffect(() => {
    if (!pair || !timeframe) return;
    let stopped = false;

    // Re-seed from cache when pair/tf changes (useState initializer only fires once)
    const cached = loadCache(pair, timeframe);
    if (cached.length > 0) {
      candlesRef.current = cached;
      setCandles(cached);
      setPrice(cached[cached.length - 1].close);
    }

    // Stage B — fast 200-bar bootstrap so prices are current
    (async () => {
      setError(null);
      const fast = await fetchKlines(pair, timeframe, 200);
      if (stopped) return;
      if (fast.length === 0) {
        if (candlesRef.current.length === 0) setError(`No data for ${pair} @ ${timeframe}`);
        return;
      }
      candlesRef.current = fast;
      setCandles(fast);
      setPrice(fast[fast.length - 1].close);

      // Stage C — backfill to 500 bars in background
      const full = await fetchKlines(pair, timeframe, 500);
      if (stopped || full.length === 0) return;
      candlesRef.current = full;
      setCandles(full);
    })();

    // WS — live ticks
    const sym = toStream(pair);
    const url = `wss://stream.binance.com:9443/stream?streams=${sym}@kline_${timeframe}/${sym}@ticker`;

    const connect = () => {
      if (stopped) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (!stopped) reconnectTimer.current = setTimeout(connect, 1500);
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
                timestamp: k.t,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
              };
              const arr = candlesRef.current;
              const last = arr[arr.length - 1];
              let next: OHLCV[];
              if (last && last.timestamp === tick.timestamp) {
                next = [...arr.slice(0, -1), tick];
              } else if (last && tick.timestamp > last.timestamp) {
                next = [...arr, tick];
              } else {
                next = arr;
              }
              candlesRef.current = next;
              setCandles(next);
              setPrice(tick.close);
              setLastTickAt(Date.now());
            } else if (d.e === "24hrTicker") {
              setPrice(parseFloat(d.c));
              setChange24h(parseFloat(d.P));
              setLastTickAt(Date.now());
            }
          } catch {}
        };
      } catch {
        reconnectTimer.current = setTimeout(connect, 1500);
      }
    };
    connect();

    return () => {
      stopped = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      try { wsRef.current?.close(); } catch {}
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, timeframe]);

  return { candles, price, change24h, connected, error, lastTickAt };
}
