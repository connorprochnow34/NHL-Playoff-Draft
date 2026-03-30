"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { NhlTeam } from "@/types";
import type { DraftPickEvent } from "@/hooks/use-draft";

interface TeamBoardProps {
  teams: NhlTeam[];
  picks: DraftPickEvent[];
  pickedTeamIds: Set<string>;
  isMyTurn: boolean;
  onPick: (teamId: string) => void;
}

export function TeamBoard({
  teams,
  picks,
  pickedTeamIds,
  isMyTurn,
  onPick,
}: TeamBoardProps) {
  // Sort teams by conference then seed
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.conference !== b.conference) return a.conference.localeCompare(b.conference);
    return (a.seed || 99) - (b.seed || 99);
  });

  const eastern = sortedTeams.filter((t) => t.conference === "Eastern");
  const western = sortedTeams.filter((t) => t.conference === "Western");

  return (
    <div className="space-y-4">
      <ConferenceSection
        title="Eastern Conference"
        teams={eastern}
        picks={picks}
        pickedTeamIds={pickedTeamIds}
        isMyTurn={isMyTurn}
        onPick={onPick}
      />
      <ConferenceSection
        title="Western Conference"
        teams={western}
        picks={picks}
        pickedTeamIds={pickedTeamIds}
        isMyTurn={isMyTurn}
        onPick={onPick}
      />
    </div>
  );
}

function ConferenceSection({
  title,
  teams,
  picks,
  pickedTeamIds,
  isMyTurn,
  onPick,
}: {
  title: string;
  teams: NhlTeam[];
  picks: DraftPickEvent[];
  pickedTeamIds: Set<string>;
  isMyTurn: boolean;
  onPick: (teamId: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {teams.map((team) => {
          const isPicked = pickedTeamIds.has(team.id);
          const pickedBy = picks.find((p) => p.teamId === team.id);

          return (
            <button
              key={team.id}
              onClick={() => isMyTurn && !isPicked && onPick(team.id)}
              disabled={isPicked || !isMyTurn}
              className={cn(
                "relative flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                isPicked
                  ? "opacity-40 border-border bg-muted cursor-not-allowed"
                  : isMyTurn
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary cursor-pointer"
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
              <span className="text-xs font-medium">{team.abbreviation}</span>
              {team.seed && (
                <span className="text-[10px] text-muted-foreground">
                  #{team.seed} seed
                </span>
              )}
              {pickedBy && (
                <span className="text-[10px] text-primary font-medium truncate max-w-full">
                  {pickedBy.userName}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
