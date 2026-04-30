"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExchangeCredentials,
  ExchangeBalance,
  ExchangeOrder,
  ConnectionStatus,
  BotTradingLimits,
  OrderRequest,
  loadCredentials,
  saveCredentials,
  clearCredentials,
  isLiveMode,
  setLiveMode,
  loadBotLimits,
  saveBotLimits,
  testBinanceConnection,
  testCoinbaseConnection,
  getBinanceBalances,
  getCoinbaseBalances,
  getBalances,
  getOpenOrders,
  placeBinanceOrder,
  placeCoinbaseOrder,
  cancelBinanceOrder,
  TRADEABLE_SYMBOLS,
  formatBalance,
} from "@/lib/exchangeConnector";

// ─── helpers ───
function usd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

type Tab = "connect" | "portfolio" | "orders" | "trade" | "bot";

export default function ConnectPage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("connect");
  const [tick, setTick] = useState(0);

  // credentials
  const [binKey, setBinKey] = useState("");
  const [binSecret, setBinSecret] = useState("");
  const [cbKey, setCbKey] = useState("");
  const [cbSecret, setCbSecret] = useState("");

  // connection status
  const [binStatus, setBinStatus] = useState<ConnectionStatus | null>(null);
  const [cbStatus, setCbStatus] = useState<ConnectionStatus | null>(null);
  const [connecting, setConnecting] = useState<"binance" | "coinbase" | null>(null);

  // data
  const [balances, setBalances] = useState<{ binance: ExchangeBalance[]; coinbase: ExchangeBalance[]; totalUSD: number } | null>(null);
  const [orders, setOrders] = useState<ExchangeOrder[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // trading form
  const [tradeExchange, setTradeExchange] = useState<"binance" | "coinbase">("binance");
  const [tradeSymbol, setTradeSymbol] = useState("BTCUSDT");
  const [tradeSide, setTradeSide] = useState<"BUY" | "SELL">("BUY");
  const [tradeType, setTradeType] = useState<"MARKET" | "LIMIT">("LIMIT");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeResult, setTradeResult] = useState<string | null>(null);
  const [tradingBusy, setTradingBusy] = useState(false);

  // bot limits
  const [limits, setLimits] = useState<BotTradingLimits>(loadBotLimits());
  const [live, setLive] = useState(false);

  useEffect(() => {
    setMounted(true);
    const creds = loadCredentials();
    if (creds.binance) {
      setBinKey(creds.binance.apiKey);
      setBinSecret(creds.binance.secret);
    }
    if (creds.coinbase) {
      setCbKey(creds.coinbase.apiKey);
      setCbSecret(creds.coinbase.secret);
    }
    setLive(isLiveMode());
    setLimits(loadBotLimits());
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  // ─── connect handlers ───
  const connectBinance = async () => {
    if (!binKey || !binSecret) return;
    setConnecting("binance");
    const status = await testBinanceConnection(binKey, binSecret);
    setBinStatus(status);
    if (status.connected) {
      const creds = loadCredentials();
      creds.binance = { apiKey: binKey, secret: binSecret };
      saveCredentials(creds);
    }
    setConnecting(null);
  };

  const connectCoinbase = async () => {
    if (!cbKey || !cbSecret) return;
    setConnecting("coinbase");
    const status = await testCoinbaseConnection(cbKey, cbSecret);
    setCbStatus(status);
    if (status.connected) {
      const creds = loadCredentials();
      creds.coinbase = { apiKey: cbKey, secret: cbSecret };
      saveCredentials(creds);
    }
    setConnecting(null);
  };

  const disconnectAll = () => {
    clearCredentials();
    setBinKey("");
    setBinSecret("");
    setCbKey("");
    setCbSecret("");
    setBinStatus(null);
    setCbStatus(null);
    setBalances(null);
    setOrders([]);
  };

  // ─── fetch portfolio ───
  const fetchPortfolio = useCallback(async () => {
    const creds = loadCredentials();
    if (!creds.binance && !creds.coinbase) return;
    setLoadingData(true);
    try {
      const [bal, ord] = await Promise.all([
        getBalances(creds),
        getOpenOrders(creds),
      ]);
      setBalances(bal);
      setOrders(ord);
    } catch {}
    setLoadingData(false);
  }, []);

  // ─── place order ───
  const submitOrder = async () => {
    const creds = loadCredentials();
    if (!creds.binance && !creds.coinbase) {
      setTradeResult("No exchange connected");
      return;
    }
    setTradingBusy(true);
    setTradeResult(null);
    try {
      const request: OrderRequest = {
        symbol: tradeSymbol,
        side: tradeSide,
        type: tradeType,
        quantity: parseFloat(tradeQty),
        price: tradeType === "LIMIT" ? parseFloat(tradePrice) : undefined,
      };
      if (tradeExchange === "binance" && creds.binance) {
        const res = await placeBinanceOrder(creds.binance.apiKey, creds.binance.secret, request, limits);
        setTradeResult(`Order placed: ${res.orderId} — ${res.status}`);
      } else if (tradeExchange === "coinbase" && creds.coinbase) {
        const res = await placeCoinbaseOrder(creds.coinbase.apiKey, creds.coinbase.secret, request, limits);
        setTradeResult(`Order placed: ${res.orderId} — ${res.status}`);
      } else {
        setTradeResult(`${tradeExchange} not connected`);
      }
    } catch (err: any) {
      setTradeResult(`Error: ${err.message}`);
    }
    setTradingBusy(false);
  };

  // ─── cancel order ───
  const handleCancel = async (order: ExchangeOrder) => {
    const creds = loadCredentials();
    try {
      if (order.exchange === "binance" && creds.binance) {
        await cancelBinanceOrder(creds.binance.apiKey, creds.binance.secret, order.symbol, order.orderId);
      }
      fetchPortfolio();
    } catch {}
  };

  if (!mounted) return <div className="p-6 text-slate-400">Loading...</div>;

  const anyConnected = binStatus?.connected || cbStatus?.connected;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "connect", label: "Connect Exchanges", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" },
    { id: "portfolio", label: "Live Portfolio", icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" },
    { id: "orders", label: "Open Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { id: "trade", label: "Place Order", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" },
    { id: "bot", label: "Bot Controls", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Exchange Connection &amp; Live Trading
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect Binance &amp; Coinbase wallets — keys stay in your browser (sessionStorage)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live / Demo toggle */}
          <button
            onClick={() => {
              const next = !live;
              setLive(next);
              setLiveMode(next);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
              live
                ? "bg-red-500/20 border-red-500/50 text-red-400"
                : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
            }`}
          >
            {live ? "LIVE TRADING" : "DEMO MODE"}
          </button>
          {anyConnected && (
            <button
              onClick={disconnectAll}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 text-slate-400 hover:bg-slate-800"
            >
              Disconnect All
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase">Binance</div>
          <div className={`text-lg font-bold ${binStatus?.connected ? "text-emerald-400" : "text-slate-500"}`}>
            {binStatus?.connected ? "Connected" : "Not Connected"}
          </div>
          {binStatus?.connected && (
            <div className="text-[10px] text-slate-400">
              {binStatus.accountType} | Trade: {binStatus.canTrade ? "Yes" : "No"}
            </div>
          )}
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase">Coinbase</div>
          <div className={`text-lg font-bold ${cbStatus?.connected ? "text-emerald-400" : "text-slate-500"}`}>
            {cbStatus?.connected ? "Connected" : "Not Connected"}
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase">Total Portfolio</div>
          <div className="text-lg font-bold text-amber-400">
            {balances ? usd(balances.totalUSD) : "—"}
          </div>
          <div className="text-[10px] text-slate-400">
            {balances ? `${balances.binance.length + balances.coinbase.length} assets` : ""}
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
          <div className="text-[10px] text-slate-500 uppercase">Open Orders</div>
          <div className="text-lg font-bold text-cyan-400">{orders.length}</div>
          <div className="text-[10px] text-slate-400">
            {limits.emergencyStop ? "Emergency Stop ON" : "Trading Active"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === "portfolio" || t.id === "orders") fetchPortfolio();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t.id
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-slate-400 hover:bg-slate-800 border border-transparent"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ TAB: CONNECT ═══════════════════════ */}
      {tab === "connect" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Binance Card */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <span className="text-yellow-400 font-bold text-lg">B</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Binance</h3>
                <p className="text-[11px] text-slate-400">Spot trading via REST API</p>
              </div>
              {binStatus?.connected && (
                <span className="ml-auto px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CONNECTED
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">API Key</label>
                <input
                  type="password"
                  value={binKey}
                  onChange={(e) => setBinKey(e.target.value)}
                  placeholder="Enter Binance API Key"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-yellow-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">API Secret</label>
                <input
                  type="password"
                  value={binSecret}
                  onChange={(e) => setBinSecret(e.target.value)}
                  placeholder="Enter Binance Secret Key"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-yellow-500/50 focus:outline-none"
                />
              </div>
              <button
                onClick={connectBinance}
                disabled={connecting === "binance" || !binKey || !binSecret}
                className="w-full py-2.5 rounded-lg font-bold text-sm bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-40 transition"
              >
                {connecting === "binance" ? "Testing Connection..." : binStatus?.connected ? "Reconnect" : "Test & Connect"}
              </button>
              {binStatus && !binStatus.connected && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{binStatus.error}</p>
              )}
            </div>

            <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                <strong className="text-slate-400">Security:</strong> Your API keys are stored in sessionStorage (cleared when you close the tab). Keys are used for client-side HMAC-SHA256 signing and never sent to any server. Enable &quot;Restrict to IP&quot; on Binance for extra safety.
              </p>
            </div>
          </div>

          {/* Coinbase Card */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-lg">C</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Coinbase</h3>
                <p className="text-[11px] text-slate-400">Advanced Trade API</p>
              </div>
              {cbStatus?.connected && (
                <span className="ml-auto px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CONNECTED
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">API Key</label>
                <input
                  type="password"
                  value={cbKey}
                  onChange={(e) => setCbKey(e.target.value)}
                  placeholder="Enter Coinbase API Key"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">API Secret</label>
                <input
                  type="password"
                  value={cbSecret}
                  onChange={(e) => setCbSecret(e.target.value)}
                  placeholder="Enter Coinbase Secret Key"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <button
                onClick={connectCoinbase}
                disabled={connecting === "coinbase" || !cbKey || !cbSecret}
                className="w-full py-2.5 rounded-lg font-bold text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 transition"
              >
                {connecting === "coinbase" ? "Testing Connection..." : cbStatus?.connected ? "Reconnect" : "Test & Connect"}
              </button>
              {cbStatus && !cbStatus.connected && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{cbStatus.error}</p>
              )}
            </div>

            <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                <strong className="text-slate-400">Security:</strong> Uses Coinbase Advanced Trade API with HMAC-SHA256 signing. Keys never leave your browser. Create keys at coinbase.com/settings/api with &quot;Trade&quot; permission only.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="lg:col-span-2 bg-slate-800/30 rounded-2xl border border-slate-700/30 p-6">
            <h3 className="text-white font-bold mb-4">How Bot Trading Works</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { step: "1", title: "Connect API", desc: "Enter your exchange API keys. They stay in your browser session only." },
                { step: "2", title: "Set Limits", desc: "Configure max order size, allowed pairs, and daily loss limits in Bot Controls." },
                { step: "3", title: "Enable Agents", desc: "Choose which AI agents can execute trades on your behalf." },
                { step: "4", title: "Monitor", desc: "Watch real-time portfolio, open orders, and agent decisions. Emergency stop anytime." },
              ].map((s) => (
                <div key={s.step} className="bg-slate-900/50 rounded-xl p-4">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm mb-2">
                    {s.step}
                  </div>
                  <h4 className="text-white font-semibold text-sm">{s.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ TAB: PORTFOLIO ═══════════════════════ */}
      {tab === "portfolio" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Live Portfolio</h2>
            <button
              onClick={fetchPortfolio}
              disabled={loadingData}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            >
              {loadingData ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {!anyConnected ? (
            <div className="bg-slate-800/40 rounded-xl p-8 text-center">
              <p className="text-slate-400 text-sm">Connect an exchange first to see your portfolio.</p>
              <button
                onClick={() => setTab("connect")}
                className="mt-3 px-4 py-2 rounded-lg text-sm bg-amber-500/20 text-amber-400 border border-amber-500/30"
              >
                Go to Connect
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Binance balances */}
              {balances && balances.binance.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" /> Binance ({balances.binance.length} assets)
                  </h3>
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-700/50">
                          <th className="text-left p-3">Asset</th>
                          <th className="text-right p-3">Free</th>
                          <th className="text-right p-3">Locked</th>
                          <th className="text-right p-3">Total</th>
                          <th className="text-right p-3">USD Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balances.binance.map((b) => (
                          <tr key={b.asset} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="p-3 font-semibold text-white">{b.asset}</td>
                            <td className="p-3 text-right text-slate-300">{formatBalance(b.free)}</td>
                            <td className="p-3 text-right text-slate-500">{formatBalance(b.locked)}</td>
                            <td className="p-3 text-right text-slate-300">{formatBalance(b.total)}</td>
                            <td className="p-3 text-right font-semibold text-amber-400">{usd(b.usdValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Coinbase balances */}
              {balances && balances.coinbase.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" /> Coinbase ({balances.coinbase.length} assets)
                  </h3>
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-700/50">
                          <th className="text-left p-3">Asset</th>
                          <th className="text-right p-3">Free</th>
                          <th className="text-right p-3">Locked</th>
                          <th className="text-right p-3">Total</th>
                          <th className="text-right p-3">USD Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balances.coinbase.map((b) => (
                          <tr key={b.asset} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="p-3 font-semibold text-white">{b.asset}</td>
                            <td className="p-3 text-right text-slate-300">{formatBalance(b.free)}</td>
                            <td className="p-3 text-right text-slate-500">{formatBalance(b.locked)}</td>
                            <td className="p-3 text-right text-slate-300">{formatBalance(b.total)}</td>
                            <td className="p-3 text-right font-semibold text-amber-400">{usd(b.usdValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {balances && balances.binance.length === 0 && balances.coinbase.length === 0 && (
                <div className="bg-slate-800/40 rounded-xl p-6 text-center text-slate-400 text-sm">
                  No balances found. Make sure your API keys have read permission.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB: ORDERS ═══════════════════════ */}
      {tab === "orders" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Open Orders</h2>
            <button
              onClick={fetchPortfolio}
              disabled={loadingData}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            >
              {loadingData ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-slate-800/40 rounded-xl p-8 text-center text-slate-400 text-sm">
              No open orders.{" "}
              {!anyConnected && (
                <button onClick={() => setTab("connect")} className="text-amber-400 underline">
                  Connect an exchange
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-700/50">
                    <th className="text-left p-3">Exchange</th>
                    <th className="text-left p-3">Symbol</th>
                    <th className="text-left p-3">Side</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-right p-3">Qty</th>
                    <th className="text-right p-3">Price</th>
                    <th className="text-right p-3">Filled</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-center p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.exchange === "binance" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {o.exchange.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-white">{o.symbol}</td>
                      <td className="p-3">
                        <span className={o.side === "BUY" ? "text-emerald-400" : "text-red-400"}>
                          {o.side}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{o.type}</td>
                      <td className="p-3 text-right text-slate-300">{o.quantity}</td>
                      <td className="p-3 text-right text-slate-300">{o.price ? `$${o.price}` : "MKT"}</td>
                      <td className="p-3 text-right text-slate-400">{o.filledQty}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400">
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleCancel(o)}
                          className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB: TRADE ═══════════════════════ */}
      {tab === "trade" && (
        <div className="max-w-xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-4">Place Manual Order</h2>
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 space-y-4">
            {/* Exchange select */}
            <div className="grid grid-cols-2 gap-2">
              {(["binance", "coinbase"] as const).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setTradeExchange(ex)}
                  className={`py-2 rounded-lg text-sm font-bold border transition ${
                    tradeExchange === ex
                      ? ex === "binance"
                        ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                        : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                      : "bg-slate-900/50 border-slate-700 text-slate-400"
                  }`}
                >
                  {ex.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Symbol */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Symbol</label>
              <select
                value={tradeSymbol}
                onChange={(e) => setTradeSymbol(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                {TRADEABLE_SYMBOLS.map((s) => (
                  <option key={s.binance} value={tradeExchange === "binance" ? s.binance : s.coinbase}>
                    {s.label} ({tradeExchange === "binance" ? s.binance : s.coinbase})
                  </option>
                ))}
              </select>
            </div>

            {/* Side */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTradeSide("BUY")}
                className={`py-2.5 rounded-lg text-sm font-bold border transition ${
                  tradeSide === "BUY"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : "bg-slate-900/50 border-slate-700 text-slate-400"
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setTradeSide("SELL")}
                className={`py-2.5 rounded-lg text-sm font-bold border transition ${
                  tradeSide === "SELL"
                    ? "bg-red-500/20 border-red-500/40 text-red-400"
                    : "bg-slate-900/50 border-slate-700 text-slate-400"
                }`}
              >
                SELL
              </button>
            </div>

            {/* Type */}
            <div className="grid grid-cols-2 gap-2">
              {(["LIMIT", "MARKET"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTradeType(t)}
                  className={`py-2 rounded-lg text-xs font-bold border transition ${
                    tradeType === t
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-slate-900/50 border-slate-700 text-slate-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Quantity */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Quantity (base asset)</label>
              <input
                type="number"
                step="any"
                value={tradeQty}
                onChange={(e) => setTradeQty(e.target.value)}
                placeholder="0.001"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>

            {/* Price (limit only) */}
            {tradeType === "LIMIT" && (
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Limit Price (USDT)</label>
                <input
                  type="number"
                  step="any"
                  value={tradePrice}
                  onChange={(e) => setTradePrice(e.target.value)}
                  placeholder="67000"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={submitOrder}
              disabled={tradingBusy || !tradeQty}
              className={`w-full py-3 rounded-lg font-bold text-sm border transition ${
                tradeSide === "BUY"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                  : "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
              } disabled:opacity-40`}
            >
              {tradingBusy ? "Placing Order..." : `${tradeSide} ${tradeSymbol}`}
            </button>

            {tradeResult && (
              <div className={`p-3 rounded-lg text-xs ${
                tradeResult.startsWith("Error")
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}>
                {tradeResult}
              </div>
            )}

            <div className="bg-slate-900/50 rounded-lg p-3 text-[10px] text-slate-500">
              Orders go through safety checks: emergency stop, max order size ({usd(limits.maxOrderUSD)}), and allowed pairs list.
              {live ? " LIVE MODE — real money at risk." : " Demo mode — configure in Bot Controls."}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ TAB: BOT CONTROLS ═══════════════════════ */}
      {tab === "bot" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-lg font-bold text-white">Bot Trading Controls</h2>

          {/* Emergency Stop */}
          <div className={`rounded-2xl border p-6 ${
            limits.emergencyStop
              ? "bg-red-500/10 border-red-500/30"
              : "bg-emerald-500/10 border-emerald-500/30"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-lg ${limits.emergencyStop ? "text-red-400" : "text-emerald-400"}`}>
                  Emergency Stop
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {limits.emergencyStop
                    ? "All bot trading is HALTED. No orders will be placed."
                    : "Bot trading is active. Agents can place orders within limits."}
                </p>
              </div>
              <button
                onClick={() => {
                  const next = { ...limits, emergencyStop: !limits.emergencyStop };
                  setLimits(next);
                  saveBotLimits(next);
                }}
                className={`px-6 py-3 rounded-xl font-bold text-sm border transition ${
                  limits.emergencyStop
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
                }`}
              >
                {limits.emergencyStop ? "ENABLE TRADING" : "STOP ALL TRADING"}
              </button>
            </div>
          </div>

          {/* Position Limits */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-white font-bold mb-4">Position Limits</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Max Order Size (USD)</label>
                <input
                  type="number"
                  value={limits.maxOrderUSD}
                  onChange={(e) => {
                    const next = { ...limits, maxOrderUSD: parseFloat(e.target.value) || 0 };
                    setLimits(next);
                    saveBotLimits(next);
                  }}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Max Position (USD)</label>
                <input
                  type="number"
                  value={limits.maxPositionUSD}
                  onChange={(e) => {
                    const next = { ...limits, maxPositionUSD: parseFloat(e.target.value) || 0 };
                    setLimits(next);
                    saveBotLimits(next);
                  }}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Max Daily Loss (USD)</label>
                <input
                  type="number"
                  value={limits.maxDailyLossUSD}
                  onChange={(e) => {
                    const next = { ...limits, maxDailyLossUSD: parseFloat(e.target.value) || 0 };
                    setLimits(next);
                    saveBotLimits(next);
                  }}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Allowed Pairs */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-white font-bold mb-3">Allowed Trading Pairs</h3>
            <p className="text-[11px] text-slate-400 mb-4">Only these pairs can be traded by bots. Click to toggle.</p>
            <div className="flex flex-wrap gap-2">
              {TRADEABLE_SYMBOLS.map((s) => {
                const active = limits.allowedPairs.includes(s.binance);
                return (
                  <button
                    key={s.binance}
                    onClick={() => {
                      const pairs = active
                        ? limits.allowedPairs.filter((p) => p !== s.binance)
                        : [...limits.allowedPairs, s.binance];
                      const next = { ...limits, allowedPairs: pairs };
                      setLimits(next);
                      saveBotLimits(next);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      active
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "bg-slate-900/50 border-slate-700 text-slate-500"
                    }`}
                  >
                    {s.asset}/USDT
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agent Trading Permissions */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-white font-bold mb-3">Agent Trading Permissions</h3>
            <p className="text-[11px] text-slate-400 mb-4">Enable which agents can place real trades.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                "Trader Alpha",
                "Risk Manager",
                "Arbitrage Scout",
                "Grid Master",
                "Market Analyst",
                "Portfolio Manager",
                "Order Executor",
                "Whale Tracker",
                "DeFi Strategist",
                "Sentiment Analyzer",
              ].map((agent) => {
                const enabled = limits.agentsEnabled.includes(agent);
                return (
                  <button
                    key={agent}
                    onClick={() => {
                      const agents = enabled
                        ? limits.agentsEnabled.filter((a) => a !== agent)
                        : [...limits.agentsEnabled, agent];
                      const next = { ...limits, agentsEnabled: agents };
                      setLimits(next);
                      saveBotLimits(next);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${
                      enabled
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-slate-900/50 border-slate-700 text-slate-500"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${enabled ? "bg-emerald-400" : "bg-slate-600"}`} />
                    {agent}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Config Summary */}
          <div className="bg-slate-900/50 rounded-xl p-4 text-[11px] text-slate-400 space-y-1">
            <div><strong className="text-slate-300">Mode:</strong> {live ? "LIVE" : "DEMO"}</div>
            <div><strong className="text-slate-300">Max Order:</strong> {usd(limits.maxOrderUSD)} | <strong className="text-slate-300">Max Position:</strong> {usd(limits.maxPositionUSD)} | <strong className="text-slate-300">Max Daily Loss:</strong> {usd(limits.maxDailyLossUSD)}</div>
            <div><strong className="text-slate-300">Allowed Pairs:</strong> {limits.allowedPairs.join(", ") || "None"}</div>
            <div><strong className="text-slate-300">Agents Enabled:</strong> {limits.agentsEnabled.length > 0 ? limits.agentsEnabled.join(", ") : "None"}</div>
            <div><strong className="text-slate-300">Emergency Stop:</strong> {limits.emergencyStop ? "ON (trading halted)" : "OFF (trading active)"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
