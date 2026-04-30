"use client";
/**
 * NewsWire — real-time RSS news aggregator panel
 * ───────────────────────────────────────────────
 * Self-fetching, no props required. Uses useNews() from newsFeed.
 */
import { useMemo, useState } from "react";
import { useNews, type NewsItem } from "@/lib/newsFeed";

function timeAgo(t: number) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); return `${d}d`;
}

const sentColor = (s: number) =>
  s > 0.25 ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/40"
  : s < -0.25 ? "text-rose-300 bg-rose-500/10 border-rose-500/40"
  : "text-slate-300 bg-slate-800/40 border-slate-700";

const sentLabel = (s: number) =>
  s > 0.5 ? "VERY BULLISH" : s > 0.15 ? "BULLISH"
  : s < -0.5 ? "VERY BEARISH" : s < -0.15 ? "BEARISH" : "NEUTRAL";

export default function NewsWire({ max = 50, compact = false }: { max?: number; compact?: boolean }) {
  const items = useNews();
  const [filter, setFilter] = useState<"ALL" | "BULL" | "BEAR" | "BTC" | "ETH" | "ALT">("ALL");

  const filtered = useMemo(() => {
    let arr = items;
    if (filter === "BULL") arr = arr.filter(i => i.sentiment > 0.15);
    else if (filter === "BEAR") arr = arr.filter(i => i.sentiment < -0.15);
    else if (filter === "BTC") arr = arr.filter(i => i.symbols.includes("BTC"));
    else if (filter === "ETH") arr = arr.filter(i => i.symbols.includes("ETH"));
    else if (filter === "ALT") arr = arr.filter(i => i.symbols.some(s => s !== "BTC" && s !== "ETH"));
    return arr.slice(0, max);
  }, [items, filter, max]);

  const stats = useMemo(() => {
    const bull = items.filter(i => i.sentiment > 0.15).length;
    const bear = items.filter(i => i.sentiment < -0.15).length;
    const avg = items.length ? items.reduce((a, b) => a + b.sentiment, 0) / items.length : 0;
    return { bull, bear, avg, total: items.length };
  }, [items]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            CRYPTO NEWS WIRE · RSS LIVE · {stats.total} HEADLINES
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            Sentiment {stats.avg >= 0 ? "+" : ""}{(stats.avg * 100).toFixed(0)} ·
            <span className="text-emerald-400 ml-2">▲ {stats.bull} bull</span>
            <span className="text-rose-400 ml-2">▼ {stats.bear} bear</span>
          </div>
        </div>
        <div className="flex gap-1 text-[10px]">
          {(["ALL","BULL","BEAR","BTC","ETH","ALT"] as const).map(k => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-2 py-1 rounded border font-bold ${
                filter === k ? "bg-amber-500 text-black border-amber-500" : "border-slate-700 text-slate-300 hover:border-amber-500/50"
              }`}>{k}</button>
          ))}
        </div>
      </div>

      <div className={`space-y-1.5 ${compact ? "max-h-[420px]" : "max-h-[720px]"} overflow-y-auto pr-1`}>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs opacity-50">Fetching live news…</div>
        )}
        {filtered.map(n => <Row key={n.id} n={n} />)}
      </div>
    </div>
  );
}

function Row({ n }: { n: NewsItem }) {
  return (
    <a href={n.link} target="_blank" rel="noopener noreferrer"
      className="block rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-amber-500/30 p-2.5 transition">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider flex-wrap">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{n.source}</span>
          <span className={`px-1.5 py-0.5 rounded border font-bold ${sentColor(n.sentiment)}`}>
            {sentLabel(n.sentiment)} {n.sentiment >= 0 ? "+" : ""}{(n.sentiment * 100).toFixed(0)}
          </span>
          {n.symbols.map(s => (
            <span key={s} className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">${s}</span>
          ))}
        </div>
        <span className="text-[10px] opacity-60 shrink-0">{timeAgo(n.publishedAt)} ago</span>
      </div>
      <div className="text-sm font-bold text-slate-100 leading-snug">{n.title}</div>
      {n.summary && <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.summary}</div>}
    </a>
  );
}
