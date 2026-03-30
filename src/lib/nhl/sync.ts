import { prisma } from "@/lib/prisma";
import {
  fetchPlayoffBracket,
  fetchStandings,
  getCurrentSeasonYear,
} from "./api";
import { awardPointsForSeries } from "@/lib/scoring/engine";
import type { NhlBracketSeries } from "./types";

export interface SyncResult {
  teamsUpserted: number;
  seriesUpserted: number;
  seriesCompleted: string[];
  errors: string[];
}

export async function syncNhlData(): Promise<SyncResult> {
  const result: SyncResult = {
    teamsUpserted: 0,
    seriesUpserted: 0,
    seriesCompleted: [],
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
