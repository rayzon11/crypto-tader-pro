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

interface ChatMessage {
  id: string;
  agent: string;
  agentAvatar: string;
  agentDisplayName: string;
  content: string;
  timestamp: string;
  channel: string;
  isAdmin?: boolean;
}

export default function ChatPage() {
  const [activeChannel, setActiveChannel] = useState("trading-floor");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
  }, [mounted, activeChannel]);

  // Simulate new agent conversations every 10 seconds
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
    if (tick === 0 || !mounted) return;
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
    setMessages((prev) => [...prev, ...newMsgs].slice(-60));
  }, [tick, mounted, activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendAdmin = () => {
    if (!adminMessage.trim()) return;

    // Add admin message
    const adminMsg: ChatMessage = {
      id: `ADMIN${Date.now()}`,
      agent: "admin",
      agentAvatar: "👑",
      agentDisplayName: "Admin",
      content: adminMessage,
      timestamp: new Date().toISOString(),
      channel: activeChannel,
      isAdmin: true,
    };
    setMessages((prev) => [...prev, adminMsg]);

    const msgText = adminMessage;
    setAdminMessage("");

    // Agent responds after short delay
    setTimeout(() => {
      if (activeChannel === "trading-floor") {
        // Multiple agents respond on trading floor
        const responders = AGENTS.filter((a) => a.tier === "Strategy" || a.name === "risk" || a.name === "ml")
          .slice(0, 3);
        const responses: ChatMessage[] = responders.map((agent, i) => {
          const state = agentStates[agent.name] || {
            name: agent.name, memory: [], currentAnalysis: "", mood: "neutral" as const,
            recentResearch: [], tradeCount: 0, lastTradeResult: "none" as const,
          };
          return {
            id: `RESP${Date.now()}-${i}`,
            agent: agent.name,
            agentAvatar: agent.avatar,
            agentDisplayName: agent.displayName,
            content: generateAgentResponse(agent.name, msgText, state),
            timestamp: new Date(Date.now() + (i + 1) * 1500).toISOString(),
            channel: activeChannel,
          };
        });
        responses.forEach((resp, i) => {
          setTimeout(() => {
            setMessages((prev) => [...prev, resp]);
          }, (i + 1) * 1500);
        });
      } else {
        // Single agent responds on their channel
        const agent = AGENTS.find((a) => a.name === activeChannel);
        if (agent) {
          const state = agentStates[agent.name] || {
            name: agent.name, memory: [], currentAnalysis: "", mood: "neutral" as const,
            recentResearch: [], tradeCount: 0, lastTradeResult: "none" as const,
          };
          const resp: ChatMessage = {
            id: `RESP${Date.now()}`,
            agent: agent.name,
            agentAvatar: agent.avatar,
            agentDisplayName: agent.displayName,
            content: generateAgentResponse(agent.name, msgText, state),
            timestamp: new Date(Date.now() + 2000).toISOString(),
            channel: activeChannel,
          };
          setTimeout(() => {
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
          }, 2000);
        }
      }
    }, 800);
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

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading chat...</div>;
  }

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
          <p className="text-xs text-slate-500 mt-1">Agents respond to your messages with real-time market analysis</p>
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
                <span className="text-[10px] text-slate-500">Live — Agents respond to messages</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {channelMessages.length === 0 && (
                <div className="text-center text-slate-600 text-xs py-8">
                  {activeChannel === "trading-floor"
                    ? "Agents are analyzing markets... Messages will appear shortly."
                    : `Send a message to start chatting with ${channels.find((c) => c.id === activeChannel)?.label}. Try: "What's your status?" or "Should we buy BTC?"`}
                </div>
              )}
              {channelMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.isAdmin ? "flex-row-reverse" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/30 flex items-center justify-center flex-shrink-0 text-sm">
                    {msg.agentAvatar}
                  </div>
                  <div className={`max-w-[75%] ${msg.isAdmin ? "text-right" : ""}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[11px] font-bold ${msg.isAdmin ? "text-amber-400" : "text-cyan-400"}`}>
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
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-slate-700/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendAdmin()}
                  placeholder={activeChannel === "trading-floor" ? "Ask all agents..." : `Ask ${channels.find((c) => c.id === activeChannel)?.label}...`}
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
                Try: &quot;What&apos;s your status?&quot; &bull; &quot;Should we buy BTC?&quot; &bull; &quot;What are you thinking?&quot; &bull; &quot;Show me your performance&quot;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
