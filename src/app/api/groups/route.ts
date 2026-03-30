import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Group name is required" },
      { status: 400 }
    );
  }

  // Generate unique 6-character invite code
  const inviteCode = nanoid(6).toUpperCase();

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      commissionerId: user.id,
      inviteCode,
      members: {
        create: {
          userId: user.id,
        },
      },
    },
    include: {
      members: { include: { user: true } },
      commissioner: true,
    },
  });

  return NextResponse.json(group);
}
