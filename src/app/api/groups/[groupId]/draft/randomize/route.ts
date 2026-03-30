import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
    include: { members: { include: { user: true } } },
  });

  if (!group || group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    group.draftStatus !== "PENDING" &&
    group.draftStatus !== "SCHEDULED"
  ) {
    return NextResponse.json(
      { error: "Draft order can only be set before the draft starts" },
      { status: 400 }
    );
  }

  if (group.members.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 members" },
      { status: 400 }
    );
  }

  // Fisher-Yates shuffle
  const memberIds = group.members.map((m) => m.id);
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

  // Update group status
  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { draftStatus: "SCHEDULED" },
    include: {
      commissioner: true,
      members: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
    },
  });

  return NextResponse.json(updated);
}
