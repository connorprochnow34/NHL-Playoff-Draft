import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPickInfo,
  getTotalPicks,
  validatePick,
  getAutoPickTeamId,
} from "@/lib/draft/snake";

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

  const { teamId, isAutoPick } = await request.json();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
      picks: true,
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (group.draftStatus !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Draft is not in progress" },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = group.members.find((m) => m.userId === user.id);
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const currentPickNumber = group.picks.length + 1;
  const totalMembers = group.members.length;

  // Build lookup maps
  const membersByPosition = new Map(
    group.members
      .filter((m) => m.draftPosition)
      .map((m) => [m.draftPosition!, m.userId])
  );
  const pickedTeamIds = new Set(group.picks.map((p) => p.teamId));

  // Determine team to pick
  let finalTeamId = teamId;

  if (isAutoPick) {
    // Auto-pick: get available teams and pick highest seed
    const availableTeams = await prisma.nhlTeam.findMany({
      where: {
        isPlayoffTeam: true,
        id: { notIn: Array.from(pickedTeamIds) },
      },
      select: { id: true, seed: true },
    });

    finalTeamId = getAutoPickTeamId(availableTeams);
    if (!finalTeamId) {
      return NextResponse.json(
        { error: "No teams available" },
        { status: 400 }
      );
    }
  }

  // Validate pick
  const validation = validatePick({
    currentPickNumber,
    totalMembers,
    userId: user.id,
    membersByPosition,
    pickedTeamIds,
    teamId: finalTeamId,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const { round } = getPickInfo(totalMembers, currentPickNumber);

  // Record the pick
  const pick = await prisma.pick.create({
    data: {
      groupId,
      userId: user.id,
      teamId: finalTeamId,
      draftRound: round,
      draftPosition: currentPickNumber,
    },
    include: { team: true, user: true },
  });

  // Check if draft is complete
  const totalPicks = getTotalPicks(totalMembers);
  const newPickNumber = currentPickNumber + 1;
  const isDraftComplete = newPickNumber > totalPicks;

  if (isDraftComplete) {
    await prisma.group.update({
      where: { id: groupId },
      data: { draftStatus: "COMPLETED" },
    });
  }

  // Determine next picker
  let nextUserId: string | null = null;
  if (!isDraftComplete) {
    const { draftPosition: nextPosition } = getPickInfo(
      totalMembers,
      newPickNumber
    );
    nextUserId = membersByPosition.get(nextPosition) || null;
  }

  // Broadcast via Supabase realtime
  const adminClient = createAdminClient();
  const channel = adminClient.channel(`draft:${groupId}`);

  if (isDraftComplete) {
    await channel.send({
      type: "broadcast",
      event: "draft_completed",
      payload: {
        lastPick: {
          userId: pick.userId,
          userName: pick.user.displayName,
          teamId: pick.teamId,
          teamName: pick.team.name,
          teamAbbrev: pick.team.abbreviation,
          teamLogo: pick.team.logoUrl,
          pickNumber: currentPickNumber,
          round,
        },
      },
    });
  } else {
    await channel.send({
      type: "broadcast",
      event: "pick_made",
      payload: {
        userId: pick.userId,
        userName: pick.user.displayName,
        teamId: pick.teamId,
        teamName: pick.team.name,
        teamAbbrev: pick.team.abbreviation,
        teamLogo: pick.team.logoUrl,
        pickNumber: currentPickNumber,
        round,
        nextUserId,
        nextPickNumber: newPickNumber,
        isAutoPick: !!isAutoPick,
      },
    });
  }

  return NextResponse.json({
    pick,
    isDraftComplete,
    nextUserId,
    nextPickNumber: isDraftComplete ? null : newPickNumber,
  });
}
