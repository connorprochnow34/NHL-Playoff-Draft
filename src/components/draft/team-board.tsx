"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { NhlTeam, Pick } from "@/types";

interface PickWithDetails extends Pick {
  team: NhlTeam;
  user: { id: string; displayName: string; avatarUrl: string | null };
}

interface Props {
  teams: NhlTeam[];
  picks: PickWithDetails[];
  isMyTurn: boolean;
  isDraftLive: boolean;
  onPick: (teamId: string) => void;
}

export function TeamBoard({ teams, picks, isMyTurn, isDraftLive, onPick }: Props) {
  const pickedByTeamId = new Map<string, PickWithDetails>();
  for (const p of picks) pickedByTeamId.set(p.teamId, p);

  const conferences = ["Eastern", "Western"] as const;

  return (
    <div className="space-y-4">
      {conferences.map((conf) => {
        const confTeams = teams
          .filter((t) => t.conference === conf)
          .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
        return (
          <div key={conf}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {conf} Conference
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {confTeams.map((team) => {
                const pick = pickedByTeamId.get(team.id);
                const isPicked = !!pick;
                const clickable = isMyTurn && isDraftLive && !isPicked;

                return (
                  <button
                    key={team.id}
                    onClick={() => clickable && onPick(team.id)}
                    disabled={!clickable}
                    className={cn(
                      "relative flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                      isPicked
                        ? "opacity-40 border-border bg-muted cursor-not-allowed"
                        : clickable
                          ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary cursor-pointer"
                          : "border-border bg-card cursor-default"
                    )}
                  >
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                      <Image
                        src={team.darkLogoUrl || team.logoUrl}
                        alt={team.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {team.abbreviation}
                    </span>
                    {team.seed && (
                      <span className="text-[10px] text-muted-foreground">
                        #{team.seed}
                      </span>
                    )}
                    {pick && (
                      <span className="text-[10px] text-primary font-medium truncate max-w-full">
                        {pick.user.displayName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
