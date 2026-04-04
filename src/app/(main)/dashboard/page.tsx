import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { JoinCodeInput } from "@/components/groups/join-code-input";
import { InviteCard } from "@/components/groups/invite-card";
import { DraftTime } from "@/components/groups/draft-time";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get all user's group memberships with full data
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          commissioner: true,
          members: { include: { user: true }, orderBy: { draftPosition: "asc" } },
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

  // Split groups by draft status
  const preDraftGroups = memberships.filter(
    (m) =>
      m.group.draftStatus === "OPEN" ||
      m.group.draftStatus === "LOCKED" ||
      m.group.draftStatus === "IN_PROGRESS"
  );
  const postDraftGroups = memberships.filter(
    (m) => m.group.draftStatus === "COMPLETED"
  );

  // Get user's drafted teams across completed groups
  const myPicks = await prisma.pick.findMany({
    where: { userId: user.id },
    include: { team: true, group: true },
  });
  const myTeamIds = myPicks.map((p) => p.teamId);

  // Get active series involving user's teams
  const activeMatchups =
    myTeamIds.length > 0
      ? await prisma.series.findMany({
          where: {
            status: "IN_PROGRESS",
            OR: [
              { homeTeamId: { in: myTeamIds } },
              { awayTeamId: { in: myTeamIds } },
            ],
          },
          include: { homeTeam: true, awayTeam: true },
          orderBy: { round: "asc" },
        })
      : [];

  // Get all series for schedule
  const allSeries = await prisma.series.findMany({
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: [{ round: "asc" }, { seriesLetter: "asc" }],
  });

  // Get playoff teams for seeding preview
  const playoffTeams = await prisma.nhlTeam.findMany({
    where: { isPlayoffTeam: true },
    orderBy: [{ conference: "asc" }, { seed: "asc" }],
  });

  const draftStatusLabels: Record<string, string> = {
    OPEN: "Open",
    LOCKED: "Locked",
    IN_PROGRESS: "Draft in progress",
    COMPLETED: "Completed",
  };

  const draftStatusColors: Record<string, string> = {
    OPEN: "text-green-500 border-green-500/30",
    LOCKED: "text-blue-500 border-blue-500/30",
    IN_PROGRESS: "text-yellow-500 border-yellow-500/30",
    COMPLETED: "text-muted-foreground",
  };

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
            <h3 className="text-lg font-medium mb-2">
              Welcome to Consolation Cup
            </h3>
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

      {/* ============================================ */}
      {/* PRE-DRAFT GROUPS                             */}
      {/* ============================================ */}
      {preDraftGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Groups</h2>

          {preDraftGroups.map(({ group }) => {
            const isCommissioner = group.commissionerId === user.id;
            const draftTimeIso = group.draftScheduledAt
              ? group.draftScheduledAt.toISOString()
              : null;

            return (
              <Card key={group.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription>
                        Commissioner: {group.commissioner.displayName}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={draftStatusColors[group.draftStatus]}
                      >
                        {draftStatusLabels[group.draftStatus]}
                      </Badge>
                      {isCommissioner && (
                        <Link
                          href={`/groups/${group.id}/settings`}
                          className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground h-7 px-2 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          Settings
                        </Link>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Invite code - only when open */}
                  {group.draftStatus === "OPEN" && (
                    <InviteCard inviteCode={group.inviteCode} />
                  )}

                  {/* Draft time */}
                  {draftTimeIso && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Draft:</span>
                      <DraftTime iso={draftTimeIso} />
                    </div>
                  )}

                  {/* Draft notes */}
                  {group.draftNotes && (
                    <div className="text-sm p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Notes: </span>
                      {group.draftNotes}
                    </div>
                  )}

                  {/* Draft in progress link */}
                  {group.draftStatus === "IN_PROGRESS" && (
                    <Link
                      href={`/groups/${group.id}/draft`}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 text-white h-9 px-4 text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Join Draft Now
                    </Link>
                  )}

                  {/* Members list */}
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Members ({group.members.length}{group.maxPlayers ? ` of ${group.maxPlayers}` : ""})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {group.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 py-1 px-2 rounded text-sm"
                        >
                          <span
                            className={
                              m.userId === user.id ? "text-primary font-medium" : ""
                            }
                          >
                            {m.user.displayName}
                          </span>
                          {m.userId === group.commissionerId && (
                            <span className="text-[10px] text-muted-foreground">
                              (comm.)
                            </span>
                          )}
                          {m.draftPosition && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              #{m.draftPosition}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Projected playoff bracket */}
          {allSeries.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Projected Bracket</CardTitle>
                <CardDescription>
                  First round matchups based on current standings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {["Eastern", "Western"].map((conf) => {
                    // Series A-D are Eastern, E-H are Western
                    const confLetters =
                      conf === "Eastern"
                        ? ["A", "B", "C", "D"]
                        : ["E", "F", "G", "H"];
                    const confSeries = allSeries.filter(
                      (s) =>
                        s.round === 1 &&
                        confLetters.includes(s.seriesLetter)
                    );

                    return (
                      <div key={conf}>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          {conf} Conference
                        </h3>
                        <div className="space-y-2">
                          {confSeries.map((series) => (
                            <div
                              key={series.id}
                              className="flex items-center gap-2 p-2 rounded-lg border border-border"
                            >
                              <div className="flex-1 flex items-center gap-2">
                                <div className="relative w-6 h-6 shrink-0">
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
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {series.homeTeam.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    #{series.homeSeed} seed
                                  </p>
                                </div>
                              </div>

                              <span className="text-xs text-muted-foreground font-medium shrink-0">
                                vs
                              </span>

                              <div className="flex-1 flex items-center gap-2 justify-end text-right">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {series.awayTeam.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    #{series.awaySeed} seed
                                  </p>
                                </div>
                                <div className="relative w-6 h-6 shrink-0">
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
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : playoffTeams.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Playoff Teams</CardTitle>
                <CardDescription>
                  The 16 teams available in the draft. Sync NHL data from
                  group settings to see projected matchups.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {["Eastern", "Western"].map((conf) => {
                    const confTeams = playoffTeams.filter(
                      (t) => t.conference === conf
                    );
                    return (
                      <div key={conf}>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          {conf} Conference
                        </h3>
                        <div className="space-y-1">
                          {confTeams.map((team) => (
                            <div
                              key={team.id}
                              className="flex items-center gap-2 py-1 text-sm"
                            >
                              <span className="text-muted-foreground w-4 text-right text-xs">
                                {team.seed}
                              </span>
                              <div className="relative w-5 h-5">
                                <Image
                                  src={team.darkLogoUrl || team.logoUrl}
                                  alt={team.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                              <span>{team.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {/* Separator between pre and post draft sections */}
      {preDraftGroups.length > 0 && postDraftGroups.length > 0 && (
        <Separator />
      )}

      {/* ============================================ */}
      {/* POST-DRAFT GROUPS                            */}
      {/* ============================================ */}
      {postDraftGroups.length > 0 && (
        <div className="space-y-4">
          {/* YOUR MATCHUPS */}
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
                    const myTeam = isMyHomeTeam
                      ? series.homeTeam
                      : series.awayTeam;
                    const theirTeam = isMyHomeTeam
                      ? series.awayTeam
                      : series.homeTeam;

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
                                src={
                                  theirTeam.darkLogoUrl || theirTeam.logoUrl
                                }
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

          {/* STANDINGS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Standings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {postDraftGroups.map(({ group }) => {
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
                          View details
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
                                <span className="text-primary ml-1">
                                  (you)
                                </span>
                              )}
                            </span>
                            <span className="font-bold">
                              {member.totalPoints} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* SCHEDULE */}
          {allSeries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Playoff Schedule</CardTitle>
              </CardHeader>
              <CardContent>
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
                                  <span className="text-muted-foreground">
                                    vs
                                  </span>
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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
