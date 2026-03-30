import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncNhlData } from "@/lib/nhl/sync";

export async function POST(request: Request) {
  // Check auth: either a logged-in user or the cron secret
  const cronSecret = request.headers.get("authorization");

  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) {
    // Cron job — proceed
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncNhlData();
    return NextResponse.json({
      message: `Synced ${result.teamsUpserted} teams, ${result.seriesUpserted} series. ${result.seriesCompleted.length} series completed.`,
      result,
    });
  } catch (error) {
    console.error("NHL sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
