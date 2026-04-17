import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  broadcastStateChanged,
  parseDraftState,
} from "@/lib/draft/state-machine";

/**
 * Commissioner-only: PAUSED → LIVE.
 * RESETS the timer to full duration (per spec) by setting pick_started_at = NOW.
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
  if (group.draftStatus !== "PAUSED") {
    return NextResponse.json(
      { error: "Draft can only be resumed when PAUSED" },
      { status: 400 }
    );
  }
  const draftState = parseDraftState(group.draftState);
  if (!draftState) {
    return NextResponse.json({ error: "No draft state" }, { status: 400 });
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      draftStatus: "LIVE",
      draftState: {
        ...draftState,
        pick_started_at: new Date().toISOString(),
        paused_at: null,
        paused_remaining_ms: null,
      } as unknown as Prisma.InputJsonValue,
      draftStateVersion: { increment: 1 },
    },
  });

  await broadcastStateChanged(groupId, updated.draftStateVersion, "resume");

  return NextResponse.json({ success: true });
}
