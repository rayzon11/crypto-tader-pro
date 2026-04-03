"use client";

import { useState, useEffect, useRef } from "react";
import LiveTicker from "@/components/LiveTicker";
import { AGENTS } from "@/lib/agents";
import {
  generateAgentResponse,
  generateAgentConversation,
  loadAgentStates,
  saveAgentStates,
  type AgentState,
} from "@/lib/agentMemory";
import {
  generateSmartResponse,
  generateCoordinationEvents,
  detectMarketRegime,
  runConsensusVoting,
  getRiskPnlSnapshot,
  type AgentCoordinationEvent,
} from "@/lib/agentBrain";

interface ChatMessage {
  id: string;
  agent: string;
  agentAvatar: string;
  agentDisplayName: string;
  content: string;
  timestamp: string;
  channel: string;
  isAdmin?: boolean;
  isSystem?: boolean;
}

function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

const QUICK_ACTIONS = [
  { label: "Full Analysis", prompt: "Give me a full market analysis right now" },
  { label: "Risk Report", prompt: "Show me the current risk report and exposure" },
  { label: "Alpha Signals", prompt: "What alpha signals are you seeing?" },
  { label: "Order Flow", prompt: "Analyze the current order flow and smart money" },
];

function typeBadgeColor(type: AgentCoordinationEvent["type"]): string {
  switch (type) {
    case "signal":
      return "bg-cyan-500/20 text-cyan-400";
    case "alert":
      return "bg-red-500/20 text-red-400";
    case "data":
      return "bg-blue-500/20 text-blue-400";
    case "request":
      return "bg-amber-500/20 text-amber-400";
    case "consensus":
      return "bg-purple-500/20 text-purple-400";
    case "execution":
      return "bg-green-500/20 text-green-400";
    case "risk_check":
      return "bg-orange-500/20 text-orange-400";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
}

export default function ChatPage() {
  const [activeChannel, setActiveChannel] = useState("trading-floor");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [mounted, setMounted] = useState(false);
  const [coordEvents, setCoordEvents] = useState<AgentCoordinationEvent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const coordEndRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    setAgentStates(loadAgentStates());
  }, []);

  // Generate initial trading floor messages
  useEffect(() => {
    if (!mounted) return;
    const convo = generateAgentConversation(0);
    const msgs: ChatMessage[] = convo.map((msg, i) => {
      const agent = AGENTS.find((a) => a.name === msg.agent);
      return {
        id: `INIT${i}`,
        agent: msg.agent,
        agentAvatar: agent?.avatar || "🤖",
        agentDisplayName: agent?.displayName || msg.agent,
        content: msg.content,
        timestamp: new Date(Date.now() - (convo.length - i) * 30000).toISOString(),
        channel: "trading-floor",
      };
    });
    setMessages(msgs);
    // Seed initial coordination events
    setCoordEvents(generateCoordinationEvents(0));
  }, [mounted, activeChannel]);

  // Tick every 10 seconds
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [mounted]);

  // On each tick: add conversation messages + coordination events + system messages
  useEffect(() => {
    if (tick === 0 || !mounted) return;

    // Update coordination events
    const newCoord = generateCoordinationEvents(tick);
    setCoordEvents((prev) => [...prev, ...newCoord].slice(-40));

    if (activeChannel !== "trading-floor") return;

    const convo = generateAgentConversation(tick);
    const newMsgs: ChatMessage[] = convo.map((msg, i) => {
      const agent = AGENTS.find((a) => a.name === msg.agent);
      return {
        id: `T${tick}-${i}`,
        agent: msg.agent,
        agentAvatar: agent?.avatar || "🤖",
        agentDisplayName: agent?.displayName || msg.agent,
        content: msg.content,
        timestamp: new Date().toISOString(),
        channel: "trading-floor",
      };
    });

    // Pepper in a coordination event as a system message every other tick
    if (tick % 2 === 0 && newCoord.length > 0) {
      const ev = newCoord[0];
      const fromAgent = AGENTS.find((a) => a.name === ev.fromAgent);
      const sysMsg: ChatMessage = {
        id: `SYS${tick}`,
        agent: "system",
        agentAvatar: "⚡",
        agentDisplayName: "System",
        content: `[${ev.type.toUpperCase()}] ${fromAgent?.displayName || ev.fromAgent} → ${ev.toAgent === "all" ? "All Agents" : (AGENTS.find((a) => a.name === ev.toAgent)?.displayName || ev.toAgent)}: ${ev.payload}`,
        timestamp: new Date().toISOString(),
        channel: "trading-floor",
        isSystem: true,
      };
      newMsgs.push(sysMsg);
    }

    setMessages((prev) => [...prev, ...newMsgs].slice(-60));
  }, [tick, mounted, activeChannel]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-scroll coordination feed
  useEffect(() => {
    coordEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coordEvents]);

  const handleSendAdmin = (overrideMsg?: string) => {
    const msgText = (overrideMsg || adminMessage).trim();
    if (!msgText) return;

    // Add admin message
    const adminMsg: ChatMessage = {
      id: `ADMIN${Date.now()}`,
      agent: "admin",
      agentAvatar: "👑",
      agentDisplayName: "Admin",
      content: msgText,
      timestamp: new Date().toISOString(),
      channel: activeChannel,
      isAdmin: true,
    };
    setMessages((prev) => [...prev, adminMsg]);
    setAdminMessage("");

    if (activeChannel === "trading-floor") {
      // 3 agents respond staggered at 500ms, 1000ms, 1500ms
      const responders = AGENTS.filter(
        (a) => a.tier === "Strategy" || a.name === "risk" || a.name === "ml"
      ).slice(0, 3);

      responders.forEach((agent, i) => {
        const delay = (i + 1) * 500;
        setTimeout(() => {
          let content: string;
          try {
            content = generateSmartResponse(agent.name, msgText, tick);
          } catch {
            // Fallback to basic response
            const state = agentStates[agent.name] || {
              name: agent.name,
              memory: [],
              currentAnalysis: "",
              mood: "neutral" as const,
              recentResearch: [],
              tradeCount: 0,
              lastTradeResult: "none" as const,
            };
            content = generateAgentResponse(agent.name, msgText, state);
          }

          const resp: ChatMessage = {
            id: `RESP${Date.now()}-${i}`,
            agent: agent.name,
            agentAvatar: agent.avatar,
            agentDisplayName: agent.displayName,
            content,
            timestamp: new Date().toISOString(),
            channel: activeChannel,
          };
          setMessages((prev) => [...prev, resp]);
        }, delay);
      });
    } else {
      // Single agent responds after 600ms
      const agent = AGENTS.find((a) => a.name === activeChannel);
      if (agent) {
        setTimeout(() => {
          let content: string;
          try {
            content = generateSmartResponse(agent.name, msgText, tick);
          } catch {
            const state = agentStates[agent.name] || {
              name: agent.name,
              memory: [],
              currentAnalysis: "",
              mood: "neutral" as const,
              recentResearch: [],
              tradeCount: 0,
              lastTradeResult: "none" as const,
            };
            content = generateAgentResponse(agent.name, msgText, state);
          }

          const resp: ChatMessage = {
            id: `RESP${Date.now()}`,
            agent: agent.name,
            agentAvatar: agent.avatar,
            agentDisplayName: agent.displayName,
            content,
            timestamp: new Date().toISOString(),
            channel: activeChannel,
          };
          setMessages((prev) => [...prev, resp]);

          // Save to memory
          const newStates = { ...agentStates };
          if (newStates[agent.name]) {
            newStates[agent.name].memory.push({
              timestamp: new Date().toISOString(),
              type: "conversation",
              content: `Admin asked: "${msgText}" — I responded with analysis.`,
              confidence: 0.8,
            });
            if (newStates[agent.name].memory.length > 50) {
              newStates[agent.name].memory = newStates[agent.name].memory.slice(-50);
            }
            saveAgentStates(newStates);
            setAgentStates(newStates);
          }
        }, 600);
      }
    }
  };

  const channels = [
    { id: "trading-floor", label: "Trading Floor", icon: "📊", desc: "All agents group chat" },
    ...AGENTS.filter((a) => a.tier !== "Security").map((a) => ({
      id: a.name,
      label: a.displayName,
      icon: a.avatar,
      desc: a.specialty,
    })),
  ];

  const channelMessages = messages.filter(
    (m) => m.channel === activeChannel || (activeChannel !== "trading-floor" && m.agent === activeChannel)
  );

  // Market context data
  const regime = mounted ? detectMarketRegime(tick) : null;
  const consensus = mounted ? runConsensusVoting(tick) : null;
  const pnl = mounted ? getRiskPnlSnapshot(tick) : null;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading chat...
      </div>
    );
  }

  const signalColor = (sig: string) => {
    if (sig.includes("BUY")) return "text-emerald-400";
    if (sig.includes("SELL")) return "text-red-400";
    return "text-slate-400";
  };

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
          <p className="text-xs text-slate-500 mt-1">
            Smart agent brain with real-time coordination, consensus voting, and market regime detection
          </p>
        </div>

        {/* Market Context Bar */}
        {regime && consensus && pnl && (
          <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Regime:</span>
              <span className="font-bold text-amber-400 uppercase">
                {regime.type.replace(/_/g, " ")}
              </span>
              <span className="text-slate-600">({(regime.confidence * 100).toFixed(0)}%)</span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Consensus:</span>
              <span className={`font-bold ${signalColor(consensus.finalSignal)}`}>
                {consensus.finalSignal.replace(/_/g, " ")}
              </span>
              <span className="text-slate-600">({(consensus.confidence * 100).toFixed(0)}%)</span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">P&L:</span>
              <span className={pnl.totalPnl >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                {pnl.totalPnl >= 0 ? "+" : ""}${pnl.totalPnl.toLocaleString()}
              </span>
              <span className="text-slate-600">
                (today: {pnl.todayPnl >= 0 ? "+" : ""}${pnl.todayPnl.toLocaleString()})
              </span>
            </div>
            <div className="w-px h-4 bg-slate-700 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-500">Sharpe:</span>
              <span className="text-slate-300 font-medium">{pnl.sharpeRatio.toFixed(2)}</span>
            </div>
            <div className="w-px h-4 bg-slate-700 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-500">Exposure:</span>
              <span className="text-slate-300 font-medium">{pnl.openPositions} pos</span>
              <span className="text-slate-600">({pnl.leverage.toFixed(1)}x lev)</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4" style={{ height: "calc(100vh - 240px)" }}>
          {/* Channel List */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Channels</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChannel(ch.id);
                    setMessages([]);
                  }}
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
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{channels.find((c) => c.id === activeChannel)?.icon}</span>
                <h3 className="text-sm font-bold text-slate-300">
                  {channels.find((c) => c.id === activeChannel)?.label}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-slate-500">Live — Smart Brain Active</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {channelMessages.length === 0 && (
                <div className="text-center text-slate-600 text-xs py-8">
                  {activeChannel === "trading-floor"
                    ? "Agents are analyzing markets... Messages will appear shortly."
                    : `Send a message to start chatting with ${channels.find((c) => c.id === activeChannel)?.label}. Try asking for analysis, risk reports, or alpha signals.`}
                </div>
              )}
              {channelMessages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[10px]">⚡</span>
                      <span
                        className="text-[10px] text-slate-500 italic"
                        dangerouslySetInnerHTML={{ __html: formatBold(msg.content) }}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.isAdmin ? "flex-row-reverse" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/30 flex items-center justify-center flex-shrink-0 text-sm">
                      {msg.agentAvatar}
                    </div>
                    <div className={`max-w-[75%] ${msg.isAdmin ? "text-right" : ""}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`text-[11px] font-bold ${msg.isAdmin ? "text-amber-400" : "text-cyan-400"}`}
                        >
                          {msg.agentDisplayName}
                        </span>
                        <span className="text-[9px] text-slate-600">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div
                        className={`text-xs p-3 rounded-xl whitespace-pre-line ${
                          msg.isAdmin
                            ? "bg-amber-500/10 border border-amber-500/20 text-amber-200"
                            : "bg-slate-900/50 border border-slate-700/20 text-slate-300"
                        }`}
                        dangerouslySetInnerHTML={{ __html: formatBold(msg.content) }}
                      />
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-slate-700/30">
              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSendAdmin(action.prompt)}
                    className="px-2.5 py-1 rounded-md bg-slate-700/30 border border-slate-600/30 text-[10px] text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendAdmin()}
                  placeholder="Ask agents anything... (analysis, risk, trades, research)"
                  className="flex-1 bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => handleSendAdmin()}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Agent Coordination Feed — right sidebar, hidden on mobile */}
          <div className="hidden lg:flex rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden flex-col">
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Agent Coordination
              </h3>
              <p className="text-[9px] text-slate-600 mt-0.5">Real-time inter-agent comms</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {coordEvents.length === 0 && (
                <div className="text-center text-slate-600 text-[10px] py-4">
                  Waiting for coordination events...
                </div>
              )}
              {coordEvents.map((ev, idx) => {
                const fromAgent = AGENTS.find((a) => a.name === ev.fromAgent);
                const toAgent = ev.toAgent === "all" ? null : AGENTS.find((a) => a.name === ev.toAgent);
                return (
                  <div
                    key={`coord-${idx}-${ev.timestamp}`}
                    className="p-2 rounded-lg bg-slate-900/40 border border-slate-700/20"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px]">{fromAgent?.avatar || "🤖"}</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {fromAgent?.displayName || ev.fromAgent}
                      </span>
                      <span className="text-[9px] text-slate-600">→</span>
                      <span className="text-[10px]">{toAgent?.avatar || "📡"}</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {ev.toAgent === "all" ? "All" : toAgent?.displayName || ev.toAgent}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${typeBadgeColor(ev.type)}`}
                      >
                        {ev.type.replace(/_/g, " ")}
                      </span>
                      {ev.priority === "critical" && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold uppercase">
                          CRITICAL
                        </span>
                      )}
                      {ev.priority === "high" && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold uppercase">
                          HIGH
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                      {ev.payload}
                    </p>
                  </div>
                );
              })}
              <div ref={coordEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
