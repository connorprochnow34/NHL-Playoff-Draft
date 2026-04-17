"use client";

import { ActivePickPanel } from "./active-pick-panel";
import { TeamBoard } from "./team-board";
import { DraftLogPanel } from "./draft-log-panel";
import { toast } from "sonner";
import type { UseDraftStateResult } from "@/hooks/use-draft-state";

interface Props {
  draft: UseDraftStateResult;
  userId: string;
}

export function LiveDraft({ draft, userId }: Props) {
  const { state, isMyTurn } = draft;

  async function handlePick(teamId: string) {
    const res = await fetch(`/api/groups/${state.groupId}/draft/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const code = data.error;
      // PICK_RACE_LOST is silent — auto-pick already advanced; just refresh state.
      if (code === "PICK_RACE_LOST") {
        await draft.refetch();
        return;
      }
      const messages: Record<string, string> = {
        NOT_YOUR_TURN: "It's not your turn",
        TIMER_EXPIRED: "Time ran out — picking automatically",
        TEAM_ALREADY_PICKED: "That team was just picked by someone else",
        INVALID_TEAM: "Invalid team",
      };
      toast.error(messages[code] || code || "Failed to pick");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{state.groupName}</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {state.draftStatus === "PAUSED" ? "Draft paused" : "Draft live"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ActivePickPanel draft={draft} userId={userId} />
          <TeamBoard
            teams={state.teams}
            picks={state.picks}
            isMyTurn={isMyTurn}
            isDraftLive={state.draftStatus === "LIVE"}
            onPick={handlePick}
          />
        </div>
        <div>
          <DraftLogPanel picks={state.picks} />
        </div>
      </div>
    </div>
  );
}
