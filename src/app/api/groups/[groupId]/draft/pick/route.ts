import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  advancePickInTransaction,
  broadcastStateChanged,
  parseDraftState,
} from "@/lib/draft/state-machine";

/**
 * Manual pick by current picker.
 *
 * Validates:
 *   - draft_status = LIVE (not paused, countdown, or completed)
 *   - requesting user matches draft_state.current_user_id
 *   - team is in the playoff set and not already picked
 *   - timer hasn't expired (NOW < pick_started_at + duration)
 *
 * On success: inserts pick (is_auto_pick=false), advances state, broadcasts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await request.json();
  if (!teamId || typeof teamId !== "string") {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }

  let resultPayload: {
    isComplete: boolean;
    nextVersion: number;
  };

  try {
    resultPayload = await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
      });
      if (!group) throw new Error("NOT_FOUND");
      if (group.draftStatus !== "LIVE") {
        throw new Error(`STATUS:${group.draftStatus}`);
      }

      const draftState = parseDraftState(group.draftState);
      if (!draftState) throw new Error("NO_STATE");

      // Verify it's this user's turn
      if (draftState.current_user_id !== user.id) {
        throw new Error("NOT_YOUR_TURN");
      }

      // Verify timer hasn't expired (server time)
      if (draftState.pick_started_at) {
        const elapsedMs =
          Date.now() - new Date(draftState.pick_started_at).getTime();
        if (elapsedMs >= draftState.pick_duration_seconds * 1000) {
          throw new Error("TIMER_EXPIRED");
        }
      }

      // Verify team exists and is a playoff team
      const team = await tx.nhlTeam.findUnique({ where: { id: teamId } });
      if (!team || !team.isPlayoffTeam) {
        throw new Error("INVALID_TEAM");
      }

      // Verify team not already picked
      const existing = await tx.pick.findUnique({
        where: { groupId_teamId: { groupId, teamId } },
      });
      if (existing) {
        throw new Error("TEAM_ALREADY_PICKED");
      }

      const { isComplete, newVersion } = await advancePickInTransaction(tx, {
        groupId,
        userId: user.id,
        teamId,
        isAutoPick: false,
        draftState,
        currentVersion: group.draftStateVersion,
      });

      return { isComplete, nextVersion: newVersion };
    });
  } catch (e) {
    // P2002 = unique constraint violation. Means another concurrent request
    // (likely auto-pick) already won this pick_number. Tell client to refresh.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "PICK_RACE_LOST" }, { status: 409 });
    }
    const code = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  await broadcastStateChanged(
    groupId,
    resultPayload.nextVersion,
    resultPayload.isComplete ? "complete" : "pick"
  );

  return NextResponse.json({
    success: true,
    isComplete: resultPayload.isComplete,
  });
}
