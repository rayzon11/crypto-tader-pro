"use client";

import { useEffect, useRef, useState } from "react";

const API = "http://localhost:3002";
const SESSION_ID = typeof window !== "undefined"
  ? (localStorage.getItem("claude-chat-session") || (() => {
      const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("claude-chat-session", id);
      return id;
    })())
  : "default";

interface ToolCall {
  name: string;
  input: any;
  output: any;
}
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: string;
}

const QUICK_ACTIONS = [
  "What's the current trader status?",
  "Start the autonomous trader",
  "Stop the trader",
  "Show me the BTC/USDT prediction matrix",
  "Analyze ETH and tell me if we should enter",
  "What are all agents doing right now?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "system",
      content: "◆ CLAUDE-OPUS · MASTER TRADER · TOOL-USE ENABLED\n\nI have real control over the trader. Ask me to start/stop trading, analyze pairs, or inspect the 27 agents. Every tool call actually executes against the live system.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (msg?: string) => {
    const text = (msg ?? input).trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(m => [...m, userMsg]);

    try {
      const r = await fetch(`${API}/api/claude/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
      });
      const data = await r.json();
      const reply: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.reply || data.error || "(empty response)",
        toolCalls: data.toolCalls || [],
        timestamp: new Date().toISOString(),
      };
      setMessages(m => [...m, reply]);
    } catch (e: any) {
      setMessages(m => [...m, {
        id: `e_${Date.now()}`,
        role: "system",
        content: `✖ Request failed: ${e.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    await fetch(`${API}/api/claude/chat/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    });
    setMessages([{
      id: "init2",
      role: "system",
      content: "↺ Conversation reset. Starting fresh.",
      timestamp: new Date().toISOString(),
    }]);
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-4" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="border border-green-500/40 rounded p-3 mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs tracking-widest opacity-70">◆ AGENT CHAT · CLAUDE OPUS 4.5 WITH TOOL-USE</div>
            <div className="text-lg font-bold mt-1 text-white">Direct Control Terminal</div>
            <div className="text-[10px] opacity-60">Claude can inspect state, start/stop trading, switch DEMO↔LIVE, and analyze predictions</div>
          </div>
          <button
            onClick={reset}
            className="text-xs px-3 py-1 rounded border border-yellow-400 text-yellow-300 hover:bg-yellow-500/10"
          >↺ Reset Session</button>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_ACTIONS.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={busy}
              className="text-[10px] px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="border border-green-500/40 rounded bg-black/40 h-[calc(100vh-260px)] overflow-y-auto p-4 space-y-4">
          {messages.map(m => (
            <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
              <div className="flex items-baseline gap-2 mb-1" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <span className={`text-[11px] font-bold ${
                  m.role === "user" ? "text-amber-400"
                    : m.role === "assistant" ? "text-cyan-400"
                    : "text-yellow-300"
                }`}>
                  {m.role === "user" ? "👑 ADMIN" : m.role === "assistant" ? "🤖 CLAUDE-OPUS" : "⚡ SYSTEM"}
                </span>
                <span className="text-[9px] opacity-50">{new Date(m.timestamp).toLocaleTimeString()}</span>
              </div>

              <div className={`inline-block text-left max-w-[85%] p-3 rounded text-xs whitespace-pre-wrap ${
                m.role === "user" ? "bg-amber-500/10 border border-amber-500/30 text-amber-200"
                  : m.role === "assistant" ? "bg-cyan-500/5 border border-cyan-500/30 text-slate-200"
                  : "bg-yellow-500/5 border border-yellow-500/20 text-yellow-200 italic"
              }`}>
                {m.content}

                {/* Tool calls panel */}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-2">
                    <div className="text-[10px] opacity-60 tracking-widest">⚡ TOOLS EXECUTED · {m.toolCalls.length}</div>
                    {m.toolCalls.map((tc, i) => (
                      <details key={i} className="bg-black/50 rounded border border-cyan-500/20 p-2">
                        <summary className="cursor-pointer text-[11px] text-cyan-300 font-bold">
                          {tc.name}({Object.keys(tc.input || {}).length ? JSON.stringify(tc.input) : ""})
                        </summary>
                        <pre className="mt-2 text-[10px] opacity-70 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(tc.output, null, 2).slice(0, 1500)}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div>
              <div className="text-[11px] font-bold text-cyan-400 mb-1">🤖 CLAUDE-OPUS</div>
              <div className="inline-block p-3 rounded border border-cyan-500/30 bg-cyan-500/5 text-xs">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-1" />
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-1" style={{ animationDelay: "0.2s" }} />
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
                <span className="ml-2 opacity-60">thinking · calling tools · analyzing…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Command Claude: 'start trading', 'analyze BTC', 'show risk exposure'…"
            disabled={busy}
            className="flex-1 bg-black/60 border border-green-500/40 rounded px-3 py-2 text-sm text-green-300 placeholder:opacity-40 focus:outline-none focus:border-green-400 disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="px-4 py-2 rounded border border-green-400 bg-green-500/10 hover:bg-green-500/20 text-green-300 font-bold text-sm disabled:opacity-40"
          >
            {busy ? "..." : "SEND ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}
