"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UseDraftStateResult } from "@/hooks/use-draft-state";

export function DraftResults({ draft }: { draft: UseDraftStateResult }) {
  const { state } = draft;
  const pickedTeamIds = new Set(state.picks.map((p) => p.teamId));
  const undraftedTeams = state.teams.filter((t) => !pickedTeamIds.has(t.id));

  // Group picks by user
  const picksByUser = new Map<string, typeof state.picks>();
  for (const p of state.picks) {
    if (!picksByUser.has(p.userId)) picksByUser.set(p.userId, []);
    picksByUser.get(p.userId)!.push(p);
  }

  // Sort members by draftPosition for consistent display
  const orderedMembers = [...state.members].sort(
    (a, b) => (a.draftPosition || 0) - (b.draftPosition || 0)
  );

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-3xl font-bold">Draft Complete</h1>
        <p className="text-muted-foreground mt-1">
          {state.groupName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderedMembers.map((m) => {
              const memberPicks = picksByUser.get(m.userId) || [];
              return (
                <div key={m.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">
                      {m.user.displayName}{" "}
                      <span className="text-muted-foreground text-sm font-normal">
                        (pick #{m.draftPosition})
                      </span>
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {memberPicks.length} team{memberPicks.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {memberPicks.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm"
                      >
                        <div className="relative w-5 h-5 shrink-0">
                          <Image
                            src={p.team.darkLogoUrl || p.team.logoUrl}
                            alt={p.team.abbreviation}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <span className="truncate">{p.team.abbreviation}</span>
                        {p.isAutoPick && (
                          <span className="text-[9px] text-yellow-500 ml-auto">
                            auto
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {undraftedTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Undrafted Teams ({undraftedTeams.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {undraftedTeams.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 p-2 rounded border opacity-60 text-sm"
                >
                  <div className="relative w-5 h-5 shrink-0">
                    <Image
                      src={t.darkLogoUrl || t.logoUrl}
                      alt={t.abbreviation}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className="truncate">{t.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Link
        href={`/groups/${state.groupId}`}
        className="inline-flex items-center justify-center w-full rounded-lg bg-primary text-primary-foreground h-10 px-6 text-base font-medium hover:bg-primary/80 transition-colors"
      >
        Back to Group
      </Link>
    </div>
  );
}
