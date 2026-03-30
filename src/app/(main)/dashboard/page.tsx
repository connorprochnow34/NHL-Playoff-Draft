import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { JoinCodeInput } from "@/components/groups/join-code-input";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get all user's group memberships
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          commissioner: true,
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
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  // Get user's drafted teams across all groups
  const myPicks = await prisma.pick.findMany({
    where: { userId: user.id },
    include: { team: true, group: true },
  });

  const myTeamIds = myPicks.map((p) => p.teamId);

  // Get all active/in-progress series involving user's teams
  const activeMatchups = await prisma.series.findMany({
    where: {
      status: "IN_PROGRESS",
      OR: [
        { homeTeamId: { in: myTeamIds } },
        { awayTeamId: { in: myTeamIds } },
      ],
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { round: "asc" },
  });

  // Get all series for the schedule section
  const allSeries = await prisma.series.findMany({
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: [{ round: "asc" }, { seriesLetter: "asc" }],
  });

  // No groups empty state
  if (memberships.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link
            href="/groups/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Create Group
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Welcome to Consolation Cup</h3>
            <p className="text-muted-foreground mb-4">
              Create a group to start your playoff draft, or join one with an
              invite code.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/groups/new"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors"
              >
                Create Group
              </Link>
              <JoinCodeInput />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find opponents for matchups
  function getOpponent(
    groupPicks: typeof myPicks,
    teamId: string,
    seriesHomeTeamId: string,
    seriesAwayTeamId: string
  ) {
    const opposingTeamId =
      teamId === seriesHomeTeamId ? seriesAwayTeamId : seriesHomeTeamId;
    const opponentPick = groupPicks.find((p) => p.teamId === opposingTeamId);
    return opponentPick;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <JoinCodeInput />
          <Link
            href="/groups/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Create Group
          </Link>
        </div>
      </div>

      {/* ROW 1: YOUR MATCHUPS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Matchups</CardTitle>
        </CardHeader>
        <CardContent>
          {activeMatchups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active matchups right now. Your teams will show here when
              they&apos;re playing in a series.
            </p>
          ) : (
            <div className="space-y-3">
              {activeMatchups.map((series) => {
                const isMyHomeTeam = myTeamIds.includes(series.homeTeamId);
                const myTeam = isMyHomeTeam ? series.homeTeam : series.awayTeam;
                const theirTeam = isMyHomeTeam
                  ? series.awayTeam
                  : series.homeTeam;

                // Find which group this matchup belongs to and who owns the other team
                const relevantPick = myPicks.find(
                  (p) => p.teamId === myTeam.id
                );
                const groupForMatchup = relevantPick
                  ? memberships.find(
                      (m) => m.group.id === relevantPick.groupId
                    )
                  : null;
                const opponentPick = groupForMatchup?.group.picks.find(
                  (p) => p.teamId === theirTeam.id
                );

                return (
                  <div
                    key={series.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8">
                          <Image
                            src={myTeam.darkLogoUrl || myTeam.logoUrl}
                            alt={myTeam.abbreviation}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {myTeam.abbreviation}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Your team
                          </p>
                        </div>
                      </div>

                      <div className="text-center px-3">
                        <p className="text-lg font-bold">
                          {series.homeWins} - {series.awayWins}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Round {series.round}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8">
                          <Image
                            src={theirTeam.darkLogoUrl || theirTeam.logoUrl}
                            alt={theirTeam.abbreviation}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {theirTeam.abbreviation}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {opponentPick
                              ? opponentPick.user.displayName
                              : "Undrafted"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {groupForMatchup && (
                      <Badge variant="outline" className="text-[10px]">
                        {groupForMatchup.group.name}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROW 2: STANDINGS FOR EACH LEAGUE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {memberships.filter((m) => m.group.draftStatus === "COMPLETED")
            .length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Standings will appear after a draft is completed.
            </p>
          ) : (
            <div className="space-y-6">
              {memberships
                .filter((m) => m.group.draftStatus === "COMPLETED")
                .map(({ group }) => {
                  // Calculate standings for this group
                  const memberPoints = group.members.map((m) => {
                    const totalPts = group.points
                      .filter((p) => p.userId === m.userId)
                      .reduce((sum, p) => sum.pointsAwarded + p.pointsAwarded, { pointsAwarded: 0 } as { pointsAwarded: number });
                    return {
                      userId: m.userId,
                      displayName: m.user.displayName,
                      totalPoints:
                        typeof totalPts === "number"
                          ? totalPts
                          : totalPts.pointsAwarded,
                      teamCount: group.picks.filter(
                        (p) => p.userId === m.userId
                      ).length,
                    };
                  });

                  // Actually compute properly
                  const standings = group.members
                    .map((m) => ({
                      userId: m.userId,
                      displayName: m.user.displayName,
                      totalPoints: group.points
                        .filter((p) => p.userId === m.userId)
                        .reduce((sum, p) => sum + p.pointsAwarded, 0),
                      teamCount: group.picks.filter(
                        (p) => p.userId === m.userId
                      ).length,
                    }))
                    .sort((a, b) => b.totalPoints - a.totalPoints);

                  return (
                    <div key={group.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">{group.name}</h3>
                        <Link
                          href={`/groups/${group.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View details →
                        </Link>
                      </div>
                      <div className="space-y-1">
                        {standings.map((member, idx) => (
                          <div
                            key={member.userId}
                            className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                              member.userId === user.id
                                ? "bg-primary/10 font-medium"
                                : ""
                            }`}
                          >
                            <span>
                              <span className="text-muted-foreground w-5 inline-block">
                                {idx + 1}.
                              </span>{" "}
                              {member.displayName}
                              {member.userId === user.id && (
                                <span className="text-primary ml-1">(you)</span>
                              )}
                            </span>
                            <span className="font-bold">
                              {member.totalPoints} pts
                            </span>
                          </div>
                        ))}
                      </div>
                      {memberships.filter(
                        (m) => m.group.draftStatus === "COMPLETED"
                      ).length > 1 && <Separator className="mt-4" />}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROW 3: SCHEDULE (ALL SERIES) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Playoff Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {allSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No playoff data yet. Sync NHL data from your group settings to see
              the schedule.
            </p>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((round) => {
                const roundSeries = allSeries.filter(
                  (s) => s.round === round
                );
                if (roundSeries.length === 0) return null;

                const roundNames: Record<number, string> = {
                  1: "Round 1",
                  2: "Round 2",
                  3: "Conference Finals",
                  4: "Stanley Cup Final",
                };

                return (
                  <div key={round}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      {roundNames[round]}
                    </h3>
                    <div className="space-y-1">
                      {roundSeries.map((series) => {
                        const isMyTeamInvolved =
                          myTeamIds.includes(series.homeTeamId) ||
                          myTeamIds.includes(series.awayTeamId);

                        return (
                          <div
                            key={series.id}
                            className={`flex items-center justify-between py-2 px-2 rounded text-sm ${
                              isMyTeamInvolved
                                ? "bg-primary/5 border border-primary/20"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative w-5 h-5">
                                <Image
                                  src={
                                    series.homeTeam.darkLogoUrl ||
                                    series.homeTeam.logoUrl
                                  }
                                  alt={series.homeTeam.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                              <span
                                className={
                                  series.winner &&
                                  series.winner.id === series.homeTeamId
                                    ? "font-bold"
                                    : ""
                                }
                              >
                                {series.homeTeam.abbreviation}
                              </span>
                              <span className="text-muted-foreground">vs</span>
                              <span
                                className={
                                  series.winner &&
                                  series.winner.id === series.awayTeamId
                                    ? "font-bold"
                                    : ""
                                }
                              >
                                {series.awayTeam.abbreviation}
                              </span>
                              <div className="relative w-5 h-5">
                                <Image
                                  src={
                                    series.awayTeam.darkLogoUrl ||
                                    series.awayTeam.logoUrl
                                  }
                                  alt={series.awayTeam.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {series.homeWins}-{series.awayWins}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  series.status === "COMPLETED"
                                    ? "text-muted-foreground"
                                    : series.status === "IN_PROGRESS"
                                    ? "text-green-500 border-green-500/30"
                                    : "text-yellow-500 border-yellow-500/30"
                                }`}
                              >
                                {series.status === "COMPLETED"
                                  ? "Final"
                                  : series.status === "IN_PROGRESS"
                                  ? "Live"
                                  : "Upcoming"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
