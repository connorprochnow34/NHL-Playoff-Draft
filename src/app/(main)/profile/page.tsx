"use client";

import { useState, useEffect } from "react";
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

export default function ProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/callback")
      .then(() => {
        // Load profile from the page itself since we're in the main layout
      })
      .catch(console.error);

    // Fetch current profile
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.displayName) setDisplayName(data.displayName);
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, avatarUrl: avatarUrl || null }),
    });

    if (res.ok) {
      toast.success("Profile updated");
      router.refresh();
    } else {
      toast.error("Failed to update profile");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your display name and avatar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
              <Input
                id="avatarUrl"
                type="url"
                placeholder="https://..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
