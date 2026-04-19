"use client";
/**
 * Real-Time Whale Feed
 * ────────────────────
 * Subscribes to Binance aggTrade WebSocket streams for the top pairs
 * and classifies every trade by USD notional:
 *
 *   MEGA  ≥ $1,000,000   (red/green flash)
 *   LARGE ≥ $250,000
 *   WHALE ≥ $100,000
 *
 * Aggregates rolling windows: CVD (cumulative volume delta),
 * buy/sell volume, trade count, largest print.
 *
 * Singleton — one connection for the whole app. Survives route changes.
 * Re-hydrates from sessionStorage on reload (recent tape only, <5min old).
 */

import { useEffect, useState } from "react";

export interface WhaleTrade {
  id: string;
  pair: string;
  price: number;
  qty: number;
  usd: number;
  side: "BUY" | "SELL"; // Binance: m=true → buyer is maker → aggressive SELL
  ts: number;
  tier: "MEGA" | "LARGE" | "WHALE";
}

export interface FlowStats {
  buyUsd: number;        // aggressive buy USD volume (windowed)
  sellUsd: number;       // aggressive sell USD volume (windowed)
  cvd: number;           // cumulative volume delta (session)
  trades: number;        // trade count (windowed)
  largestBuy: number;    // largest single aggressive buy (USD)
  largestSell: number;   // largest single aggressive sell (USD)
  pressure: number;      // (buy-sell)/(buy+sell) in [-1,1]
  lastPrice: number;
}

const PAIRS = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
  "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "MATIC/USDT",
  "DOT/USDT", "LTC/USDT", "TRX/USDT", "SHIB/USDT", "NEAR/USDT",
  "APT/USDT", "ARB/USDT", "OP/USDT", "SUI/USDT", "PEPE/USDT",
];

const WHALE_MIN = 100_000;
const LARGE_MIN = 250_000;
const MEGA_MIN  = 1_000_000;

const SS_KEY = "cb:whaleFeed:v1";
const WINDOW_MS = 60_000; // 1-min rolling window for flow stats
const MAX_TAPE = 300;

type TapeListener = (tape: WhaleTrade[]) => void;
type StatsListener = (stats: Record<string, FlowStats>) => void;
type AlertListener = (trade: WhaleTrade) => void;

class WhaleFeed {
  tape: WhaleTrade[] = [];
  stats: Record<string, FlowStats> = {};
  private recentByPair: Record<string, WhaleTrade[]> = {}; // for windowing
  private cvdByPair: Record<string, number> = {};
  private tapeListeners = new Set<TapeListener>();
  private statsListeners = new Set<StatsListener>();
  private alertListeners = new Set<AlertListener>();
  private ws: WebSocket | null = null;
  private closed = false;
  private backoff = 1500;
  private emitTimer: any = null;

  constructor() {
    if (typeof window === "undefined") return;
    // Hydrate recent tape from sessionStorage
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - (parsed.ts || 0) < 5 * 60_000) {
          this.tape = parsed.tape || [];
          this.cvdByPair = parsed.cvd || {};
        }
      }
    } catch {}
    this.connect();
    // Periodic stats recompute (every 1s)
    setInterval(() => this.recomputeStats(), 1000);
    // Persist tape every 3s
    setInterval(() => this.persist(), 3000);
  }

  private persist() {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        ts: Date.now(),
        tape: this.tape.slice(0, 100),
        cvd: this.cvdByPair,
      }));
    } catch {}
  }

  private connect() {
    if (this.closed) return;
    const streams = PAIRS.map(p => p.replace("/", "").toLowerCase() + "@aggTrade").join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => { this.backoff = 1500; };
    this.ws.onclose = () => {
      if (this.closed) return;
      setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 30_000);
    };
    this.ws.onerror = () => { try { this.ws?.close(); } catch {} };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const d = msg?.data; if (!d) return;
        const sym: string = d.s;
        const pair = PAIRS.find(p => p.replace("/", "") === sym);
        if (!pair) return;
        const price = +d.p, qty = +d.q;
        const usd = price * qty;
        // m = true means buyer is the maker → aggressive SELL hit the bid
        const side: "BUY" | "SELL" = d.m ? "SELL" : "BUY";

        // Update CVD for every trade (full resolution)
        this.cvdByPair[pair] = (this.cvdByPair[pair] || 0) + (side === "BUY" ? usd : -usd);

        // Track in rolling window for flow stats
        const recent = this.recentByPair[pair] || (this.recentByPair[pair] = []);
        recent.push({ id: `${d.T}-${d.a}`, pair, price, qty, usd, side, ts: d.T, tier: "WHALE" });
        // Trim old
        const cutoff = Date.now() - WINDOW_MS;
        while (recent.length && recent[0].ts < cutoff) recent.shift();

        // Update lastPrice even for small trades
        if (!this.stats[pair]) this.stats[pair] = {
          buyUsd: 0, sellUsd: 0, cvd: 0, trades: 0,
          largestBuy: 0, largestSell: 0, pressure: 0, lastPrice: price,
        };
        this.stats[pair].lastPrice = price;

        if (usd < WHALE_MIN) return;

        const tier: WhaleTrade["tier"] = usd >= MEGA_MIN ? "MEGA" : usd >= LARGE_MIN ? "LARGE" : "WHALE";
        const trade: WhaleTrade = { id: `${d.T}-${d.a}`, pair, price, qty, usd, side, ts: d.T, tier };
        this.tape.unshift(trade);
        if (this.tape.length > MAX_TAPE) this.tape.length = MAX_TAPE;
        this.scheduleEmit();
        // Fire alert on MEGA trades instantly (no throttle)
        if (tier === "MEGA") {
          this.alertListeners.forEach(cb => { try { cb(trade); } catch {} });
        }
      } catch {}
    };
  }

  private scheduleEmit() {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      const snap = [...this.tape];
      this.tapeListeners.forEach(cb => { try { cb(snap); } catch {} });
    }, 150);
  }

  private recomputeStats() {
    const next: Record<string, FlowStats> = {};
    for (const pair of PAIRS) {
      const recent = this.recentByPair[pair] || [];
      let buyUsd = 0, sellUsd = 0, lb = 0, ls = 0;
      for (const t of recent) {
        if (t.side === "BUY") { buyUsd += t.usd; if (t.usd > lb) lb = t.usd; }
        else { sellUsd += t.usd; if (t.usd > ls) ls = t.usd; }
      }
      const tot = buyUsd + sellUsd;
      next[pair] = {
        buyUsd, sellUsd,
        cvd: this.cvdByPair[pair] || 0,
        trades: recent.length,
        largestBuy: lb, largestSell: ls,
        pressure: tot > 0 ? (buyUsd - sellUsd) / tot : 0,
        lastPrice: this.stats[pair]?.lastPrice || 0,
      };
    }
    this.stats = next;
    this.statsListeners.forEach(cb => { try { cb(next); } catch {} });
  }

  subscribeTape(cb: TapeListener): () => void {
    this.tapeListeners.add(cb);
    cb([...this.tape]);
    return () => { this.tapeListeners.delete(cb); };
  }
  subscribeStats(cb: StatsListener): () => void {
    this.statsListeners.add(cb);
    cb({ ...this.stats });
    return () => { this.statsListeners.delete(cb); };
  }
  subscribeAlerts(cb: AlertListener): () => void {
    this.alertListeners.add(cb);
    return () => { this.alertListeners.delete(cb); };
  }
}

// Singleton on window
let feed: WhaleFeed;
if (typeof window !== "undefined") {
  const w = window as any;
  if (!w.__cb_whaleFeed) w.__cb_whaleFeed = new WhaleFeed();
  feed = w.__cb_whaleFeed;
} else {
  feed = new WhaleFeed();
}

// React hooks
export function useWhaleTape(): WhaleTrade[] {
  const [tape, setTape] = useState<WhaleTrade[]>(() => feed?.tape || []);
  useEffect(() => feed?.subscribeTape(setTape), []);
  return tape;
}

export function useFlowStats(): Record<string, FlowStats> {
  const [stats, setStats] = useState<Record<string, FlowStats>>(() => feed?.stats || {});
  useEffect(() => feed?.subscribeStats(setStats), []);
  return stats;
}

export function useWhaleAlerts(cb: (t: WhaleTrade) => void) {
  useEffect(() => feed?.subscribeAlerts(cb), [cb]);
}

export const WHALE_PAIRS = PAIRS;
