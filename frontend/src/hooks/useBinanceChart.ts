"use client";

import { useEffect, useRef, useState } from "react";
import type { OHLCV } from "@/components/CandleChart";

// Binance public REST kline endpoint — no auth, no rate limit issues for small batches.
// Response format: [[openTime, open, high, low, close, volume, closeTime, ...], ...]
// Intervals accepted: 1m 3m 5m 15m 30m 1h 2h 4h 6h 8h 12h 1d 3d 1w 1M

function toSymbol(pair: string) {
  return pair.replace("/", "").toUpperCase();
}
function toStream(pair: string) {
  return pair.replace("/", "").toLowerCase();
}

async function fetchKlines(pair: string, tf: string, limit = 500): Promise<OHLCV[]> {
  const sym = toSymbol(pair);
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${limit}`;
  try {
    const r = await fetch(url);
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

export interface UseBinanceChart {
  candles: OHLCV[];
  price: number | null;
  change24h: number | null;
  connected: boolean;
  error: string | null;
  lastTickAt: number;
}

/**
 * One-shot hook: bootstraps ~500 historical candles from Binance REST,
 * then subscribes to WS for live tick updates on the current candle.
 * Emits a new `candles` array every tick so CandleChart can incrementally update.
 */
export function useBinanceChart(pair: string, timeframe: string): UseBinanceChart {
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTickAt, setLastTickAt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);
  const candlesRef = useRef<OHLCV[]>([]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    if (!pair || !timeframe) return;
    let stopped = false;

    // Step 1 — bootstrap history
    (async () => {
      setError(null);
      const hist = await fetchKlines(pair, timeframe, 500);
      if (stopped) return;
      if (hist.length === 0) {
        setError(`No data for ${pair} @ ${timeframe}`);
      } else {
        candlesRef.current = hist;
        setCandles(hist);
        setPrice(hist[hist.length - 1].close);
      }
    })();

    // Step 2 — open WS for this pair/tf
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
              // Merge into candles: replace last if same timestamp, else append
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
      try { wsRef.current?.close(); } catch {}
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, timeframe]);

  return { candles, price, change24h, connected, error, lastTickAt };
}
