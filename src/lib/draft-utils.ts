import { prisma } from "@/lib/prisma";

export async function randomizeDraftOrder(groupId: string): Promise<void> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
  });

  if (members.length < 2) {
    throw new Error("Need at least 2 members to randomize draft order");
  }

  // Fisher-Yates shuffle
  const memberIds = members.map((m) => m.id);
  for (let i = memberIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [memberIds[i], memberIds[j]] = [memberIds[j], memberIds[i]];
  }

  // Assign positions
  await Promise.all(
    memberIds.map((memberId, index) =>
      prisma.groupMember.update({
        where: { id: memberId },
        data: { draftPosition: index + 1 },
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
