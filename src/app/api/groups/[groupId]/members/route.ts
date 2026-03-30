import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (group.draftStatus === "COMPLETED") {
    return NextResponse.json(
      { error: "Draft is completed. Membership is locked." },
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

  return NextResponse.json(member);
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

  if (group.draftStatus !== "PENDING" && group.draftStatus !== "SCHEDULED") {
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

  return NextResponse.json({ success: true });
}
