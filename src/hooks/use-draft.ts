"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PickWithTeam, GroupMemberWithUser, NhlTeam } from "@/types";

export interface DraftPickEvent {
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  teamLogo: string;
  pickNumber: number;
  round: number;
  nextUserId?: string;
  nextPickNumber?: number;
  isAutoPick?: boolean;
}

interface UseDraftOptions {
  groupId: string;
  userId: string;
  initialPicks: PickWithTeam[];
  members: GroupMemberWithUser[];
  teams: NhlTeam[];
  pickTimerSeconds: number;
  draftStatus: string;
}

export function useDraft({
  groupId,
  userId,
  initialPicks,
  members,
  teams,
  pickTimerSeconds,
  draftStatus: initialDraftStatus,
}: UseDraftOptions) {
  const [picks, setPicks] = useState<DraftPickEvent[]>(
    initialPicks.map((p) => ({
      userId: p.userId,
      userName: p.user.displayName,
      teamId: p.teamId,
      teamName: p.team.name,
      teamAbbrev: p.team.abbreviation,
      teamLogo: p.team.logoUrl,
      pickNumber: p.draftPosition,
      round: p.draftRound,
    }))
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPickNumber, setCurrentPickNumber] = useState(
    initialPicks.length + 1
  );
  const [draftStatus, setDraftStatus] = useState(initialDraftStatus);
  const [timeLeft, setTimeLeft] = useState(pickTimerSeconds);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPickRef = useRef<NodeJS.Timeout | null>(null);

  // Compute initial current user from picks
  useEffect(() => {
    if (draftStatus !== "IN_PROGRESS") return;
    if (initialPicks.length < 16) {
      // Compute who picks next based on snake draft
      const totalMembers = members.length;
      const pickNum = initialPicks.length + 1;
      const zeroIdx = pickNum - 1;
      const round = Math.floor(zeroIdx / totalMembers) + 1;
      const posInRound = zeroIdx % totalMembers;
      const isForward = round % 2 === 1;
      const draftPos = isForward ? posInRound + 1 : totalMembers - posInRound;
      const member = members.find((m) => m.draftPosition === draftPos);
      if (member) {
        setCurrentUserId(member.userId);
      }
    }
  }, [draftStatus, initialPicks.length, members]);

  // Timer
  useEffect(() => {
    if (draftStatus !== "IN_PROGRESS" || !currentUserId) return;

    setTimeLeft(pickTimerSeconds);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — auto-pick if it's the current user
          if (currentUserId === userId) {
            handleAutoPick();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentUserId, draftStatus, pickTimerSeconds]);

  // Supabase realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`draft:${groupId}`);

    channel
      .on("broadcast", { event: "pick_made" }, ({ payload }) => {
        const pick = payload as DraftPickEvent;
        setPicks((prev) => [...prev, pick]);
        setCurrentUserId(pick.nextUserId || null);
        setCurrentPickNumber(pick.nextPickNumber || picks.length + 2);
        setTimeLeft(pickTimerSeconds);
      })
      .on("broadcast", { event: "draft_started" }, ({ payload }) => {
        setDraftStatus("IN_PROGRESS");
        setCurrentUserId(payload.firstUserId);
        setTimeLeft(payload.pickTimerSeconds || pickTimerSeconds);
      })
      .on("broadcast", { event: "draft_completed" }, ({ payload }) => {
        if (payload.lastPick) {
          setPicks((prev) => [...prev, payload.lastPick]);
        }
        setDraftStatus("COMPLETED");
        setCurrentUserId(null);
        if (timerRef.current) clearInterval(timerRef.current);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, pickTimerSeconds]);

  const pickedTeamIds = new Set(picks.map((p) => p.teamId));
  const availableTeams = teams.filter((t) => !pickedTeamIds.has(t.id));
  const isMyTurn = currentUserId === userId && draftStatus === "IN_PROGRESS";

  const makePick = useCallback(
    async (teamId: string) => {
      const res = await fetch(`/api/groups/${groupId}/draft/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to make pick");
      }

      return res.json();
    },
    [groupId]
  );

  const handleAutoPick = useCallback(async () => {
    try {
      await fetch(`/api/groups/${groupId}/draft/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAutoPick: true }),
      });
    } catch (e) {
      console.error("Auto-pick failed:", e);
    }
  }, [groupId]);

  return {
    picks,
    currentUserId,
    currentPickNumber,
    draftStatus,
    timeLeft,
    availableTeams,
    pickedTeamIds,
    isMyTurn,
    makePick,
    members,
  };
}
