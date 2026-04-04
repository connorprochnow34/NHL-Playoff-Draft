import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
    },
  });

  if (!group || group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (group.draftStatus !== "LOCKED") {
    return NextResponse.json(
      { error: "Group must be locked before starting the draft" },
      { status: 400 }
    );
  }

  // Check all members have draft positions
  const allHavePositions = group.members.every((m) => m.draftPosition);
  if (!allHavePositions) {
    return NextResponse.json(
      { error: "Not all members have draft positions" },
      { status: 400 }
    );
  }

  // Check we have playoff teams
  const teamCount = await prisma.nhlTeam.count({
    where: { isPlayoffTeam: true },
  });

  if (teamCount < 16) {
    return NextResponse.json(
      {
        error: `Only ${teamCount} playoff teams found. Sync NHL data first.`,
      },
      { status: 400 }
    );
  }

  // Start the draft
  await prisma.group.update({
    where: { id: groupId },
    data: { draftStatus: "IN_PROGRESS" },
  });

  // Broadcast draft start via Supabase realtime
  const adminClient = createAdminClient();
  const channel = adminClient.channel(`draft:${groupId}`);
  await channel.send({
    type: "broadcast",
    event: "draft_started",
    payload: {
      firstUserId: group.members.find((m) => m.draftPosition === 1)?.userId,
      pickTimerSeconds: group.pickTimerSeconds,
    },
  });

  return NextResponse.json({ success: true });
}
