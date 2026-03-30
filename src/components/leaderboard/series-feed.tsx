"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PointWithDetails } from "@/types";

interface SeriesFeedProps {
  points: PointWithDetails[];
}

export function SeriesFeed({ points }: SeriesFeedProps) {
  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No series completed yet. Points will appear here as teams advance.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {points.map((point) => (
            <div
              key={point.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8">
                  <Image
                    src={
                      point.team.darkLogoUrl || point.team.logoUrl
                    }
                    alt={point.team.abbreviation}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-medium">
                      {point.user.displayName}
                    </span>{" "}
                    earned{" "}
                    <span className="font-bold text-primary">
                      {point.pointsAwarded} pts
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {point.team.name} won Round {point.series.round}
                    {point.wasUnderdog && (
                      <Badge
                        variant="outline"
                        className="ml-1 text-[10px] px-1 text-yellow-500 border-yellow-500/30"
                      >
                        Upset
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {point.series.homeTeam.abbreviation}{" "}
                {point.series.homeWins}-{point.series.awayWins}{" "}
                {point.series.awayTeam.abbreviation}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
