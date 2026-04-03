"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ChirpCardProps {
  chirp: {
    text: string;
    generatedAt: string;
  } | null;
}

export function ChirpCard({ chirp }: ChirpCardProps) {
  const [copied, setCopied] = useState(false);

  if (!chirp) return null;

  const isToday = new Date(chirp.generatedAt).toDateString() === new Date().toDateString();
  const dateLabel = isToday
    ? "Today"
    : new Date(chirp.generatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

  function handleShare() {
    navigator.clipboard.writeText(chirp!.text);
    setCopied(true);
    toast.success("Chirp copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Chirp of the Day
          </CardTitle>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-base leading-relaxed mb-3">{chirp.text}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="text-xs"
        >
          {copied ? "Copied!" : "Share"}
        </Button>
      </CardContent>
    </Card>
  );
}
