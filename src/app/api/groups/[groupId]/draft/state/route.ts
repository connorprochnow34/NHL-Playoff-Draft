import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { parseDraftState } from "@/lib/draft/state-machine";

export async function GET(
  _request: Request,
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

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      commissioner: { select: { id: true, displayName: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { draftPosition: "asc" },
      },
      picks: {
        include: {
          team: true,
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { draftPosition: "asc" },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const teams = await prisma.nhlTeam.findMany({
    where: { isPlayoffTeam: true },
    orderBy: [{ conference: "asc" }, { seed: "asc" }],
  });

  return NextResponse.json({
    groupId: group.id,
    groupName: group.name,
    commissionerId: group.commissionerId,
    commissioner: group.commissioner,
    draftStatus: group.draftStatus,
    draftState: parseDraftState(group.draftState),
    version: group.draftStateVersion,
    pickTimerSeconds: group.pickTimerSeconds,
    members: group.members,
    picks: group.picks,
    teams,
    serverNow: new Date().toISOString(),
  });
}
