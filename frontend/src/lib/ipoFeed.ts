"use client";
/**
 * IPO Feed — real-time crypto token launch tracker
 * ─────────────────────────────────────────────────
 * The Binance SPOT exchangeInfo does NOT include onboardDate, so we
 * use the backend's /api/listings/ipo endpoint which already tracks
 * real listings via the newListingsTracker service.
 *
 * We then overlay a live @ticker WS for sub-second price/change
 * updates and pull whale pressure from window.__cb_whaleFeed.
 */
import { useEffect, useState } from "react";

export type IpoRow = {
  symbol: string;
  base: string;
  pair: string;
  listedAt: number;
  ageDays: number;
  price: number;
  change24h: number;
  quoteVolume: number;
  trades: number;
  spreadPct?: number;
  whalePressure?: number;
  score: number;
  verdict: "BUY" | "WATCH" | "AVOID";
  reasoning: string;
};

const API = "http://localhost:3002";
const SS_KEY = "cb:ipoFeed:v3";
const TTL = 10 * 60 * 1000;
const REFRESH = 30_000;

type Listener = (rows: IpoRow[]) => void;

class IpoFeed {
  rows: IpoRow[] = [];
  listeners = new Set<Listener>();
  timer: any = null;
  wsTicker: WebSocket | null = null;
  tickerMap = new Map<string, { price: number; change24h: number; qv: number; trades: number }>();
  started = false;

  constructor() { this.hydrate(); }
  hydrate() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.rows) && Date.now() - p.t < TTL) this.rows = p.rows;
    } catch {}
  }
  persist() { try { sessionStorage.setItem(SS_KEY, JSON.stringify({ t: Date.now(), rows: this.rows })); } catch {} }
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
  }
  emit() { this.listeners.forEach(cb => { try { cb(this.rows); } catch {} }); }

  async refresh() {
    try {
      const r = await fetch(`${API}/api/listings/ipo`, { cache: "no-store" });
      if (!r.ok) return;
      const arr = await r.json();
      if (!Array.isArray(arr)) return;
      // backend already provides score/verdict/reasoning; we just
      // enrich with live ticker + whale pressure
      const rows: IpoRow[] = arr.slice(0, 80).map((x: any) => this.enrich(x));
      // subscribe live tickers for these symbols
      this.subscribeTickers(rows.map(r => r.symbol.toLowerCase()));
      this.rows = rows;
      this.persist();
      this.emit();
    } catch (e) {
      console.warn("[IPO] refresh failed", e);
    }
  }

  enrich(x: any): IpoRow {
    const t = this.tickerMap.get(x.symbol);
    const price = t?.price ?? Number(x.price) ?? 0;
    const change24h = t?.change24h ?? Number(x.change24h) ?? 0;
    const quoteVolume = t?.qv ?? Number(x.quoteVolume) ?? 0;
    const trades = t?.trades ?? Number(x.trades) ?? 0;

    let whalePressure: number | undefined;
    try {
      const feed = (window as any).__cb_whaleFeed;
      if (feed?.stats) {
        const s = feed.stats.get?.(`${x.base}/USDT`);
        if (s) whalePressure = s.pressure;
      }
    } catch {}

    return {
      symbol: x.symbol,
      base: x.base,
      pair: `${x.base}/USDT`,
      listedAt: Number(x.listedAt) || Date.now(),
      ageDays: Number(x.ageDays) || 0,
      price, change24h, quoteVolume, trades,
      spreadPct: x.spreadPct != null ? Number(x.spreadPct) : undefined,
      whalePressure,
      score: Math.round(Number(x.score) || 0),
      verdict: (x.verdict || "AVOID") as IpoRow["verdict"],
      reasoning: String(x.reasoning || ""),
    };
  }

  subscribeTickers(symbols: string[]) {
    if (this.wsTicker) { try { this.wsTicker.close(); } catch {} this.wsTicker = null; }
    if (symbols.length === 0) return;
    // Binance limits stream URL length — chunk if huge
    const chunk = symbols.slice(0, 60);
    const streams = chunk.map(s => `${s}@ticker`).join("/");
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
          let dirty = false;
          for (let i = 0; i < this.rows.length; i++) {
            if (this.rows[i].symbol === d.s) {
              this.rows[i] = this.enrich({ ...this.rows[i] });
              dirty = true;
            }
          }
          if (dirty) this.emit();
        } catch {}
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    } catch {}
  }
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
