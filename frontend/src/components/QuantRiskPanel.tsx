"use client";
/**
 * Quant Risk Panel
 * ────────────────
 * Renders heavy-math outputs on live candles:
 *   Kalman prediction, GARCH(1,1) vol, composite forecast ensemble,
 *   Cornish-Fisher VaR / ES, Hurst, HMM regime probability,
 *   Ornstein-Uhlenbeck half-life, Shannon entropy, VPIN, composite risk.
 */

import { useMemo } from "react";
import {
  kalman1D, garch11, hurstExponent, cornishFisherVaR,
  fitOU, hmmRegime, shannonEntropy, vpin,
  compositeForecast, compositeRisk, logReturns,
} from "@/lib/quantMath";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume?: number }

export default function QuantRiskPanel({ candles, pair = "BTC/USDT" }: { candles: Candle[]; pair?: string }) {
  // normalize missing volume
  candles = (candles || []).map(c => ({ ...c, volume: c.volume ?? 0 }));
  const q = useMemo(() => {
    if (!candles || candles.length < 60) return null;
    const closes = candles.map(c => c.close);
    const rets = logReturns(closes);
    const last = closes[closes.length - 1];

    const kf = kalman1D(closes);
    const gh = garch11(rets);
    const hu = hurstExponent(closes);
    const var95 = cornishFisherVaR(rets, 0.05);
    const var99 = cornishFisherVaR(rets, 0.01);
    const ou = fitOU(closes);
    const hmm = hmmRegime(rets);
    const ent = shannonEntropy(rets, 16);
    const tox = vpin(candles.map(c => ({ open: c.open, close: c.close, volume: c.volume ?? 0 })), 50, 50);
    const fc = compositeForecast(closes, 10);

    // Drawdown
    let peak = closes[0], maxDD = 0;
    for (const p of closes) { if (p > peak) peak = p; const dd = (peak - p) / peak * 100; if (dd > maxDD) maxDD = dd; }

    const avgVol = Math.sqrt(rets.reduce((s, r) => s + r * r, 0) / Math.max(1, rets.length));
    const risk = compositeRisk({
      garchVol: gh.forecast || avgVol,
      avgVol,
      drawdownPct: maxDD,
      vpin: tox,
      hurst: hu,
      kurtosis: var95.kurt,
    });

    return { last, kf, gh, hu, var95, var99, ou, hmm, ent, tox, fc, maxDD, risk };
  }, [candles]);

  if (!q) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-500 text-xs">
        Quant Risk Panel · accumulating candles ({candles?.length || 0}/60 needed)
      </div>
    );
  }

  const pctColor = (v: number) => v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-slate-300";
  const pct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;

  const riskColor =
    q.risk.level === "EXTREME" ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
    q.risk.level === "HIGH" ? "bg-orange-500/20 text-orange-300 border-orange-500/40" :
    q.risk.level === "ELEVATED" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
    "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  const hurstRegime = q.hu > 0.55 ? "TRENDING" : q.hu < 0.45 ? "MEAN-REVERTING" : "RANDOM WALK";
  const hurstColor = q.hu > 0.55 ? "text-emerald-300" : q.hu < 0.45 ? "text-sky-300" : "text-slate-300";

  const kfPredPct = (q.kf.prediction - q.last) / q.last * 100;
  const fcPct = q.fc ? (q.fc.point - q.last) / q.last * 100 : 0;
  const fcBandLow = q.fc ? (q.fc.p05 - q.last) / q.last * 100 : 0;
  const fcBandHigh = q.fc ? (q.fc.p95 - q.last) / q.last * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-950/80 to-slate-950/40 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">QUANT RISK · HEAVY MATH</div>
          <div className="text-sm font-bold text-slate-100">{pair} · {candles.length} bars</div>
        </div>
        <div className={`px-3 py-1.5 rounded border text-xs font-bold ${riskColor}`}>
          RISK {q.risk.level} · {q.risk.score.toFixed(1)}/100
        </div>
      </div>

      {/* Composite forecast band */}
      {q.fc && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-400">ENSEMBLE FORECAST · 10-BAR HORIZON</div>
            <div className={`text-xs font-bold ${pctColor(fcPct)}`}>{pct(fcPct)}</div>
          </div>
          <div className="grid grid-cols-5 gap-2 text-[10px]">
            <Stat label="P05" value={q.fc.p05.toFixed(2)} sub={pct(fcBandLow)} tone="rose" />
            <Stat label="P25" value={q.fc.p25.toFixed(2)} />
            <Stat label="MEDIAN" value={q.fc.median.toFixed(2)} tone="sky" />
            <Stat label="P75" value={q.fc.p75.toFixed(2)} />
            <Stat label="P95" value={q.fc.p95.toFixed(2)} sub={pct(fcBandHigh)} tone="emerald" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 text-[10px] text-slate-400">
            <div>Kalman <span className="text-slate-200">{q.fc.kalmanNext.toFixed(2)}</span></div>
            <div>Holt <span className="text-slate-200">{q.fc.holtNext.toFixed(2)}</span></div>
            <div>OU <span className="text-slate-200">{q.fc.ouNext.toFixed(2)}</span></div>
            <div>MC <span className="text-slate-200">{q.fc.mcMedian.toFixed(2)}</span></div>
          </div>
        </div>
      )}

      {/* Grid 1: filter/vol/regime */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Cell
          title="KALMAN 1-D"
          value={q.kf.prediction.toFixed(2)}
          sub={`next · ${pct(kfPredPct)}`}
          subColor={pctColor(kfPredPct)}
        />
        <Cell
          title="GARCH(1,1) σ"
          value={((q.gh.forecast || 0) * 100).toFixed(3) + "%"}
          sub={`α=${q.gh.alpha.toFixed(3)} β=${q.gh.beta.toFixed(3)}`}
        />
        <Cell
          title="HURST H"
          value={q.hu.toFixed(3)}
          sub={hurstRegime}
          subColor={hurstColor}
        />
        <Cell
          title="HMM REGIME"
          value={`${(q.hmm.pBull * 100).toFixed(0)}% BULL`}
          sub={q.hmm.regime}
          subColor={q.hmm.pBull > 0.6 ? "text-emerald-300" : q.hmm.pBull < 0.4 ? "text-rose-300" : "text-slate-300"}
        />
      </div>

      {/* Grid 2: VaR / reversion / entropy / toxicity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Cell
          title="VAR 95 · CF"
          value={(q.var95.varCF * 100).toFixed(2) + "%"}
          sub={`ES ${(q.var95.expectedShortfall * 100).toFixed(2)}%`}
          subColor="text-rose-300"
        />
        <Cell
          title="VAR 99 · CF"
          value={(q.var99.varCF * 100).toFixed(2) + "%"}
          sub={`kurt ${q.var99.kurt.toFixed(2)}`}
          subColor="text-rose-400"
        />
        <Cell
          title="OU HALF-LIFE"
          value={isFinite(q.ou.halfLife) && q.ou.halfLife > 0 ? q.ou.halfLife.toFixed(1) + " bars" : "∞"}
          sub={`θ=${q.ou.theta.toFixed(2)}`}
        />
        <Cell
          title="VPIN TOXICITY"
          value={(q.tox * 100).toFixed(1) + "%"}
          sub={q.tox > 0.4 ? "ELEVATED" : "NORMAL"}
          subColor={q.tox > 0.4 ? "text-amber-300" : "text-slate-300"}
        />
      </div>

      {/* Grid 3: entropy / drawdown / skew */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Cell title="SHANNON H" value={q.ent.toFixed(3)} sub="nats · randomness" />
        <Cell title="MAX DRAWDOWN" value={q.maxDD.toFixed(2) + "%"} subColor="text-rose-300" />
        <Cell title="SKEW" value={q.var95.skew.toFixed(3)} sub={q.var95.skew < 0 ? "left tail" : "right tail"} />
        <Cell title="KURT (excess)" value={q.var95.kurt.toFixed(2)} sub={q.var95.kurt > 3 ? "fat tails" : "thin tails"} />
      </div>

      {/* Composite breakdown bar */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">COMPOSITE RISK BREAKDOWN</div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="bg-rose-500" style={{ width: `${q.risk.components.vol}%` }} title={`Vol ${q.risk.components.vol.toFixed(1)}`} />
          <div className="bg-orange-500" style={{ width: `${q.risk.components.dd}%` }} title={`DD ${q.risk.components.dd.toFixed(1)}`} />
          <div className="bg-amber-500" style={{ width: `${q.risk.components.vpin}%` }} title={`VPIN ${q.risk.components.vpin.toFixed(1)}`} />
          <div className="bg-sky-500" style={{ width: `${q.risk.components.hurst}%` }} title={`Hurst ${q.risk.components.hurst.toFixed(1)}`} />
          <div className="bg-fuchsia-500" style={{ width: `${q.risk.components.kurt}%` }} title={`Kurt ${q.risk.components.kurt.toFixed(1)}`} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-slate-500 uppercase tracking-wider">
          <span>Vol {q.risk.components.vol.toFixed(0)}</span>
          <span>DD {q.risk.components.dd.toFixed(0)}</span>
          <span>VPIN {q.risk.components.vpin.toFixed(0)}</span>
          <span>Hurst {q.risk.components.hurst.toFixed(0)}</span>
          <span>Kurt {q.risk.components.kurt.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

function Cell({ title, value, sub, subColor }: { title: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">{value}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${subColor || "text-slate-400"}`}>{sub}</div>}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "rose" | "sky" | "emerald" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "sky" ? "text-sky-300" : tone === "emerald" ? "text-emerald-300" : "text-slate-200";
  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xs font-mono font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-400">{sub}</div>}
    </div>
  );
}
