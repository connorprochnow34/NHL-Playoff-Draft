"use client";

import { useEffect, useRef } from "react";
import type { UseDraftStateResult } from "./use-draft-state";

/**
 * When the live timer reaches 0, fires an /auto-pick request to the server.
 *
 * Contention reduction: only the CURRENT PICKER fires immediately at 0:00.
 * Other clients wait BACKUP_DELAY_MS before firing as a fallback in case
 * the picker is offline or their request never lands. This drops normal-case
 * traffic from N requests to 1 (per pick), which keeps the database calm
 * and the draft snappy.
 *
 * The server-side unique constraint on (group_id, draft_position) makes
 * concurrent requests safe regardless — but minimizing the number is faster.
 *
 * If the server doesn't advance the state within 5 seconds, polls /state
 * every 1s as the safety fallback. Guarantees the UI never sticks at 0:00.
 */
const BACKUP_DELAY_MS = 3000;

export function useAutoPickTrigger(
  draft: UseDraftStateResult,
  userId: string
) {
  const triggeredForPickNumber = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const { state, remainingMs, refetch } = draft;
    if (state.draftStatus !== "LIVE") {
      triggeredForPickNumber.current = null;
      return;
    }
    const ds = state.draftState;
    if (!ds || ds.current_pick_number == null) return;

    const isCurrentPicker = ds.current_user_id === userId;

    function fireAutoPick() {
      if (triggeredForPickNumber.current === ds!.current_pick_number) return;
      triggeredForPickNumber.current = ds!.current_pick_number;

      fetch(`/api/groups/${state.groupId}/draft/auto-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick_number: ds!.current_pick_number }),
      }).catch((e) => console.error("auto-pick request failed:", e));

      // Safety fallback: if state hasn't advanced in 5s, poll every 1s
      pollTimeoutRef.current = setTimeout(() => {
        pollIntervalRef.current = setInterval(() => {
          refetch();
        }, 1000);
      }, 5000);
    }

    const interval = setInterval(() => {
      const remaining = remainingMs();
      if (remaining === null) return;
      if (remaining > 0) return;
      if (triggeredForPickNumber.current === ds.current_pick_number) return;

      if (isCurrentPicker) {
        // Picker fires immediately
        fireAutoPick();
      } else if (!backupTimeoutRef.current) {
        // Other clients wait — schedule backup fire
        backupTimeoutRef.current = setTimeout(() => {
          backupTimeoutRef.current = null;
          // Re-check that we still need to fire (state might have advanced)
          if (
            draft.state.draftState?.current_pick_number ===
            ds.current_pick_number
          ) {
            fireAutoPick();
          }
        }, BACKUP_DELAY_MS);
      }
    }, 250);

    return () => {
      clearInterval(interval);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (backupTimeoutRef.current) clearTimeout(backupTimeoutRef.current);
      backupTimeoutRef.current = null;
    };
  }, [draft, userId]);

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
      if (backupTimeoutRef.current) {
        clearTimeout(backupTimeoutRef.current);
        backupTimeoutRef.current = null;
      }
    }
  }, [currentPick]);
}
