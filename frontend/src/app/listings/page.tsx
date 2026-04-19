"use client";
import { useEffect, useState } from "react";
import MemePumpDumpPanel from "@/components/MemePumpDumpPanel";
import OnChainWhalePanel from "@/components/OnChainWhalePanel";
import CryptoIPOPanel from "@/components/CryptoIPOPanel";
import NewsWire from "@/components/NewsWire";

const API = "http://localhost:3002";
const num = (n: any, d = 2) => (Number.isFinite(n) ? Number(n).toFixed(d) : "—");
const usd = (n: any, d = 4) => (Number.isFinite(n) ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: d })}` : "—");
const compact = (n: any) => !Number.isFinite(n) ? "—" : n > 1e9 ? `$${(n/1e9).toFixed(2)}B` : n > 1e6 ? `$${(n/1e6).toFixed(2)}M` : n > 1e3 ? `$${(n/1e3).toFixed(1)}k` : `$${n.toFixed(0)}`;

async function getJson(path: string) { try { const r = await fetch(`${API}${path}`); return await r.json(); } catch { return null; } }

export default function ListingsPage() {
  const [memes, setMemes] = useState<any[]>([]);
  const [newListings, setNewListings] = useState<any[]>([]);
  const [ipo, setIpo] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [tab, setTab] = useState<"memes" | "new" | "ipo">("memes");

  useEffect(() => {
    const load = async () => {
      const [m, n, i, s] = await Promise.all([
        getJson("/api/listings/memes"),
        getJson("/api/listings/new"),
        getJson("/api/listings/ipo"),
        getJson("/api/listings/status"),
      ]);
      if (Array.isArray(m)) setMemes(m);
      if (Array.isArray(n)) setNewListings(n);
      if (Array.isArray(i)) setIpo(i);
      if (s) setStatus(s);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const verdictColor = (v: string) =>
    v === "BUY" ? "text-green-400 bg-green-500/10 border-green-500/50"
    : v === "WATCH" ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/50"
    : "text-red-400 bg-red-500/10 border-red-500/50";

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 space-y-4" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      {/* Header */}
      <div className="border border-green-500/40 rounded p-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] tracking-[0.3em] opacity-70">CRYPTO IPO ANALYST · MEME DESK · NEW LISTING ALERTS</div>
          <div className="text-xl font-bold text-white mt-1">🚀 Token Launches & Meme Coin Radar</div>
          <div className="text-xs mt-1 opacity-80">
            Tracking <span className="text-cyan-300 font-bold">{status?.trackedSymbols ?? 0}</span> Binance USDT pairs ·{" "}
            <span className="text-orange-300 font-bold">{status?.memeCount ?? 0}</span> memes ·{" "}
            <span className="text-purple-300 font-bold">{status?.ipoWindowCount ?? 0}</span> in 14-day IPO window ·{" "}
            BTC 24h <span className={status?.btc24hPct >= 0 ? "text-green-400" : "text-red-400"}>
              {status?.btc24hPct >= 0 ? "+" : ""}{num(status?.btc24hPct, 2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { k: "memes", label: `🐸 MEME DESK (${memes.length})` },
            { k: "new",   label: `🔔 NEW ALERTS (${newListings.length})` },
            { k: "ipo",   label: `📊 IPO ANALYST (${ipo.length})` },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={`px-3 py-1.5 rounded text-xs font-bold border ${
                tab === t.k ? "bg-green-500 text-black border-green-500" : "border-slate-700 text-slate-300 hover:border-green-500/50"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE REAL-TIME PANELS — always visible */}
      <CryptoIPOPanel />
      <NewsWire max={30} compact />
      <MemePumpDumpPanel />
      <OnChainWhalePanel />

      {/* MEME DESK (backend-sourced, supplementary) */}
      {tab === "memes" && (
        <div className="border border-orange-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 text-orange-400">🐸 MEME COIN DESK · LIVE</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {memes.map(m => (
              <div key={m.symbol} className="border border-slate-800 rounded p-3 bg-black/60 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-bold text-white">{m.symbol.replace("USDT", "")}</div>
                    <div className="text-[9px] opacity-50">{m.symbol}</div>
                  </div>
                  <div className={`text-xs font-black ${m.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {m.change24h >= 0 ? "▲" : "▼"} {num(m.change24h, 2)}%
                  </div>
                </div>
                <div className="text-xl font-bold tabular-nums mt-1 text-white">{usd(m.price, 8)}</div>
                <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
                  <KV k="24h Vol"  v={compact(m.quoteVolume)} cls="text-cyan-300" />
                  <KV k="Trades"   v={m.trades > 1e6 ? `${(m.trades/1e6).toFixed(1)}M` : m.trades > 1e3 ? `${(m.trades/1e3).toFixed(0)}k` : String(m.trades)} />
                  <KV k="24h Hi"   v={usd(m.high24h, 8)} cls="text-green-400" />
                  <KV k="24h Lo"   v={usd(m.low24h, 8)} cls="text-red-400" />
                  <KV k="Spread"   v={m.spreadPct != null ? `${num(m.spreadPct, 3)}%` : "—"} cls="opacity-70" />
                  <KV k="β vs BTC" v={m.betaVsBtc != null ? num(m.betaVsBtc, 2) : "—"} cls={m.betaVsBtc > 1.5 ? "text-purple-400" : ""} />
                </div>
                {Math.abs(m.change24h) > 20 && (
                  <div className={`absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded font-black ${m.change24h > 0 ? "bg-green-500/30 text-green-300" : "bg-red-500/30 text-red-300"}`}>
                    {m.change24h > 0 ? "🚀 PUMP" : "💀 DUMP"}
                  </div>
                )}
              </div>
            ))}
            {memes.length === 0 && <div className="col-span-full p-6 text-center opacity-50 text-xs">Loading meme desk…</div>}
          </div>
        </div>
      )}

      {/* NEW LISTING ALERTS */}
      {tab === "new" && (
        <div className="border border-cyan-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 text-cyan-400">🔔 NEW LISTING ALERTS · BINANCE exchangeInfo DIFF</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="text-cyan-400/70 border-b border-cyan-500/20">
                <tr><Th>Detected At</Th><Th>Token</Th><Th>Symbol</Th><Th>Listed At</Th><Th>Age</Th></tr>
              </thead>
              <tbody>
                {newListings.map((l, i) => (
                  <tr key={`${l.symbol}-${i}`} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <Td className="text-slate-300">{new Date(l.detectedAt).toLocaleString()}</Td>
                    <Td className="text-white font-bold">{l.base}</Td>
                    <Td className="text-cyan-300">{l.symbol}</Td>
                    <Td className="opacity-70">{l.listedAt ? new Date(l.listedAt).toLocaleString() : "—"}</Td>
                    <Td>{l.listedAt ? `${((Date.now() - l.listedAt) / 86400000).toFixed(1)}d` : "—"}</Td>
                  </tr>
                ))}
                {newListings.length === 0 && <tr><td colSpan={5} className="py-4 text-center opacity-50">No new listings detected yet — tracker runs every 60s</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IPO ANALYST */}
      {tab === "ipo" && (
        <div className="border border-purple-500/40 rounded p-3">
          <div className="text-xs font-bold tracking-widest mb-2 text-purple-400">📊 CRYPTO IPO ANALYST · TOKENS LISTED IN LAST 14 DAYS · RANKED</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ipo.map(t => (
              <div key={t.symbol} className="border border-slate-800 rounded p-3 bg-black/70">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-white">{t.base}</div>
                    <div className="text-[9px] opacity-50">{t.symbol} · {t.ageDays}d old</div>
                  </div>
                  <div className={`px-2 py-1 text-xs font-black rounded border ${verdictColor(t.verdict)}`}>
                    {t.verdict}
                  </div>
                </div>

                <div className="mt-2 text-lg font-bold tabular-nums text-white">{usd(t.price, 8)}
                  <span className={`ml-2 text-xs ${t.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.change24h >= 0 ? "▲" : "▼"} {num(t.change24h, 2)}%
                  </span>
                </div>

                {/* Score bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] opacity-60 mb-0.5">
                    <span>ANALYST SCORE</span>
                    <span className="font-bold text-white">{t.score}/100</span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded overflow-hidden">
                    <div
                      className={`h-full ${t.score >= 70 ? "bg-green-500" : t.score >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${t.score}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
                  <KV k="24h Vol" v={compact(t.quoteVolume)} cls="text-cyan-300" />
                  <KV k="Trades"  v={t.trades > 1e3 ? `${(t.trades/1e3).toFixed(0)}k` : String(t.trades)} />
                  <KV k="Spread"  v={`${num(t.spreadPct, 3)}%`} cls={t.spreadPct < 0.1 ? "text-green-400" : "text-yellow-300"} />
                  <KV k="Age"     v={`${t.ageDays}d`} />
                </div>

                <div className="mt-2 text-[10px] opacity-80 leading-relaxed border-t border-slate-800 pt-2">
                  ▸ {t.reasoning}
                </div>
              </div>
            ))}
            {ipo.length === 0 && <div className="col-span-full p-6 text-center opacity-50 text-xs">No tokens in 14-day IPO window yet</div>}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] opacity-70 leading-relaxed">
            Scoring factors: 24h volume (liquidity gate) · 24h move (hype vs overheat penalty above +50%) · bid-ask spread (MM quality) ·
            trade count (activity) · listing age (1–7 day sweet spot).
            <span className="text-green-400 font-bold"> BUY ≥ 70</span> · <span className="text-yellow-300 font-bold">WATCH 50–69</span> · <span className="text-red-400 font-bold">AVOID &lt; 50</span>.
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return <div className="flex justify-between"><span className="opacity-60">{k}</span><span className={`font-bold ${cls || "text-slate-200"}`}>{v}</span></div>;
}
function Th({ children }: any) { return <th className="py-1.5 px-2 text-left font-normal uppercase tracking-wider text-[10px]">{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={`py-1.5 px-2 ${className}`}>{children}</td>; }
