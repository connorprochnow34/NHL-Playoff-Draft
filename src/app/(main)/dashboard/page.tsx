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
import { ChirpCard } from "@/components/groups/chirp-card";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import type { NhlGame, NhlTeam } from "@prisma/client";

// Force fresh data on every page load — no caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GameWithTeams = NhlGame & {
  homeTeam: NhlTeam;
  awayTeam: NhlTeam;
};

const ROUND_LABEL: Record<number, string> = {
  1: "Round 1",
  2: "Round 2",
  3: "Conference Final",
  4: "Stanley Cup Final",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
              series: { include: { homeTeam: true, awayTeam: true, winner: true } },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const preDraftGroups = memberships.filter(
    (m) =>
      m.group.draftStatus === "OPEN" ||
      m.group.draftStatus === "WAITING" ||
      m.group.draftStatus === "COUNTDOWN" ||
      m.group.draftStatus === "LIVE" ||
      m.group.draftStatus === "PAUSED"
  );
  const postDraftGroups = memberships.filter(
    (m) => m.group.draftStatus === "COMPLETED"
  );

  // Build a single set of all team IDs the user has drafted (across all post-draft groups)
  const myAllDraftedTeamIds = new Set<string>();
  for (const m of postDraftGroups) {
    for (const p of m.group.picks) {
      if (p.userId === user.id) myAllDraftedTeamIds.add(p.teamId);
    }
  }

  // Latest chirp per group
  const postDraftGroupIds = postDraftGroups.map((m) => m.group.id);
  const chirps =
    postDraftGroupIds.length > 0
      ? await prisma.chirp.findMany({
          where: { groupId: { in: postDraftGroupIds } },
          orderBy: { generatedAt: "desc" },
        })
      : [];
  const chirpByGroup = new Map<string, (typeof chirps)[number]>();
  for (const c of chirps) {
    if (!chirpByGroup.has(c.groupId)) chirpByGroup.set(c.groupId, c);
  }

  // All series for bracket display
  const allSeries = await prisma.series.findMany({
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: [{ round: "asc" }, { seriesLetter: "asc" }],
  });

  // Playoff games (yesterday + 6 days forward)
  const yesterday = new Date();
  yesterday.setUTCHours(0, 0, 0, 0);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const sevenDaysOut = new Date(yesterday);
  sevenDaysOut.setUTCDate(sevenDaysOut.getUTCDate() + 7);
  const allGames = await prisma.nhlGame.findMany({
    where: {
      gameType: 3,
      startTime: { gte: yesterday, lt: sevenDaysOut },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: "asc" },
  });

  // Playoff teams for fallback display
  const playoffTeams = await prisma.nhlTeam.findMany({
    where: { isPlayoffTeam: true },
    orderBy: [{ conference: "asc" }, { seed: "asc" }],
  });

  const draftStatusLabels: Record<string, string> = {
    OPEN: "Open",
    WAITING: "Waiting room",
    COUNTDOWN: "Starting…",
    LIVE: "Draft live",
    PAUSED: "Paused",
    COMPLETED: "Completed",
  };

  const draftStatusColors: Record<string, string> = {
    OPEN: "text-green-500 border-green-500/30",
    WAITING: "text-blue-500 border-blue-500/30",
    COUNTDOWN: "text-yellow-500 border-yellow-500/30",
    LIVE: "text-yellow-500 border-yellow-500/30",
    PAUSED: "text-yellow-500 border-yellow-500/30",
    COMPLETED: "text-muted-foreground",
  };

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
      <AutoRefresh intervalMs={60_000} />
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

      {/* PRE-DRAFT GROUPS */}
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
                      <CardTitle className="text-lg">
                        <Link
                          href={`/groups/${group.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {group.name}
                        </Link>
                      </CardTitle>
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
                  {group.draftStatus === "OPEN" && (
                    <InviteCard inviteCode={group.inviteCode} />
                  )}

                  {draftTimeIso && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Draft:</span>
                      <DraftTime iso={draftTimeIso} />
                    </div>
                  )}

                  {group.draftNotes && (
                    <div className="text-sm p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Notes: </span>
                      {group.draftNotes}
                    </div>
                  )}

                  {(group.draftStatus === "WAITING" ||
                    group.draftStatus === "COUNTDOWN" ||
                    group.draftStatus === "LIVE" ||
                    group.draftStatus === "PAUSED") && (
                    <Link
                      href={`/groups/${group.id}/draft`}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 text-white h-9 px-4 text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      {group.draftStatus === "WAITING"
                        ? "Enter Waiting Room"
                        : group.draftStatus === "LIVE" ||
                            group.draftStatus === "PAUSED"
                          ? "Join Live Draft"
                          : "Draft starting…"}
                    </Link>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">
                      Members ({group.members.length}
                      {group.maxPlayers ? ` of ${group.maxPlayers}` : ""})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {group.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 py-1 px-2 rounded text-sm"
                        >
                          <span
                            className={
                              m.userId === user.id
                                ? "text-primary font-medium"
                                : ""
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
        </div>
      )}

      {preDraftGroups.length > 0 && postDraftGroups.length > 0 && <Separator />}

      {/* POST-DRAFT GROUPS — one self-contained card per group */}
      {postDraftGroups.length > 0 && (
        <div className="space-y-8">
          {postDraftGroups.map(({ group }) => {
            const groupTeamIds = new Set(group.picks.map((p) => p.teamId));
            const myPicksInGroup = group.picks.filter(
              (p) => p.userId === user.id
            );
            const myTeamIdsInGroup = new Set(
              myPicksInGroup.map((p) => p.teamId)
            );

            // Matchups: any series (UPCOMING or IN_PROGRESS) where one of my drafted teams plays
            const myMatchups = allSeries.filter(
              (s) =>
                (s.status === "UPCOMING" || s.status === "IN_PROGRESS") &&
                (myTeamIdsInGroup.has(s.homeTeamId) ||
                  myTeamIdsInGroup.has(s.awayTeamId))
            );

            // Eliminated team IDs: any team that lost a completed series
            const eliminatedTeamIds = new Set<string>();
            for (const s of allSeries) {
              if (s.status === "COMPLETED" && s.winnerTeamId) {
                if (s.winnerTeamId !== s.homeTeamId)
                  eliminatedTeamIds.add(s.homeTeamId);
                if (s.winnerTeamId !== s.awayTeamId)
                  eliminatedTeamIds.add(s.awayTeamId);
              }
            }

            // Standings, with each member's drafted teams attached
            const standings = group.members
              .map((m) => ({
                userId: m.userId,
                displayName: m.user.displayName,
                totalPoints: group.points
                  .filter((p) => p.userId === m.userId)
                  .reduce((sum, p) => sum + p.pointsAwarded, 0),
                teams: group.picks
                  .filter((p) => p.userId === m.userId)
                  .map((p) => ({
                    id: p.team.id,
                    abbreviation: p.team.abbreviation,
                    name: p.team.name,
                    logoUrl: p.team.logoUrl,
                    darkLogoUrl: p.team.darkLogoUrl,
                    eliminated: eliminatedTeamIds.has(p.team.id),
                  })),
              }))
              .sort((a, b) => b.totalPoints - a.totalPoints);

            const lastUpdate =
              group.points.length > 0
                ? new Date(
                    Math.max(
                      ...group.points.map((p) => new Date(p.createdAt).getTime())
                    )
                  )
                : null;

            const groupChirp = chirpByGroup.get(group.id);

            return (
              <Card key={group.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      <Link
                        href={`/groups/${group.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {group.name}
                      </Link>
                    </CardTitle>
                    <Link
                      href={`/groups/${group.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View group →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Chirp of the Day — first thing in each group */}
                  {groupChirp && (
                    <ChirpCard
                      chirp={{
                        text: groupChirp.text,
                        generatedAt: groupChirp.generatedAt.toISOString(),
                      }}
                    />
                  )}

                  {/* Your Matchups */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Your Matchups
                    </h3>
                    {myMatchups.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3 px-3 rounded-lg border border-dashed">
                        None of your teams are currently scheduled in an active
                        series.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {myMatchups.map((s) => {
                          const myIsHome = myTeamIdsInGroup.has(s.homeTeamId);
                          const myTeam = myIsHome ? s.homeTeam : s.awayTeam;
                          const oppTeam = myIsHome ? s.awayTeam : s.homeTeam;
                          const myWins = myIsHome ? s.homeWins : s.awayWins;
                          const oppWins = myIsHome ? s.awayWins : s.homeWins;

                          // Who in the group owns the opposing team?
                          const oppPick = group.picks.find(
                            (p) => p.teamId === oppTeam.id
                          );
                          const oppLabel = oppPick
                            ? oppPick.userId === user.id
                              ? "you"
                              : oppPick.user.displayName
                            : groupTeamIds.has(oppTeam.id)
                              ? "another member"
                              : "undrafted";

                          const isLive = s.status === "IN_PROGRESS";

                          // Find the next upcoming game for this matchup
                          const nextGame = allGames
                            .filter(
                              (g) =>
                                g.gameState !== "OFF" &&
                                ((g.homeTeamId === s.homeTeamId &&
                                  g.awayTeamId === s.awayTeamId) ||
                                  (g.homeTeamId === s.awayTeamId &&
                                    g.awayTeamId === s.homeTeamId))
                            )
                            .sort(
                              (a, b) =>
                                new Date(a.startTime).getTime() -
                                new Date(b.startTime).getTime()
                            )[0];

                          let nextGameLabel: string | null = null;
                          if (nextGame) {
                            const startDate = new Date(nextGame.startTime);
                            const day = startDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              timeZone: "America/New_York",
                            });
                            const etTime = startDate.toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: "America/New_York",
                              }
                            );
                            const ctTime = startDate.toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: "America/Chicago",
                              }
                            );
                            const verb =
                              nextGame.gameState === "LIVE" ||
                              nextGame.gameState === "CRIT"
                                ? "Live now"
                                : "Next";
                            nextGameLabel = `${verb}: ${day} · ${etTime} ET / ${ctTime} CT`;
                          }

                          return (
                            <div
                              key={s.id}
                              className="p-3 rounded-lg border border-border space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative w-7 h-7">
                                      <Image
                                        src={
                                          myTeam.darkLogoUrl || myTeam.logoUrl
                                        }
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
                                  <div className="text-center px-2">
                                    <p className="text-base font-bold tabular-nums">
                                      {myWins} - {oppWins}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {ROUND_LABEL[s.round] || `R${s.round}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative w-7 h-7">
                                      <Image
                                        src={
                                          oppTeam.darkLogoUrl ||
                                          oppTeam.logoUrl
                                        }
                                        alt={oppTeam.abbreviation}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                      />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">
                                        {oppTeam.abbreviation}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                        {oppLabel}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={
                                    isLive
                                      ? "text-green-500 border-green-500/30 text-[10px]"
                                      : "text-muted-foreground text-[10px]"
                                  }
                                >
                                  {isLive ? "Live" : "Upcoming"}
                                </Badge>
                              </div>
                              {nextGameLabel && (
                                <p className="text-[11px] text-muted-foreground pl-1">
                                  {nextGameLabel}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Standings */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Standings</h3>
                      {lastUpdate && (
                        <span className="text-[10px] text-muted-foreground">
                          Updated{" "}
                          {lastUpdate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {standings.map((m, idx) => (
                        <div
                          key={m.userId}
                          className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded text-sm ${
                            m.userId === user.id
                              ? "bg-primary/10 font-medium"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-muted-foreground w-5 shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="truncate shrink-0">
                              {m.displayName}
                              {m.userId === user.id && (
                                <span className="text-primary ml-1">(you)</span>
                              )}
                            </span>
                            <div className="flex items-center gap-1 ml-1 overflow-x-auto">
                              {m.teams.map((t) => (
                                <div
                                  key={t.id}
                                  className={`relative w-5 h-5 shrink-0 ${
                                    t.eliminated ? "opacity-30 grayscale" : ""
                                  }`}
                                  title={`${t.name}${
                                    t.eliminated ? " (eliminated)" : ""
                                  }`}
                                >
                                  <Image
                                    src={t.darkLogoUrl || t.logoUrl}
                                    alt={t.abbreviation}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          <span className="font-bold tabular-nums shrink-0">
                            {m.totalPoints} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* SHARED: Bracket */}
      {allSeries.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Bracket</CardTitle>
            <CardDescription>
              First round matchups and current series scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(["Eastern", "Western"] as const).map((conf) => {
                const confLetters =
                  conf === "Eastern"
                    ? ["A", "B", "C", "D"]
                    : ["E", "F", "G", "H"];
                const confSeries = allSeries.filter(
                  (s) => s.round === 1 && confLetters.includes(s.seriesLetter)
                );
                return (
                  <div key={conf}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {conf} Conference
                    </h3>
                    <div className="space-y-2">
                      {confSeries.map((s) => {
                        const hasScore = s.homeWins + s.awayWins > 0;
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 p-2 rounded-lg border border-border"
                          >
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <div className="relative w-6 h-6 shrink-0">
                                <Image
                                  src={
                                    s.homeTeam.darkLogoUrl ||
                                    s.homeTeam.logoUrl
                                  }
                                  alt={s.homeTeam.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {s.homeTeam.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  #{s.homeSeed}
                                </p>
                              </div>
                            </div>
                            <div className="text-center shrink-0 px-1">
                              {hasScore ? (
                                <p className="text-sm font-bold tabular-nums">
                                  {s.homeWins}-{s.awayWins}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  vs
                                </p>
                              )}
                            </div>
                            <div className="flex-1 flex items-center gap-2 justify-end text-right min-w-0">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {s.awayTeam.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  #{s.awaySeed}
                                </p>
                              </div>
                              <div className="relative w-6 h-6 shrink-0">
                                <Image
                                  src={
                                    s.awayTeam.darkLogoUrl ||
                                    s.awayTeam.logoUrl
                                  }
                                  alt={s.awayTeam.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
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
      ) : playoffTeams.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Playoff Teams</CardTitle>
            <CardDescription>
              The 16 teams available in the draft
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["Eastern", "Western"] as const).map((conf) => (
                <div key={conf}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {conf} Conference
                  </h3>
                  <div className="space-y-1">
                    {playoffTeams
                      .filter((t) => t.conference === conf)
                      .map((team) => (
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
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* SHARED: Playoff Schedule (date-based) */}
      <PlayoffScheduleCard
        games={allGames}
        myDraftedTeamIds={myAllDraftedTeamIds}
      />
    </div>
  );
}

// =====================================================
// Playoff Schedule sub-component (server-rendered)
// =====================================================

function PlayoffScheduleCard({
  games,
  myDraftedTeamIds,
}: {
  games: GameWithTeams[];
  myDraftedTeamIds: Set<string>;
}) {
  // Bucket by Eastern Time day, since the audience is US-based and a game's
  // "night" should align with the local viewing day (e.g. 11:30 PM ET game
  // is "tonight", not "tomorrow morning UTC").
  const ymdInET = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const todayET = ymdInET(new Date());
  const yesterdayET = ymdInET(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const tomorrowET = ymdInET(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const buckets = new Map<string, GameWithTeams[]>();

  for (const g of games) {
    const gameYmdET = ymdInET(new Date(g.startTime));

    let label: string;
    if (gameYmdET === yesterdayET) label = "Last night";
    else if (gameYmdET === todayET) label = "Today";
    else if (gameYmdET === tomorrowET) label = "Tomorrow";
    else {
      // Future days within the 7-day window
      const gameDay = new Date(gameYmdET + "T12:00:00Z"); // noon to avoid TZ edge cases
      const todayDay = new Date(todayET + "T12:00:00Z");
      const diffDays = Math.round(
        (gameDay.getTime() - todayDay.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (diffDays > 1 && diffDays <= 6) {
        label = new Date(g.startTime).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: "America/New_York",
        });
      } else continue;
    }

    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(g);
  }

  const orderedLabels = ["Last night", "Today", "Tomorrow"];
  const futureLabels = Array.from(buckets.keys())
    .filter((l) => !orderedLabels.includes(l))
    .sort((a, b) => {
      // Sort by the first game's startTime in each bucket
      const ag = buckets.get(a)![0];
      const bg = buckets.get(b)![0];
      return new Date(ag.startTime).getTime() - new Date(bg.startTime).getTime();
    });
  const allLabels = [
    ...orderedLabels.filter((l) => buckets.has(l)),
    ...futureLabels.slice(0, 2), // limit to ~2 more days = next 3 days total
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Playoff Schedule</CardTitle>
        <CardDescription>
          Last night&apos;s results and the next few days. Games involving your
          drafted teams are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allLabels.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No playoff games in the next few days.
          </p>
        ) : (
          <div className="space-y-5">
            {allLabels.map((label) => {
              const dayGames = buckets.get(label) || [];
              return (
                <div key={label}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {label}
                  </h3>
                  {dayGames.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No games.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {dayGames.map((g) => {
                        const isFinal = g.gameState === "OFF";
                        const isLive =
                          g.gameState === "LIVE" || g.gameState === "CRIT";
                        const involvesMyTeam =
                          myDraftedTeamIds.has(g.homeTeamId) ||
                          myDraftedTeamIds.has(g.awayTeamId);
                        const startDate = new Date(g.startTime);
                        const etTime = startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "America/New_York",
                        });
                        const ctTime = startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "America/Chicago",
                        });
                        const startTimeLabel = `${etTime} ET / ${ctTime} CT`;

                        return (
                          <div
                            key={g.id}
                            className={`flex items-center justify-between py-2 px-2 rounded text-sm ${
                              involvesMyTeam
                                ? "bg-primary/5 border border-primary/20"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative w-5 h-5 shrink-0">
                                <Image
                                  src={
                                    g.awayTeam.darkLogoUrl ||
                                    g.awayTeam.logoUrl
                                  }
                                  alt={g.awayTeam.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                              <span
                                className={
                                  isFinal &&
                                  (g.awayScore ?? 0) > (g.homeScore ?? 0)
                                    ? "font-bold"
                                    : ""
                                }
                              >
                                {g.awayTeam.abbreviation}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                @
                              </span>
                              <span
                                className={
                                  isFinal &&
                                  (g.homeScore ?? 0) > (g.awayScore ?? 0)
                                    ? "font-bold"
                                    : ""
                                }
                              >
                                {g.homeTeam.abbreviation}
                              </span>
                              <div className="relative w-5 h-5 shrink-0">
                                <Image
                                  src={
                                    g.homeTeam.darkLogoUrl ||
                                    g.homeTeam.logoUrl
                                  }
                                  alt={g.homeTeam.abbreviation}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isFinal ? (
                                <span className="font-mono text-sm tabular-nums">
                                  {g.awayScore} - {g.homeScore}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {startTimeLabel}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  isFinal
                                    ? "text-muted-foreground"
                                    : isLive
                                      ? "text-green-500 border-green-500/30"
                                      : "text-yellow-500 border-yellow-500/30"
                                }`}
                              >
                                {isFinal
                                  ? "Final"
                                  : isLive
                                    ? "Live"
                                    : "Upcoming"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
