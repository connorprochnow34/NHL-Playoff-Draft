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
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Group"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
