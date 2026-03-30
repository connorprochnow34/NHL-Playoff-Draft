"use client";

import { cn } from "@/lib/utils";

interface PickTimerProps {
  timeLeft: number;
  isMyTurn: boolean;
  currentUserName: string | undefined;
}

export function PickTimer({
  timeLeft,
  isMyTurn,
  currentUserName,
}: PickTimerProps) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft <= 10;

  return (
    <div
      className={cn(
        "text-center p-4 rounded-lg border",
        isMyTurn
          ? "border-primary bg-primary/10"
          : "border-border bg-card"
      )}
    >
      <p className="text-sm text-muted-foreground mb-1">
        {isMyTurn ? "Your pick!" : `${currentUserName}'s pick`}
      </p>
      <p
        className={cn(
          "text-3xl font-mono font-bold",
          isLow ? "text-destructive animate-pulse" : "text-foreground"
        )}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </p>
    </div>
  );
}
