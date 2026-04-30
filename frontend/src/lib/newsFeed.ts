"use client";
/**
 * News Feed — real-time crypto news aggregator (backend-proxied)
 * ───────────────────────────────────────────────────────────────
 * Hits /api/v1/news on the backend, which fetches 5 RSS feeds
 * server-side every 2 min (bypasses browser CORS / rss2json
 * quota that were blocking the original client-side approach).
 */
import { useEffect, useState } from "react";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
  sentiment: number;
  symbols: string[];
};

const API = "http://localhost:3002";
const SS_KEY = "cb:news:v2";
const TTL = 10 * 60 * 1000;
const REFRESH = 60_000;

type Listener = (items: NewsItem[]) => void;

class NewsFeed {
  items: NewsItem[] = [];
  listeners = new Set<Listener>();
  timer: any = null;
  started = false;

  constructor() { this.hydrate(); }
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
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ t: Date.now(), items: this.items.slice(0, 120) })); } catch {}
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
  emit() { this.listeners.forEach(cb => { try { cb(this.items); } catch {} }); }

  async refresh() {
    try {
      const r = await fetch(`${API}/api/v1/news?limit=120`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (!j || !Array.isArray(j.items)) return;
      this.items = j.items;
      this.persist();
      this.emit();
    } catch (e) {
      console.warn("[NEWS] refresh failed", e);
    }
  }
}

function getInstance(): NewsFeed {
  if (typeof window === "undefined") return new NewsFeed();
  const w = window as any;
  if (!w.__cb_newsFeed2) w.__cb_newsFeed2 = new NewsFeed();
  return w.__cb_newsFeed2;
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
