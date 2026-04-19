"use client";
/**
 * On-Chain Whale Wallets Panel
 * ────────────────────────────
 * Live BTC transactions ≥ 50 BTC direct from blockchain.info.
 * Tags known exchange/fund/government wallets. Classifies direction
 * (inflow = bearish, outflow = bullish).
 */

import { useMemo } from "react";
import { useOnChainWhales, type ChainTx } from "@/lib/onChainFeed";

export default function OnChainWhalePanel() {
  const tape = useOnChainWhales();

  const kpi = useMemo(() => {
    let megaCount = 0, totBtc = 0, inflowUsd = 0, outflowUsd = 0;
    for (const t of tape.slice(0, 60)) {
      totBtc += t.totalBtc;
      if (t.tier === "MEGA") megaCount++;
      if (t.direction === "exchange_inflow") inflowUsd += t.totalUsd;
      if (t.direction === "exchange_outflow") outflowUsd += t.totalUsd;
    }
    const net = outflowUsd - inflowUsd; // +ve = accumulation (bullish)
    return { megaCount, totBtc, inflowUsd, outflowUsd, net };
  }, [tape]);

  const netTone = kpi.net > 0 ? "text-emerald-300" : kpi.net < 0 ? "text-rose-300" : "text-slate-300";

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-orange-950/30 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-orange-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            ON-CHAIN · BTC WALLET MOVES
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">Live firehose · blockchain.info · ≥ 50 BTC</div>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <KPI label="MEGA (≥1000 BTC)" value={String(kpi.megaCount)} />
          <KPI label="TOTAL FLOW" value={`${kpi.totBtc.toFixed(0)} BTC`} />
          <KPI label="EXCH INFLOW" value={`$${(kpi.inflowUsd / 1e6).toFixed(1)}M`} tone="rose" />
          <KPI label="EXCH OUTFLOW" value={`$${(kpi.outflowUsd / 1e6).toFixed(1)}M`} tone="emerald" />
          <KPI label="NET SENTIMENT" value={`${kpi.net >= 0 ? "+" : ""}$${(kpi.net / 1e6).toFixed(1)}M`} tone={kpi.net >= 0 ? "emerald" : "rose"} />
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
        {tape.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            Listening for BTC whale transfers on mainnet… (usually 1–3 per minute)
          </div>
        ) : (
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-3 py-1.5">Time</th>
                <th className="text-right px-2 py-1.5">BTC</th>
                <th className="text-right px-2 py-1.5">USD</th>
                <th className="text-left px-2 py-1.5">Tier</th>
                <th className="text-left px-2 py-1.5">Direction</th>
                <th className="text-left px-2 py-1.5">From → To</th>
                <th className="text-left px-3 py-1.5">Tx</th>
              </tr>
            </thead>
            <tbody>
              {tape.slice(0, 60).map(t => <Row key={t.id} t={t} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({ t }: { t: ChainTx }) {
  const dirIcon =
    t.direction === "exchange_inflow" ? "📥"
    : t.direction === "exchange_outflow" ? "📤"
    : t.direction === "wallet_to_wallet" ? "🔄" : "•";
  const dirLabel =
    t.direction === "exchange_inflow" ? "INFLOW · bearish"
    : t.direction === "exchange_outflow" ? "OUTFLOW · bullish"
    : t.direction === "wallet_to_wallet" ? "Wallet→Wallet" : "Unknown";
  const dirColor =
    t.direction === "exchange_inflow" ? "text-rose-300"
    : t.direction === "exchange_outflow" ? "text-emerald-300"
    : "text-slate-400";
  const tierColor =
    t.tier === "MEGA" ? "bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-500/50" :
    t.tier === "LARGE" ? "bg-amber-500/20 text-amber-200 border-amber-500/40" :
    "bg-slate-700/40 text-slate-300 border-slate-600/40";
  const rowBg = t.tier === "MEGA" ? "bg-fuchsia-500/5" : t.tier === "LARGE" ? "bg-amber-500/5" : "";

  return (
    <tr className={`border-b border-slate-900 hover:bg-slate-900/40 ${rowBg}`}>
      <td className="px-3 py-1 text-slate-500">{new Date(t.ts).toLocaleTimeString()}</td>
      <td className="px-2 py-1 text-right text-slate-200 font-bold">{t.totalBtc.toFixed(1)}</td>
      <td className="px-2 py-1 text-right text-slate-300">${(t.totalUsd / 1e6).toFixed(2)}M</td>
      <td className="px-2 py-1">
        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${tierColor}`}>{t.tier}</span>
      </td>
      <td className={`px-2 py-1 ${dirColor}`}>{dirIcon} {dirLabel}</td>
      <td className="px-2 py-1 text-slate-400">
        {t.inputsLabel || "—"} → {t.outputsLabel || "—"}
      </td>
      <td className="px-3 py-1">
        <a href={`https://www.blockchain.com/btc/tx/${t.hash}`} target="_blank" rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline">
          {t.hash.slice(0, 8)}…
        </a>
      </td>
    </tr>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const c = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-slate-200";
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-bold ${c}`}>{value}</div>
    </div>
  );
}
