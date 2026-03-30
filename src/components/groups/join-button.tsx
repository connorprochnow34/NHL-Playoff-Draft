"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function JoinButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
    });

    if (res.ok) {
      toast.success("Joined the group!");
      router.push(`/groups/${groupId}`);
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to join group");
    }
    setLoading(false);
  }

  return (
    <Button onClick={handleJoin} className="w-full" disabled={loading}>
      {loading ? "Joining..." : "Join Group"}
    </Button>
  );
}
