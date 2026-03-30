import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId, email, displayName } = await request.json();

    if (!userId || !email || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upsert user — handles both new signups and magic link logins
    await prisma.user.upsert({
      where: { id: userId },
      update: { email, displayName },
      create: {
        id: userId,
        email,
        displayName,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
