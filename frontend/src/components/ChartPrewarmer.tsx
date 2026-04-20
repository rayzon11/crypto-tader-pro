"use client";
/**
 * ChartPrewarmer — kicks off shared candleHub subscriptions for the
 * most-viewed pairs as soon as the app mounts. By the time the user
 * clicks into a chart, the data is already in memory + sessionStorage
 * so the chart paints within ~50ms instead of waiting on REST.
 */
import { useEffect } from "react";
import { prefetch } from "@/lib/candleHub";

const HOT_PAIRS = [
  { pair: "BTC/USDT", tf: "15m" },
  { pair: "ETH/USDT", tf: "15m" },
  { pair: "SOL/USDT", tf: "15m" },
  { pair: "BTC/USDT", tf: "1h" },
];

export default function ChartPrewarmer() {
  useEffect(() => {
    // Wait a beat so the initial page isn't competing for bandwidth
    const t = setTimeout(() => {
      for (const p of HOT_PAIRS) prefetch(p.pair, p.tf);
    }, 500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
