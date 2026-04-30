"use client";

import ScoreBadge from "./ScoreBadge";

export interface AgentReport {
  agent: string;
  status: "active" | "halted" | "error";
  pnl: number;
  signal: string | null;
  win_rate: number;
  trade_count: number;
  weight: number;
  timestamp: string;
}

function smartScore(r?: AgentReport): number {
  if (!r || r.trade_count === 0) return 50;
  const wr = (r.win_rate ?? 0.5) * 40;
  const wt = Math.min((r.weight ?? 1.0) / 2.0, 1.0) * 30;
  const pnlS = Math.min(Math.max((r.pnl + 0.05) / 0.1, 0), 1) * 30;
  return Math.round(wr + wt + pnlS);
}

export default function AgentCard({
  name,
  report,
  tierColor,
}: {
  name: string;
  report?: AgentReport;
  tierColor: string;
}) {
  const score = smartScore(report);
  const status = report?.status ?? "offline";
  const pnlColor = (report?.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400";

  const signalBg =
    report?.signal === "BUY"
      ? "bg-green-500/20 text-green-400"
      : report?.signal === "SELL"
      ? "bg-red-500/20 text-red-400"
      : "bg-slate-700/50 text-slate-400";

  return (
    <div
      className="card-hover bg-slate-800/50 rounded-xl p-3 flex flex-col gap-1.5 border border-slate-700/30 relative overflow-hidden"
    >
      {/* Tier accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${tierColor}, transparent)` }}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="font-bold text-[11px] uppercase tracking-wide" style={{ color: tierColor }}>
          {name.replace(/_/g, " ")}
        </span>
        <ScoreBadge score={score} />
      </div>

      {/* Status + Signal */}
      <div className="flex gap-1.5 items-center">
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "active" ? "bg-green-500" : status === "halted" ? "bg-red-500" : "bg-gray-500"
            }`}
          />
          <span className="text-[9px] text-slate-400 uppercase">{status}</span>
        </span>
        <span className={`text-[9px] rounded px-1.5 py-0.5 ${signalBg}`}>
          {report?.signal ?? "\u2014"}
        </span>
      </div>

      {/* PnL + Win Rate */}
      <div className="flex justify-between text-[10px]">
        <span className={pnlColor}>
          {(report?.pnl ?? 0) >= 0 ? "+" : ""}
          {(report?.pnl ?? 0).toFixed(4)} BTC
        </span>
        <span className="text-slate-400">
          WR {((report?.win_rate ?? 0.5) * 100).toFixed(0)}%
        </span>
      </div>

      {/* Progress bar for win rate */}
      <div className="w-full h-1 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(report?.win_rate ?? 0.5) * 100}%`,
            background: `linear-gradient(90deg, ${tierColor}88, ${tierColor})`,
          }}
        />
      </div>

      {/* Footer */}
      <div className="text-[9px] text-slate-600 flex justify-between">
        <span>Wt: {(report?.weight ?? 1.0).toFixed(2)}</span>
        <span>{report?.trade_count ?? 0} trades</span>
      </div>
    </div>
  );
}
