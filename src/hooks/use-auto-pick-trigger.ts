"use client";

import { useEffect, useRef } from "react";
import type { UseDraftStateResult } from "./use-draft-state";

/**
 * When the live timer reaches 0, fires an /auto-pick request to the server.
 *
 * Idempotent on the server side via the pick_number race guard. Multiple
 * clients can fire concurrently — only the first wins. Subsequent ones get
 * { picked: false } and noop.
 *
 * If the server doesn't advance the state within 5 seconds, polls /state
 * every 1s as the safety fallback. Guarantees the UI never sticks at 0:00.
 */
export function useAutoPickTrigger(draft: UseDraftStateResult) {
  const triggeredForPickNumber = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const { state, remainingMs, refetch } = draft;
    if (state.draftStatus !== "LIVE") {
      // Reset trigger flag when leaving LIVE
      triggeredForPickNumber.current = null;
      return;
    }
    const ds = state.draftState;
    if (!ds || ds.current_pick_number == null) return;

    // Check timer remaining
    const interval = setInterval(() => {
      const remaining = remainingMs();
      if (remaining === null) return;
      if (remaining > 0) return;
      if (triggeredForPickNumber.current === ds.current_pick_number) return;

      triggeredForPickNumber.current = ds.current_pick_number;

      // Fire auto-pick request
      fetch(`/api/groups/${state.groupId}/draft/auto-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick_number: ds.current_pick_number }),
      }).catch((e) => console.error("auto-pick request failed:", e));

      // Start safety fallback: if state hasn't advanced in 5s, poll every 1s
      pollTimeoutRef.current = setTimeout(() => {
        pollIntervalRef.current = setInterval(() => {
          refetch();
        }, 1000);
      }, 5000);
    }, 250);

    return () => {
      clearInterval(interval);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [draft]);

  // Stop polling once the pick number advances
  const currentPick = draft.state.draftState?.current_pick_number;
  useEffect(() => {
    if (currentPick !== triggeredForPickNumber.current) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [currentPick]);
}
