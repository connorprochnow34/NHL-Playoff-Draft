import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  broadcastStateChanged,
  parseDraftState,
} from "@/lib/draft/state-machine";

/**
 * Idempotent transition COUNTDOWN → LIVE after the 5-second countdown.
 *
 * Any client whose UI observes that 5s has elapsed can call this. Atomic
 * guard: only the first request wins; subsequent requests find status=LIVE
 * and return success without modification.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  // Atomic update: only succeeds if status is COUNTDOWN AND 5s has elapsed
  const updated = await prisma.$queryRaw<
    Array<{ id: string; draft_state_version: number }>
  >(Prisma.sql`
    UPDATE groups
    SET
      draft_status = 'LIVE',
      draft_state = jsonb_set(
        jsonb_set(
          draft_state,
          '{pick_started_at}',
          to_jsonb(NOW())
        ),
        '{current_user_id}',
        draft_state->'snake_order'->0
      ),
      draft_state_version = draft_state_version + 1
    WHERE id = ${groupId}::uuid
      AND draft_status = 'COUNTDOWN'
      AND (draft_state->>'countdown_started_at')::timestamptz + interval '5 seconds' <= NOW()
    RETURNING id, draft_state_version
  `);

  if (updated.length > 0) {
    await broadcastStateChanged(
      groupId,
      updated[0].draft_state_version,
      "transition"
    );
    return NextResponse.json({ transitioned: true });
  }

  // Already transitioned, or countdown not yet elapsed — both are fine
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { draftStatus: true, draftState: true },
  });
  const draftState = parseDraftState(group?.draftState);
  return NextResponse.json({
    transitioned: false,
    currentStatus: group?.draftStatus,
    countdownStartedAt: draftState?.countdown_started_at,
  });
}
