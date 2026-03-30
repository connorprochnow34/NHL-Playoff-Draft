"use client";

import { useDraft } from "@/hooks/use-draft";
import { TeamBoard } from "./team-board";
import { PickTimer } from "./pick-timer";
import { DraftLog } from "./draft-log";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PickWithTeam, GroupMemberWithUser, NhlTeam } from "@/types";

interface DraftRoomProps {
  groupId: string;
  userId: string;
  initialPicks: PickWithTeam[];
  members: GroupMemberWithUser[];
  teams: NhlTeam[];
  pickTimerSeconds: number;
  draftStatus: string;
}

export function DraftRoom({
  groupId,
  userId,
  initialPicks,
  members,
  teams,
  pickTimerSeconds,
  draftStatus: initialStatus,
}: DraftRoomProps) {
  const {
    picks,
    currentUserId,
    currentPickNumber,
    draftStatus,
    timeLeft,
    availableTeams,
    pickedTeamIds,
    isMyTurn,
    makePick,
  } = useDraft({
    groupId,
    userId,
    initialPicks,
    members,
    teams,
    pickTimerSeconds,
    draftStatus: initialStatus,
  });

  const currentMember = members.find((m) => m.userId === currentUserId);

  async function handlePick(teamId: string) {
    try {
      await makePick(teamId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to make pick");
    }
  }

  if (draftStatus === "COMPLETED") {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-2">Draft Complete!</h2>
          <p className="text-muted-foreground">
            All teams have been drafted. Head to the group home to see the
            leaderboard.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {picks
                .filter((p) => p.userId === userId)
                .map((p) => (
                  <div
                    key={p.teamId}
                    className="flex items-center gap-2 p-2 rounded bg-muted"
                  >
                    <span className="text-sm font-medium">{p.teamName}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <DraftLog picks={picks} />
      </div>
    );
  }

  if (draftStatus !== "IN_PROGRESS") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="text-lg font-medium mb-2">Draft Not Started</h3>
          <p className="text-muted-foreground">
            Waiting for the commissioner to start the draft.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Draft Room</h2>
          <p className="text-sm text-muted-foreground">
            Pick {currentPickNumber} of 16 &middot; Round{" "}
            {Math.ceil(currentPickNumber / members.length)}
          </p>
        </div>
        <Badge variant={isMyTurn ? "default" : "outline"}>
          {availableTeams.length} teams left
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PickTimer
            timeLeft={timeLeft}
            isMyTurn={isMyTurn}
            currentUserName={currentMember?.user.displayName}
          />

          <TeamBoard
            teams={teams}
            picks={picks}
            pickedTeamIds={pickedTeamIds}
            isMyTurn={isMyTurn}
            onPick={handlePick}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {members
                  .filter((m) => m.draftPosition)
                  .sort(
                    (a, b) =>
                      (a.draftPosition || 0) - (b.draftPosition || 0)
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
                        m.userId === currentUserId
                          ? "bg-primary/10 text-primary font-medium"
                          : ""
                      }`}
                    >
                      <span>
                        {m.draftPosition}. {m.user.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {picks.filter((p) => p.userId === m.userId).length}{" "}
                        teams
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <DraftLog picks={picks} />
        </div>
      </div>
    </div>
  );
}
