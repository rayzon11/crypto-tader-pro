"use client";

import { useState, useEffect, useRef } from "react";
import LiveTicker from "@/components/LiveTicker";
import { AGENTS, getAgentsByTier, type AgentProfile } from "@/lib/agents";

interface ChatMessage {
  id: string;
  agent: string;
  agentAvatar: string;
  agentDisplayName: string;
  content: string;
  timestamp: string;
  channel: string;
}

const TRADING_FLOOR_MESSAGES: { agent: string; content: string }[] = [
  { agent: "trend", content: "EMA(9) just crossed above EMA(21) on BTC/USDT 4H chart. Bullish signal confirmed." },
  { agent: "momentum", content: "Agreed. RSI at 58 with room to run. StochRSI showing bullish momentum divergence." },
  { agent: "indicator_master", content: "My 10-indicator composite reads +6.2/10. STRONG_BUY signal. MACD, EMA, Stochastic, and ADX all aligned." },
  { agent: "risk", content: "Position sizing recommendation: 15% of portfolio max. VaR(99%) at 2.3% — within limits." },
  { agent: "sentiment", content: "Fear & Greed Index at 72 (Greed). Institutional inflows $800M today. Market sentiment supports the trade." },
  { agent: "news", content: "Breaking: Bitcoin ETF sees $1.2B inflows. Headline sentiment score +0.78. This is very bullish." },
  { agent: "arbitrage", content: "Seeing 0.15% spread between Binance and Kraken on BTC. Not actionable yet — watching." },
  { agent: "orderbook", content: "Large buy wall at $67,200 (~2,500 BTC). Significant sell resistance at $68,500." },
  { agent: "ml", content: "LSTM model predicts 73% probability of upward movement in next 4 hours. Confidence: HIGH." },
  { agent: "stoploss", content: "Setting trailing stop at 2% below entry. Take profit target at $71,000 (+5.2%)." },
  { agent: "portfolio", content: "Current BTC allocation: 38%. Kelly criterion suggests optimal size at 42%. Room to add." },
  { agent: "order", content: "Executing: BUY 0.15 BTC/USDT @ $67,523 via TWAP (3 exchanges). Estimated fill: 99.7%." },
  { agent: "fee", content: "Routing through maker orders. Expected fee: 0.075%. Gas optimization: batch transaction queued." },
  { agent: "slippage", content: "Slippage estimate: 0.018% for 0.15 BTC order. Well within acceptable range." },
  { agent: "breakout", content: "BTC approaching key resistance at $68,000. Volume confirmation needed for breakout signal." },
  { agent: "mean_reversion", content: "Bollinger Bands widening. Z-score at +0.8 — not overbought yet. Mean reversion risk is low." },
  { agent: "backtest", content: "This setup has 71% win rate historically. Average return: +2.8% over 48-hour holding period." },
  { agent: "rebalance", content: "After this trade, portfolio will be: BTC 42%, ETH 29%, SOL 14%, BNB 10%, AVAX 5%. Within targets." },
  { agent: "audit", content: "Trade logged to PostgreSQL. Anomaly score: 0.12 (normal). No suspicious patterns detected." },
  { agent: "alert", content: "Notifications sent to Telegram & Discord. Position monitoring active. Will alert on SL/TP triggers." },
  { agent: "defi", content: "FYI: Aave BTC lending rate at 3.2% APY. Consider deploying idle BTC to earn yield." },
  { agent: "indicator_master", content: "Update: ADX at 28, trending condition confirmed. Ichimoku Cloud shows bullish kumo twist. Maintaining STRONG_BUY." },
  { agent: "trend", content: "4H candle closed bullish engulfing. MACD histogram expanding. Trend strength: STRONG." },
  { agent: "risk", content: "Portfolio risk check: Max drawdown today 0.8%. Kill switch threshold at 5%. System healthy." },
];

function generateMessages(channel: string, count: number, offset: number = 0): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const pool = channel === "trading-floor" ? TRADING_FLOOR_MESSAGES : TRADING_FLOOR_MESSAGES.filter((m) => m.agent === channel);
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const idx = (i + offset) % pool.length;
    const msg = pool[idx];
    const agent = AGENTS.find((a) => a.name === msg.agent);
    msgs.push({
      id: `MSG${Date.now()}-${i}`,
      agent: msg.agent,
      agentAvatar: agent?.avatar || "🤖",
      agentDisplayName: agent?.displayName || msg.agent,
      content: msg.content,
      timestamp: new Date(Date.now() - (count - i) * 45000).toISOString(),
      channel,
    });
  }
  return msgs;
}

export default function ChatPage() {
  const [activeChannel, setActiveChannel] = useState("trading-floor");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMessages(generateMessages(activeChannel, 15));
  }, [activeChannel]);

  // Simulate new messages
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tick === 0) return;
    const newMsgs = generateMessages(activeChannel, 1, tick + 15);
    if (newMsgs.length > 0) {
      setMessages((prev) => [...prev, ...newMsgs].slice(-50));
    }
  }, [tick, activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendAdmin = () => {
    if (!adminMessage.trim()) return;
    const msg: ChatMessage = {
      id: `ADMIN${Date.now()}`,
      agent: "admin",
      agentAvatar: "👑",
      agentDisplayName: "Admin",
      content: adminMessage,
      timestamp: new Date().toISOString(),
      channel: activeChannel,
    };
    setMessages((prev) => [...prev, msg]);
    setAdminMessage("");
  };

  const channels = [
    { id: "trading-floor", label: "Trading Floor", icon: "📊", desc: "All agents group chat" },
    ...AGENTS.filter((a) => a.tier === "Strategy" || a.tier === "Intelligence").map((a) => ({
      id: a.name,
      label: a.displayName,
      icon: a.avatar,
      desc: a.specialty,
    })),
  ];

  return (
    <div className="min-h-screen text-slate-200">
      <LiveTicker />
      <div className="p-4 lg:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Agent Chat
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Monitor agent-to-agent communication and join the conversation</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: "calc(100vh - 180px)" }}>
          {/* Channel List */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Channels</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                    activeChannel === ch.id
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-slate-400 hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-base">{ch.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ch.label}</div>
                    <div className="text-[9px] text-slate-600 truncate">{ch.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="lg:col-span-3 rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{channels.find((c) => c.id === activeChannel)?.icon}</span>
                <h3 className="text-sm font-bold text-slate-300">
                  {channels.find((c) => c.id === activeChannel)?.label}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-slate-500">Live</span>
              </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.agent === "admin" ? "flex-row-reverse" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/30 flex items-center justify-center flex-shrink-0 text-sm">
                    {msg.agentAvatar}
                  </div>
                  <div className={`max-w-[75%] ${msg.agent === "admin" ? "text-right" : ""}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[11px] font-bold ${msg.agent === "admin" ? "text-amber-400" : "text-cyan-400"}`}>
                        {msg.agentDisplayName}
                      </span>
                      <span className="text-[9px] text-slate-600">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      className={`text-xs p-3 rounded-xl ${
                        msg.agent === "admin"
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-200"
                          : "bg-slate-900/50 border border-slate-700/20 text-slate-300"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin Input */}
            <div className="p-3 border-t border-slate-700/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendAdmin()}
                  placeholder="Send message as Admin..."
                  className="flex-1 bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={handleSendAdmin}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  Send
                </button>
              </div>
              <div className="text-[9px] text-slate-600 mt-1">
                👑 You are observing as Admin. Messages are broadcast to the channel.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
