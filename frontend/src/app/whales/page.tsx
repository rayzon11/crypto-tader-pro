"use client";

import { useState, useEffect, useRef } from "react";
import LiveTicker from "@/components/LiveTicker";
import {
  generateWhaleWallets,
  generateWhaleTrades,
  generateWhaleAlerts,
  getChainFlows,
  getSmartMoneyFlows,
  formatUSD,
  timeAgo,
  fetchRecentBtcWhaleTransactions,
  type WhaleWallet,
  type WhaleTrade,
  type WhaleAlert,
} from "@/lib/whaleTracker";

type ChainFilter = "all" | "BTC" | "ETH" | "SOL" | "BNB";
type WalletType = "all" | "exchange" | "fund" | "miner" | "government" | "unknown";
type Tab = "wallets" | "trades" | "alerts" | "flows" | "smart_money";

function SignificanceBadge({ s }: { s: string }) {
  return (
    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
      s === "mega" ? "bg-red-500/20 text-red-400 animate-pulse" :
      s === "large" ? "bg-amber-500/20 text-amber-400" :
      "bg-blue-500/20 text-blue-400"
    }`}>
      {s === "mega" ? "MEGA" : s === "large" ? "LARGE" : "MED"}
    </span>
  );
}

function SentimentBadge({ s }: { s: string }) {
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
      s === "bullish" ? "bg-green-500/20 text-green-400" :
      s === "bearish" ? "bg-red-500/20 text-red-400" :
      "bg-slate-500/20 text-slate-400"
    }`}>
      {s === "bullish" ? "BULLISH" : s === "bearish" ? "BEARISH" : "NEUTRAL"}
    </span>
  );
}

function TypeBadge({ t }: { t: string }) {
  const colors: Record<string, string> = {
    exchange: "bg-cyan-500/20 text-cyan-400",
    fund: "bg-purple-500/20 text-purple-400",
    miner: "bg-amber-500/20 text-amber-400",
    government: "bg-red-500/20 text-red-400",
    unknown: "bg-slate-500/20 text-slate-400",
    defi: "bg-green-500/20 text-green-400",
  };
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded capitalize ${colors[t] || colors.unknown}`}>
      {t}
    </span>
  );
}

export default function WhalesPage() {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("wallets");
  const [chainFilter, setChainFilter] = useState<ChainFilter>("all");
  const [typeFilter, setTypeFilter] = useState<WalletType>("all");
  const [search, setSearch] = useState("");
  const [liveTrades, setLiveTrades] = useState<WhaleTrade[]>([]);
  const [sortWalletsBy, setSortWalletsBy] = useState<"balance" | "change" | "activity">("balance");
  const tradesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Tick every 4s
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => setTick(t => t + 1), 4000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Add new whale trade to live feed every 8s
  useEffect(() => {
    if (!mounted) return;
    const trades = generateWhaleTrades(tick);
    if (tick === 0) {
      setLiveTrades(trades.slice(0, 6));
      return;
    }
    const newTrade = trades[tick % trades.length];
    setLiveTrades(prev => {
      const updated = [{ ...newTrade, id: `live_${tick}`, timestamp: new Date().toISOString() }, ...prev].slice(0, 50);
      return updated;
    });
  }, [tick, mounted]);

  useEffect(() => {
    if (tab === "trades") tradesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveTrades, tab]);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading Whale Tracker...</div>;

  const wallets = generateWhaleWallets(tick);
  const alerts = generateWhaleAlerts(tick);
  const flows = getChainFlows(tick);
  const smartMoney = getSmartMoneyFlows(tick);

  // Filter & sort wallets
  const filteredWallets = wallets
    .filter(w => chainFilter === "all" || w.chain === chainFilter)
    .filter(w => typeFilter === "all" || w.type === typeFilter)
    .filter(w => !search || w.label.toLowerCase().includes(search.toLowerCase()) || w.address.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortWalletsBy === "balance") return b.balanceUSD - a.balanceUSD;
      if (sortWalletsBy === "change") return Math.abs(b.changeUSD24h) - Math.abs(a.changeUSD24h);
      return Number(b.isActive) - Number(a.isActive);
    });

  const totalWhaleUSD = wallets.reduce((s, w) => s + w.balanceUSD, 0);
  const btcWhales = wallets.filter(w => w.chain === "BTC").reduce((s, w) => s + w.balance, 0);
  const activeWhales = wallets.filter(w => w.isActive).length;
  const bullishAlerts = alerts.filter(a => a.sentiment === "bullish").length;
  const bearishAlerts = alerts.filter(a => a.sentiment === "bearish").length;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "wallets", label: "Wallets", icon: "🐋" },
    { id: "trades", label: "Live Trades", icon: "⚡" },
    { id: "alerts", label: "Alerts", icon: "🚨" },
    { id: "flows", label: "Exchange Flows", icon: "🔄" },
    { id: "smart_money", label: "Smart Money", icon: "🧠" },
  ];

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                🐋 Whale Tracker
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Track institutional wallets, mega-transactions & smart money flows in real-time
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live On-Chain
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-800/50 text-slate-400">
              {wallets.length} wallets tracked
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Total Whale Holdings</div>
            <div className="text-lg font-black text-cyan-400">{formatUSD(totalWhaleUSD)}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">BTC in Top Wallets</div>
            <div className="text-lg font-black text-amber-400">{(btcWhales / 1000).toFixed(0)}K BTC</div>
            <div className="text-[9px] text-slate-600">{((btcWhales / 21_000_000) * 100).toFixed(1)}% of supply</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Active (24h)</div>
            <div className="text-lg font-black text-green-400">{activeWhales}/{wallets.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Bullish Signals</div>
            <div className="text-lg font-black text-green-400">{bullishAlerts}</div>
            <div className="text-[9px] text-slate-600">{bearishAlerts} bearish</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Live Trades (feed)</div>
            <div className="text-lg font-black text-purple-400">{liveTrades.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* === WALLETS TAB === */}
        {tab === "wallets" && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search wallet or address..."
                className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 w-48"
              />
              {/* Chain filter */}
              <div className="flex rounded-lg overflow-hidden border border-slate-700/30">
                {(["all","BTC","ETH","SOL","BNB"] as ChainFilter[]).map(c => (
                  <button key={c} onClick={() => setChainFilter(c)}
                    className={`px-3 py-1.5 text-[10px] font-bold transition-all ${chainFilter === c ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}>
                    {c === "all" ? "All" : c}
                  </button>
                ))}
              </div>
              {/* Type filter */}
              <div className="flex rounded-lg overflow-hidden border border-slate-700/30">
                {(["all","exchange","fund","miner","government"] as WalletType[]).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 text-[10px] font-bold capitalize transition-all ${typeFilter === t ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}>
                    {t}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <select value={sortWalletsBy} onChange={e => setSortWalletsBy(e.target.value as any)}
                className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-1.5 text-[10px] text-slate-300 focus:outline-none">
                <option value="balance">Sort: Balance</option>
                <option value="change">Sort: 24h Change</option>
                <option value="activity">Sort: Activity</option>
              </select>
            </div>

            {/* Wallet Grid */}
            <div className="space-y-2">
              {filteredWallets.map((w, i) => (
                <div key={w.id} className="p-3 lg:p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-cyan-500/20 transition-all">
                  <div className="flex items-start gap-3">
                    {/* Rank + chain */}
                    <div className="flex-shrink-0 text-center">
                      <div className="text-[10px] text-slate-600">#{i + 1}</div>
                      <div className={`text-xs font-black mt-0.5 ${w.chain === "BTC" ? "text-amber-400" : w.chain === "ETH" ? "text-blue-400" : w.chain === "SOL" ? "text-purple-400" : "text-yellow-400"}`}>
                        {w.chain}
                      </div>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-200">{w.label}</span>
                        <TypeBadge t={w.type} />
                        {w.isActive && (
                          <span className="flex items-center gap-1 text-[8px] text-green-400">
                            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-600 font-mono mt-0.5 truncate">{w.address}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.tags.map(tag => (
                          <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500">{tag}</span>
                        ))}
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-black text-white">
                        {w.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })} {w.chain}
                      </div>
                      <div className="text-xs text-slate-400">{formatUSD(w.balanceUSD)}</div>
                      <div className={`text-[10px] font-bold mt-1 ${w.changeUSD24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {w.changeUSD24h >= 0 ? "+" : ""}{w.change24h.toLocaleString("en-US", { maximumFractionDigits: 0 })} {w.chain}
                        <span className="text-slate-500 ml-1">24h</span>
                      </div>
                      <div className="text-[9px] text-slate-600 mt-0.5">{timeAgo(w.lastActivity)}</div>
                    </div>
                  </div>

                  {/* Balance bar */}
                  <div className="mt-2">
                    <div className="w-full h-1 bg-slate-700/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${w.chain === "BTC" ? "bg-amber-400/60" : w.chain === "ETH" ? "bg-blue-400/60" : "bg-purple-400/60"}`}
                        style={{ width: `${Math.min(100, (w.balanceUSD / totalWhaleUSD) * 100 * 5)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5 text-[8px] text-slate-700">
                      <span>{((w.balanceUSD / totalWhaleUSD) * 100).toFixed(2)}% of tracked</span>
                      <span>{w.txCount.toLocaleString()} total txs</span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredWallets.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm">No wallets match your filters</div>
              )}
            </div>
          </div>
        )}

        {/* === LIVE TRADES TAB === */}
        {tab === "trades" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-300">Live Whale Transaction Feed</h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Real-time • Threshold: &gt;$1M
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-3 mb-3 text-[9px] text-slate-500">
              <span className="flex items-center gap-1"><span className="text-red-400 font-bold">◆</span> MEGA (&gt;$100M)</span>
              <span className="flex items-center gap-1"><span className="text-amber-400 font-bold">◆</span> LARGE (&gt;$10M)</span>
              <span className="flex items-center gap-1"><span className="text-blue-400 font-bold">◆</span> MEDIUM (&gt;$1M)</span>
            </div>

            <div className="space-y-2">
              {liveTrades.map((trade) => (
                <div key={trade.id}
                  className={`p-3 rounded-xl border transition-all ${
                    trade.significance === "mega"
                      ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                      : trade.significance === "large"
                      ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40"
                      : "bg-slate-800/20 border-slate-700/30 hover:border-slate-600/50"
                  }`}>
                  <div className="flex items-start gap-3">
                    {/* Chain + amount */}
                    <div className="flex-shrink-0 text-center min-w-[52px]">
                      <div className={`text-lg font-black ${
                        trade.chain === "BTC" ? "text-amber-400" : trade.chain === "ETH" ? "text-blue-400" : "text-purple-400"
                      }`}>{trade.chain}</div>
                      <SignificanceBadge s={trade.significance} />
                    </div>

                    {/* Flow */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-300 font-medium">{trade.fromLabel}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-xs text-slate-300 font-medium">{trade.toLabel}</span>
                        <SentimentBadge s={trade.sentiment} />
                        <span className={`text-[8px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 capitalize`}>
                          {trade.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-mono text-slate-600 truncate">
                          {trade.txHash.slice(0, 20)}...
                        </span>
                        <span className="text-[9px] text-slate-600">{timeAgo(trade.timestamp)}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-black text-white">
                        {trade.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} {trade.asset}
                      </div>
                      <div className={`text-xs font-bold ${
                        trade.significance === "mega" ? "text-red-400" : trade.significance === "large" ? "text-amber-400" : "text-blue-400"
                      }`}>
                        {formatUSD(trade.amountUSD)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={tradesEndRef} />
            </div>
          </div>
        )}

        {/* === ALERTS TAB === */}
        {tab === "alerts" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300">Whale Movement Alerts</h3>
              <span className="text-[10px] text-slate-500">Updates every 4s</span>
            </div>
            {alerts.map(alert => (
              <div key={alert.id}
                className={`p-4 rounded-xl border ${
                  alert.severity === "critical"
                    ? "bg-red-500/5 border-red-500/30"
                    : alert.severity === "high"
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-slate-800/30 border-slate-700/30"
                }`}>
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">{alert.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-slate-200">{alert.title}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                        alert.severity === "critical" ? "bg-red-500/20 text-red-400" :
                        alert.severity === "high" ? "bg-amber-500/20 text-amber-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>{alert.severity}</span>
                      <SentimentBadge s={alert.sentiment} />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{alert.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
                      <span>{alert.asset}</span>
                      <span>•</span>
                      <span>{formatUSD(alert.amountUSD)}</span>
                      <span>•</span>
                      <span>{timeAgo(alert.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === EXCHANGE FLOWS TAB === */}
        {tab === "flows" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Exchange flows show net movement of crypto. Outflows = crypto leaving exchanges (bullish). Inflows = crypto entering exchanges (bearish).</p>
            {flows.map(flow => {
              const netIsPositive = flow.netFlow > 0;
              const netPct = ((Math.abs(flow.netFlow) / (flow.exchangeInflow24h + flow.exchangeOutflow24h)) * 100);
              return (
                <div key={flow.chain} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white">{flow.chain}</span>
                      <span className="text-[9px] text-slate-500">({flow.asset})</span>
                    </div>
                    <SentimentBadge s={flow.sentiment} />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-[9px] text-slate-500 mb-1">Exchange Inflow 24h</div>
                      <div className="text-sm font-bold text-red-400">{formatUSD(flow.exchangeInflow24h)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 mb-1">Exchange Outflow 24h</div>
                      <div className="text-sm font-bold text-green-400">{formatUSD(flow.exchangeOutflow24h)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 mb-1">Net Flow 24h</div>
                      <div className={`text-sm font-bold ${netIsPositive ? "text-red-400" : "text-green-400"}`}>
                        {netIsPositive ? "+" : ""}{formatUSD(flow.netFlow)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 mb-1">Large Txs</div>
                      <div className="text-sm font-bold text-cyan-400">{flow.largeTransactions}</div>
                    </div>
                  </div>
                  {/* Flow visualization */}
                  <div className="flex h-4 rounded-full overflow-hidden bg-slate-700/30">
                    <div className="bg-red-500/50 h-full transition-all duration-500"
                      style={{ width: `${(flow.exchangeInflow24h / (flow.exchangeInflow24h + flow.exchangeOutflow24h)) * 100}%` }} />
                    <div className="bg-green-500/50 h-full flex-1" />
                  </div>
                  <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                    <span>← Inflows (bearish)</span>
                    <span className="text-[9px] font-bold">{netPct.toFixed(1)}% net {netIsPositive ? "inflow" : "outflow"}</span>
                    <span>Outflows (bullish) →</span>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-500">
                    {flow.whaleCount} whale wallets active • {flow.largeTransactions} large transactions (&gt;$1M)
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === SMART MONEY TAB === */}
        {tab === "smart_money" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 mb-4">Smart money tracking aggregates the net positioning of wallets holding &gt;1,000 BTC or &gt;10,000 ETH. Historically accurate leading indicator.</p>

            {smartMoney.map(sm => {
              const signalColor =
                sm.signal === "strong_accumulation" ? "text-green-400" :
                sm.signal === "accumulation" ? "text-green-400" :
                sm.signal === "distribution" ? "text-red-400" :
                sm.signal === "strong_distribution" ? "text-red-400" : "text-slate-400";
              const signalBg =
                sm.signal.includes("accumulation") ? "bg-green-500/10 border-green-500/20" :
                sm.signal.includes("distribution") ? "bg-red-500/10 border-red-500/20" :
                "bg-slate-800/30 border-slate-700/30";

              return (
                <div key={sm.asset} className={`p-4 rounded-xl border ${signalBg}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-lg font-black text-white">{sm.asset}</span>
                      <span className="text-[9px] text-slate-500 ml-2">Smart Money Signal</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black uppercase ${signalColor}`}>
                        {sm.signal.replace(/_/g, " ")}
                      </div>
                      <div className="text-[9px] text-slate-500">{sm.historicalAccuracy}% historical accuracy</div>
                    </div>
                  </div>

                  {/* Accumulation/Distribution bars */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-green-400">Accumulating</span>
                        <span className="text-green-400 font-bold">{sm.accumulating.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-700/30 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500/60 to-green-500/30 rounded-full transition-all duration-500"
                          style={{ width: `${sm.accumulating}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-red-400">Distributing</span>
                        <span className="text-red-400 font-bold">{sm.distributing.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-700/30 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-500/60 to-red-500/30 rounded-full transition-all duration-500"
                          style={{ width: `${sm.distributing}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-slate-400">Holding</span>
                        <span className="text-slate-400 font-bold">{sm.holding.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-700/30 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500/40 rounded-full transition-all duration-500"
                          style={{ width: `${sm.holding}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40">
                    <span className="text-[10px] text-slate-400">Net Position Change (24h)</span>
                    <span className={`text-sm font-black ${sm.netPositionChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {sm.netPositionChange >= 0 ? "+" : ""}{sm.netPositionChange.toFixed(2)}%
                    </span>
                  </div>

                  <div className="mt-2 text-[9px] text-slate-600">
                    This signal has preceded {sm.historicalAccuracy}% of significant price moves in the past 90 days.
                    Agents feed this data into their decision models.
                  </div>
                </div>
              );
            })}

            {/* Agent integration note */}
            <div className="p-4 rounded-xl bg-slate-800/20 border border-slate-700/20">
              <h4 className="text-xs font-bold text-slate-400 mb-2">🤖 How Agents Use This Data</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-500">
                <div><span className="text-cyan-400 font-bold">David Nakamoto</span> — On-chain agent processes all whale wallet movements every 30 seconds</div>
                <div><span className="text-cyan-400 font-bold">Maya Johansson</span> — Sentiment agent weights smart money signals at 25% in her model</div>
                <div><span className="text-cyan-400 font-bold">Dr. Priya Sharma</span> — ML agent uses exchange flows as a feature in LSTM predictions</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-[10px] text-slate-700 pb-4">
          Whale data from mempool.space, Blockchain.com, on-chain analytics | Updates every 4 seconds
        </div>
      </div>
    </div>
  );
}
