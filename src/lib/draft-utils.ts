import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildSnakeOrder, shuffle } from "@/lib/draft/snake-order";
import type { DraftStateJson } from "@/lib/draft/state-machine";

/**
 * Atomically lock a group:
 *   1. Validate exactly 16 playoff teams exist
 *   2. Validate >= 2 members
 *   3. Fisher-Yates shuffle members → assign draftPosition 1..N
 *   4. Compute snake order
 *   5. Set group: draftStatus='WAITING', draftState=<json>, increment version
 *
 * All steps in one transaction.
 */
export async function lockGroupAndComputeDraftState(
  groupId: string
): Promise<void> {
  // Validation outside transaction (read-only checks)
  const teamCount = await prisma.nhlTeam.count({
    where: { isPlayoffTeam: true },
  });
  if (teamCount !== 16) {
    throw new Error(
      `Expected 16 playoff teams, got ${teamCount}. Sync NHL data first.`
    );
  }

  await prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new Error("Group not found");
    if (group.members.length < 2) {
      throw new Error("Need at least 2 members to lock the group");
    }

    // Shuffle members → assign positions
    const shuffled = shuffle(group.members);
    await Promise.all(
      shuffled.map((m, i) =>
        tx.groupMember.update({
          where: { id: m.id },
          data: { draftPosition: i + 1 },
        })
      )
    );

    const memberIdsInDraftPosition = shuffled.map((m) => m.userId);
    const { snakeOrder, totalPicks, teamsPerMember } = buildSnakeOrder({
      memberIdsInDraftPosition,
    });

    const draftState: DraftStateJson = {
      current_pick_number: 1,
      current_user_id: snakeOrder[0],
      pick_started_at: null, // set when COUNTDOWN→LIVE happens
      pick_duration_seconds: group.pickTimerSeconds,
      snake_order: snakeOrder,
      teams_per_member: teamsPerMember,
      total_picks: totalPicks,
      countdown_started_at: null,
      paused_at: null,
      paused_remaining_ms: null,
    };

    await tx.group.update({
      where: { id: groupId },
      data: {
        draftStatus: "WAITING",
        draftState: draftState as unknown as Prisma.InputJsonValue,
        draftStateVersion: { increment: 1 },
      },
    });
  });
}

/**
 * Unlock a group: clear draft order, draft state, return to OPEN.
 */
export async function unlockGroup(groupId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.updateMany({
      where: { groupId },
      data: { draftPosition: null },
    });
    await tx.group.update({
      where: { id: groupId },
      data: {
        draftStatus: "OPEN",
        draftState: Prisma.JsonNull,
        draftStateVersion: { increment: 1 },
      },
    });
  });
}

// --- Legacy helpers retained for other call sites ---

export async function randomizeDraftOrder(groupId: string): Promise<void> {
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  if (members.length < 2) {
    throw new Error("Need at least 2 members to randomize draft order");
  }
  const shuffled = shuffle(members);
  await Promise.all(
    shuffled.map((m, i) =>
      prisma.groupMember.update({
        where: { id: m.id },
        data: { draftPosition: i + 1 },
      })
    )
  );
}

export async function clearDraftOrder(groupId: string): Promise<void> {
  await prisma.groupMember.updateMany({
    where: { groupId },
    data: { draftPosition: null },
  });
}
