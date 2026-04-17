/**
 * Server-side helpers for the draft state machine.
 * All state transitions are atomic SQL operations guarded by current state.
 */

import { Prisma } from "@prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";

export type DraftStateKind =
  | "start"
  | "transition"
  | "pick"
  | "pause"
  | "resume"
  | "complete";

export interface DraftStateJson {
  current_pick_number: number;
  current_user_id: string | null;
  pick_started_at: string | null;
  pick_duration_seconds: number;
  snake_order: string[];
  teams_per_member: number;
  total_picks: number;
  countdown_started_at: string | null;
  paused_at: string | null;
  paused_remaining_ms: number | null;
}

/**
 * Send a real-time broadcast notifying clients that draft state has changed.
 * Clients react by refetching /api/groups/[id]/draft/state.
 *
 * IMPORTANT: Supabase requires the channel to be subscribed before send()
 * will deliver. We subscribe, wait for SUBSCRIBED status, send, then tear down.
 * Bounded by a 2s timeout so a slow connection never blocks the API request.
 */
export async function broadcastStateChanged(
  groupId: string,
  version: number,
  kind: DraftStateKind
): Promise<void> {
  const admin = createAdminClient();
  const channel = admin.channel(`draft:${groupId}`, {
    config: { broadcast: { ack: false, self: false } },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("broadcast subscribe timeout")),
        2000
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`broadcast subscribe failed: ${status}`));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event: "state_changed",
      payload: { version, kind },
    });
  } catch (error) {
    // Log but never throw — clients will catch up via polling fallback.
    console.error("broadcastStateChanged failed:", error);
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch {
      // Cleanup errors are not actionable
    }
  }
}

/**
 * Transactional helper: record a pick and advance the draft state.
 * Used by both manual pick endpoint and auto-pick endpoint.
 *
 * Caller must validate (in same transaction) that:
 *   - draft is LIVE
 *   - pick number matches draft_state.current_pick_number
 *   - team is unpicked
 *   - (for manual) user matches current_user_id
 *   - (for manual) timer hasn't expired
 *
 * Returns the new state info.
 */
export async function advancePickInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    groupId: string;
    userId: string;
    teamId: string;
    isAutoPick: boolean;
    draftState: DraftStateJson;
    currentVersion: number;
  }
): Promise<{
  isComplete: boolean;
  nextState: DraftStateJson;
  newVersion: number;
}> {
  const { groupId, userId, teamId, isAutoPick, draftState, currentVersion } =
    params;

  const pickNumber = draftState.current_pick_number;
  const round = Math.ceil(pickNumber / (draftState.snake_order.length / draftState.teams_per_member));

  // Insert the pick
  await tx.pick.create({
    data: {
      groupId,
      userId,
      teamId,
      draftRound: round,
      draftPosition: pickNumber,
      isAutoPick,
    },
  });

  const nextPickNumber = pickNumber + 1;
  const isComplete = nextPickNumber > draftState.total_picks;

  let nextState: DraftStateJson;
  let newStatus: "LIVE" | "COMPLETED";

  if (isComplete) {
    nextState = {
      ...draftState,
      current_pick_number: nextPickNumber,
      current_user_id: null,
      pick_started_at: null,
      paused_at: null,
      paused_remaining_ms: null,
    };
    newStatus = "COMPLETED";
  } else {
    nextState = {
      ...draftState,
      current_pick_number: nextPickNumber,
      current_user_id: draftState.snake_order[nextPickNumber - 1],
      pick_started_at: new Date().toISOString(),
      paused_at: null,
      paused_remaining_ms: null,
    };
    newStatus = "LIVE";
  }

  const newVersion = currentVersion + 1;

  await tx.group.update({
    where: { id: groupId },
    data: {
      draftStatus: newStatus,
      draftState: nextState as unknown as Prisma.InputJsonValue,
      draftStateVersion: newVersion,
    },
  });

  return { isComplete, nextState, newVersion };
}

/**
 * Cast Prisma's Json field to our DraftStateJson type.
 * Returns null if the field is null or not a valid object.
 */
export function parseDraftState(raw: unknown): DraftStateJson | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as DraftStateJson;
}

/**
 * Compute remaining milliseconds for the current pick timer based on server time.
 * Returns 0 if expired, null if no active pick.
 */
export function computeRemainingMs(
  draftState: DraftStateJson,
  serverNow: Date = new Date()
): number | null {
  if (!draftState.pick_started_at) return null;
  if (draftState.paused_at) return draftState.paused_remaining_ms ?? 0;
  const startMs = new Date(draftState.pick_started_at).getTime();
  const durationMs = draftState.pick_duration_seconds * 1000;
  const elapsed = serverNow.getTime() - startMs;
  return Math.max(0, durationMs - elapsed);
}
