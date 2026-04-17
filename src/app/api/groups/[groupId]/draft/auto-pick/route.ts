import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  advancePickInTransaction,
  broadcastStateChanged,
  parseDraftState,
} from "@/lib/draft/state-machine";

/**
 * Auto-pick endpoint — fires when the current pick's timer expires.
 *
 * Idempotent + race-safe: the atomic guard on `current_pick_number` ensures
 * only the first request for a given pick wins. Subsequent concurrent requests
 * (from other clients also detecting expiry, or the cron sweep) get
 * { picked: false } and noop.
 *
 * Selects a random unpicked playoff team (NOT highest seed).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const body = await request.json().catch(() => ({}));
  const expectedPickNumber: number | undefined = body.pick_number;

  if (!expectedPickNumber || !Number.isInteger(expectedPickNumber)) {
    return NextResponse.json(
      { error: "pick_number (integer) required in body" },
      { status: 400 }
    );
  }

  let result: {
    picked: boolean;
    isComplete?: boolean;
    nextVersion?: number;
    teamId?: string;
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
      });
      if (!group || group.draftStatus !== "LIVE") {
        return { picked: false };
      }
      const draftState = parseDraftState(group.draftState);
      if (!draftState) return { picked: false };

      // Race guard: only act if this is still the same pick number
      if (draftState.current_pick_number !== expectedPickNumber) {
        return { picked: false };
      }

      // Confirm timer truly expired (server time)
      if (!draftState.pick_started_at) return { picked: false };
      const elapsedMs =
        Date.now() - new Date(draftState.pick_started_at).getTime();
      if (elapsedMs < draftState.pick_duration_seconds * 1000) {
        return { picked: false };
      }

      const currentUserId = draftState.current_user_id;
      if (!currentUserId) return { picked: false };

      // Get all picked team IDs in this group
      const pickedTeams = await tx.pick.findMany({
        where: { groupId },
        select: { teamId: true },
      });
      const pickedSet = new Set(pickedTeams.map((p) => p.teamId));

      // Select random unpicked playoff team
      const candidates = await tx.nhlTeam.findMany({
        where: {
          isPlayoffTeam: true,
          id: { notIn: Array.from(pickedSet) },
        },
        select: { id: true },
      });
      if (candidates.length === 0) return { picked: false };

      const random = candidates[Math.floor(Math.random() * candidates.length)];

      const { isComplete, newVersion } = await advancePickInTransaction(tx, {
        groupId,
        userId: currentUserId,
        teamId: random.id,
        isAutoPick: true,
        draftState,
        currentVersion: group.draftStateVersion,
      });

      return {
        picked: true,
        isComplete,
        nextVersion: newVersion,
        teamId: random.id,
      };
    });
  } catch (e) {
    console.error("auto-pick failed:", e);
    return NextResponse.json({ error: "auto-pick failed" }, { status: 500 });
  }

  if (result.picked && result.nextVersion !== undefined) {
    await broadcastStateChanged(
      groupId,
      result.nextVersion,
      result.isComplete ? "complete" : "pick"
    );
  }

  return NextResponse.json(result);
}
