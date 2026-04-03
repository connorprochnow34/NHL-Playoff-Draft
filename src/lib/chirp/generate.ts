import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const TONE_LABELS: Record<number, string> = {
  1: "Family friendly — keep it completely clean and playful, safe for any audience",
  2: "Playground rules — gentle teasing, nothing that would make anyone uncomfortable",
  3: "Friend group — light roasting between friends, some edge but nothing personal",
  4: "No mercy — sharp and pointed, the kind of thing that stings a little",
  5: "Unfiltered — the gloves are off, a little savage, the kind of thing that gets screenshotted and sent in the group chat",
};

const FALLBACK_CHIRP = "The hockey gods are silent today. Check back tomorrow.";

interface ChirpContext {
  groupName: string;
  members: {
    userId: string;
    displayName: string;
    rank: number;
    totalPoints: number;
    pointsByRound: Record<number, number>;
    teams: {
      name: string;
      abbreviation: string;
      seed: number | null;
      isEliminated: boolean;
      roundReached: number;
      currentSeriesRecord: string | null;
    }[];
  }[];
  recentResults: {
    seriesLetter: string;
    round: number;
    homeTeam: string;
    awayTeam: string;
    homeWins: number;
    awayWins: number;
    winnerName: string | null;
    ownerOfWinner: string | null;
    ownerOfLoser: string | null;
    pointsAwarded: number | null;
    wasUnderdog: boolean;
  }[];
  activeSeries: {
    homeTeam: string;
    awayTeam: string;
    homeWins: number;
    awayWins: number;
    round: number;
    homeOwner: string | null;
    awayOwner: string | null;
  }[];
  chirpTone: number;
  previousAngle: string | null;
  previousTarget: string | null;
  recentTargets: string[];
  today: string;
}

export async function generateChirpForGroup(groupId: string): Promise<void> {
  try {
    const context = await buildChirpContext(groupId);
    if (!context) return;

    const chirpText = await callAnthropicAPI(context);
    const angle = inferAngle(chirpText, context);
    const target = inferTarget(chirpText, context);

    await prisma.chirp.create({
      data: {
        groupId,
        text: chirpText,
        angle,
        targetUserId: target,
      },
    });
  } catch (error) {
    console.error(`Chirp generation failed for group ${groupId}:`, error);

    // Log failure
    await prisma.chirp.create({
      data: {
        groupId,
        text: FALLBACK_CHIRP,
        angle: "fallback",
        targetUserId: null,
      },
    });
  }
}

async function buildChirpContext(
  groupId: string
): Promise<ChirpContext | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      picks: { include: { team: true, user: true } },
      points: {
        include: {
          user: true,
          team: true,
          series: {
            include: { homeTeam: true, awayTeam: true, winner: true },
          },
        },
      },
      chirps: {
        orderBy: { generatedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!group || group.draftStatus !== "COMPLETED") return null;

  // Build leaderboard
  const members = group.members.map((m) => {
    const memberPoints = group.points.filter((p) => p.userId === m.userId);
    const totalPoints = memberPoints.reduce(
      (sum, p) => sum + p.pointsAwarded,
      0
    );
    const pointsByRound: Record<number, number> = {};
    memberPoints.forEach((p) => {
      pointsByRound[p.series.round] =
        (pointsByRound[p.series.round] || 0) + p.pointsAwarded;
    });

    const memberPicks = group.picks.filter((p) => p.userId === m.userId);
    const teams = memberPicks.map((pick) => {
      const isEliminated = group.points.some(
        (pt) =>
          pt.series.status === "COMPLETED" &&
          pt.series.winnerTeamId !== pick.teamId &&
          (pt.series.homeTeamId === pick.teamId ||
            pt.series.awayTeamId === pick.teamId)
      );

      return {
        name: pick.team.name,
        abbreviation: pick.team.abbreviation,
        seed: pick.team.seed,
        isEliminated,
        roundReached: 1, // simplified
        currentSeriesRecord: null as string | null,
      };
    });

    return {
      userId: m.userId,
      displayName: m.user.displayName,
      totalPoints,
      pointsByRound,
      teams,
      rank: 0,
    };
  });

  // Sort and assign ranks
  members.sort((a, b) => b.totalPoints - a.totalPoints);
  members.forEach((m, i) => (m.rank = i + 1));

  // Get recent completed series (last 48 hours)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentPoints = group.points.filter(
    (p) => new Date(p.createdAt) >= twoDaysAgo
  );

  const recentResults = recentPoints.map((p) => {
    const loserTeamId =
      p.series.winnerTeamId === p.series.homeTeamId
        ? p.series.awayTeamId
        : p.series.homeTeamId;
    const loserPick = group.picks.find(
      (pick) => pick.teamId === loserTeamId
    );

    return {
      seriesLetter: p.series.seriesLetter,
      round: p.series.round,
      homeTeam: p.series.homeTeam.abbreviation,
      awayTeam: p.series.awayTeam.abbreviation,
      homeWins: p.series.homeWins,
      awayWins: p.series.awayWins,
      winnerName: p.team.name,
      ownerOfWinner: p.user.displayName,
      ownerOfLoser: loserPick?.user.displayName || null,
      pointsAwarded: p.pointsAwarded,
      wasUnderdog: p.wasUnderdog,
    };
  });

  // Get active series
  const allSeries = await prisma.series.findMany({
    where: { status: "IN_PROGRESS" },
    include: { homeTeam: true, awayTeam: true },
  });

  const activeSeries = allSeries.map((s) => {
    const homePick = group.picks.find((p) => p.teamId === s.homeTeamId);
    const awayPick = group.picks.find((p) => p.teamId === s.awayTeamId);
    return {
      homeTeam: s.homeTeam.abbreviation,
      awayTeam: s.awayTeam.abbreviation,
      homeWins: s.homeWins,
      awayWins: s.awayWins,
      round: s.round,
      homeOwner: homePick?.user.displayName || null,
      awayOwner: awayPick?.user.displayName || null,
    };
  });

  // Previous chirp info for variety
  const lastChirp = group.chirps[0];
  const recentChirps = group.chirps.slice(0, 5);

  return {
    groupName: group.name,
    members,
    recentResults,
    activeSeries,
    chirpTone: group.chirpTone,
    previousAngle: lastChirp?.angle || null,
    previousTarget: lastChirp?.targetUserId || null,
    recentTargets: recentChirps
      .map((c) => c.targetUserId)
      .filter(Boolean) as string[],
    today: new Date().toISOString().split("T")[0],
  };
}

async function callAnthropicAPI(context: ChirpContext): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const standingsText = context.members
    .map(
      (m) =>
        `${m.rank}. ${m.displayName} — ${m.totalPoints} pts | Teams: ${m.teams
          .map(
            (t) =>
              `${t.name} (${t.abbreviation}, #${t.seed}${
                t.isEliminated ? ", ELIMINATED" : ", alive"
              })`
          )
          .join(", ")}${
          Object.keys(m.pointsByRound).length > 0
            ? ` | Points by round: ${Object.entries(m.pointsByRound)
                .map(([r, p]) => `R${r}: ${p}`)
                .join(", ")}`
            : ""
        }`
    )
    .join("\n");

  const recentResultsText =
    context.recentResults.length > 0
      ? context.recentResults
          .map(
            (r) =>
              `${r.homeTeam} ${r.homeWins}-${r.awayWins} ${r.awayTeam} — ${
                r.winnerName
              } wins (owned by ${r.ownerOfWinner || "nobody"}${
                r.ownerOfLoser
                  ? `, ${r.ownerOfLoser} owned the loser`
                  : ""
              }) — ${r.pointsAwarded} pts${r.wasUnderdog ? " (UPSET)" : ""}`
          )
          .join("\n")
      : "No series completed in the last 48 hours.";

  const activeSeriesText =
    context.activeSeries.length > 0
      ? context.activeSeries
          .map(
            (s) =>
              `${s.homeTeam} ${s.homeWins}-${s.awayWins} ${s.awayTeam} (Round ${s.round}) — ${s.homeOwner || "nobody"} vs ${s.awayOwner || "nobody"}`
          )
          .join("\n")
      : "No active series right now.";

  const avoidText = [];
  if (context.previousAngle)
    avoidText.push(`Yesterday's angle was: ${context.previousAngle}.`);
  if (context.previousTarget) {
    const targetName = context.members.find(
      (m) => m.userId === context.previousTarget
    )?.displayName;
    if (targetName)
      avoidText.push(`Yesterday's target was: ${targetName}.`);
  }

  const frequentTargets = context.recentTargets.reduce(
    (acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const overTargeted = Object.entries(frequentTargets)
    .filter(([, count]) => count >= 2)
    .map(([id]) => context.members.find((m) => m.userId === id)?.displayName)
    .filter(Boolean);
  if (overTargeted.length > 0)
    avoidText.push(
      `Avoid targeting these members (targeted 2+ times in last 5 days): ${overTargeted.join(", ")}.`
    );

  const systemPrompt = `You are the funniest guy in an NHL locker room — quick, sharp, a little ruthless, but never mean-spirited. You write the Chirp of the Day for a friend group's NHL playoff draft game called Consolation Cup. Your job is to find the most interesting, absurd, or tragicomic angle in today's standings and recent series results and turn it into a short piece of trash talk. It should feel like it was written by someone who knows this specific group — not a template.

Tone setting: ${context.chirpTone}. ${TONE_LABELS[context.chirpTone]}

Vary your approach each day. You have several angles available — use whichever fits today's situation best:
• Roast the person in last place, but find a specific detail that makes it funny rather than just "you're losing"
• Build up the leader in a way that makes everyone else want to take them down
• Find the absurd subplot — the person whose only surviving team is a team they clearly didn't want, the wild card that won't die, the Cup favorite that already went home
• Write a fake ESPN/TSN headline or panel debate about the group's standings
• Find something that happened in the last 48 hours — a specific game, a comeback, a collapse — and make it personal to whoever owns those teams
• Praise someone's good pick in a way that implicitly roasts everyone who passed on that team

Format: 2–4 sentences maximum. No hashtags. No emoji. No "Day X of the playoffs." Just the chirp. Make the first sentence strong enough to work as a push notification preview.

${avoidText.length > 0 ? avoidText.join(" ") : "This is the first chirp for this group."}`;

  const userMessage = `Group: ${context.groupName}
Date: ${context.today}

STANDINGS:
${standingsText}

RESULTS (LAST 48 HOURS):
${recentResultsText}

ACTIVE SERIES:
${activeSeriesText}

Generate the Chirp of the Day.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in API response");
  }

  return textBlock.text.trim();
}

function inferAngle(chirpText: string, context: ChirpContext): string {
  const lower = chirpText.toLowerCase();
  const lastPlace = context.members[context.members.length - 1];
  const firstPlace = context.members[0];

  if (
    lower.includes("breaking") ||
    lower.includes("headline") ||
    lower.includes("espn") ||
    lower.includes("tsn") ||
    lower.includes("panel")
  )
    return "fake_headline";
  if (context.recentResults.length > 0) {
    for (const r of context.recentResults) {
      if (
        lower.includes(r.homeTeam.toLowerCase()) ||
        lower.includes(r.awayTeam.toLowerCase())
      )
        return "recent_event";
    }
  }
  if (lastPlace && lower.includes(lastPlace.displayName.toLowerCase()))
    return "roast_last";
  if (firstPlace && lower.includes(firstPlace.displayName.toLowerCase()))
    return "hype_first";
  if (
    lower.includes("passed on") ||
    lower.includes("let") ||
    lower.includes("smart pick")
  )
    return "praise_pick";
  return "absurd_subplot";
}

function inferTarget(
  chirpText: string,
  context: ChirpContext
): string | null {
  const lower = chirpText.toLowerCase();
  for (const m of context.members) {
    if (lower.includes(m.displayName.toLowerCase())) {
      return m.userId;
    }
  }
  return null;
}
