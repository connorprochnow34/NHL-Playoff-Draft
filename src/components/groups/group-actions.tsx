"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export function LockButton({
  groupId,
  memberCount,
}: {
  groupId: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLock() {
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });

    if (res.ok) {
      toast.success("Group locked! Draft order has been randomized.");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to lock group");
    }
    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLock}
      disabled={loading || memberCount < 2}
    >
      {loading ? "Locking..." : "Lock Group"}
    </Button>
  );
}

export function UnlockButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });

    if (res.ok) {
      toast.success("Group unlocked. Invites are open again.");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to unlock group");
    }
    setLoading(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleUnlock} disabled={loading}>
      {loading ? "Unlocking..." : "Unlock Group"}
    </Button>
  );
}

export function StartDraftButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/draft/start`, {
      method: "POST",
    });

    if (res.ok) {
      toast.success("Draft started!");
      router.push(`/groups/${groupId}/draft`);
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to start draft");
    }
    setLoading(false);
  }

  return (
    <Button onClick={handleStart} disabled={loading} size="sm">
      {loading ? "Starting..." : "Start Draft"}
    </Button>
  );
}
