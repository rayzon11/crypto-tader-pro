"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Live batch ticker feed straight from Binance combined WS stream.
 * Covers many pairs at once — one WebSocket, sub-second updates.
 *
 * Usage: const tickers = useBinanceTickers(["BTC/USDT", "ETH/USDT", ...]);
 * Returns: { "BTC/USDT": { price, change24h, volume, high24h, low24h, ts } }
 */

export interface Ticker {
  price: number;
  change24h: number;   // percent
  volume: number;      // 24h base volume
  quoteVolume: number; // 24h quote volume
  high24h: number;
  low24h: number;
  bid: number;
  ask: number;
  ts: number;
}

export function useBinanceTickers(pairs: string[]) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const key = pairs.join(",");

  useEffect(() => {
    if (!pairs.length) return;
    const streams = pairs.map(p => p.replace("/", "").toLowerCase() + "@ticker").join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    // Bootstrap with REST 24hr snapshot so prices are there before first WS tick
    (async () => {
      try {
        const symbols = pairs.map(p => `"${p.replace("/", "")}"`).join(",");
        const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`);
        const data = await r.json();
        const next: Record<string, Ticker> = {};
        for (const d of data) {
          const pair = findPair(pairs, d.symbol);
          if (!pair) continue;
          next[pair] = {
            price: +d.lastPrice, change24h: +d.priceChangePercent,
            volume: +d.volume, quoteVolume: +d.quoteVolume,
            high24h: +d.highPrice, low24h: +d.lowPrice,
            bid: +d.bidPrice, ask: +d.askPrice, ts: Date.now(),
          };
        }
        setTickers(prev => ({ ...prev, ...next }));
      } catch {}
    })();

    let closed = false;
    let backoff = 1500;
    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); backoff = 1500; };
      ws.onclose = () => { setConnected(false); if (!closed) setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30000); };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg.data;
          if (!d) return;
          const pair = findPair(pairs, d.s);
          if (!pair) return;
          setTickers(prev => ({
            ...prev,
            [pair]: {
              price: +d.c, change24h: +d.P, volume: +d.v, quoteVolume: +d.q,
              high24h: +d.h, low24h: +d.l, bid: +d.b, ask: +d.a, ts: Date.now(),
            },
          }));
        } catch {}
      };
    };
    connect();

    return () => {
      closed = true;
      setConnected(false);
      try { wsRef.current?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { tickers, connected };
}

function findPair(pairs: string[], symbol: string): string | null {
  const s = symbol.toUpperCase();
  return pairs.find(p => p.replace("/", "").toUpperCase() === s) || null;
}
