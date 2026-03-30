import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { displayName, avatarUrl } = await request.json();

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json(
      { error: "Display name is required" },
      { status: 400 }
    );
  }

  const profile = await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      avatarUrl,
    },
  });

  return NextResponse.json(profile);
}
