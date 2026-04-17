import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding nhl_games table...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "nhl_games" (
      "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "nhl_game_id"    INTEGER NOT NULL UNIQUE,
      "series_letter"  TEXT,
      "home_team_id"   UUID NOT NULL REFERENCES "nhl_teams"("id"),
      "away_team_id"   UUID NOT NULL REFERENCES "nhl_teams"("id"),
      "home_score"     INTEGER,
      "away_score"     INTEGER,
      "start_time"     TIMESTAMP NOT NULL,
      "game_state"     TEXT NOT NULL,
      "game_type"      INTEGER NOT NULL,
      "synced_at"      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ Created nhl_games table");

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "nhl_games_start_time_idx" ON "nhl_games" ("start_time")`
  );
  console.log("  ✓ Created start_time index");

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "nhl_games_game_state_idx" ON "nhl_games" ("game_state")`
  );
  console.log("  ✓ Created game_state index");

  console.log("\n✅ Games migration applied successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
