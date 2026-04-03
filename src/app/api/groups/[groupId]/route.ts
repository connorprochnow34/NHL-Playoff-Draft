import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

  // Check membership
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      commissioner: true,
      members: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
      picks: {
        include: { team: true, user: true },
        orderBy: { createdAt: "asc" },
      },
      points: {
        include: { user: true, team: true, series: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(group);
}

export async function PATCH(
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

  // Only commissioner can update
  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group || group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name) updates.name = body.name;
  if (body.draftScheduledAt !== undefined)
    updates.draftScheduledAt = body.draftScheduledAt
      ? new Date(body.draftScheduledAt)
      : null;
  if (body.draftNotes !== undefined) updates.draftNotes = body.draftNotes;
  if (body.pickTimerSeconds)
    updates.pickTimerSeconds = Math.min(120, Math.max(30, body.pickTimerSeconds));
  if (body.chirpTone !== undefined)
    updates.chirpTone = Math.min(5, Math.max(1, body.chirpTone));

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: updates,
    include: {
      commissioner: true,
      members: { include: { user: true } },
    },
  });

  return NextResponse.json(updated);
}
