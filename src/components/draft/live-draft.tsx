"use client";

import { useState } from "react";
import Image from "next/image";
import { ActivePickPanel } from "./active-pick-panel";
import { TeamBoard } from "./team-board";
import { DraftLogPanel } from "./draft-log-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { UseDraftStateResult } from "@/hooks/use-draft-state";
import type { NhlTeam } from "@/types";

interface Props {
  draft: UseDraftStateResult;
  userId: string;
}

export function LiveDraft({ draft, userId }: Props) {
  const { state, isMyTurn } = draft;
  const [pendingTeam, setPendingTeam] = useState<NhlTeam | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleTeamClick(teamId: string) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return;
    setPendingTeam(team);
  }

  async function confirmPick() {
    if (!pendingTeam) return;
    setSubmitting(true);
    const res = await fetch(`/api/groups/${state.groupId}/draft/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: pendingTeam.id }),
    });
    setSubmitting(false);

    if (res.ok) {
      setPendingTeam(null);
      // Refetch immediately so the picker sees their own pick instantly,
      // even before the broadcast lands.
      await draft.refetch();
      return;
    }

    const data = await res.json().catch(() => ({}));
    const code = data.error;
    // PICK_RACE_LOST is silent — auto-pick already advanced; just refresh state.
    if (code === "PICK_RACE_LOST") {
      setPendingTeam(null);
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
    setPendingTeam(null);
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
            onPick={handleTeamClick}
          />
        </div>
        <div>
          <DraftLogPanel picks={state.picks} />
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={!!pendingTeam}
        onOpenChange={(open) => {
          if (!open && !submitting) setPendingTeam(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Pick</DialogTitle>
            <DialogDescription>
              You can&apos;t undo this once submitted.
            </DialogDescription>
          </DialogHeader>

          {pendingTeam && (
            <div className="flex items-center gap-4 py-3">
              <div className="relative w-16 h-16 shrink-0">
                <Image
                  src={pendingTeam.darkLogoUrl || pendingTeam.logoUrl}
                  alt={pendingTeam.abbreviation}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div>
                <p className="text-lg font-semibold">{pendingTeam.name}</p>
                <p className="text-sm text-muted-foreground">
                  {pendingTeam.conference} Conference · #{pendingTeam.seed} seed
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingTeam(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={confirmPick} disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm Pick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
