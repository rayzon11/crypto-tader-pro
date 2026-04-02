"use client";

interface MasterStatsProps {
  masterPnl: number;
  activeAgents: number;
  consensus: string;
  killSwitch: boolean;
  confidence?: number;
}

const CONS_COLORS: Record<string, string> = {
  BUY: "text-green-400",
  SELL: "text-red-400",
  HALT: "text-yellow-400",
  REDUCE: "text-orange-400",
  HOLD: "text-slate-400",
};

const CONS_BG: Record<string, string> = {
  BUY: "from-green-500/10 to-green-500/5",
  SELL: "from-red-500/10 to-red-500/5",
  HALT: "from-yellow-500/10 to-yellow-500/5",
  REDUCE: "from-orange-500/10 to-orange-500/5",
  HOLD: "from-slate-500/10 to-slate-500/5",
};

export default function MasterStats({
  masterPnl,
  activeAgents,
  consensus,
  killSwitch,
  confidence = 0,
}: MasterStatsProps) {
  const stats = [
    {
      label: "Master P&L",
      value: `${masterPnl >= 0 ? "+" : ""}${masterPnl.toFixed(4)} BTC`,
      sub: `$${(masterPnl * 67500).toFixed(2)} USD`,
      colorClass: masterPnl >= 0 ? "text-green-400" : "text-red-400",
      bg: masterPnl >= 0 ? "from-green-500/10 to-green-500/5" : "from-red-500/10 to-red-500/5",
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      label: "Active Agents",
      value: `${activeAgents}/25`,
      sub: `${Math.round((activeAgents / 23) * 100)}% online`,
      colorClass: activeAgents >= 20 ? "text-green-400" : activeAgents >= 15 ? "text-blue-400" : "text-yellow-400",
      bg: "from-blue-500/10 to-blue-500/5",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      label: "Consensus",
      value: consensus,
      sub: `${(confidence * 100).toFixed(0)}% confidence`,
      colorClass: CONS_COLORS[consensus] ?? "text-slate-400",
      bg: CONS_BG[consensus] ?? "from-slate-500/10 to-slate-500/5",
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
    {
      label: "Kill Switch",
      value: killSwitch ? "ACTIVE" : "SAFE",
      sub: killSwitch ? "Trading halted" : "All systems go",
      colorClass: killSwitch ? "text-red-400" : "text-green-400",
      bg: killSwitch ? "from-red-500/10 to-red-500/5" : "from-green-500/10 to-green-500/5",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map(({ label, value, sub, colorClass, bg, icon }, i) => (
        <div
          key={label}
          className={`animate-fadeIn delay-${i + 1} card-hover bg-gradient-to-br ${bg} rounded-xl border border-slate-800/50 px-4 py-4`}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
          </div>
          <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
          <div className="text-[10px] text-slate-600 mt-1">{sub}</div>
        </div>
      ))}
    </div>
  );
}
