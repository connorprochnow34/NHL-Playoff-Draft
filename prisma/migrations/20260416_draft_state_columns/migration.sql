-- Add JSONB draft_state and version columns to groups
ALTER TABLE "groups" ADD COLUMN "draft_state" JSONB;
ALTER TABLE "groups" ADD COLUMN "draft_state_version" INTEGER NOT NULL DEFAULT 0;

-- Track auto-picks
ALTER TABLE "picks" ADD COLUMN "is_auto_pick" BOOLEAN NOT NULL DEFAULT false;

-- Index for cron sweep efficiency
CREATE INDEX "groups_draft_status_idx" ON "groups" ("draft_status")
  WHERE "draft_status" IN ('COUNTDOWN', 'LIVE');
