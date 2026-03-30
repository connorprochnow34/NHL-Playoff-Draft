/**
 * Scoring rules per playoff round.
 * Lower seed number = favorite.
 */
const POINTS_TABLE: Record<number, { favorite: number; underdog: number }> = {
  1: { favorite: 2, underdog: 5 },
  2: { favorite: 3, underdog: 7 },
  3: { favorite: 5, underdog: 10 },
  4: { favorite: 7, underdog: 14 },
};

/**
 * Calculate points for a completed series.
 *
 * @param round - Playoff round (1-4)
 * @param winnerSeed - Conference seed of the winning team
 * @param loserSeed - Conference seed of the losing team
 * @returns Points awarded and whether the winner was the underdog
 */
export function calculatePoints(
  round: number,
  winnerSeed: number,
  loserSeed: number
): { points: number; wasUnderdog: boolean } {
  const roundPoints = POINTS_TABLE[round];
  if (!roundPoints) {
    throw new Error(`Invalid round: ${round}`);
  }

  // Lower seed number = favorite
  // If seeds are equal, treat winner as favorite (wasUnderdog = false)
  const wasUnderdog = winnerSeed > loserSeed;
  const points = wasUnderdog ? roundPoints.underdog : roundPoints.favorite;

  return { points, wasUnderdog };
}

/**
 * Award points for a completed series across all groups.
 * Finds every group where the winning team was drafted and creates Point records.
 */
export async function awardPointsForSeries(seriesId: string): Promise<void> {
  // Lazy import to avoid pulling Prisma into test environment
  const { prisma } = await import("@/lib/prisma");

  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: {
      homeTeam: true,
      awayTeam: true,
      winner: true,
    },
  });

  if (!series || !series.winnerTeamId || !series.winner) {
    return; // Series not complete
  }

  const winnerSeed =
    series.winnerTeamId === series.homeTeamId
      ? series.homeSeed
      : series.awaySeed;
  const loserSeed =
    series.winnerTeamId === series.homeTeamId
      ? series.awaySeed
      : series.homeSeed;

  const { points, wasUnderdog } = calculatePoints(
    series.round,
    winnerSeed,
    loserSeed
  );

  // Find all picks of the winning team across all groups
  const picks = await prisma.pick.findMany({
    where: { teamId: series.winnerTeamId },
    include: { group: true },
  });

  for (const pick of picks) {
    // Skip if points already awarded for this group/series/team combo
    const existing = await prisma.point.findUnique({
      where: {
        groupId_seriesId_teamId: {
          groupId: pick.groupId,
          seriesId: series.id,
          teamId: series.winnerTeamId,
        },
      },
    });

    if (existing) continue;

    await prisma.point.create({
      data: {
        groupId: pick.groupId,
        userId: pick.userId,
        seriesId: series.id,
        teamId: series.winnerTeamId,
        pointsAwarded: points,
        wasUnderdog,
      },
    });
  }
}
