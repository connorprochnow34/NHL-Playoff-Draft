import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  advancePickInTransaction,
  broadcastStateChanged,
  parseDraftState,
} from "@/lib/draft/state-machine";

/**
 * Cron sweep — runs every minute as the safety net.
 *
 * Catches:
 *   - COUNTDOWN groups whose 5s elapsed but no client triggered transition-to-live
 *   - LIVE groups whose pick timer expired but no client triggered auto-pick
 *
 * In both cases, the primary path is the connected clients themselves.
 * This cron only fires when no clients are observing.
 *
 * 15s grace before auto-picking from cron, to avoid racing client triggers.
 */
export async function GET(request: Request) {
  // Vercel cron sends Authorization: Bearer ${CRON_SECRET}
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stuckCountdowns: string[] = [];
  const stuckLives: string[] = [];

  // 1. Sweep stuck COUNTDOWN groups
  const countdowns = await prisma.$queryRaw<
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
    WHERE draft_status = 'COUNTDOWN'
      AND (draft_state->>'countdown_started_at')::timestamptz + interval '10 seconds' <= NOW()
    RETURNING id, draft_state_version
  `);

  for (const row of countdowns) {
    stuckCountdowns.push(row.id);
    await broadcastStateChanged(row.id, row.draft_state_version, "transition");
  }

  // 2. Sweep stuck LIVE groups whose pick timer + 15s grace has elapsed
  const expired = await prisma.$queryRaw<
    Array<{ id: string }>
  >(Prisma.sql`
    SELECT id FROM groups
    WHERE draft_status = 'LIVE'
      AND (draft_state->>'pick_started_at')::timestamptz
          + ((draft_state->>'pick_duration_seconds')::int * interval '1 second')
          + interval '15 seconds' <= NOW()
  `);

  for (const row of expired) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const group = await tx.group.findUnique({ where: { id: row.id } });
        if (!group || group.draftStatus !== "LIVE") return null;
        const draftState = parseDraftState(group.draftState);
        if (!draftState || !draftState.current_user_id) return null;

        const pickedTeams = await tx.pick.findMany({
          where: { groupId: row.id },
          select: { teamId: true },
        });
        const candidates = await tx.nhlTeam.findMany({
          where: {
            isPlayoffTeam: true,
            id: { notIn: pickedTeams.map((p) => p.teamId) },
          },
          select: { id: true },
        });
        if (candidates.length === 0) return null;
        const random = candidates[Math.floor(Math.random() * candidates.length)];

        return advancePickInTransaction(tx, {
          groupId: row.id,
          userId: draftState.current_user_id,
          teamId: random.id,
          isAutoPick: true,
          draftState,
          currentVersion: group.draftStateVersion,
        });
      });

      if (result) {
        stuckLives.push(row.id);
        await broadcastStateChanged(
          row.id,
          result.newVersion,
          result.isComplete ? "complete" : "pick"
        );
      }
    } catch (e) {
      console.error(`Cron sweep failed for group ${row.id}:`, e);
    }
  }

  return NextResponse.json({
    sweptCountdowns: stuckCountdowns.length,
    sweptLives: stuckLives.length,
  });
}
