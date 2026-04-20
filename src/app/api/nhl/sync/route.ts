import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncNhlData } from "@/lib/nhl/sync";

async function runSync() {
  const result = await syncNhlData();
  return NextResponse.json({
    message: `Synced ${result.teamsUpserted} teams, ${result.seriesUpserted} series. ${result.seriesCompleted.length} series completed.`,
    result,
  });
}

/**
 * GET handler for Vercel cron — Vercel cron jobs send GET requests with
 * Bearer CRON_SECRET. Same logic as POST, just different verb.
 */
export async function GET(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    console.error("NHL sync error (cron):", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    return await runSync();
  } catch (error) {
    console.error("NHL sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
