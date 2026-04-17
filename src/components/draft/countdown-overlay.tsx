"use client";

import { useEffect, useState } from "react";
import type { UseDraftStateResult } from "@/hooks/use-draft-state";

const COUNTDOWN_SECONDS = 5;

export function CountdownOverlay({ draft }: { draft: UseDraftStateResult }) {
  const ds = draft.state.draftState;
  const [secondsLeft, setSecondsLeft] = useState<number>(COUNTDOWN_SECONDS);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!ds?.countdown_started_at) return;
    const startMs = new Date(ds.countdown_started_at).getTime();

    const tick = () => {
      const elapsedMs = Date.now() - startMs;
      const remaining = Math.max(
        0,
        Math.ceil((COUNTDOWN_SECONDS * 1000 - elapsedMs) / 1000)
      );
      setSecondsLeft(remaining);

      if (remaining === 0 && !transitioning) {
        setTransitioning(true);
        // Fire transition request — server validates 5s elapsed and is idempotent
        fetch(
          `/api/groups/${draft.state.groupId}/draft/transition-to-live`,
          { method: "POST" }
        ).catch((e) => console.error("transition failed:", e));
      }
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [ds?.countdown_started_at, draft.state.groupId, transitioning]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center space-y-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Draft starts in
        </p>
        <div className="text-9xl font-bold text-primary tabular-nums">
          {secondsLeft}
        </div>
        <p className="text-muted-foreground">Get ready…</p>
      </div>
    </div>
  );
}
