"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Function returning current remaining ms based on server time + clock skew */
  getRemainingMs: () => number | null;
  /** When true, freeze the displayed value (for paused state) */
  frozen?: boolean;
  /** When provided, displays a specific frozen value (used for PAUSED) */
  frozenValueMs?: number;
}

/**
 * Pure render component. Computes remaining time on every animation frame
 * (via setInterval at 100ms which is plenty for second-precision display).
 * Owns no authoritative state — just reflects the server's pick_started_at.
 */
export function ServerTimer({ getRemainingMs, frozen, frozenValueMs }: Props) {
  const [displayMs, setDisplayMs] = useState<number | null>(null);

  useEffect(() => {
    if (frozen) {
      setDisplayMs(frozenValueMs ?? 0);
      return;
    }
    const tick = () => setDisplayMs(getRemainingMs());
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [getRemainingMs, frozen, frozenValueMs]);

  if (displayMs === null) {
    return <span className="text-3xl font-mono font-bold">--:--</span>;
  }

  const totalSeconds = Math.ceil(displayMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isLow = totalSeconds <= 10 && totalSeconds > 0;
  const isExpired = totalSeconds === 0;

  return (
    <span
      className={`text-3xl font-mono font-bold tabular-nums ${
        isExpired
          ? "text-destructive"
          : isLow
            ? "text-destructive animate-pulse"
            : "text-foreground"
      }`}
    >
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
