"use client";

export function DraftTime({ iso }: { iso: string }) {
  const formatted = new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return <span className="font-medium">{formatted}</span>;
}
