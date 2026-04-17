"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ServerTimer } from "./server-timer";
import { toast } from "sonner";
import type { UseDraftStateResult } from "@/hooks/use-draft-state";

interface Props {
  draft: UseDraftStateResult;
  userId: string;
}

export function ActivePickPanel({ draft, userId }: Props) {
  const { state, isMyTurn, remainingMs } = draft;
  const ds = state.draftState;
  const isCommissioner = state.commissionerId === userId;
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);

  const currentMember = state.members.find(
    (m) => m.userId === ds?.current_user_id
  );
  const round = ds
    ? Math.ceil(ds.current_pick_number / state.members.length)
    : 0;

  async function handlePause() {
    setPausing(true);
    const res = await fetch(`/api/groups/${state.groupId}/draft/pause`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to pause");
    }
    setPausing(false);
  }

  async function handleResume() {
    setResuming(true);
    const res = await fetch(`/api/groups/${state.groupId}/draft/resume`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to resume");
    }
    setResuming(false);
  }

  const isPaused = state.draftStatus === "PAUSED";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {isPaused && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-center">
            <p className="font-medium text-yellow-500">
              Draft paused by commissioner
            </p>
            {ds?.paused_remaining_ms != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil(ds.paused_remaining_ms / 1000)}s remained when paused
                · timer will reset on resume
              </p>
            )}
          </div>
        )}

        {ds && (
          <div className="text-center space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Pick {ds.current_pick_number} of {ds.total_picks} · Round {round}
            </p>

            {currentMember && (
              <div className="flex items-center justify-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentMember.user.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    {currentMember.user.displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-semibold">
                    {isMyTurn ? "Your pick!" : `${currentMember.user.displayName}`}
                  </p>
                  {!isMyTurn && (
                    <p className="text-xs text-muted-foreground">
                      Waiting for {currentMember.user.displayName}…
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <ServerTimer
                getRemainingMs={remainingMs}
                frozen={isPaused}
                frozenValueMs={ds.paused_remaining_ms ?? undefined}
              />
            </div>

            {isMyTurn && !isPaused && (
              <p className="text-sm text-primary font-medium pt-1">
                Pick a team from the board →
              </p>
            )}
          </div>
        )}

        {isCommissioner && (
          <div className="pt-2 border-t">
            {isPaused ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResume}
                disabled={resuming}
              >
                {resuming ? "Resuming…" : "Resume Draft"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePause}
                disabled={pausing || state.draftStatus !== "LIVE"}
              >
                {pausing ? "Pausing…" : "Pause Draft"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
