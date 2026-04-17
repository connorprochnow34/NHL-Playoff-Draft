"use client";

import { useDraftState, type DraftStateResponse } from "@/hooks/use-draft-state";
import { useDraftPresence } from "@/hooks/use-draft-presence";
import { useAutoPickTrigger } from "@/hooks/use-auto-pick-trigger";
import { WaitingRoom } from "./waiting-room";
import { CountdownOverlay } from "./countdown-overlay";
import { LiveDraft } from "./live-draft";
import { DraftResults } from "./draft-results";

interface Props {
  groupId: string;
  userId: string;
  initialState: DraftStateResponse;
}

export function DraftRoomShell({ groupId, userId, initialState }: Props) {
  const draft = useDraftState(groupId, userId, initialState);
  const presence = useDraftPresence(groupId, userId);
  useAutoPickTrigger(draft);

  const status = draft.state.draftStatus;

  if (status === "WAITING") {
    return <WaitingRoom draft={draft} presence={presence} userId={userId} />;
  }
  if (status === "COUNTDOWN") {
    return (
      <>
        <WaitingRoom draft={draft} presence={presence} userId={userId} locked />
        <CountdownOverlay draft={draft} />
      </>
    );
  }
  if (status === "LIVE" || status === "PAUSED") {
    return <LiveDraft draft={draft} userId={userId} />;
  }
  if (status === "COMPLETED") {
    return <DraftResults draft={draft} />;
  }

  return null;
}
