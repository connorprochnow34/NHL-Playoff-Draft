-- Rename DraftStatus enum values in-place
ALTER TYPE "DraftStatus" RENAME VALUE 'LOCKED' TO 'WAITING';
ALTER TYPE "DraftStatus" RENAME VALUE 'IN_PROGRESS' TO 'LIVE';

-- Add new enum values for the rebuilt draft state machine
ALTER TYPE "DraftStatus" ADD VALUE 'COUNTDOWN' BEFORE 'LIVE';
ALTER TYPE "DraftStatus" ADD VALUE 'PAUSED' AFTER 'LIVE';
