"use client";

import { useEffect, useState } from "react";
import type { OHLCV } from "@/components/CandleChart";
import { subscribe } from "@/lib/candleHub";

/**
 * useBinanceChart — thin consumer of the shared candleHub. Multiple
 * mounts with the same (pair, tf) share ONE WebSocket + REST pipeline.
 * Paints from sessionStorage instantly, then REST, then WS. All the
 * work lives in lib/candleHub.ts.
 */

export interface UseBinanceChart {
  candles: OHLCV[];
  price: number | null;
  change24h: number | null;
  connected: boolean;
  error: string | null;
  lastTickAt: number;
}

export function useBinanceChart(pair: string, timeframe: string): UseBinanceChart {
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastTickAt, setLastTickAt] = useState(0);

  useEffect(() => {
    if (!pair || !timeframe) return;
    const unsub = subscribe(
      pair, timeframe,
      (c) => {
        setCandles(c);
        if (c.length > 0) setPrice(c[c.length - 1].close);
      },
      (conn) => setConnected(conn),
      (t) => {
        if (t.price != null) setPrice(t.price);
        if (t.change24h != null) setChange24h(t.change24h);
        if (t.lastTickAt) setLastTickAt(t.lastTickAt);
      }
    );
    return unsub;
  }, [pair, timeframe]);

  return { candles, price, change24h, connected, error: null, lastTickAt };
}
