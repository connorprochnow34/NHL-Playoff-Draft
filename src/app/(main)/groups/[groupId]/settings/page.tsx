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
  const [maxPlayers, setMaxPlayers] = useState("");
  const [pickTimer, setPickTimer] = useState(60);
  const [chirpTone, setChirpTone] = useState(3);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generatingChirp, setGeneratingChirp] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then((res) => res.json())
      .then((data) => {
        setGroup(data);
        setName(data.name);
        setDraftNotes(data.draftNotes || "");
        setPickTimer(data.pickTimerSeconds);
        setChirpTone(data.chirpTone || 3);
        setMaxPlayers(data.maxPlayers ? String(data.maxPlayers) : "");
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
        chirpTone,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setGroup(data);
      toast.success("Settings saved");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to save settings");
    }
    setSaving(false);
  }

  async function handleLock() {
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });

    if (res.ok) {
      const data = await res.json();
      setGroup(data);
      toast.success("Group locked! Draft order randomized.");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to lock group");
    }
    setSaving(false);
  }

  async function handleUnlock() {
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });

    if (res.ok) {
      const data = await res.json();
      setGroup(data);
      toast.success("Group unlocked. Invites are open again.");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to unlock group");
    }
    setSaving(false);
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
      // Refresh to get updated state (may have auto-unlocked)
      const groupRes = await fetch(`/api/groups/${groupId}`);
      if (groupRes.ok) {
        setGroup(await groupRes.json());
      }
      router.refresh();
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

  const isDraftStarted =
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
              disabled={isDraftStarted}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {!isDraftStarted && (
        <Card>
          <CardHeader>
            <CardTitle>Draft Setup</CardTitle>
            <CardDescription>
              Configure draft settings before starting.
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
              <Label>
                Max Players{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                type="number"
                min={2}
                max={16}
                placeholder="No limit"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Group auto-locks when this many players join. Leave blank for no limit.
              </p>
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
              {group.draftStatus === "OPEN" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLock}
                  disabled={saving || group.members.length < 2}
                >
                  {saving ? "Locking..." : "Lock Group & Randomize Draft Order"}
                </Button>
              )}

              {group.draftStatus === "LOCKED" && (
                <>
                  {group.members.some((m) => m.draftPosition) && (
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Draft Order:</p>
                      {group.members
                        .filter((m) => m.draftPosition)
                        .sort(
                          (a, b) =>
                            (a.draftPosition || 0) - (b.draftPosition || 0)
                        )
                        .map((m) => (
                          <p key={m.id} className="text-muted-foreground">
                            {m.draftPosition}. {m.user.displayName}
                          </p>
                        ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleUnlock}
                    disabled={saving}
                  >
                    {saving ? "Unlocking..." : "Unlock Group"}
                  </Button>

                  <Button
                    className="w-full"
                    onClick={handleStartDraft}
                    disabled={group.members.length < 2}
                  >
                    Start Draft Now
                  </Button>
                </>
              )}

              {group.members.length < 2 && (
                <p className="text-xs text-muted-foreground text-center">
                  Need at least 2 members to lock the group.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Members ({group.members.length}
            {group.maxPlayers ? ` of ${group.maxPlayers}` : ""})
          </CardTitle>
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
                {!isDraftStarted &&
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
          <CardTitle>Chirp of the Day</CardTitle>
          <CardDescription>
            AI-generated daily trash talk for the group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Chirp Tone: {chirpTone}</Label>
            <Input
              type="range"
              min={1}
              max={5}
              step={1}
              value={chirpTone}
              onChange={(e) => setChirpTone(Number(e.target.value))}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>Family friendly</span>
              <span>Playground</span>
              <span>Friend group</span>
              <span>No mercy</span>
              <span>Unfiltered</span>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Tone"}
          </Button>
          <Separator />
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              setGeneratingChirp(true);
              const res = await fetch("/api/chirp/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupId }),
              });
              if (res.ok) {
                const data = await res.json();
                toast.success(data.message || "Chirp generated!");
              } else {
                toast.error("Failed to generate chirp");
              }
              setGeneratingChirp(false);
            }}
            disabled={generatingChirp}
          >
            {generatingChirp ? "Generating..." : "Generate Today's Chirp"}
          </Button>
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
