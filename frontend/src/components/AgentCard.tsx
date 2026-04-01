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
  const statusBg =
    status === "active"
      ? "bg-green-900"
      : status === "halted"
      ? "bg-red-900"
      : "bg-gray-700";
  const pnlColor = (report?.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div
      className="bg-slate-800 rounded-lg p-3 flex flex-col gap-1 border"
      style={{ borderColor: `${tierColor}44` }}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <span
          className="font-bold text-[11px] uppercase"
          style={{ color: tierColor }}
        >
          {name}
        </span>
        <ScoreBadge score={score} />
      </div>

      {/* Status + Signal */}
      <div className="flex gap-1.5 items-center">
        <span
          className={`${statusBg} text-white text-[9px] rounded px-1.5 py-0.5`}
        >
          {status}
        </span>
        <span className="text-[10px] text-blue-400">
          {report?.signal ?? "\u2014"}
        </span>
      </div>

      {/* PnL + Win Rate */}
      <div className="flex justify-between text-[10px]">
        <span className={pnlColor}>
          P&L: {(report?.pnl ?? 0) >= 0 ? "+" : ""}
          {(report?.pnl ?? 0).toFixed(4)}
        </span>
        <span className="text-slate-400">
          WR: {((report?.win_rate ?? 0.5) * 100).toFixed(0)}%
        </span>
      </div>

      {/* Weight + Trades */}
      <div className="text-[9px] text-slate-500">
        Wt: {(report?.weight ?? 1.0).toFixed(2)} | Trades:{" "}
        {report?.trade_count ?? 0}
      </div>
    </div>
  );
}
