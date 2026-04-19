"use client";
/**
 * On-Chain Whale Feed
 * ───────────────────
 * Real-time BTC transaction firehose via blockchain.info WS.
 * Classifies inputs/outputs of every confirmed tx; emits "whale transfers"
 * when total output value ≥ threshold (default 50 BTC).
 *
 * Also maintains a reference list of famous wallet labels so we can tag
 * inflows/outflows to known entities (exchanges, funds, governments).
 *
 * Free · no API key · single WebSocket.
 */

import { useEffect, useState } from "react";

export interface ChainTx {
  id: string;
  hash: string;
  asset: "BTC";
  totalBtc: number;
  totalUsd: number;
  ts: number;
  // classification
  inputsLabel?: string;   // named source (exchange, fund...)
  outputsLabel?: string;
  direction: "exchange_inflow" | "exchange_outflow" | "wallet_to_wallet" | "unknown";
  tier: "MEGA" | "LARGE" | "MEDIUM";   // ≥1000 / ≥200 / ≥50 BTC
}

// Famous / labeled BTC wallets (public, well-known)
const LABELS: Record<string, string> = {
  "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo": "Binance · cold",
  "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97": "Binance · cold 2",
  "1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ": "Coinbase Custody",
  "3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64": "Coinbase",
  "3LQUu4v9z6KNch71j7kbj8GPeAGUo1FW6a": "Bitfinex",
  "39884E3j6KZj82FK4vcCrkUvWYL5MQaS3K": "Robinhood",
  "bc1qjasf9z3h7w3jspkhtgatgpyvvzgpa2wwd2lr0eh5tx44reyn2k7sfc27a4": "US Gov seized (BFX)",
  "bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt": "Huobi",
  "3AAzK4Xbu8PTM8AD7gw2XaMZavL6xoKWHQ": "OKX cold",
};

const WHALE_MIN_BTC = 50;       // ~$3.5M at typical prices
const LARGE_MIN_BTC = 200;
const MEGA_MIN_BTC  = 1000;

const MAX_TAPE = 100;
const SS_KEY = "cb:onChainFeed:v1";

type Listener = (tape: ChainTx[]) => void;

class OnChainFeed {
  tape: ChainTx[] = [];
  btcPrice = 0;
  private ws: WebSocket | null = null;
  private closed = false;
  private backoff = 2000;
  private listeners = new Set<Listener>();
  private priceSub: WebSocket | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - (parsed.ts || 0) < 10 * 60_000) {
          this.tape = parsed.tape || [];
          this.btcPrice = parsed.btc || 0;
        }
      }
    } catch {}
    // Bootstrap BTC price via Binance REST
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
      .then(r => r.json()).then(j => { if (j?.price) this.btcPrice = +j.price; }).catch(() => {});
    // Live BTC price via ticker (shared)
    this.openPrice();
    this.connect();
    setInterval(() => this.persist(), 3000);
  }

  private persist() {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        ts: Date.now(), tape: this.tape.slice(0, 60), btc: this.btcPrice,
      }));
    } catch {}
  }

  private openPrice() {
    try {
      this.priceSub = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");
      this.priceSub.onmessage = (ev) => {
        try { const d = JSON.parse(ev.data); if (d?.c) this.btcPrice = +d.c; } catch {}
      };
      this.priceSub.onclose = () => setTimeout(() => this.openPrice(), 10_000);
    } catch {}
  }

  private connect() {
    if (this.closed) return;
    try {
      this.ws = new WebSocket("wss://ws.blockchain.info/inv");
      this.ws.onopen = () => {
        this.backoff = 2000;
        try { this.ws?.send(JSON.stringify({ op: "unconfirmed_sub" })); } catch {}
      };
      this.ws.onclose = () => {
        if (this.closed) return;
        setTimeout(() => this.connect(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 30_000);
      };
      this.ws.onerror = () => { try { this.ws?.close(); } catch {} };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.op !== "utx") return;
          const x = msg.x;
          const outs: any[] = x?.out || [];
          const ins: any[] = x?.inputs || [];
          const totalSat = outs.reduce((s, o) => s + (o?.value || 0), 0);
          const totalBtc = totalSat / 1e8;
          if (totalBtc < WHALE_MIN_BTC) return;

          // Labels (first match wins)
          let inputsLabel = "";
          for (const i of ins) {
            const addr = i?.prev_out?.addr;
            if (addr && LABELS[addr]) { inputsLabel = LABELS[addr]; break; }
          }
          let outputsLabel = "";
          for (const o of outs) {
            if (o?.addr && LABELS[o.addr]) { outputsLabel = LABELS[o.addr]; break; }
          }
          const direction: ChainTx["direction"] =
            outputsLabel && !inputsLabel ? "exchange_inflow"
            : inputsLabel && !outputsLabel ? "exchange_outflow"
            : (!inputsLabel && !outputsLabel) ? "wallet_to_wallet" : "unknown";

          const tier: ChainTx["tier"] = totalBtc >= MEGA_MIN_BTC ? "MEGA" : totalBtc >= LARGE_MIN_BTC ? "LARGE" : "MEDIUM";
          const tx: ChainTx = {
            id: x.hash,
            hash: x.hash,
            asset: "BTC",
            totalBtc,
            totalUsd: totalBtc * (this.btcPrice || 0),
            ts: (x.time || Math.floor(Date.now() / 1000)) * 1000,
            inputsLabel: inputsLabel || undefined,
            outputsLabel: outputsLabel || undefined,
            direction,
            tier,
          };
          this.tape.unshift(tx);
          if (this.tape.length > MAX_TAPE) this.tape.length = MAX_TAPE;
          const snap = [...this.tape];
          this.listeners.forEach(cb => { try { cb(snap); } catch {} });
        } catch {}
      };
    } catch {}
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb([...this.tape]);
    return () => { this.listeners.delete(cb); };
  }
}

let feed: OnChainFeed;
if (typeof window !== "undefined") {
  const w = window as any;
  if (!w.__cb_onChainFeed) w.__cb_onChainFeed = new OnChainFeed();
  feed = w.__cb_onChainFeed;
} else {
  feed = new OnChainFeed();
}

export function useOnChainWhales(): ChainTx[] {
  const [tape, setTape] = useState<ChainTx[]>(() => feed?.tape || []);
  useEffect(() => feed?.subscribe(setTape), []);
  return tape;
}
