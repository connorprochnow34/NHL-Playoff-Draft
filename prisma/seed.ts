import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script that populates test data for a complete 8-person draft.
 * Creates: 8 users, 1 group, 16 playoff teams, 8 R1 series (4 completed),
 * all 16 picks distributed, and points for completed series.
 *
 * Run with: npx prisma db seed
 */
async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.point.deleteMany();
  await prisma.pick.deleteMany();
  await prisma.series.deleteMany();
  await prisma.nhlTeam.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.user.deleteMany();

  // Create 8 users
  const userNames = [
    "Alex",
    "Jordan",
    "Taylor",
    "Casey",
    "Morgan",
    "Riley",
    "Quinn",
    "Drew",
  ];

  const users = await Promise.all(
    userNames.map((name, i) =>
      prisma.user.create({
        data: {
          id: `00000000-0000-0000-0000-00000000000${i + 1}`,
          email: `${name.toLowerCase()}@example.com`,
          displayName: name,
        },
      })
    )
  );

  console.log(`Created ${users.length} users`);

  // Create group with first user as commissioner
  const group = await prisma.group.create({
    data: {
      name: "Playoff Pals",
      commissionerId: users[0].id,
      inviteCode: "PLYPLS",
      draftStatus: "COMPLETED",
      pickTimerSeconds: 60,
    },
  });

  // Add all users as members with draft positions
  await Promise.all(
    users.map((user, i) =>
      prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          draftPosition: i + 1,
        },
      })
    )
  );

  console.log("Created group with 8 members");

  // Create 16 playoff teams (based on 2024-25 actual teams)
  const teamsData = [
    // Eastern Conference
    { nhlApiId: 10, name: "Toronto Maple Leafs", abbrev: "TOR", conf: "Eastern", div: "Atlantic", seed: 1 },
    { nhlApiId: 13, name: "Florida Panthers", abbrev: "FLA", conf: "Eastern", div: "Atlantic", seed: 2 },
    { nhlApiId: 14, name: "Tampa Bay Lightning", abbrev: "TBL", conf: "Eastern", div: "Atlantic", seed: 3 },
    { nhlApiId: 9, name: "Ottawa Senators", abbrev: "OTT", conf: "Eastern", div: "Atlantic", seed: 4 },
    { nhlApiId: 15, name: "Washington Capitals", abbrev: "WSH", conf: "Eastern", div: "Metropolitan", seed: 5 },
    { nhlApiId: 3, name: "New York Rangers", abbrev: "NYR", conf: "Eastern", div: "Metropolitan", seed: 6 },
    { nhlApiId: 12, name: "Carolina Hurricanes", abbrev: "CAR", conf: "Eastern", div: "Metropolitan", seed: 7 },
    { nhlApiId: 1, name: "New Jersey Devils", abbrev: "NJD", conf: "Eastern", div: "Metropolitan", seed: 8 },
    // Western Conference
    { nhlApiId: 52, name: "Winnipeg Jets", abbrev: "WPG", conf: "Western", div: "Central", seed: 1 },
    { nhlApiId: 25, name: "Dallas Stars", abbrev: "DAL", conf: "Western", div: "Central", seed: 2 },
    { nhlApiId: 21, name: "Colorado Avalanche", abbrev: "COL", conf: "Western", div: "Central", seed: 3 },
    { nhlApiId: 18, name: "Nashville Predators", abbrev: "NSH", conf: "Western", div: "Central", seed: 4 },
    { nhlApiId: 23, name: "Vancouver Canucks", abbrev: "VAN", conf: "Western", div: "Pacific", seed: 5 },
    { nhlApiId: 22, name: "Edmonton Oilers", abbrev: "EDM", conf: "Western", div: "Pacific", seed: 6 },
    { nhlApiId: 26, name: "Los Angeles Kings", abbrev: "LAK", conf: "Western", div: "Pacific", seed: 7 },
    { nhlApiId: 24, name: "Vegas Golden Knights", abbrev: "VGK", conf: "Western", div: "Pacific", seed: 8 },
  ];

  const teams = await Promise.all(
    teamsData.map((t) =>
      prisma.nhlTeam.create({
        data: {
          nhlApiId: t.nhlApiId,
          name: t.name,
          abbreviation: t.abbrev,
          logoUrl: `https://assets.nhle.com/logos/nhl/svg/${t.abbrev}_light.svg`,
          darkLogoUrl: `https://assets.nhle.com/logos/nhl/svg/${t.abbrev}_dark.svg`,
          conference: t.conf,
          division: t.div,
          seed: t.seed,
          isPlayoffTeam: true,
        },
      })
    )
  );

  console.log(`Created ${teams.length} playoff teams`);

  // Snake draft: 8 members, 16 teams = 2 rounds
  // Round 1: positions 1→8, Round 2: positions 8→1
  const draftOrder = [
    // Round 1 (1→8): highest seeds go first
    0, 1, 2, 3, 4, 5, 6, 7,
    // Round 2 (8→1): reverse order
    15, 14, 13, 12, 11, 10, 9, 8,
  ];

  const picks = await Promise.all(
    draftOrder.map((teamIdx, pickIdx) => {
      const round = pickIdx < 8 ? 1 : 2;
      const userIdx = round === 1 ? pickIdx : 15 - pickIdx;
      return prisma.pick.create({
        data: {
          groupId: group.id,
          userId: users[userIdx].id,
          teamId: teams[teamIdx].id,
          draftRound: round,
          draftPosition: pickIdx + 1,
        },
      });
    })
  );

  console.log(`Created ${picks.length} draft picks`);

  // Create Round 1 series (Eastern: A-D, Western: E-H)
  const seriesData = [
    // Eastern Conference R1
    { letter: "A", home: 0, away: 7, homeW: 4, awayW: 2, status: "COMPLETED" as const }, // TOR beats NJD
    { letter: "B", home: 1, away: 6, homeW: 4, awayW: 3, status: "COMPLETED" as const }, // FLA beats CAR
    { letter: "C", home: 2, away: 5, homeW: 2, awayW: 3, status: "IN_PROGRESS" as const }, // TBL vs NYR
    { letter: "D", home: 3, away: 4, homeW: 1, awayW: 2, status: "IN_PROGRESS" as const }, // OTT vs WSH
    // Western Conference R1
    { letter: "E", home: 8, away: 15, homeW: 4, awayW: 1, status: "COMPLETED" as const }, // WPG beats VGK
    { letter: "F", home: 9, away: 14, homeW: 4, awayW: 3, status: "COMPLETED" as const }, // DAL beats LAK
    { letter: "G", home: 10, away: 13, homeW: 3, awayW: 2, status: "IN_PROGRESS" as const }, // COL vs EDM
    { letter: "H", home: 11, away: 12, homeW: 1, awayW: 3, status: "IN_PROGRESS" as const }, // NSH vs VAN
  ];

  const createdSeries = await Promise.all(
    seriesData.map((s) =>
      prisma.series.create({
        data: {
          round: 1,
          seriesLetter: s.letter,
          homeTeamId: teams[s.home].id,
          awayTeamId: teams[s.away].id,
          homeSeed: teamsData[s.home].seed,
          awaySeed: teamsData[s.away].seed,
          homeWins: s.homeW,
          awayWins: s.awayW,
          winnerTeamId: s.status === "COMPLETED" ? teams[s.home].id : null,
          status: s.status,
          nhlSeriesId: s.letter,
        },
      })
    )
  );

  console.log(`Created ${createdSeries.length} Round 1 series`);

  // Create Round 2 series (upcoming)
  await Promise.all([
    prisma.series.create({
      data: {
        round: 2,
        seriesLetter: "I",
        homeTeamId: teams[0].id, // TOR
        awayTeamId: teams[1].id, // FLA
        homeSeed: 1,
        awaySeed: 2,
        status: "UPCOMING",
      },
    }),
    prisma.series.create({
      data: {
        round: 2,
        seriesLetter: "K",
        homeTeamId: teams[8].id, // WPG
        awayTeamId: teams[9].id, // DAL
        homeSeed: 1,
        awaySeed: 2,
        status: "UPCOMING",
      },
    }),
  ]);

  console.log("Created Round 2 series (upcoming)");

  // Award points for completed series
  // Series A: TOR (seed 1) beats NJD (seed 8) = favorite wins = 2 pts
  // Alex has TOR (pick 1)
  await prisma.point.create({
    data: {
      groupId: group.id,
      userId: users[0].id, // Alex
      seriesId: createdSeries[0].id,
      teamId: teams[0].id, // TOR
      pointsAwarded: 2,
      wasUnderdog: false,
    },
  });

  // Series B: FLA (seed 2) beats CAR (seed 7) = favorite wins = 2 pts
  // Jordan has FLA (pick 2)
  await prisma.point.create({
    data: {
      groupId: group.id,
      userId: users[1].id, // Jordan
      seriesId: createdSeries[1].id,
      teamId: teams[1].id, // FLA
      pointsAwarded: 2,
      wasUnderdog: false,
    },
  });

  // Series E: WPG (seed 1) beats VGK (seed 8) = favorite wins = 2 pts
  // Drew has VGK (R2 pick, lost) — nobody gets points for VGK losing
  // WPG is picked by... looking at draft order:
  // R1 picks: Alex=TOR, Jordan=FLA, Taylor=TBL, Casey=OTT, Morgan=WSH, Riley=NYR, Quinn=CAR, Drew=NJD
  // R2 picks: Drew=VGK, Quinn=LAK, Riley=EDM, Morgan=VAN, Casey=NSH, Taylor=COL, Jordan=DAL, Alex=WPG
  // So Alex has WPG
  await prisma.point.create({
    data: {
      groupId: group.id,
      userId: users[0].id, // Alex
      seriesId: createdSeries[4].id,
      teamId: teams[8].id, // WPG
      pointsAwarded: 2,
      wasUnderdog: false,
    },
  });

  // Series F: DAL (seed 2) beats LAK (seed 7) = favorite wins = 2 pts
  // Jordan has DAL
  await prisma.point.create({
    data: {
      groupId: group.id,
      userId: users[1].id, // Jordan
      seriesId: createdSeries[5].id,
      teamId: teams[9].id, // DAL
      pointsAwarded: 2,
      wasUnderdog: false,
    },
  });

  console.log("Awarded points for completed series");

  // Summary
  console.log("\n--- Seed Summary ---");
  console.log("Group: Playoff Pals (invite code: PLYPLS)");
  console.log("Commissioner: Alex");
  console.log("\nDraft Results:");
  console.log("Alex: TOR (#1), WPG (#1) — 4 pts (2+2)");
  console.log("Jordan: FLA (#2), DAL (#2) — 4 pts (2+2)");
  console.log("Taylor: TBL (#3), COL (#3) — 0 pts (both still playing)");
  console.log("Casey: OTT (#4), NSH (#4) — 0 pts (both still playing)");
  console.log("Morgan: WSH (#5), VAN (#5) — 0 pts (both still playing)");
  console.log("Riley: NYR (#6), EDM (#6) — 0 pts (both still playing)");
  console.log("Quinn: CAR (#7), LAK (#7) — 0 pts (CAR eliminated, LAK eliminated)");
  console.log("Drew: NJD (#8), VGK (#8) — 0 pts (NJD eliminated, VGK eliminated)");
  console.log("\nTest users can log in with email: {name}@example.com");
  console.log("Note: These are DB-only users. Create Supabase auth users separately.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
