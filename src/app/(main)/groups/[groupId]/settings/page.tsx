"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { GroupWithMembers } from "@/types";

export default function GroupSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [name, setName] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [pickTimer, setPickTimer] = useState(60);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then((res) => res.json())
      .then((data) => {
        setGroup(data);
        setName(data.name);
        setDraftNotes(data.draftNotes || "");
        setPickTimer(data.pickTimerSeconds);
        if (data.draftScheduledAt) {
          setDraftDate(
            new Date(data.draftScheduledAt).toISOString().slice(0, 16)
          );
        }
      });
  }, [groupId]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        draftScheduledAt: draftDate || null,
        draftNotes: draftNotes || null,
        pickTimerSeconds: pickTimer,
      }),
    });

    if (res.ok) {
      toast.success("Settings saved");
      router.refresh();
    } else {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  }

  async function handleRandomize() {
    const res = await fetch(`/api/groups/${groupId}/draft/randomize`, {
      method: "POST",
    });

    if (res.ok) {
      toast.success("Draft order randomized!");
      const data = await res.json();
      setGroup(data);
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to randomize");
    }
  }

  async function handleStartDraft() {
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
  }

  async function handleSync() {
    setSyncing(true);
    const res = await fetch("/api/nhl/sync", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Synced: ${data.message}`);
    } else {
      toast.error("Sync failed");
    }
    setSyncing(false);
  }

  async function handleRemoveMember(userId: string) {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      toast.success("Member removed");
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((m) => m.userId !== userId),
            }
          : null
      );
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to remove member");
    }
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto mt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-6">
              <div className="h-20 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isDraftLocked =
    group.draftStatus === "IN_PROGRESS" || group.draftStatus === "COMPLETED";

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <h1 className="text-2xl font-bold">Group Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDraftLocked}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {!isDraftLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Draft Setup</CardTitle>
            <CardDescription>
              Configure draft settings before starting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Draft Date & Time</Label>
              <Input
                type="datetime-local"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Draft Notes</Label>
              <Textarea
                placeholder="e.g. Be on at 8pm, we go fast, no pausing"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pick Timer (seconds): {pickTimer}s</Label>
              <Input
                type="range"
                min={30}
                max={120}
                step={10}
                value={pickTimer}
                onChange={(e) => setPickTimer(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Draft Settings"}
            </Button>

            <Separator />

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRandomize}
                disabled={group.members.length < 2}
              >
                Randomize Draft Order
              </Button>

              {group.members.some((m) => m.draftPosition) && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Draft Order:</p>
                  {group.members
                    .filter((m) => m.draftPosition)
                    .sort((a, b) => (a.draftPosition || 0) - (b.draftPosition || 0))
                    .map((m) => (
                      <p key={m.id} className="text-muted-foreground">
                        {m.draftPosition}. {m.user.displayName}
                      </p>
                    ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleStartDraft}
                disabled={
                  !group.members.some((m) => m.draftPosition) ||
                  group.members.length < 2
                }
              >
                Start Draft Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members ({group.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {group.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-2"
              >
                <span>
                  {m.user.displayName}
                  {m.userId === group.commissionerId && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Commissioner)
                    </span>
                  )}
                </span>
                {!isDraftLocked &&
                  m.userId !== group.commissionerId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(m.userId)}
                    >
                      Remove
                    </Button>
                  )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NHL Data</CardTitle>
          <CardDescription>
            Sync playoff data from the NHL API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
