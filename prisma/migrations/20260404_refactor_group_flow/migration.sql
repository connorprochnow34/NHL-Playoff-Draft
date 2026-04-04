-- Rename DraftStatus enum values in-place (no data migration needed)
ALTER TYPE "DraftStatus" RENAME VALUE 'PENDING' TO 'OPEN';
ALTER TYPE "DraftStatus" RENAME VALUE 'SCHEDULED' TO 'LOCKED';

-- Add max_players column to groups
ALTER TABLE "groups" ADD COLUMN "max_players" INTEGER;
