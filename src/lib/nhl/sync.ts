import { prisma } from "@/lib/prisma";
import {
  fetchPlayoffBracket,
  fetchScheduleForDate,
  fetchStandings,
  getCurrentSeasonYear,
} from "./api";
import { awardPointsForSeries } from "@/lib/scoring/engine";
import type { NhlBracketSeries } from "./types";

export interface SyncResult {
  teamsUpserted: number;
  seriesUpserted: number;
  seriesCompleted: string[];
  gamesUpserted: number;
  errors: string[];
}

export async function syncNhlData(): Promise<SyncResult> {
  const result: SyncResult = {
    teamsUpserted: 0,
    seriesUpserted: 0,
    seriesCompleted: [],
    gamesUpserted: 0,
    errors: [],
  };

  try {
    const year = getCurrentSeasonYear();
    const [bracket, standings] = await Promise.all([
      fetchPlayoffBracket(year),
      fetchStandings(),
    ]);

    // Build a lookup from standings for conference/division/seed info
    const standingsMap = new Map(
      standings.standings.map((t) => [t.teamAbbrev.default, t])
    );

    // Reset all playoff flags BEFORE upserts so stale teams from prior syncs
    // are correctly marked non-playoff. Only the 16 teams in the current bracket
    // will end up with isPlayoffTeam=true after this sync completes.
    await prisma.nhlTeam.updateMany({
      data: { isPlayoffTeam: false },
    });

    // Upsert teams from bracket data
    const allTeamIds = new Set<number>();

    for (const series of bracket.series) {
      for (const bracketTeam of [series.topSeedTeam, series.bottomSeedTeam]) {
        if (!bracketTeam || allTeamIds.has(bracketTeam.id)) continue;
        allTeamIds.add(bracketTeam.id);

        const standingsInfo = standingsMap.get(bracketTeam.abbrev);

        try {
          await prisma.nhlTeam.upsert({
            where: { nhlApiId: bracketTeam.id },
            update: {
              name: bracketTeam.name.default,
              abbreviation: bracketTeam.abbrev,
              logoUrl: bracketTeam.logo,
              darkLogoUrl: bracketTeam.darkLogo,
              conference: standingsInfo?.conferenceName || "",
              division: standingsInfo?.divisionName || "",
              seed: standingsInfo?.conferenceSequence || null,
              isPlayoffTeam: true,
            },
            create: {
              nhlApiId: bracketTeam.id,
              name: bracketTeam.name.default,
              abbreviation: bracketTeam.abbrev,
              logoUrl: bracketTeam.logo,
              darkLogoUrl: bracketTeam.darkLogo,
              conference: standingsInfo?.conferenceName || "",
              division: standingsInfo?.divisionName || "",
              seed: standingsInfo?.conferenceSequence || null,
              isPlayoffTeam: true,
            },
          });
          result.teamsUpserted++;
        } catch (e) {
          result.errors.push(
            `Failed to upsert team ${bracketTeam.abbrev}: ${e}`
          );
        }
      }
    }

    // Upsert series
    for (const s of bracket.series) {
      try {
        await upsertSeries(s, result);
      } catch (e) {
        result.errors.push(
          `Failed to upsert series ${s.seriesLetter}: ${e}`
        );
      }
    }

    // Validate exactly 16 playoff teams
    const playoffCount = await prisma.nhlTeam.count({
      where: { isPlayoffTeam: true },
    });
    if (playoffCount !== 16) {
      result.errors.push(
        `Expected 16 playoff teams after sync, got ${playoffCount}`
      );
    }

    // Sync games (yesterday + 6 days forward) — best effort, don't fail full sync
    try {
      await syncGames(result);
    } catch (e) {
      result.errors.push(`Game sync failed: ${e}`);
    }

    // Log sync
    await prisma.syncLog.create({
      data: {
        status: result.errors.length > 0 ? "partial" : "success",
        details: JSON.stringify(result),
      },
    });
  } catch (e) {
    result.errors.push(`Sync failed: ${e}`);
    await prisma.syncLog.create({
      data: {
        status: "error",
        details: `${e}`,
      },
    });
  }

  return result;
}

async function upsertSeries(
  s: NhlBracketSeries,
  result: SyncResult
) {
  if (!s.topSeedTeam || !s.bottomSeedTeam) return;

  const homeTeam = await prisma.nhlTeam.findUnique({
    where: { nhlApiId: s.topSeedTeam.id },
  });
  const awayTeam = await prisma.nhlTeam.findUnique({
    where: { nhlApiId: s.bottomSeedTeam.id },
  });

  if (!homeTeam || !awayTeam) return;

  // Check if series was previously incomplete
  const existingSeries = await prisma.series.findUnique({
    where: { seriesLetter: s.seriesLetter },
  });

  const wasIncomplete = existingSeries && !existingSeries.winnerTeamId;
  const winnerTeam = s.winningTeamId
    ? await prisma.nhlTeam.findUnique({
        where: { nhlApiId: s.winningTeamId },
      })
    : null;

  const status =
    s.topSeedWins === 4 || s.bottomSeedWins === 4
      ? "COMPLETED"
      : s.topSeedWins > 0 || s.bottomSeedWins > 0
      ? "IN_PROGRESS"
      : "UPCOMING";

  await prisma.series.upsert({
    where: { seriesLetter: s.seriesLetter },
    update: {
      round: s.playoffRound,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeSeed: s.topSeedRank,
      awaySeed: s.bottomSeedRank,
      homeWins: s.topSeedWins,
      awayWins: s.bottomSeedWins,
      winnerTeamId: winnerTeam?.id || null,
      status: status as "UPCOMING" | "IN_PROGRESS" | "COMPLETED",
    },
    create: {
      round: s.playoffRound,
      seriesLetter: s.seriesLetter,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeSeed: s.topSeedRank,
      awaySeed: s.bottomSeedRank,
      homeWins: s.topSeedWins,
      awayWins: s.bottomSeedWins,
      winnerTeamId: winnerTeam?.id || null,
      status: status as "UPCOMING" | "IN_PROGRESS" | "COMPLETED",
      nhlSeriesId: s.seriesLetter,
    },
  });

  result.seriesUpserted++;

  // If series just completed, award points
  if (wasIncomplete && winnerTeam && status === "COMPLETED") {
    result.seriesCompleted.push(
      `${s.seriesLetter}: ${winnerTeam.name} wins`
    );

    const completedSeries = await prisma.series.findUnique({
      where: { seriesLetter: s.seriesLetter },
    });

    if (completedSeries) {
      await awardPointsForSeries(completedSeries.id);
    }
  }
}

/**
 * Sync playoff games for the date window starting yesterday (UTC).
 * /v1/schedule/{date} returns a 7-day window. Calling with yesterday's date
 * gives us yesterday's results + 6 future days, all in one API call.
 */
async function syncGames(result: SyncResult): Promise<void> {
  // Yesterday in UTC, formatted YYYY-MM-DD
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const schedule = await fetchScheduleForDate(dateStr);

  // Build a map of nhlApiId → team.id for quick lookup
  const playoffTeams = await prisma.nhlTeam.findMany({
    where: { isPlayoffTeam: true },
    select: { id: true, nhlApiId: true },
  });
  const teamIdByNhlId = new Map(
    playoffTeams.map((t) => [t.nhlApiId, t.id])
  );

  // Build a map of (homeTeamId, awayTeamId) sorted → seriesLetter for badge
  const allSeries = await prisma.series.findMany({
    select: {
      seriesLetter: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  const seriesByTeamPair = new Map<string, string>();
  for (const s of allSeries) {
    const key = [s.homeTeamId, s.awayTeamId].sort().join(":");
    seriesByTeamPair.set(key, s.seriesLetter);
  }

  for (const day of schedule.gameWeek) {
    for (const g of day.games) {
      // Filter to playoff games only
      if (g.gameType !== 3) continue;

      const homeId = teamIdByNhlId.get(g.homeTeam.id);
      const awayId = teamIdByNhlId.get(g.awayTeam.id);
      // Skip games involving non-playoff teams (shouldn't happen for gameType=3 but defensive)
      if (!homeId || !awayId) continue;

      const seriesKey = [homeId, awayId].sort().join(":");
      const seriesLetter = seriesByTeamPair.get(seriesKey) || null;

      try {
        await prisma.nhlGame.upsert({
          where: { nhlGameId: g.id },
          update: {
            seriesLetter,
            homeTeamId: homeId,
            awayTeamId: awayId,
            homeScore: g.homeTeam.score ?? null,
            awayScore: g.awayTeam.score ?? null,
            startTime: new Date(g.startTimeUTC),
            gameState: g.gameState,
            gameType: g.gameType,
            syncedAt: new Date(),
          },
          create: {
            nhlGameId: g.id,
            seriesLetter,
            homeTeamId: homeId,
            awayTeamId: awayId,
            homeScore: g.homeTeam.score ?? null,
            awayScore: g.awayTeam.score ?? null,
            startTime: new Date(g.startTimeUTC),
            gameState: g.gameState,
            gameType: g.gameType,
          },
        });
        result.gamesUpserted++;
      } catch (e) {
        result.errors.push(`Failed to upsert game ${g.id}: ${e}`);
      }
    }
  }
}
