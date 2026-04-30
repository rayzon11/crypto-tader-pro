"use client";
/**
 * CryptoIPOPanel — real-time token launch analyst
 * ────────────────────────────────────────────────
 * Reads useIpoRows() (Binance exchangeInfo + live @ticker) and
 * shows every USDT pair listed in the last 30 days, ranked by our
 * composite score with whale buy/sell pressure overlay.
 */
import { useMemo, useState } from "react";
import { useIpoRows, type IpoRow } from "@/lib/ipoFeed";

const num = (n: any, d = 2) => (Number.isFinite(n) ? Number(n).toFixed(d) : "—");
const usd = (n: any, d = 4) => (Number.isFinite(n) ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: d })}` : "—");
const compact = (n: any) => !Number.isFinite(n) ? "—" : n > 1e9 ? `$${(n/1e9).toFixed(2)}B` : n > 1e6 ? `$${(n/1e6).toFixed(2)}M` : n > 1e3 ? `$${(n/1e3).toFixed(1)}k` : `$${n.toFixed(0)}`;

const verdictClass = (v: string) =>
  v === "BUY" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/50"
  : v === "WATCH" ? "text-amber-300 bg-amber-500/20 border-amber-500/50"
  : "text-rose-300 bg-rose-500/20 border-rose-500/50";

export default function CryptoIPOPanel() {
  const rows = useIpoRows();
  const [sort, setSort] = useState<"score" | "age" | "change" | "vol">("score");

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sort === "score")  arr.sort((a, b) => b.score - a.score);
    if (sort === "age")    arr.sort((a, b) => a.ageDays - b.ageDays);
    if (sort === "change") arr.sort((a, b) => b.change24h - a.change24h);
    if (sort === "vol")    arr.sort((a, b) => b.quoteVolume - a.quoteVolume);
    return arr;
  }, [rows, sort]);

  const stats = useMemo(() => {
    const buy = rows.filter(r => r.verdict === "BUY").length;
    const watch = rows.filter(r => r.verdict === "WATCH").length;
    const avoid = rows.filter(r => r.verdict === "AVOID").length;
    const whaleAccum = rows.filter(r => (r.whalePressure ?? 0) > 0.15).length;
    return { buy, watch, avoid, whaleAccum, total: rows.length };
  }, [rows]);

  return (
    <div className="rounded-xl border border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-purple-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            CRYPTO IPO ANALYST · BINANCE EXCHANGEINFO LIVE · WHALE-OVERLAY
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {stats.total} tokens listed ≤30d ·
            <span className="text-emerald-400 ml-2">🟢 {stats.buy} BUY</span>
            <span className="text-amber-300 ml-2">🟡 {stats.watch} WATCH</span>
            <span className="text-rose-400 ml-2">🔴 {stats.avoid} AVOID</span>
            <span className="text-cyan-300 ml-2">🐋 {stats.whaleAccum} whale-accumulating</span>
          </div>
        </div>
        <div className="flex gap-1 text-[10px]">
          {(["score","age","change","vol"] as const).map(k => (
            <button key={k} onClick={() => setSort(k)}
              className={`px-2 py-1 rounded border font-bold uppercase ${
                sort === k ? "bg-purple-500 text-black border-purple-500" : "border-slate-700 text-slate-300 hover:border-purple-500/50"
              }`}>{k}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.length === 0 && (
          <div className="col-span-full p-8 text-center text-xs opacity-50">
            Fetching live Binance exchangeInfo…
          </div>
        )}
        {sorted.map(r => <Card key={r.symbol} r={r} />)}
      </div>

      <div className="pt-2 border-t border-slate-800 text-[10px] opacity-70 leading-relaxed">
        Score = 35% volume + 25% 24h move + 25% whale pressure + 15% listing-age sweet spot (1–7d).
        Overheating penalty applies above +50% 24h.
        <span className="text-emerald-400 font-bold"> BUY ≥ 70</span> ·{" "}
        <span className="text-amber-300 font-bold">WATCH 50–69</span> ·{" "}
        <span className="text-rose-400 font-bold">AVOID &lt; 50</span>.
      </div>
    </div>
  );
}

function Card({ r }: { r: IpoRow }) {
  const wp = r.whalePressure ?? 0;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-black text-white">{r.base}</div>
          <div className="text-[9px] opacity-50">{r.symbol} · {r.ageDays}d old</div>
        </div>
        <div className={`px-2 py-0.5 text-[10px] font-black rounded border ${verdictClass(r.verdict)}`}>
          {r.verdict}
        </div>
      </div>

      <div className="mt-1 text-lg font-bold tabular-nums text-white">
        {usd(r.price, 8)}
        <span className={`ml-2 text-xs ${r.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {r.change24h >= 0 ? "▲" : "▼"} {num(r.change24h, 2)}%
        </span>
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-[9px] opacity-60 mb-0.5">
          <span>ANALYST SCORE</span>
          <span className="font-bold text-white">{r.score}/100</span>
        </div>
        <div className="h-2 bg-slate-800 rounded overflow-hidden">
          <div className={`h-full ${r.score >= 70 ? "bg-emerald-500" : r.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${r.score}%` }} />
        </div>
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-[9px] opacity-60 mb-0.5">
          <span>🐋 WHALE PRESSURE (1m)</span>
          <span className={`font-bold ${wp > 0.15 ? "text-emerald-300" : wp < -0.15 ? "text-rose-300" : "text-slate-400"}`}>
            {r.whalePressure == null ? "—" : (wp >= 0 ? "+" : "") + (wp * 100).toFixed(0)}
          </span>
        </div>
        <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="absolute top-0 bottom-0 w-px bg-slate-700 left-1/2" />
          <div className={`absolute top-0 h-full ${wp > 0 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{
              left: wp >= 0 ? "50%" : `${50 - Math.abs(wp) * 50}%`,
              width: `${Math.min(50, Math.abs(wp) * 50)}%`,
            }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
        <KV k="24h Vol" v={compact(r.quoteVolume)} cls="text-cyan-300" />
        <KV k="Trades"  v={r.trades > 1e3 ? `${(r.trades/1e3).toFixed(0)}k` : String(r.trades || 0)} />
        <KV k="Age"     v={`${r.ageDays}d`} />
        <KV k="Listed"  v={new Date(r.listedAt).toLocaleDateString()} cls="opacity-70" />
      </div>

      <div className="mt-2 text-[10px] opacity-80 leading-relaxed border-t border-slate-800 pt-2">
        ▸ {r.reasoning}
      </div>
    </div>
  );
}

function KV({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return <div className="flex justify-between"><span className="opacity-60">{k}</span><span className={`font-bold ${cls || "text-slate-200"}`}>{v}</span></div>;
}
