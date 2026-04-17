import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  broadcastStateChanged,
  parseDraftState,
} from "@/lib/draft/state-machine";

/**
 * Commissioner-only: LIVE → PAUSED.
 * Records paused_at and the remaining ms (for display only).
 */
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

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (group.draftStatus !== "LIVE") {
    return NextResponse.json(
      { error: "Draft can only be paused when LIVE" },
      { status: 400 }
    );
  }
  const draftState = parseDraftState(group.draftState);
  if (!draftState) {
    return NextResponse.json({ error: "No draft state" }, { status: 400 });
  }

  const now = new Date();
  let remainingMs = 0;
  if (draftState.pick_started_at) {
    const elapsedMs = now.getTime() - new Date(draftState.pick_started_at).getTime();
    remainingMs = Math.max(0, draftState.pick_duration_seconds * 1000 - elapsedMs);
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      draftStatus: "PAUSED",
      draftState: {
        ...draftState,
        paused_at: now.toISOString(),
        paused_remaining_ms: remainingMs,
      } as unknown as Prisma.InputJsonValue,
      draftStateVersion: { increment: 1 },
    },
  });

  await broadcastStateChanged(groupId, updated.draftStateVersion, "pause");

  return NextResponse.json({ success: true });
}
