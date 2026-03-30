import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DraftRoom } from "@/components/draft/draft-room";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });

  if (!membership) notFound();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
      picks: {
        include: { team: true, user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!group) notFound();

  // Get all playoff teams
  const teams = await prisma.nhlTeam.findMany({
    where: { isPlayoffTeam: true },
    orderBy: [{ conference: "asc" }, { seed: "asc" }],
  });

  return (
    <DraftRoom
      groupId={groupId}
      userId={user.id}
      initialPicks={group.picks}
      members={group.members}
      teams={teams}
      pickTimerSeconds={group.pickTimerSeconds}
      draftStatus={group.draftStatus}
    />
  );
}
