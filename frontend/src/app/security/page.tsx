"use client";

import { useState, useEffect } from "react";
import LiveTicker from "@/components/LiveTicker";
import { generateSecurityScans, type SecurityScan } from "@/lib/mockData";

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  info: { bg: "bg-slate-700/30", text: "text-slate-400", border: "border-slate-600/30" },
};

const AGENT_DETAILS = {
  npm_security: {
    name: "NPM Security Agent",
    color: "#EF4444",
    metrics: [
      { label: "Packages Scanned", value: "847" },
      { label: "Vulnerabilities", value: "0" },
      { label: "Typosquat Checks", value: "847" },
      { label: "Lockfile Integrity", value: "Verified" },
      { label: "Threat Patterns Learned", value: "234" },
      { label: "False Positives Learned", value: "12" },
    ],
    description: "Scans npm audit, verifies lockfile integrity, detects typosquatting, learns threat patterns over time.",
  },
  db_security: {
    name: "Database Security Agent",
    color: "#F97316",
    metrics: [
      { label: "SQL Injection Patterns", value: "156" },
      { label: "Queries Monitored", value: "12,847" },
      { label: "Anomalies Detected", value: "3" },
      { label: "EMA Baseline", value: "Active" },
      { label: "PostgreSQL SSL", value: "Enforced" },
      { label: "Raw SQL Found", value: "0" },
    ],
    description: "Monitors for SQL injection, tracks query baselines via EMA, scans for raw SQL, checks DB permissions.",
  },
  code_security: {
    name: "Code Security Agent",
    color: "#8B5CF6",
    metrics: [
      { label: "Files Tracked", value: "59" },
      { label: "Secret Patterns", value: "12" },
      { label: "OWASP Checks", value: "13" },
      { label: ".gitignore Status", value: "Secured" },
      { label: "Integrity Hashes", value: "59/59" },
      { label: "Security Score", value: "94/100" },
    ],
    description: "Scans for hardcoded secrets, OWASP vulnerabilities, verifies .gitignore, tracks file integrity hashes.",
  },
};

export default function SecurityPage() {
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(100);

  useEffect(() => {
    setScans(generateSecurityScans());
  }, []);

  // Simulate periodic scan
  useEffect(() => {
    const interval = setInterval(() => {
      setScanProgress(0);
      const step = setInterval(() => {
        setScanProgress((p) => {
          if (p >= 100) {
            clearInterval(step);
            return 100;
          }
          return p + 5;
        });
      }, 150);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = scans.filter((s) => s.severity === "critical").length;
  const highCount = scans.filter((s) => s.severity === "high").length;
  const resolvedCount = scans.filter((s) => s.resolved).length;

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Security Center
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            3 self-learning security agents protecting your system 24/7
          </p>
        </div>

        {/* Security Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Security Score", value: "94/100", color: "text-green-400", bg: "from-green-500/10" },
            { label: "Critical Issues", value: String(criticalCount), color: criticalCount > 0 ? "text-red-400" : "text-green-400", bg: criticalCount > 0 ? "from-red-500/10" : "from-green-500/10" },
            { label: "High Issues", value: String(highCount), color: highCount > 0 ? "text-orange-400" : "text-green-400", bg: "from-green-500/10" },
            { label: "Total Scans", value: String(scans.length), color: "text-blue-400", bg: "from-blue-500/10" },
            { label: "Resolved", value: `${resolvedCount}/${scans.length}`, color: "text-green-400", bg: "from-green-500/10" },
          ].map((stat, i) => (
            <div key={stat.label} className={`animate-fadeIn delay-${i + 1} card-hover bg-gradient-to-br ${stat.bg} to-transparent rounded-xl border border-slate-800/50 px-4 py-3`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{stat.label}</div>
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Scan Progress */}
        <div className="mb-6 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-400">Security Scan Progress</span>
            <span className="text-[11px] text-slate-500">{scanProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-red-500 via-orange-500 to-green-500"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(AGENT_DETAILS).map(([key, agent]) => (
            <div
              key={key}
              className={`card-hover rounded-xl border p-4 cursor-pointer transition-all ${
                selectedAgent === key
                  ? "bg-slate-800/60 border-slate-600"
                  : "bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50"
              }`}
              onClick={() => setSelectedAgent(selectedAgent === key ? null : key)}
            >
              {/* Agent header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}20` }}>
                  <svg className="w-4 h-4" style={{ color: agent.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold" style={{ color: agent.color }}>{agent.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[9px] text-slate-500">Self-Learning Active</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 mb-3">{agent.description}</p>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2">
                {agent.metrics.map((m) => (
                  <div key={m.label} className="bg-slate-900/50 rounded-lg px-2 py-1.5">
                    <div className="text-[8px] text-slate-600 uppercase">{m.label}</div>
                    <div className="text-[11px] text-slate-300 font-medium">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Scan Log */}
        <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Scan Log</h3>
            <span className="text-[10px] text-slate-500">Last 10 findings</span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {scans.map((scan) => {
              const sev = SEVERITY_CONFIG[scan.severity];
              return (
                <div key={scan.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-800/20">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${sev.bg} ${sev.text} border ${sev.border} whitespace-nowrap mt-0.5`}>
                    {scan.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-300">{scan.message}</div>
                    <div className="text-[9px] text-slate-600 mt-0.5">
                      {scan.agent.replace(/_/g, " ")} &middot; {new Date(scan.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  {scan.resolved && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 whitespace-nowrap">
                      Resolved
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Security agents get smarter with every scan cycle through Redis-persisted learning data.
        </div>
      </div>
    </div>
  );
}
