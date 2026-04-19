"use client";
/**
 * Strategist Desk — BlackRock / JPM-style institutional lens
 * ──────────────────────────────────────────────────────────
 * Aggregates every signal already flowing through the app:
 *   • Order-flow regime  (whaleFeed)
 *   • On-chain sentiment (onChainFeed)
 *   • Meme speculation   (memeScanner)
 *   • Market breadth     (useLiveTickers)
 *
 * Outputs a single, plain-English strategist call + position sizing hints,
 * plus a "conviction stack" showing which signals agree.
 */

import { useMemo } from "react";
import { useFlowStats, useWhaleTape } from "@/lib/whaleFeed";
import { useOnChainWhales } from "@/lib/onChainFeed";
import { useMemeRows } from "@/lib/memeScanner";
import { useLiveTickers } from "@/lib/liveStore";

const MAJORS = ["BTC/USDT","ETH/USDT","SOL/USDT","BNB/USDT","XRP/USDT","ADA/USDT","DOGE/USDT","AVAX/USDT","LINK/USDT","MATIC/USDT","DOT/USDT","LTC/USDT","TRX/USDT","NEAR/USDT"];

export default function StrategistDesk() {
  const flow = useFlowStats();
  const tape = useWhaleTape();
  const chain = useOnChainWhales();
  const memes = useMemeRows();
  const tickers = useLiveTickers(MAJORS);

  const call = useMemo(() => {
    // ── Flow pressure: aggregate weighted buy vs sell across top pairs ──
    let fBuy = 0, fSell = 0;
    for (const p of MAJORS) {
      const s = flow[p]; if (!s) continue;
      fBuy += s.buyUsd; fSell += s.sellUsd;
    }
    const flowPressure = fBuy + fSell > 0 ? (fBuy - fSell) / (fBuy + fSell) : 0; // -1..1

    // ── Breadth: % of majors up on the day ──
    let upN = 0, totN = 0, sumChg = 0;
    for (const p of MAJORS) {
      const t = tickers[p]; if (!t) continue;
      totN++; sumChg += t.change24h; if (t.change24h > 0) upN++;
    }
    const breadth = totN > 0 ? upN / totN : 0.5;
    const avgChg = totN > 0 ? sumChg / totN : 0;

    // ── On-chain net ──
    let chInflow = 0, chOutflow = 0;
    for (const t of chain.slice(0, 60)) {
      if (t.direction === "exchange_inflow")  chInflow  += t.totalUsd;
      if (t.direction === "exchange_outflow") chOutflow += t.totalUsd;
    }
    const chainNet = chOutflow - chInflow;
    const chainScore = Math.max(-1, Math.min(1, chainNet / 50_000_000));

    // ── Meme speculation heat ──
    const memePump = memes.filter(r => r.verdict === "PUMP").length;
    const memeDump = memes.filter(r => r.verdict === "DUMP").length;
    const memeHeat = memes.length ? (memePump - memeDump) / memes.length : 0;

    // ── Mega trade bias in last 200 prints ──
    const recent = tape.slice(0, 200);
    const megaBuy = recent.filter(t => t.tier === "MEGA" && t.side === "BUY").length;
    const megaSell = recent.filter(t => t.tier === "MEGA" && t.side === "SELL").length;
    const megaBias = megaBuy + megaSell > 0 ? (megaBuy - megaSell) / (megaBuy + megaSell) : 0;

    // Composite conviction (-1..+1)
    const conviction = 0.30 * flowPressure + 0.20 * (breadth * 2 - 1) + 0.20 * chainScore + 0.15 * megaBias + 0.15 * memeHeat;

    // Map to stance
    let stance: "RISK-ON · AGGRESSIVE" | "RISK-ON" | "NEUTRAL · CAUTIOUS" | "RISK-OFF" | "RISK-OFF · DEFENSIVE" = "NEUTRAL · CAUTIOUS";
    if (conviction >= 0.45) stance = "RISK-ON · AGGRESSIVE";
    else if (conviction >= 0.15) stance = "RISK-ON";
    else if (conviction <= -0.45) stance = "RISK-OFF · DEFENSIVE";
    else if (conviction <= -0.15) stance = "RISK-OFF";

    // Position sizing (of a notional $10k book)
    const gross = Math.min(1, Math.abs(conviction) * 1.2);      // 0..100% utilization
    const longPct = conviction > 0 ? gross : 0;
    const shortPct = conviction < 0 ? gross : 0;
    const cashPct = 1 - (longPct + shortPct);

    // Strategist narrative
    const bullets: string[] = [];
    bullets.push(
      flowPressure > 0.15 ? `Aggressive buyers dominating tape (+${(flowPressure * 100).toFixed(0)}% pressure)` :
      flowPressure < -0.15 ? `Aggressive sellers hitting the bid (${(flowPressure * 100).toFixed(0)}% pressure)` :
      `Order-flow balanced (${(flowPressure * 100).toFixed(0)}%)`
    );
    bullets.push(
      breadth > 0.65 ? `Broad strength: ${upN}/${totN} majors green, avg +${avgChg.toFixed(2)}%` :
      breadth < 0.35 ? `Broad weakness: only ${upN}/${totN} majors green, avg ${avgChg.toFixed(2)}%` :
      `Mixed tape: ${upN}/${totN} majors up, avg ${avgChg.toFixed(2)}%`
    );
    bullets.push(
      chainNet > 10_000_000 ? `On-chain: $${(chainNet / 1e6).toFixed(1)}M net outflow from exchanges — accumulation` :
      chainNet < -10_000_000 ? `On-chain: $${(Math.abs(chainNet) / 1e6).toFixed(1)}M net inflow to exchanges — distribution risk` :
      `On-chain: flat exchange netting`
    );
    bullets.push(
      megaBias > 0.3 ? `Mega prints (≥$1M): ${megaBuy} buys vs ${megaSell} sells — institutions long` :
      megaBias < -0.3 ? `Mega prints: ${megaSell} sells vs ${megaBuy} buys — institutions offloading` :
      `Mega prints balanced (${megaBuy}/${megaSell})`
    );
    bullets.push(
      memePump > memeDump + 3 ? `Retail heat: ${memePump} memes pumping — speculative froth` :
      memeDump > memePump + 3 ? `Retail capitulation: ${memeDump} memes dumping` :
      `Retail: ${memePump} pumps / ${memeDump} dumps (cool)`
    );

    return {
      conviction, stance,
      alloc: { longPct, shortPct, cashPct },
      bullets,
      components: {
        flow: flowPressure, breadth: breadth * 2 - 1, chain: chainScore,
        mega: megaBias, meme: memeHeat,
      },
    };
  }, [flow, tape, chain, memes, tickers]);

  const stanceColor =
    call.stance.startsWith("RISK-ON · AGG") ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/50" :
    call.stance === "RISK-ON" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" :
    call.stance === "RISK-OFF" ? "bg-rose-500/10 text-rose-300 border-rose-500/30" :
    call.stance.startsWith("RISK-OFF · DEF") ? "bg-rose-500/20 text-rose-200 border-rose-500/50" :
    "bg-amber-500/10 text-amber-200 border-amber-500/30";

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-blue-950/30 to-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            STRATEGIST DESK · CROSS-ASSET ALPHA
          </div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">Conviction-weighted house view · refreshes every second</div>
        </div>
        <div className={`px-3 py-1.5 rounded border text-xs font-bold ${stanceColor}`}>
          {call.stance} · {(call.conviction * 100).toFixed(0)}
        </div>
      </div>

      {/* Allocation strip */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">SUGGESTED BOOK ALLOCATION</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-800">
          <div className="bg-emerald-500" style={{ width: `${call.alloc.longPct * 100}%` }} title={`Long ${(call.alloc.longPct * 100).toFixed(0)}%`} />
          <div className="bg-rose-500" style={{ width: `${call.alloc.shortPct * 100}%` }} title={`Short ${(call.alloc.shortPct * 100).toFixed(0)}%`} />
          <div className="bg-slate-600" style={{ width: `${Math.max(0, call.alloc.cashPct * 100)}%` }} title={`Cash ${(call.alloc.cashPct * 100).toFixed(0)}%`} />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-mono">
          <span className="text-emerald-300">LONG {(call.alloc.longPct * 100).toFixed(0)}%</span>
          <span className="text-rose-300">SHORT {(call.alloc.shortPct * 100).toFixed(0)}%</span>
          <span className="text-slate-400">CASH {(Math.max(0, call.alloc.cashPct) * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Narrative bullets */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">HOUSE VIEW</div>
        <ul className="space-y-1 text-xs text-slate-200">
          {call.bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="text-slate-500">▸</span><span>{b}</span></li>)}
        </ul>
      </div>

      {/* Signal stack */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Signal label="ORDER FLOW" v={call.components.flow} />
        <Signal label="BREADTH" v={call.components.breadth} />
        <Signal label="ON-CHAIN" v={call.components.chain} />
        <Signal label="MEGA PRINTS" v={call.components.mega} />
        <Signal label="MEME HEAT" v={call.components.meme} />
      </div>
    </div>
  );
}

function Signal({ label, v }: { label: string; v: number }) {
  const pct = Math.abs(v) * 100;
  const color = v > 0.1 ? "bg-emerald-500" : v < -0.1 ? "bg-rose-500" : "bg-slate-500";
  const tone = v > 0.1 ? "text-emerald-300" : v < -0.1 ? "text-rose-300" : "text-slate-400";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-[11px] font-mono font-bold ${tone}`}>{v >= 0 ? "+" : ""}{(v * 100).toFixed(0)}</span>
      </div>
      <div className="relative h-1.5 mt-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-px bg-slate-700 left-1/2" />
        <div className={`absolute top-0 h-full ${color}`}
          style={{ left: v >= 0 ? "50%" : `${50 - pct / 2}%`, width: `${pct / 2}%` }} />
      </div>
    </div>
  );
}
