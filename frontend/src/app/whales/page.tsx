"use client";
/**
 * Whales · On-Chain · Meme Radar · Strategist Desk
 * ────────────────────────────────────────────────
 * 100% real-time. Zero mocks. Every number you see here came from
 * a live Binance or blockchain.info socket in the last ~1 second.
 */

import LiveTicker from "@/components/LiveTicker";
import WhaleTape from "@/components/WhaleTape";
import VolumeFlowPanel from "@/components/VolumeFlowPanel";
import AladdinPanel from "@/components/AladdinPanel";
import OnChainWhalePanel from "@/components/OnChainWhalePanel";
import MemePumpDumpPanel from "@/components/MemePumpDumpPanel";
import StrategistDesk from "@/components/StrategistDesk";

export default function WhalesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <LiveTicker />
      <div className="p-4 md:p-6 space-y-4 max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              🐋 Whale Desk · On-Chain · Meme Radar · Strategist
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time Binance aggTrades · blockchain.info firehose · pump/dump scanner · BlackRock-style house view
            </p>
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE · NO MOCKS · 🔔 MEGA ALARM ENABLED
          </div>
        </div>

        <StrategistDesk />
        <AladdinPanel />
        <OnChainWhalePanel />
        <MemePumpDumpPanel />
        <VolumeFlowPanel />
        <WhaleTape max={120} />
      </div>
    </div>
  );
}
