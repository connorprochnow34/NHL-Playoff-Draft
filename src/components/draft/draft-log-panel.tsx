"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NhlTeam, Pick } from "@/types";

interface PickWithDetails extends Pick {
  team: NhlTeam;
  user: { id: string; displayName: string; avatarUrl: string | null };
}

interface Props {
  picks: PickWithDetails[];
}

export function DraftLogPanel({ picks }: Props) {
  const reversed = [...picks].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Draft Log</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="h-72 sm:h-96">
          <div className="space-y-1">
            {reversed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Waiting for first pick…
              </p>
            ) : (
              reversed.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded text-sm hover:bg-muted/50"
                >
                  <span className="text-xs text-muted-foreground w-6 shrink-0">
                    #{p.draftPosition}
                  </span>
                  <div className="relative w-5 h-5 shrink-0">
                    <Image
                      src={p.team.darkLogoUrl || p.team.logoUrl}
                      alt={p.team.abbreviation}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className="truncate">
                    {p.isAutoPick ? (
                      <>
                        <span className="font-medium">{p.user.displayName}</span>
                        <span className="text-muted-foreground"> was auto-drafted </span>
                        <span>{p.team.name}</span>
                        <span className="text-muted-foreground"> (Seed {p.team.seed})</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{p.user.displayName}</span>
                        <span className="text-muted-foreground"> picked </span>
                        <span>{p.team.name}</span>
                        <span className="text-muted-foreground"> (Seed {p.team.seed})</span>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
