import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Applying enum renames and additions...");

  // Migration 1: rename existing values, add new ones (must be in separate statements)
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "DraftStatus" RENAME VALUE 'LOCKED' TO 'WAITING'`
  );
  console.log("  ✓ LOCKED → WAITING");

  await prisma.$executeRawUnsafe(
    `ALTER TYPE "DraftStatus" RENAME VALUE 'IN_PROGRESS' TO 'LIVE'`
  );
  console.log("  ✓ IN_PROGRESS → LIVE");

  await prisma.$executeRawUnsafe(
    `ALTER TYPE "DraftStatus" ADD VALUE 'COUNTDOWN' BEFORE 'LIVE'`
  );
  console.log("  ✓ Added COUNTDOWN");

  await prisma.$executeRawUnsafe(
    `ALTER TYPE "DraftStatus" ADD VALUE 'PAUSED' AFTER 'LIVE'`
  );
  console.log("  ✓ Added PAUSED");

  console.log("\nApplying schema additions...");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "draft_state" JSONB`
  );
  console.log("  ✓ Added groups.draft_state");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "draft_state_version" INTEGER NOT NULL DEFAULT 0`
  );
  console.log("  ✓ Added groups.draft_state_version");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "picks" ADD COLUMN IF NOT EXISTS "is_auto_pick" BOOLEAN NOT NULL DEFAULT false`
  );
  console.log("  ✓ Added picks.is_auto_pick");

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "groups_draft_status_idx" ON "groups" ("draft_status") WHERE "draft_status" IN ('COUNTDOWN', 'LIVE')`
  );
  console.log("  ✓ Created groups_draft_status_idx");

  console.log("\n✅ All migrations applied successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
