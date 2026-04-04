import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomizeDraftOrder, clearDraftOrder } from "@/lib/draft-utils";

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

  // Handle lock/unlock actions
  if (body.action === "lock") {
    if (group.draftStatus !== "OPEN") {
      return NextResponse.json(
        { error: "Group can only be locked when open" },
        { status: 400 }
      );
    }
    const members = await prisma.groupMember.findMany({
      where: { groupId },
    });
    if (members.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 members to lock" },
        { status: 400 }
      );
    }
    await randomizeDraftOrder(groupId);
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

  if (body.action === "unlock") {
    if (group.draftStatus !== "LOCKED") {
      return NextResponse.json(
        { error: "Group can only be unlocked when locked" },
        { status: 400 }
      );
    }
    await clearDraftOrder(groupId);
    const updated = await prisma.group.update({
      where: { id: groupId },
      data: { draftStatus: "OPEN" },
      include: {
        commissioner: true,
        members: { include: { user: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // Regular field updates
  const updates: Record<string, unknown> = {};

  if (body.name) updates.name = body.name;
  if (body.draftScheduledAt !== undefined) {
    updates.draftScheduledAt = body.draftScheduledAt
      ? new Date(body.draftScheduledAt)
      : null;
  }
  if (body.draftNotes !== undefined) updates.draftNotes = body.draftNotes;
  if (body.pickTimerSeconds)
    updates.pickTimerSeconds = Math.min(120, Math.max(30, body.pickTimerSeconds));
  if (body.chirpTone !== undefined)
    updates.chirpTone = Math.min(5, Math.max(1, body.chirpTone));
  if (body.maxPlayers !== undefined) {
    if (body.maxPlayers !== null) {
      const mp = Number(body.maxPlayers);
      if (!Number.isInteger(mp) || mp < 2) {
        return NextResponse.json(
          { error: "Max players must be at least 2" },
          { status: 400 }
        );
      }
      const memberCount = await prisma.groupMember.count({
        where: { groupId },
      });
      if (mp < memberCount) {
        return NextResponse.json(
          { error: `Cannot set max below current member count (${memberCount})` },
          { status: 400 }
        );
      }
      updates.maxPlayers = mp;
    } else {
      updates.maxPlayers = null;
    }
  }

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
