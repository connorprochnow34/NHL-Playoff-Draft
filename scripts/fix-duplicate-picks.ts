/**
 * Cleans up duplicate picks at the same (group_id, draft_position) caused by
 * the auto-pick race condition, then adds the unique constraint that prevents
 * the bug going forward.
 *
 * Strategy: keep the EARLIEST pick at each (group_id, draft_position) and
 * delete the rest. Earliest pick is the one that "would have won" if the race
 * had been adjudicated correctly.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Step 1: Find duplicate picks...");

  const dupes = await prisma.$queryRaw<
    Array<{ group_id: string; draft_position: number; ids: string[]; created_ats: Date[] }>
  >`
    SELECT
      group_id,
      draft_position,
      array_agg(id ORDER BY created_at ASC) AS ids,
      array_agg(created_at ORDER BY created_at ASC) AS created_ats
    FROM picks
    GROUP BY group_id, draft_position
    HAVING COUNT(*) > 1
  `;

  console.log(`  Found ${dupes.length} (group_id, draft_position) pairs with duplicates`);

  let deleted = 0;
  for (const row of dupes) {
    // Keep the first id (earliest createdAt), delete the rest
    const idsToDelete = row.ids.slice(1);
    console.log(
      `  Group ${row.group_id} pos ${row.draft_position}: keeping ${row.ids[0]}, deleting ${idsToDelete.length}`
    );
    const result = await prisma.pick.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    deleted += result.count;
  }
  console.log(`  Deleted ${deleted} duplicate picks total`);

  console.log("\nStep 2: Add unique constraint...");
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "picks_group_id_draft_position_key" ON "picks" ("group_id", "draft_position")`
    );
    console.log("  ✓ Created unique index on (group_id, draft_position)");
  } catch (e) {
    console.error("  ✗ Failed:", e);
    throw e;
  }

  console.log("\n✅ Cleanup + constraint applied successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
