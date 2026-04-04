import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomizeDraftOrder } from "@/lib/draft-utils";

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

  if (group.draftStatus !== "OPEN" && group.draftStatus !== "LOCKED") {
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

  await randomizeDraftOrder(groupId);

  // Update group status to LOCKED
  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { draftStatus: "LOCKED" },
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
