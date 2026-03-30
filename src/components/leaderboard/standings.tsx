"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GroupWithMembers, PickWithTeam, PointWithDetails, NhlTeam } from "@/types";

interface StandingsProps {
  group: {
    members: { userId: string; user: { displayName: string; avatarUrl: string | null } }[];
    picks: (PickWithTeam)[];
    points: (PointWithDetails)[];
  };
}

export function Standings({ group }: StandingsProps) {
  // Build leaderboard data
  const memberStats = group.members.map((m) => {
    const memberPicks = group.picks.filter((p) => p.userId === m.userId);
    const memberPoints = group.points.filter((p) => p.userId === m.userId);
    const totalPoints = memberPoints.reduce(
      (sum, p) => sum + p.pointsAwarded,
      0
    );

    // Group points by round
    const pointsByRound: Record<number, number> = {};
    memberPoints.forEach((p) => {
      const round = p.series.round;
      pointsByRound[round] = (pointsByRound[round] || 0) + p.pointsAwarded;
    });

    // Check which teams are still alive
    const teams = memberPicks.map((pick) => {
      // A team is eliminated if it lost a series (appears as loser in a completed series)
      const isEliminated = group.points.some(
        (pt) =>
          pt.series.status === "COMPLETED" &&
          pt.series.winnerTeamId !== pick.teamId &&
          (pt.series.homeTeamId === pick.teamId ||
            pt.series.awayTeamId === pick.teamId)
      );

      return {
        ...pick.team,
        isEliminated,
      };
    });

    return {
      userId: m.userId,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      totalPoints,
      teams,
      pointsByRound,
    };
  });

  // Sort by total points descending
  memberStats.sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Standings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {memberStats.map((member, index) => (
            <div
              key={member.userId}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                index === 0 && member.totalPoints > 0
                  ? "border-primary/30 bg-primary/5"
                  : "border-border"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-lg font-bold w-8 text-center",
                    index === 0 && "text-primary"
                  )}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{member.displayName}</p>
                  <div className="flex gap-1 mt-1">
                    {member.teams.map((team) => (
                      <div
                        key={team.id}
                        className={cn(
                          "relative w-6 h-6",
                          team.isEliminated && "opacity-30 grayscale"
                        )}
                        title={`${team.name}${
                          team.isEliminated ? " (eliminated)" : ""
                        }`}
                      >
                        <Image
                          src={team.darkLogoUrl || team.logoUrl}
                          alt={team.abbreviation}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold">{member.totalPoints}</p>
                <div className="flex gap-1 justify-end">
                  {[1, 2, 3, 4].map(
                    (round) =>
                      member.pointsByRound[round] && (
                        <Badge
                          key={round}
                          variant="outline"
                          className="text-[10px] px-1"
                        >
                          R{round}: {member.pointsByRound[round]}
                        </Badge>
                      )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
