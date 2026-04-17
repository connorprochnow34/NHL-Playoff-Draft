-- NhlGame: per-game playoff data for the date-based schedule view
CREATE TABLE "nhl_games" (
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
);

CREATE INDEX "nhl_games_start_time_idx" ON "nhl_games" ("start_time");
CREATE INDEX "nhl_games_game_state_idx" ON "nhl_games" ("game_state");
