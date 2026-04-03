import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateChirpForGroup } from "@/lib/chirp/generate";

export async function POST(request: Request) {
  // Auth: either cron secret or logged-in commissioner
  const cronSecret = request.headers.get("authorization");

  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) {
    // Cron job — generate for all completed groups that haven't had a chirp today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groups = await prisma.group.findMany({
      where: { draftStatus: "COMPLETED" },
      include: {
        chirps: {
          where: { generatedAt: { gte: today } },
          take: 1,
        },
      },
    });

    const groupsNeedingChirp = groups.filter((g) => g.chirps.length === 0);

    for (const group of groupsNeedingChirp) {
      await generateChirpForGroup(group.id);
    }

    return NextResponse.json({
      message: `Generated chirps for ${groupsNeedingChirp.length} groups`,
    });
  }

  // Manual trigger — commissioner only, for a specific group
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await request.json();

  if (!groupId) {
    return NextResponse.json(
      { error: "groupId required" },
      { status: 400 }
    );
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group || group.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if chirp already exists today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingChirp = await prisma.chirp.findFirst({
    where: {
      groupId,
      generatedAt: { gte: today },
    },
  });

  if (existingChirp) {
    return NextResponse.json({
      message: "Chirp already generated today",
      chirp: existingChirp,
    });
  }

  await generateChirpForGroup(groupId);

  const newChirp = await prisma.chirp.findFirst({
    where: { groupId },
    orderBy: { generatedAt: "desc" },
  });

  return NextResponse.json({ chirp: newChirp });
}
