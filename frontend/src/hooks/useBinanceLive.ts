"use client";

import { useEffect, useRef, useState } from "react";

export interface LiveCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

// Convert "BTC/USDT" → "btcusdt"
function toStream(pair: string) {
  return pair.replace("/", "").toLowerCase();
}

/**
 * Binance WebSocket live stream — emits every candle tick (sub-second).
 * Streams: wss://stream.binance.com:9443/ws/{sym}@kline_{tf}
 */
export function useBinanceLive(pair: string, timeframe: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [liveCandle, setLiveCandle] = useState<LiveCandle | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastTickAt, setLastTickAt] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);

  useEffect(() => {
    if (!pair || !timeframe) return;
    const sym = toStream(pair);
    // Combined stream: kline (candle tick) + ticker (24h change)
    const url = `wss://stream.binance.com:9443/stream?streams=${sym}@kline_${timeframe}/${sym}@ticker`;

    let stopped = false;
    const connect = () => {
      if (stopped) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (!stopped) {
            reconnectTimer.current = setTimeout(connect, 2000);
          }
        };
        ws.onerror = () => {
          try { ws.close(); } catch {}
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            const d = msg?.data;
            if (!d) return;
            if (d.e === "kline" && d.k) {
              const k = d.k;
              setLiveCandle({
                timestamp: k.t,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                isClosed: !!k.x,
              });
              setPrice(parseFloat(k.c));
              setLastTickAt(Date.now());
            } else if (d.e === "24hrTicker") {
              setPrice(parseFloat(d.c));
              setChange24h(parseFloat(d.P));
              setLastTickAt(Date.now());
            }
          } catch {}
        };
      } catch {
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };
    connect();

    return () => {
      stopped = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      try { wsRef.current?.close(); } catch {}
    };
  }, [pair, timeframe]);

  return { price, liveCandle, change24h, connected, lastTickAt };
}
