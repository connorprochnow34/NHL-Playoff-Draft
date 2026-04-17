"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { UseDraftStateResult } from "@/hooks/use-draft-state";
import type { useDraftPresence } from "@/hooks/use-draft-presence";

interface Props {
  draft: UseDraftStateResult;
  presence: ReturnType<typeof useDraftPresence>;
  userId: string;
  locked?: boolean; // when true (during COUNTDOWN), disable controls
}

export function WaitingRoom({ draft, presence, userId, locked }: Props) {
  const { state } = draft;
  const { presentMembers, myReady, toggleReady } = presence;
  const isCommissioner = state.commissionerId === userId;
  const [pickDuration, setPickDuration] = useState(state.pickTimerSeconds);
  const [starting, setStarting] = useState(false);
  const [savingTimer, setSavingTimer] = useState(false);

  async function handleStart() {
    if (locked) return;
    setStarting(true);
    const res = await fetch(`/api/groups/${state.groupId}/draft/start`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to start draft");
    }
    setStarting(false);
  }

  async function handleSaveTimer(value: number) {
    setPickDuration(value);
    setSavingTimer(true);
    await fetch(`/api/groups/${state.groupId}/draft/timer-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pick_duration_seconds: value }),
    });
    setSavingTimer(false);
    draft.refetch();
  }

  const ds = state.draftState;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{state.groupName}</h1>
        <p className="text-muted-foreground text-sm">
          Waiting room — {locked ? "draft starting…" : "ready when you are"}
        </p>
      </div>

      {/* Presence + draft order */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({state.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {state.members
              .filter((m) => m.draftPosition)
              .sort((a, b) => (a.draftPosition || 0) - (b.draftPosition || 0))
              .map((m) => {
                const isPresent = presentMembers.has(m.userId);
                const isReady = presentMembers.get(m.userId)?.ready ?? false;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg border ${
                      isPresent ? "border-border" : "border-border/50 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-6">
                        #{m.draftPosition}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isPresent ? "bg-green-500" : "bg-muted"
                          }`}
                          aria-label={isPresent ? "online" : "offline"}
                        />
                        <span className="font-medium">{m.user.displayName}</span>
                        {m.userId === state.commissionerId && (
                          <Badge variant="outline" className="text-[10px]">
                            Commissioner
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isPresent && isReady && (
                      <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">
                        Ready
                      </Badge>
                    )}
                  </div>
                );
              })}
          </div>

          {!locked && (
            <Button
              variant={myReady ? "outline" : "default"}
              className="mt-4 w-full"
              onClick={toggleReady}
            >
              {myReady ? "I'm not ready" : "I'm ready"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Commissioner controls */}
      {isCommissioner && !locked && (
        <Card>
          <CardHeader>
            <CardTitle>Commissioner Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Pick Timer</p>
              <div className="flex gap-2">
                {[60, 90, 120].map((seconds) => (
                  <Button
                    key={seconds}
                    variant={pickDuration === seconds ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSaveTimer(seconds)}
                    disabled={savingTimer}
                  >
                    {seconds}s
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? "Starting..." : "Start Draft Now"}
            </Button>
            <p className="text-xs text-muted-foreground">
              You can start the draft any time. Members don&apos;t need to be
              present or ready.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bracket preview */}
      <Card>
        <CardHeader>
          <CardTitle>Playoff Bracket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {(["Eastern", "Western"] as const).map((conf) => (
              <div key={conf}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {conf} Conference
                </h3>
                <div className="space-y-1">
                  {state.teams
                    .filter((t) => t.conference === conf)
                    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
                    .map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center gap-2 py-1 text-sm"
                      >
                        <span className="text-muted-foreground w-4 text-xs">
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
          {ds && (
            <p className="text-xs text-muted-foreground mt-4">
              {ds.teams_per_member} teams per member · {ds.total_picks} total
              picks
              {16 - ds.total_picks > 0
                ? ` · ${16 - ds.total_picks} undrafted`
                : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
