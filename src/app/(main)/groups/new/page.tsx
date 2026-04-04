"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        draftScheduledAt: draftDate,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
      }),
    });

    if (res.ok) {
      const group = await res.json();
      toast.success("Group created!");
      router.push(`/groups/${group.id}`);
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to create group");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a Group</CardTitle>
          <CardDescription>
            Start a new playoff draft group. You&apos;ll be the commissioner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                placeholder="e.g. Office Bracket Busters"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draftDate">Draft Date & Time</Label>
              <Input
                id="draftDate"
                type="datetime-local"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                When will your group draft? You can change this later.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPlayers">
                Max Players{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="maxPlayers"
                type="number"
                min={2}
                max={16}
                placeholder="e.g. 8"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Group auto-locks and draft order randomizes when full. Leave
                blank for no limit.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Group"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
