"use client";

interface MasterStatsProps {
  masterPnl: number;
  activeAgents: number;
  consensus: string;
  killSwitch: boolean;
}

const CONS_COLORS: Record<string, string> = {
  BUY: "text-green-400",
  SELL: "text-red-400",
  HALT: "text-yellow-400",
  REDUCE: "text-orange-400",
  HOLD: "text-slate-400",
};

export default function MasterStats({
  masterPnl,
  activeAgents,
  consensus,
  killSwitch,
}: MasterStatsProps) {
  const stats = [
    {
      label: "Master P&L",
      value: `${masterPnl >= 0 ? "+" : ""}${masterPnl.toFixed(4)} BTC`,
      colorClass: masterPnl >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Active Agents",
      value: `${activeAgents}/23`,
      colorClass: "text-blue-400",
    },
    {
      label: "Consensus",
      value: consensus,
      colorClass: CONS_COLORS[consensus] ?? "text-slate-400",
    },
    {
      label: "Kill Switch",
      value: killSwitch ? "ACTIVE" : "SAFE",
      colorClass: killSwitch ? "text-red-400" : "text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map(({ label, value, colorClass }) => (
        <div
          key={label}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3"
        >
          <div className="text-[11px] text-slate-500 mb-1">{label}</div>
          <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}
