/**
 * newsAggregator — server-side RSS aggregator
 * ────────────────────────────────────────────
 * Fetches 5 top crypto RSS feeds every 2 minutes, parses without
 * external deps (regex-based XML), scores sentiment via keyword
 * weighting, exposes a cached array to the bot API + frontend.
 *
 * No API keys required. Runs server-side so there's no CORS or
 * browser quota issues (which is why rss2json was failing in the
 * frontend).
 */

const FEEDS = [
  { name: "CoinDesk",        url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "CoinTelegraph",   url: "https://cointelegraph.com/rss" },
  { name: "Decrypt",         url: "https://decrypt.co/feed" },
  { name: "TheBlock",        url: "https://www.theblock.co/rss.xml" },
  { name: "BitcoinMagazine", url: "https://bitcoinmagazine.com/feed" },
];

const POS = {
  rally:2, surge:2, soar:2, moon:1.5, pump:1.5, bullish:2, breakout:1.5,
  approve:1.5, approved:1.5, etf:1.5, upgrade:1, partnership:1, launch:0.8,
  adopt:1, adoption:1, record:1, ath:2, gain:1, rise:0.8, buy:0.6,
  accumulate:1.2, institutional:0.8, invest:0.6, bullrun:2,
};
const NEG = {
  crash:2, plunge:2, dump:1.5, bearish:2, selloff:1.5, hack:2, exploit:2,
  rug:2, scam:2, fraud:2, lawsuit:1.5, sue:1.2, ban:1.5, banned:1.5,
  sec:0.8, charge:1, fined:1.2, investigation:1, collapse:2, bankrupt:2,
  liquidat:1, down:0.4, fall:0.6, drop:0.8, warning:0.8, risk:0.4,
  decline:0.8, fear:1,
};
const SYMS = ["BTC","ETH","SOL","XRP","BNB","ADA","DOGE","SHIB","PEPE","AVAX","LINK","MATIC","DOT","TRX","LTC","NEAR","ARB","OP","SUI","APT","TON","ATOM","FIL","INJ","TIA","TRUMP","BONK","WIF","FLOKI"];

function stripHtml(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function scoreSentiment(t) {
  t = t.toLowerCase();
  let s = 0, n = 0;
  for (const [w, v] of Object.entries(POS)) if (t.includes(w)) { s += v; n++; }
  for (const [w, v] of Object.entries(NEG)) if (t.includes(w)) { s -= v; n++; }
  return n === 0 ? 0 : Math.max(-1, Math.min(1, s / (n * 2)));
}
function extractSyms(text) {
  const up = text.toUpperCase();
  const found = new Set();
  for (const s of SYMS) {
    if (new RegExp(`(^|[^A-Z])${s}([^A-Z]|$)`).test(up)) found.add(s);
  }
  return Array.from(found).slice(0, 4);
}
function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

// minimal XML item extractor — covers <item> and <entry> (Atom)
function parseRss(xml, sourceName) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/g;
  const matches = xml.match(itemRe) || [];
  for (const block of matches) {
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1];
    const link =
      (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] ||
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1];
    const desc =
      (block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] ||
      (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] ||
      (block.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] ||
      "";
    const pub =
      (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] ||
      (block.match(/<published[^>]*>([\s\S]*?)<\/published>/) || [])[1] ||
      (block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/) || [])[1];

    if (!title) continue;
    const cleanTitle = stripHtml(title);
    const summary = stripHtml(desc).slice(0, 280);
    const publishedAt = pub ? new Date(pub).getTime() : Date.now();
    const sentiment = scoreSentiment(`${cleanTitle}. ${summary}`);
    const symbols = extractSyms(`${cleanTitle} ${summary}`);
    items.push({
      id: hashId(sourceName + "::" + cleanTitle),
      title: cleanTitle,
      link: stripHtml(link) || "#",
      source: sourceName,
      publishedAt,
      summary,
      sentiment,
      symbols,
    });
  }
  return items;
}

async function fetchWithTimeout(url, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        "User-Agent": "CryptoBot/1.0 (+https://github.com/rayzon11/crypto-tader-pro)",
        "Accept": "application/rss+xml,application/xml,text/xml,*/*",
      },
    });
    const text = await r.text();
    return { ok: r.ok, text };
  } finally { clearTimeout(t); }
}

const state = {
  items: [],
  lastRefresh: 0,
  refreshing: false,
  timer: null,
};

async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  try {
    const results = await Promise.allSettled(
      FEEDS.map(f => fetchWithTimeout(f.url).then(r => ({ ok: r.ok, name: f.name, text: r.text })))
    );
    const merged = [];
    for (const res of results) {
      if (res.status !== "fulfilled" || !res.value.ok) continue;
      try {
        const parsed = parseRss(res.value.text, res.value.name);
        for (const it of parsed) merged.push(it);
      } catch (e) { /* swallow parse errs per feed */ }
    }
    // dedupe by title prefix
    const seen = new Set();
    const out = [];
    for (const it of merged) {
      const k = it.title.toLowerCase().slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    out.sort((a, b) => b.publishedAt - a.publishedAt);
    state.items = out.slice(0, 120);
    state.lastRefresh = Date.now();
    console.log(`[NEWS] refreshed ${state.items.length} items from ${results.filter(r => r.status === "fulfilled" && r.value.ok).length}/${FEEDS.length} feeds`);
  } catch (e) {
    console.warn("[NEWS] refresh failed:", e.message);
  } finally {
    state.refreshing = false;
  }
}

function start() {
  if (state.timer) return;
  refresh();
  state.timer = setInterval(refresh, 2 * 60 * 1000);
  console.log("[NEWS] aggregator started — 5 RSS sources, refresh every 2min");
}
function items() { return state.items; }
function status() {
  return {
    count: state.items.length,
    lastRefresh: state.lastRefresh,
    ageMs: state.lastRefresh ? Date.now() - state.lastRefresh : null,
    sources: FEEDS.map(f => f.name),
  };
}

module.exports = { start, items, status, refresh };
