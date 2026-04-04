import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomizeDraftOrder, clearDraftOrder } from "@/lib/draft-utils";

// Join a group
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (group.draftStatus !== "OPEN") {
    return NextResponse.json(
      { error: "This group is not accepting new members" },
      { status: 400 }
    );
  }

  // Check capacity
  if (group.maxPlayers && group._count.members >= group.maxPlayers) {
    return NextResponse.json(
      { error: "This group is full" },
      { status: 400 }
    );
  }

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });

  if (existing) {
    return NextResponse.json({ message: "Already a member" });
  }

  const member = await prisma.groupMember.create({
    data: {
      groupId,
      userId: user.id,
    },
    include: { user: true },
  });

  // Auto-lock if at capacity
  const newCount = group._count.members + 1;
  let autoLocked = false;
  if (group.maxPlayers && newCount >= group.maxPlayers && newCount >= 2) {
    await randomizeDraftOrder(groupId);
    await prisma.group.update({
      where: { id: groupId },
      data: { draftStatus: "LOCKED" },
    });
    autoLocked = true;
  }

  return NextResponse.json({ ...member, autoLocked });
}

// Remove a member (commissioner only, pre-draft)
export async function DELETE(
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group || group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (group.draftStatus !== "OPEN" && group.draftStatus !== "LOCKED") {
    return NextResponse.json(
      { error: "Cannot remove members after draft starts" },
      { status: 400 }
    );
  }

  const { userId } = await request.json();

  if (userId === user.id) {
    return NextResponse.json(
      { error: "Commissioner cannot remove themselves" },
      { status: 400 }
    );
  }

  await prisma.groupMember.delete({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  // If group was locked, auto-unlock since draft order is now invalid
  if (group.draftStatus === "LOCKED") {
    await clearDraftOrder(groupId);
    await prisma.group.update({
      where: { id: groupId },
      data: { draftStatus: "OPEN" },
    });
  }

  return NextResponse.json({ success: true });
}
