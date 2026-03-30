"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export function InviteCard({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Code copied!");
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Invite Code</p>
            <button
              onClick={copyCode}
              className="text-2xl font-mono font-bold tracking-[0.3em] text-primary hover:text-primary/80 transition-colors"
            >
              {inviteCode}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
