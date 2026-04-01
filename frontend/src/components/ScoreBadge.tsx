"use client";

export default function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "from-green-500 to-emerald-600"
      : score >= 45
      ? "from-yellow-500 to-amber-600"
      : "from-red-500 to-rose-600";

  return (
    <span
      className={`text-[10px] font-bold text-white bg-gradient-to-r ${color} rounded-md px-1.5 py-0.5 inline-block shadow-sm`}
    >
      {score}
    </span>
  );
}
