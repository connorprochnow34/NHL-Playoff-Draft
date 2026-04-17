import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Commissioner-only: set the pick timer duration (60/90/120s).
 * Only allowed in WAITING state — must be set before draft starts.
 */
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

  const { pick_duration_seconds } = await request.json();
  if (![60, 90, 120].includes(pick_duration_seconds)) {
    return NextResponse.json(
      { error: "pick_duration_seconds must be 60, 90, or 120" },
      { status: 400 }
    );
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (group.draftStatus !== "WAITING") {
    return NextResponse.json(
      { error: "Timer can only be configured before the draft starts" },
      { status: 400 }
    );
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { pickTimerSeconds: pick_duration_seconds },
  });

  return NextResponse.json({ success: true });
}
