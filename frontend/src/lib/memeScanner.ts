"use client";
/**
 * Meme Coin Pump/Dump Scanner
 * ───────────────────────────
 * Singleton streaming 24hr ticker for ~35 meme/micro-cap symbols.
 * Every second it recomputes per-symbol:
 *
 *   • velocity5m   — price momentum (Binance REST 5m klines every 30s)
 *   • volSpike     — current 24h vol vs 7-day median (>3× = spike)
 *   • buyPressure  — from whaleFeed aggTrades (1-min rolling)
 *   • pumpScore    — 0..100 composite (price % + volSpike + pressure + whale count)
 *   • dumpScore    — mirror
 *   • verdict      — "PUMP" | "DUMP" | "ACCUMULATE" | "DISTRIBUTE" | "NEUTRAL"
 *
 * Emits an alert when pump/dumpScore crosses 75.
 */

import { useEffect, useState } from "react";

export interface MemeRow {
  pair: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24hUsd: number;
  velocity5m: number;     // % change over last 5m
  volSpike: number;       // ratio vs 7d median
  buyUsd1m: number;
  sellUsd1m: number;
  pressure: number;       // -1..+1
  pumpScore: number;
  dumpScore: number;
  verdict: "PUMP" | "DUMP" | "ACCUMULATE" | "DISTRIBUTE" | "NEUTRAL";
  flag: boolean;          // crossed alert threshold
  ts: number;
}

export const MEME_PAIRS = [
  "DOGE/USDT","SHIB/USDT","PEPE/USDT","FLOKI/USDT","BONK/USDT","WIF/USDT",
  "MEME/USDT","BOME/USDT","TURBO/USDT","BRETT/USDT","POPCAT/USDT","MEW/USDT",
  "NEIRO/USDT","PNUT/USDT","GOAT/USDT","MOODENG/USDT","TRUMP/USDT","PENGU/USDT",
  "1000SATS/USDT","BABYDOGE/USDT","LADYS/USDT","COQ/USDT","MOG/USDT","AKITA/USDT",
  "SAMO/USDT","MYRO/USDT","CAT/USDT","WOJAK/USDT","SPX/USDT","FARTCOIN/USDT",
];

type Listener = (rows: MemeRow[]) => void;
type AlertListener = (row: MemeRow) => void;

class MemeScanner {
  rows: Record<string, MemeRow> = {};
  private priceWs: WebSocket | null = null;
  private closed = false;
  private backoff = 2000;
  private listeners = new Set<Listener>();
  private alertListeners = new Set<AlertListener>();
  private vel5mByPair: Record<string, number> = {};
  private volMedByPair: Record<string, number> = {};
  private lastAlertAt: Record<string, number> = {};
  private tickers: Record<string, any> = {};

  constructor() {
    if (typeof window === "undefined") return;
    this.connect();
    this.bootstrapHistorical();
    setInterval(() => this.recompute(), 1000);
    setInterval(() => this.bootstrapHistorical(), 30_000);
  }

  private connect() {
    if (this.closed) return;
    const streams = MEME_PAIRS.map(p => p.replace("/", "").toLowerCase() + "@ticker").join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    try {
      this.priceWs = new WebSocket(url);
      this.priceWs.onopen = () => { this.backoff = 2000; };
      this.priceWs.onclose = () => {
        if (this.closed) return;
        setTimeout(() => this.connect(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 30_000);
      };
      this.priceWs.onerror = () => { try { this.priceWs?.close(); } catch {} };
      this.priceWs.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg?.data; if (!d) return;
          const pair = MEME_PAIRS.find(p => p.replace("/", "") === d.s);
          if (!pair) return;
          this.tickers[pair] = d;
        } catch {}
      };
    } catch {}
  }

  private async bootstrapHistorical() {
    // For each meme pair, fetch last 6×5m candles for velocity + daily vol median.
    // Batched lightly (max ~10 parallel) to avoid Binance rate limits.
    const batch = async (arr: string[]) => {
      await Promise.all(arr.map(async pair => {
        try {
          const sym = pair.replace("/", "");
          const kr = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=5m&limit=6`);
          const k = await kr.json();
          if (Array.isArray(k) && k.length >= 2) {
            const first = +k[0][1], last = +k[k.length - 1][4];
            this.vel5mByPair[pair] = first > 0 ? ((last - first) / first) * 100 : 0;
          }
          // 7-day median daily quoteVolume
          const dr = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&limit=7`);
          const dk = await dr.json();
          if (Array.isArray(dk) && dk.length) {
            const vols = dk.map((c: any[]) => +c[7]).sort((a, b) => a - b); // quoteVolume
            this.volMedByPair[pair] = vols[Math.floor(vols.length / 2)] || 0;
          }
        } catch {}
      }));
    };
    const chunks: string[][] = [];
    for (let i = 0; i < MEME_PAIRS.length; i += 8) chunks.push(MEME_PAIRS.slice(i, i + 8));
    for (const c of chunks) await batch(c);
  }

  private recompute() {
    const flow = (window as any).__cb_whaleFeed?.stats || {};
    const next: Record<string, MemeRow> = {};
    for (const pair of MEME_PAIRS) {
      const d = this.tickers[pair];
      if (!d) continue;
      const price = +d.c, change24h = +d.P;
      const volume24hUsd = +d.q; // quote volume
      const vel = this.vel5mByPair[pair] ?? 0;
      const med = this.volMedByPair[pair] || 0;
      const volSpike = med > 0 ? volume24hUsd / med : 1;
      const f = flow[pair] || { buyUsd: 0, sellUsd: 0, pressure: 0 };
      const tot = f.buyUsd + f.sellUsd;

      // Pump score: positive momentum + vol spike + buy pressure
      let pump = 0;
      pump += Math.max(0, Math.min(35, vel * 5));                       // 5m velocity
      pump += Math.max(0, Math.min(25, change24h * 0.8));               // 24h %
      pump += Math.max(0, Math.min(25, (volSpike - 1) * 8));            // volume spike
      pump += Math.max(0, Math.min(15, f.pressure * 30));               // whale buy pressure
      // Dump mirror
      let dump = 0;
      dump += Math.max(0, Math.min(35, -vel * 5));
      dump += Math.max(0, Math.min(25, -change24h * 0.8));
      dump += Math.max(0, Math.min(25, (volSpike - 1) * 8));           // dumps also need volume
      dump += Math.max(0, Math.min(15, -f.pressure * 30));

      pump = Math.round(pump); dump = Math.round(dump);

      let verdict: MemeRow["verdict"] = "NEUTRAL";
      if (pump >= 70 && pump > dump + 20) verdict = "PUMP";
      else if (dump >= 70 && dump > pump + 20) verdict = "DUMP";
      else if (change24h > 5 && f.pressure > 0.15) verdict = "ACCUMULATE";
      else if (change24h < -5 && f.pressure < -0.15) verdict = "DISTRIBUTE";

      const row: MemeRow = {
        pair, symbol: pair.split("/")[0], price, change24h, volume24hUsd,
        velocity5m: vel, volSpike, buyUsd1m: f.buyUsd, sellUsd1m: f.sellUsd,
        pressure: f.pressure, pumpScore: pump, dumpScore: dump,
        verdict, flag: false, ts: Date.now(),
      };

      // Alert gate — once every 60s per pair
      if ((verdict === "PUMP" || verdict === "DUMP") && Date.now() - (this.lastAlertAt[pair] || 0) > 60_000) {
        this.lastAlertAt[pair] = Date.now();
        row.flag = true;
        this.alertListeners.forEach(cb => { try { cb(row); } catch {} });
      }
      next[pair] = row;
    }
    this.rows = next;
    const arr = Object.values(next);
    this.listeners.forEach(cb => { try { cb(arr); } catch {} });
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(Object.values(this.rows));
    return () => { this.listeners.delete(cb); };
  }
  subscribeAlerts(cb: AlertListener): () => void {
    this.alertListeners.add(cb);
    return () => { this.alertListeners.delete(cb); };
  }
}

let scanner: MemeScanner;
if (typeof window !== "undefined") {
  const w = window as any;
  if (!w.__cb_memeScanner) w.__cb_memeScanner = new MemeScanner();
  scanner = w.__cb_memeScanner;
} else {
  scanner = new MemeScanner();
}

export function useMemeRows(): MemeRow[] {
  const [rows, setRows] = useState<MemeRow[]>(() => Object.values(scanner?.rows || {}));
  useEffect(() => scanner?.subscribe(setRows), []);
  return rows;
}

export function useMemeAlerts(cb: (r: MemeRow) => void) {
  useEffect(() => scanner?.subscribeAlerts(cb), [cb]);
}
