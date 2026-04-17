"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PresenceMember {
  userId: string;
  ready: boolean;
  joinedAt: string;
}

/**
 * Tracks which members are currently in the waiting room and their ready
 * state via Supabase presence. State is ephemeral (does not persist across
 * disconnects), which is exactly what we want for "who's currently here".
 */
export function useDraftPresence(groupId: string, userId: string) {
  const [presentMembers, setPresentMembers] = useState<Map<string, PresenceMember>>(
    new Map()
  );
  const [myReady, setMyReady] = useState(false);
  const [channel, setChannel] = useState<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`draft-presence:${groupId}`, {
      config: { presence: { key: userId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const newState = ch.presenceState() as Record<string, PresenceMember[]>;
      const map = new Map<string, PresenceMember>();
      for (const [, entries] of Object.entries(newState)) {
        for (const entry of entries) {
          map.set(entry.userId, entry);
        }
      }
      setPresentMembers(map);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          userId,
          ready: false,
          joinedAt: new Date().toISOString(),
        });
        setChannel(ch);
      }
    });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId, userId]);

  const toggleReady = useCallback(async () => {
    const next = !myReady;
    setMyReady(next);
    if (channel) {
      await channel.track({
        userId,
        ready: next,
        joinedAt: new Date().toISOString(),
      });
    }
  }, [channel, myReady, userId]);

  return { presentMembers, myReady, toggleReady };
}
