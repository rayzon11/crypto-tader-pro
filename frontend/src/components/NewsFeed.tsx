"use client";

import { type NewsItem } from "@/lib/mockData";

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export interface NewsFeedItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  imageUrl?: string | null;
  url?: string;
  currencies?: { code: string; title: string }[];
}

export default function NewsFeed({
  items,
  compact = false,
}: {
  items: (NewsItem | NewsFeedItem)[];
  compact?: boolean;
}) {
  const displayed = compact ? items.slice(0, 5) : items;

  return (
    <div className="space-y-2">
      {displayed.map((item) => {
        const feedItem = item as NewsFeedItem;
        const hasImage = feedItem.imageUrl;

        return (
          <a
            key={item.id}
            href={feedItem.url || "#"}
            target={feedItem.url && feedItem.url !== "#" ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-colors group cursor-pointer"
          >
            {/* Image or Sentiment dot */}
            {hasImage ? (
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-700/50">
                <img
                  src={feedItem.imageUrl!}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="mt-1.5 flex-shrink-0">
                <span
                  className={`w-2 h-2 rounded-full block ${
                    item.sentiment === "positive"
                      ? "bg-green-500"
                      : item.sentiment === "negative"
                      ? "bg-red-500"
                      : "bg-slate-500"
                  }`}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-300 leading-snug group-hover:text-cyan-300 transition-colors`}>
                {item.title}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                  {item.source}
                </span>
                <span className="text-[9px] text-slate-600">
                  {timeAgo(item.timestamp)}
                </span>
                {feedItem.currencies && feedItem.currencies.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                    {feedItem.currencies.map((c) => c.code).join(", ")}
                  </span>
                )}
                {!compact && (
                  <span
                    className={`text-[9px] font-medium ${
                      item.score > 0
                        ? "text-green-400"
                        : item.score < 0
                        ? "text-red-400"
                        : "text-slate-500"
                    }`}
                  >
                    {item.score > 0 ? "+" : ""}
                    {(item.score * 100).toFixed(0)}%
                  </span>
                )}
                {/* Sentiment badge */}
                <span
                  className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    item.sentiment === "positive"
                      ? "bg-green-500/10 text-green-400"
                      : item.sentiment === "negative"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-slate-500/10 text-slate-500"
                  }`}
                >
                  {item.sentiment}
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
