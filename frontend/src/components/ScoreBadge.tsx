"use client";

export default function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-500" : score >= 45 ? "bg-yellow-500" : "bg-red-500";
  return (
    <span
      className={`text-[11px] font-bold text-white ${color} rounded px-1.5 py-0.5 inline-block`}
    >
      {score}
    </span>
  );
}
