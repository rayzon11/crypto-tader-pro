"use client";

import { useEffect, useState } from "react";

const TICKER_DATA = [
  { pair: "BTC/USDT", price: 67523.45, change: 2.34 },
  { pair: "ETH/USDT", price: 3451.23, change: -0.87 },
  { pair: "SOL/USDT", price: 178.56, change: 5.12 },
  { pair: "BNB/USDT", price: 598.34, change: 1.23 },
  { pair: "AVAX/USDT", price: 38.67, change: -1.45 },
  { pair: "BTC/USDT", price: 67523.45, change: 2.34 },
  { pair: "ETH/USDT", price: 3451.23, change: -0.87 },
  { pair: "SOL/USDT", price: 178.56, change: 5.12 },
  { pair: "BNB/USDT", price: 598.34, change: 1.23 },
  { pair: "AVAX/USDT", price: 38.67, change: -1.45 },
];

export default function LiveTicker() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden bg-slate-900/50 border-b border-slate-800 py-2">
      <div className="animate-ticker flex whitespace-nowrap">
        {TICKER_DATA.map((item, i) => {
          const jitteredPrice = item.price * (1 + (Math.sin(tick + i) * 0.001));
          const jitteredChange = item.change + Math.sin(tick + i * 2) * 0.1;
          return (
            <span key={i} className="inline-flex items-center gap-2 mx-6 text-xs">
              <span className="font-bold text-slate-300">{item.pair}</span>
              <span className="text-slate-400">
                ${jitteredPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={jitteredChange >= 0 ? "text-green-400" : "text-red-400"}>
                {jitteredChange >= 0 ? "+" : ""}
                {jitteredChange.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
