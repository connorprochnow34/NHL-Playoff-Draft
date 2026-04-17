"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  DraftStatus,
  GroupMember,
  NhlTeam,
  Pick as PickModel,
} from "@/types";
import type { DraftStateJson } from "@/lib/draft/state-machine";

export interface DraftStateResponse {
  groupId: string;
  groupName: string;
  commissionerId: string;
  commissioner: { id: string; displayName: string; avatarUrl: string | null };
  draftStatus: DraftStatus;
  draftState: DraftStateJson | null;
  version: number;
  pickTimerSeconds: number;
  members: (GroupMember & { user: { id: string; displayName: string; avatarUrl: string | null } })[];
  picks: (PickModel & {
    team: NhlTeam;
    user: { id: string; displayName: string; avatarUrl: string | null };
  })[];
  teams: NhlTeam[];
  serverNow: string;
}

export interface UseDraftStateResult {
  state: DraftStateResponse;
  loading: boolean;
  error: string | null;
  isMyTurn: boolean;
  remainingMs: () => number | null;
  refetch: () => Promise<void>;
}

/**
 * Subscribes to the `draft:{groupId}` broadcast channel for state-change
 * notifications. On each notification with a newer version, refetches the
 * full draft state from /api/groups/{groupId}/draft/state.
 *
 * Also refetches on tab visibility change (returning to the tab).
 *
 * Tracks server clock skew so the timer is accurate regardless of client
 * clock drift.
 */
export function useDraftState(
  groupId: string,
  userId: string,
  initialState: DraftStateResponse
): UseDraftStateResult {
  const [state, setState] = useState<DraftStateResponse>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clockSkewMs = useRef(0); // serverNow - clientNow at last fetch
  const versionRef = useRef(initialState.version);

  // Initialize clock skew from initial fetch
  useEffect(() => {
    if (initialState.serverNow) {
      clockSkewMs.current =
        new Date(initialState.serverNow).getTime() - Date.now();
    }
  }, [initialState.serverNow]);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/groups/${groupId}/draft/state`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const next: DraftStateResponse = await res.json();
      // Update clock skew
      clockSkewMs.current = new Date(next.serverNow).getTime() - Date.now();
      versionRef.current = next.version;
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch state");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`draft:${groupId}`);

    channel
      .on("broadcast", { event: "state_changed" }, ({ payload }) => {
        const newVersion: number =
          typeof payload?.version === "number" ? payload.version : 0;
        if (newVersion > versionRef.current) {
          refetch();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, refetch]);

  // Refetch on tab visibility change
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refetch]);

  const isMyTurn =
    state.draftStatus === "LIVE" &&
    state.draftState?.current_user_id === userId;

  const remainingMs = useCallback((): number | null => {
    const ds = state.draftState;
    if (!ds) return null;
    if (state.draftStatus === "PAUSED") return ds.paused_remaining_ms ?? 0;
    if (!ds.pick_started_at) return null;
    const startMs = new Date(ds.pick_started_at).getTime();
    const adjustedNow = Date.now() + clockSkewMs.current;
    return Math.max(0, ds.pick_duration_seconds * 1000 - (adjustedNow - startMs));
  }, [state]);

  return { state, loading, error, isMyTurn, remainingMs, refetch };
}
