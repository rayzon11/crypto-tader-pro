"use client";

import { useMemo } from "react";
import { summary, type Candle } from "@/lib/indicators";

const fmt = (n: any, d = 2): string => (Number.isFinite(n) ? Number(n).toFixed(d) : "—");
const pct = (n: any, d = 2): string => (Number.isFinite(n) ? `${Number(n).toFixed(d)}%` : "—");

function signal(n: any, bull: number, bear: number): { label: string; cls: string } {
  if (!Number.isFinite(n)) return { label: "—", cls: "text-slate-500" };
  if (n >= bull) return { label: "BULL", cls: "text-green-400" };
  if (n <= bear) return { label: "BEAR", cls: "text-red-400" };
  return { label: "NEUT", cls: "text-yellow-300" };
}

export default function IndicatorGrid({ candles, title = "ALL INDICATORS · LIVE" }: { candles: Candle[]; title?: string }) {
  const s = useMemo(() => summary(candles), [candles]);
  if (!s) {
    return (
      <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-4 text-xs text-slate-500">
        Need ≥ 30 candles to compute indicators…
      </div>
    );
  }

  const rsiSig = signal(s.rsi14, 70, 30);
  const stochSig = signal(s.stochK, 80, 20);
  const stochRsiSig = signal(s.stochRsiK, 80, 20);
  const mfiSig = signal(s.mfi14, 80, 20);
  const cciSig = signal(s.cci20, 100, -100);
  const wprSig = signal(s.wpr14, -20, -80);
  const adxStrength =
    !Number.isFinite(s.adx14) ? { label: "—", cls: "text-slate-500" }
    : s.adx14 >= 40 ? { label: "V.STRONG", cls: "text-purple-400" }
    : s.adx14 >= 25 ? { label: "STRONG",   cls: "text-green-400" }
    : s.adx14 >= 20 ? { label: "DEVLPNG",  cls: "text-yellow-300" }
                    : { label: "WEAK",     cls: "text-slate-400" };
  const mh = s.macdHist ?? 0;
  const macdSig = mh > 0 ? { label: "BULL", cls: "text-green-400" } : mh < 0 ? { label: "BEAR", cls: "text-red-400" } : { label: "—", cls: "text-slate-500" };

  // Composite vote
  const bulls = [rsiSig, stochSig, stochRsiSig, mfiSig, cciSig, wprSig, macdSig].filter(x => x.label === "BULL").length;
  const bears = [rsiSig, stochSig, stochRsiSig, mfiSig, cciSig, wprSig, macdSig].filter(x => x.label === "BEAR").length;
  const vote =
    bulls > bears + 1 ? { label: `STRONG BUY (${bulls}/${bulls + bears + 1})`, cls: "text-green-400 bg-green-500/10 border-green-500/50" }
    : bears > bulls + 1 ? { label: `STRONG SELL (${bears}/${bulls + bears + 1})`, cls: "text-red-400 bg-red-500/10 border-red-500/50" }
    : bulls > bears ? { label: "BUY", cls: "text-green-300 border-green-500/30" }
    : bears > bulls ? { label: "SELL", cls: "text-red-300 border-red-500/30" }
    : { label: "NEUTRAL", cls: "text-yellow-300 border-yellow-500/30" };

  return (
    <div className="bg-slate-900/70 border border-cyan-500/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-cyan-300 tracking-widest uppercase">◆ {title}</div>
        <div className={`px-3 py-1 text-xs font-black rounded border ${vote.cls}`}>{vote.label}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] font-mono">
        {/* Trend */}
        <Section title="TREND" />
        <Cell k="SMA 20"  v={fmt(s.sma20)}  />
        <Cell k="SMA 50"  v={fmt(s.sma50)}  />
        <Cell k="SMA 200" v={fmt(s.sma200)} />
        <Cell k="EMA 9"   v={fmt(s.ema9)}   cls={(s.price ?? 0) > (s.ema9 ?? 0) ? "text-green-400" : "text-red-400"} />
        <Cell k="EMA 20"  v={fmt(s.ema20)}  cls={(s.price ?? 0) > (s.ema20 ?? 0) ? "text-green-400" : "text-red-400"} />
        <Cell k="EMA 50"  v={fmt(s.ema50)}  cls={(s.price ?? 0) > (s.ema50 ?? 0) ? "text-green-400" : "text-red-400"} />
        <Cell k="EMA 200" v={fmt(s.ema200)} cls={(s.price ?? 0) > (s.ema200 ?? 0) ? "text-green-400" : "text-red-400"} />
        <Cell k="HMA 21"  v={fmt(s.hma21)}  />
        <Cell k="KAMA"    v={fmt(s.kama)}   />
        <Cell k="VWAP"    v={fmt(s.vwap)}   cls={(s.price ?? 0) > (s.vwap ?? 0) ? "text-green-400" : "text-red-400"} />
        <Cell k="Ichi Tenkan" v={fmt(s.ichTenkan)} />
        <Cell k="Ichi Kijun"  v={fmt(s.ichKijun)}  />

        {/* Momentum */}
        <Section title="MOMENTUM" />
        <Cell k="RSI 14"     v={fmt(s.rsi14)}    sub={rsiSig.label}  cls={rsiSig.cls} />
        <Cell k="Stoch %K"   v={fmt(s.stochK)}   sub={stochSig.label} cls={stochSig.cls} />
        <Cell k="Stoch %D"   v={fmt(s.stochD)}   />
        <Cell k="StochRSI K" v={fmt(s.stochRsiK)} sub={stochRsiSig.label} cls={stochRsiSig.cls} />
        <Cell k="MACD"       v={fmt(s.macd)}     />
        <Cell k="MACD Sig"   v={fmt(s.macdSignal)} />
        <Cell k="MACD Hist"  v={fmt(s.macdHist)}  sub={macdSig.label} cls={macdSig.cls} />
        <Cell k="CCI 20"     v={fmt(s.cci20)}    sub={cciSig.label}  cls={cciSig.cls} />
        <Cell k="Williams %R" v={fmt(s.wpr14)}   sub={wprSig.label}  cls={wprSig.cls} />
        <Cell k="ROC 10"     v={pct(s.roc10)}    cls={(s.roc10 ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
        <Cell k="Momentum"   v={fmt(s.mom10)}    />
        <Cell k="TRIX"       v={fmt(s.trix, 3)}  />
        <Cell k="Awesome Osc" v={fmt(s.ao)}      cls={(s.ao ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
        <Cell k="Ultimate Osc" v={fmt(s.uo)}     />

        {/* Volatility */}
        <Section title="VOLATILITY" />
        <Cell k="ATR 14"     v={fmt(s.atr14)}    />
        <Cell k="BB Upper"   v={fmt(s.bbUpper)}  />
        <Cell k="BB Middle"  v={fmt(s.bbMid)}    />
        <Cell k="BB Lower"   v={fmt(s.bbLower)}  />
        <Cell k="BB Width"   v={pct(s.bbBW)}     />
        <Cell k="BB %B"      v={fmt(s.bbPB, 3)}  />
        <Cell k="Kelt Upper" v={fmt(s.kcUpper)}  />
        <Cell k="Kelt Lower" v={fmt(s.kcLower)}  />
        <Cell k="Donch Up"   v={fmt(s.dcUpper)}  />
        <Cell k="Donch Low"  v={fmt(s.dcLower)}  />

        {/* Volume */}
        <Section title="VOLUME" />
        <Cell k="OBV"        v={fmt(s.obv, 0)}   />
        <Cell k="MFI 14"     v={fmt(s.mfi14)}    sub={mfiSig.label} cls={mfiSig.cls} />
        <Cell k="Chaikin MF" v={fmt(s.cmf, 3)}   cls={(s.cmf ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
        <Cell k="Force Idx"  v={fmt(s.forceIdx, 0)} />

        {/* Trend strength */}
        <Section title="STRENGTH" />
        <Cell k="ADX 14"     v={fmt(s.adx14)}   sub={adxStrength.label} cls={adxStrength.cls} />
        <Cell k="+DI"        v={fmt(s.plusDI)}  cls="text-green-400" />
        <Cell k="-DI"        v={fmt(s.minusDI)} cls="text-red-400" />
        <Cell k="Aroon Up"   v={fmt(s.aroonUp)} cls={(s.aroonUp ?? 0) > 70 ? "text-green-400" : ""} />
        <Cell k="Aroon Dn"   v={fmt(s.aroonDn)} cls={(s.aroonDn ?? 0) > 70 ? "text-red-400" : ""} />
        <Cell k="Choppiness" v={fmt(s.chop)}    sub={(s.chop ?? 50) > 61.8 ? "CHOP" : (s.chop ?? 50) < 38.2 ? "TREND" : "—"} />

        {/* Levels */}
        {s.pivots && <>
          <Section title="PIVOTS (CLASSIC)" />
          <Cell k="R3" v={fmt(s.pivots.classic.R3)} cls="text-red-400" />
          <Cell k="R2" v={fmt(s.pivots.classic.R2)} cls="text-red-300" />
          <Cell k="R1" v={fmt(s.pivots.classic.R1)} cls="text-red-200" />
          <Cell k="P"  v={fmt(s.pivots.classic.P)}  cls="text-white font-bold" />
          <Cell k="S1" v={fmt(s.pivots.classic.S1)} cls="text-green-200" />
          <Cell k="S2" v={fmt(s.pivots.classic.S2)} cls="text-green-300" />
          <Cell k="S3" v={fmt(s.pivots.classic.S3)} cls="text-green-400" />
        </>}
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="col-span-full border-t border-cyan-500/20 mt-1 pt-1">
      <div className="text-[9px] tracking-[0.3em] text-cyan-400/80 uppercase">{title}</div>
    </div>
  );
}

function Cell({ k, v, sub, cls = "" }: { k: string; v: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded bg-slate-950/60 border border-slate-800 p-1.5">
      <div className="text-[9px] opacity-50 uppercase tracking-wider">{k}</div>
      <div className={`font-bold tabular-nums ${cls || "text-slate-200"}`}>{v}</div>
      {sub && <div className={`text-[8px] mt-0.5 ${cls || "opacity-60"}`}>{sub}</div>}
    </div>
  );
}
