"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
} from "lightweight-charts";

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Indicators {
  ema20?: number[];
  ema50?: number[];
  bbUpper?: number[];
  bbMiddle?: number[];
  bbLower?: number[];
}

interface Props {
  candles: OHLCV[];
  indicators?: Indicators;
  height?: number;
  showVolume?: boolean;
  title?: string;
}

export default function CandleChart({
  candles,
  indicators = {},
  height = 500,
  showVolume = true,
  title,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const firstDataRef = useRef<boolean>(true);
  const lastSeriesLenRef = useRef<number>(0);
  const lastFirstTsRef = useRef<number>(0);
  const lastLastTsRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volumeSeriesRef.current = volSeries;
    }

    ema20Ref.current    = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, title: "EMA20" });
    ema50Ref.current    = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1, title: "EMA50" });
    bbUpperRef.current  = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Upper" });
    bbMiddleRef.current = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Mid" });
    bbLowerRef.current  = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Lower" });

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [height, showVolume]);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    const byTime = new Map<number, OHLCV>();
    for (const c of candles) {
      const t = Math.floor(c.timestamp / 1000);
      byTime.set(t, c);
    }
    const sorted = Array.from(byTime.entries()).sort((a, b) => a[0] - b[0]);

    const candleData: CandlestickData[] = sorted.map(([t, c]) => ({
      time: t as any, open: c.open, high: c.high, low: c.low, close: c.close,
    }));

    const firstTs = candleData[0]?.time as number;
    const lastTs = candleData[candleData.length - 1]?.time as number;

    // Detect TF switch / full re-bootstrap: the first timestamp changed, or we jumped past the old tail,
    // or the series shrank. In any of those cases we MUST setData — calling update() with an
    // earlier/unordered timestamp throws in lightweight-charts.
    const isFullReplace =
      lastSeriesLenRef.current === 0 ||
      lastFirstTsRef.current !== firstTs ||
      candleData.length < lastSeriesLenRef.current ||
      (lastLastTsRef.current > 0 && lastTs < lastLastTsRef.current);

    if (!isFullReplace) {
      // Incremental tick — only the tail changed (live WS tick)
      try {
        const last = candleData[candleData.length - 1];
        candleSeriesRef.current.update(last);
        if (volumeSeriesRef.current) {
          const c = sorted[sorted.length - 1][1];
          volumeSeriesRef.current.update({
            time: last.time,
            value: c.volume || 0,
            color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
          });
        }
      } catch {
        // Fallback: if update() throws for any reason, rebuild cleanly
        candleSeriesRef.current.setData(candleData);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(sorted.map(([t, c]) => ({
            time: t as any, value: c.volume || 0,
            color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
          })));
        }
        firstDataRef.current = true;
      }
    } else {
      candleSeriesRef.current.setData(candleData);
      if (volumeSeriesRef.current) {
        const volData: HistogramData[] = sorted.map(([t, c]) => ({
          time: t as any,
          value: c.volume || 0,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
        }));
        volumeSeriesRef.current.setData(volData);
      }
      firstDataRef.current = true; // re-fit after TF switch
    }
    lastSeriesLenRef.current = candleData.length;
    lastFirstTsRef.current = firstTs;
    lastLastTsRef.current = lastTs;

    const closes = sorted.map(([, c]) => c.close);
    const times  = sorted.map(([t]) => t);

    const ema20 = indicators.ema20 || computeEMA(closes, 20);
    const ema50 = indicators.ema50 || computeEMA(closes, 50);
    const bbMid = indicators.bbMiddle || computeSMA(closes, 20);
    const bbUp  = indicators.bbUpper  || computeBB(closes, 20, 2, "upper");
    const bbLo  = indicators.bbLower  || computeBB(closes, 20, 2, "lower");

    ema20Ref.current?.setData(toLineData(times, ema20));
    ema50Ref.current?.setData(toLineData(times, ema50));
    bbUpperRef.current?.setData(toLineData(times, bbUp));
    bbMiddleRef.current?.setData(toLineData(times, bbMid));
    bbLowerRef.current?.setData(toLineData(times, bbLo));

    if (firstDataRef.current) {
      chartRef.current?.timeScale().fitContent();
      firstDataRef.current = false;
    }
  }, [candles, indicators]);

  return (
    <div className="w-full">
      {title && (
        <div className="mb-2 px-1 text-xs text-slate-400 font-mono uppercase tracking-wider">
          {title}
        </div>
      )}
      <div ref={containerRef} className="w-full rounded-lg border border-slate-800 overflow-hidden" />
    </div>
  );
}

// ─── Helpers ───
function toLineData(times: number[], values: number[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < times.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) out.push({ time: times[i] as any, value: v });
  }
  return out;
}

function computeEMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function computeSMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out[i] = sum / period;
  }
  return out;
}

function computeBB(values: number[], period: number, stdDev: number, side: "upper" | "lower"): number[] {
  const sma = computeSMA(values, period);
  const out: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (values[j] - sma[i]) ** 2;
    const sd = Math.sqrt(sumSq / period);
    out[i] = side === "upper" ? sma[i] + stdDev * sd : sma[i] - stdDev * sd;
  }
  return out;
}
