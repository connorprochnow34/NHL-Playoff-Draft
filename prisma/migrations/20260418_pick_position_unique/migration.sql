-- Prevent duplicate picks at the same draft position within a group.
-- Closes the race condition where multiple concurrent auto-pick requests
-- could each succeed in inserting a pick for the same pick_number.
CREATE UNIQUE INDEX IF NOT EXISTS "picks_group_id_draft_position_key"
  ON "picks" ("group_id", "draft_position");
