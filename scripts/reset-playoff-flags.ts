/**
 * Non-destructive playoff team flag reset.
 *
 * Resets all NhlTeam.isPlayoffTeam flags to false, then runs syncNhlData()
 * which sets exactly the 16 current bracket teams back to true. Picks/series/
 * points are not touched — all foreign keys remain intact.
 */
import { PrismaClient } from "@prisma/client";
import { syncNhlData } from "../src/lib/nhl/sync";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing isPlayoffTeam=true on all teams...");
  const cleared = await prisma.nhlTeam.updateMany({
    data: { isPlayoffTeam: false },
  });
  console.log(`  Cleared ${cleared.count} team flags`);

  console.log("\nRunning NHL sync...");
  const result = await syncNhlData();
  console.log(
    `  Synced ${result.teamsUpserted} teams, ${result.seriesUpserted} series`
  );
  if (result.errors.length > 0) {
    console.error("  Errors:", result.errors);
  }

  const teams = await prisma.nhlTeam.findMany({
    where: { isPlayoffTeam: true },
    orderBy: [{ conference: "asc" }, { seed: "asc" }],
    select: { abbreviation: true, name: true, conference: true, seed: true },
  });

  console.log(`\nPlayoff teams (${teams.length}):`);
  console.table(teams);

  if (teams.length !== 16) {
    console.error(`\n❌ Expected 16 playoff teams, got ${teams.length}`);
    process.exit(1);
  }
  console.log("\n✅ Validation passed: exactly 16 playoff teams");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
