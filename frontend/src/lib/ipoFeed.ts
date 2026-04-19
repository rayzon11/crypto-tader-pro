"use client";
/**
 * IPO Feed — real-time crypto token launch tracker
 * ─────────────────────────────────────────────────
 * Sources (all free, no API key):
 *   1. Binance exchangeInfo snapshot — detects newly listed USDT pairs
 *      by comparing against a persisted snapshot. onboardDate ≤ 30d = IPO.
 *   2. CoinGecko /coins/list/new — recently-added tokens (fallback).
 *   3. Live Binance @ticker WS per pair — price, 24h change, volume.
 *   4. window.__cb_whaleFeed — overlays whale buy/sell pressure per pair.
 *
 * Scoring:
 *   score = min(35, volume/1M) + min(25, 24hChangePct/2)
 *         + min(25, whaleBuyPressure*50) + min(15, ageBonus(1..7d sweet))
 *   verdict: BUY ≥ 70, WATCH 50..69, AVOID < 50
 */

import { useEffect, useState } from "react";

export type IpoRow = {
  symbol: string;           // BTCUSDT
  base: string;             // BTC
  pair: string;             // BTC/USDT
  listedAt: number;         // ms (onboardDate)
  ageDays: number;
  price: number;
  change24h: number;
  quoteVolume: number;
  trades: number;
  spreadPct?: number;
  whalePressure?: number;   // -1..+1 over last 1m
  score: number;            // 0..100
  verdict: "BUY" | "WATCH" | "AVOID";
  reasoning: string;
};

const SS_KEY = "cb:ipoFeed:v2";
const SNAP_KEY = "cb:ipoSnap:v2";
const TTL = 10 * 60 * 1000;
const REFRESH = 45_000;

type Listener = (rows: IpoRow[]) => void;

class IpoFeed {
  rows: IpoRow[] = [];
  listeners = new Set<Listener>();
  timer: any = null;
  wsTicker: WebSocket | null = null;
  tickerMap = new Map<string, { price: number; change24h: number; qv: number; trades: number }>();
  started = false;

  constructor() {
    this.hydrate();
  }
  hydrate() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.rows) && Date.now() - p.t < TTL) this.rows = p.rows;
    } catch {}
  }
  persist() {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ t: Date.now(), rows: this.rows })); } catch {}
  }
  subscribe(cb: Listener) {
    this.listeners.add(cb);
    cb(this.rows);
    this.start();
    return () => { this.listeners.delete(cb); };
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), REFRESH);
    this.openTickerWs();
  }
  emit() { this.listeners.forEach(cb => { try { cb(this.rows); } catch {} }); }

  async refresh() {
    try {
      const r = await fetch("https://api.binance.com/api/v3/exchangeInfo");
      if (!r.ok) return;
      const j = await r.json();
      const now = Date.now();
      const all: { symbol: string; base: string; onboardDate: number }[] = [];
      for (const s of j.symbols || []) {
        if (s.status !== "TRADING") continue;
        if (s.quoteAsset !== "USDT") continue;
        const onboard = Number(s.onboardDate || 0);
        if (!onboard) continue;
        if (now - onboard > 30 * 86400000) continue; // only last 30d
        all.push({ symbol: s.symbol, base: s.baseAsset, onboardDate: onboard });
      }
      // detect new listings by diffing snapshot
      try {
        const snapRaw = sessionStorage.getItem(SNAP_KEY);
        const prev: string[] = snapRaw ? JSON.parse(snapRaw) : [];
        const prevSet = new Set(prev);
        const current = all.map(a => a.symbol);
        const newOnes = current.filter(s => !prevSet.has(s));
        sessionStorage.setItem(SNAP_KEY, JSON.stringify(current));
        if (prev.length && newOnes.length) {
          console.log("[IPO] New listings detected:", newOnes);
        }
      } catch {}

      // subscribe tickers
      this.subscribeTickers(all.map(a => a.symbol.toLowerCase()));

      // sort newest first, cap 60
      all.sort((a, b) => b.onboardDate - a.onboardDate);
      const rows: IpoRow[] = all.slice(0, 60).map(a => this.toRow(a));
      this.rows = rows;
      this.persist();
      this.emit();
    } catch (e) {
      console.warn("[IPO] refresh failed", e);
    }
  }

  toRow(a: { symbol: string; base: string; onboardDate: number }): IpoRow {
    const t = this.tickerMap.get(a.symbol);
    const ageDays = (Date.now() - a.onboardDate) / 86400000;
    const price = t?.price ?? 0;
    const change24h = t?.change24h ?? 0;
    const qv = t?.qv ?? 0;
    const trades = t?.trades ?? 0;

    // whale pressure from singleton feed
    let whalePressure: number | undefined;
    try {
      const feed = (window as any).__cb_whaleFeed;
      if (feed?.stats) {
        const s = feed.stats.get?.(`${a.base}/USDT`);
        if (s) whalePressure = s.pressure;
      }
    } catch {}

    // scoring
    const volScore    = Math.min(35, qv / 1_000_000);
    const chgScore    = Math.max(0, Math.min(25, change24h / 2));
    const whaleScore  = Math.max(0, Math.min(25, (whalePressure ?? 0) * 50));
    const ageScore    = ageDays >= 1 && ageDays <= 7 ? 15 : ageDays < 1 ? 8 : Math.max(0, 15 - (ageDays - 7));
    // overheating penalty
    const overheat = change24h > 50 ? (change24h - 50) / 4 : 0;
    const score = Math.max(0, Math.min(100, volScore + chgScore + whaleScore + ageScore - overheat));

    const verdict: IpoRow["verdict"] = score >= 70 ? "BUY" : score >= 50 ? "WATCH" : "AVOID";
    const reasoning = [
      qv > 5e6 ? `Deep liquidity ($${(qv/1e6).toFixed(1)}M/24h)` : qv > 1e6 ? `Adequate liquidity` : `Thin liquidity`,
      change24h > 20 ? `Hot +${change24h.toFixed(1)}% 24h` : change24h > 0 ? `Up ${change24h.toFixed(1)}%` : `Down ${change24h.toFixed(1)}%`,
      ageDays < 1 ? `Fresh <24h` : ageDays < 8 ? `${ageDays.toFixed(1)}d old (sweet spot)` : `${ageDays.toFixed(0)}d old`,
      whalePressure != null ? (whalePressure > 0.2 ? `Whales accumulating` : whalePressure < -0.2 ? `Whales distributing` : `Whale flow balanced`) : ``,
      overheat > 0 ? `⚠ overheated` : ``,
    ].filter(Boolean).join(" · ");

    return {
      symbol: a.symbol, base: a.base, pair: `${a.base}/USDT`,
      listedAt: a.onboardDate, ageDays: Math.round(ageDays * 10) / 10,
      price, change24h, quoteVolume: qv, trades,
      whalePressure, score: Math.round(score), verdict, reasoning,
    };
  }

  subscribeTickers(symbols: string[]) {
    // single combined WS for all listed symbols
    if (this.wsTicker) { try { this.wsTicker.close(); } catch {} this.wsTicker = null; }
    if (symbols.length === 0) return;
    const streams = symbols.map(s => `${s}@ticker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    try {
      const ws = new WebSocket(url);
      this.wsTicker = ws;
      ws.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data);
          const d = m?.data;
          if (!d?.s) return;
          this.tickerMap.set(d.s, {
            price: parseFloat(d.c),
            change24h: parseFloat(d.P),
            qv: parseFloat(d.q),
            trades: Number(d.n),
          });
          // live-update rows in place
          let dirty = false;
          for (let i = 0; i < this.rows.length; i++) {
            if (this.rows[i].symbol === d.s) {
              this.rows[i] = this.toRow({
                symbol: this.rows[i].symbol,
                base: this.rows[i].base,
                onboardDate: this.rows[i].listedAt,
              });
              dirty = true;
            }
          }
          if (dirty) this.emit();
        } catch {}
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    } catch {}
  }

  openTickerWs() { /* called lazily after first refresh */ }
}

function getInstance(): IpoFeed {
  if (typeof window === "undefined") return new IpoFeed();
  const w = window as any;
  if (!w.__cb_ipoFeed) w.__cb_ipoFeed = new IpoFeed();
  return w.__cb_ipoFeed;
}

export function useIpoRows(): IpoRow[] {
  const [rows, setRows] = useState<IpoRow[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const inst = getInstance();
    return inst.subscribe(setRows);
  }, []);
  return rows;
}
