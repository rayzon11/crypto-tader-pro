"use client";
/**
 * News Feed — real-time crypto news aggregator
 * ────────────────────────────────────────────
 * Pulls RSS from 5 top crypto outlets via the free rss2json proxy.
 * Merges, dedupes by title, scores sentiment, persists last 100
 * items to sessionStorage with a 10-minute TTL. Refreshes every 3
 * minutes. Exposes `useNews()`.
 */

import { useEffect, useState } from "react";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
  sentiment: number; // -1..+1
  symbols: string[];
};

const FEEDS: { name: string; url: string }[] = [
  { name: "CoinDesk",        url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "CoinTelegraph",   url: "https://cointelegraph.com/rss" },
  { name: "Decrypt",         url: "https://decrypt.co/feed" },
  { name: "TheBlock",        url: "https://www.theblock.co/rss.xml" },
  { name: "BitcoinMagazine", url: "https://bitcoinmagazine.com/feed" },
];

const POS: Record<string, number> = {
  rally: 2, surge: 2, soar: 2, moon: 1.5, pump: 1.5, bullish: 2, breakout: 1.5,
  approve: 1.5, approved: 1.5, etf: 1.5, upgrade: 1, partnership: 1, launch: 0.8,
  adopt: 1, adoption: 1, record: 1, ath: 2, "all-time high": 2, gain: 1, rise: 0.8,
  buy: 0.6, accumulate: 1.2, institutional: 0.8, invest: 0.6, bullrun: 2,
};
const NEG: Record<string, number> = {
  crash: 2, plunge: 2, dump: 1.5, bearish: 2, selloff: 1.5, "sell-off": 1.5,
  hack: 2, exploit: 2, rug: 2, scam: 2, fraud: 2, lawsuit: 1.5, sue: 1.2,
  ban: 1.5, banned: 1.5, sec: 0.8, charge: 1, fined: 1.2, investigation: 1,
  collapse: 2, bankrupt: 2, liquidat: 1, down: 0.4, fall: 0.6, drop: 0.8,
  warning: 0.8, risk: 0.4, decline: 0.8, fear: 1,
};

const SYMS = ["BTC","ETH","SOL","XRP","BNB","ADA","DOGE","SHIB","PEPE","AVAX","LINK","MATIC","DOT","TRX","LTC","NEAR","ARB","OP","SUI","APT","TON","ATOM","FIL","INJ","TIA","PENGU","TRUMP","BONK","WIF","FLOKI"];

function scoreSentiment(text: string): number {
  const t = text.toLowerCase();
  let s = 0, n = 0;
  for (const [w, v] of Object.entries(POS)) if (t.includes(w)) { s += v; n++; }
  for (const [w, v] of Object.entries(NEG)) if (t.includes(w)) { s -= v; n++; }
  if (n === 0) return 0;
  return Math.max(-1, Math.min(1, s / (n * 2)));
}
function extractSymbols(text: string): string[] {
  const up = text.toUpperCase();
  const found = new Set<string>();
  for (const s of SYMS) {
    const re = new RegExp(`(^|[^A-Z])${s}([^A-Z]|$)`);
    if (re.test(up)) found.add(s);
  }
  return Array.from(found).slice(0, 4);
}
function stripHtml(s: string) {
  return (s || "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function hashId(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

const SS_KEY = "cb:news:v1";
const TTL = 10 * 60 * 1000;
const REFRESH = 3 * 60 * 1000;

type Listener = (items: NewsItem[]) => void;

class NewsFeed {
  items: NewsItem[] = [];
  listeners = new Set<Listener>();
  timer: any = null;
  started = false;
  lastRefresh = 0;

  constructor() {
    this.hydrate();
  }
  hydrate() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && Date.now() - parsed.t < TTL) {
        this.items = parsed.items;
      }
    } catch {}
  }
  persist() {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ t: Date.now(), items: this.items.slice(0, 100) }));
    } catch {}
  }
  subscribe(cb: Listener) {
    this.listeners.add(cb);
    cb(this.items);
    this.start();
    return () => { this.listeners.delete(cb); };
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), REFRESH);
  }
  emit() {
    this.listeners.forEach(cb => { try { cb(this.items); } catch {} });
  }
  async refresh() {
    if (Date.now() - this.lastRefresh < 30_000) return;
    this.lastRefresh = Date.now();
    const results = await Promise.all(FEEDS.map(f => this.fetchFeed(f.name, f.url)));
    const merged: NewsItem[] = [];
    for (const arr of results) for (const it of arr) merged.push(it);
    // dedupe by title
    const seen = new Set<string>();
    const existing = new Map(this.items.map(i => [i.id, i]));
    const combined: NewsItem[] = [];
    for (const it of merged) {
      const key = it.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(existing.get(it.id) ?? it);
    }
    // keep older items that weren't in the refresh (up to total 100)
    for (const it of this.items) {
      const key = it.title.toLowerCase().slice(0, 80);
      if (!seen.has(key)) { seen.add(key); combined.push(it); }
    }
    combined.sort((a, b) => b.publishedAt - a.publishedAt);
    this.items = combined.slice(0, 100);
    this.persist();
    this.emit();
  }
  async fetchFeed(name: string, url: string): Promise<NewsItem[]> {
    try {
      const proxied = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=20`;
      const r = await fetch(proxied);
      if (!r.ok) return [];
      const j = await r.json();
      if (!j || !Array.isArray(j.items)) return [];
      return j.items.map((it: any) => {
        const title = stripHtml(it.title || "");
        const summary = stripHtml(it.description || "").slice(0, 280);
        const publishedAt = new Date(it.pubDate || Date.now()).getTime();
        const sentiment = scoreSentiment(`${title}. ${summary}`);
        const symbols = extractSymbols(`${title} ${summary}`);
        return {
          id: hashId(name + "::" + title),
          title, link: it.link || "#", source: name,
          publishedAt, summary, sentiment, symbols,
        } as NewsItem;
      });
    } catch { return []; }
  }
}

function getInstance(): NewsFeed {
  if (typeof window === "undefined") return new NewsFeed();
  const w = window as any;
  if (!w.__cb_newsFeed) w.__cb_newsFeed = new NewsFeed();
  return w.__cb_newsFeed;
}

export function useNews(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const inst = getInstance();
    return inst.subscribe(setItems);
  }, []);
  return items;
}
