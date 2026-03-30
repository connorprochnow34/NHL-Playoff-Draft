"use client";

import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DraftPickEvent } from "@/hooks/use-draft";

interface DraftLogProps {
  picks: DraftPickEvent[];
}

export function DraftLog({ picks }: DraftLogProps) {
  return (
    <div className="border rounded-lg">
      <div className="p-3 border-b">
        <h3 className="font-medium text-sm">Draft Log</h3>
      </div>
      <ScrollArea className="h-64 sm:h-96">
        <div className="p-2 space-y-1">
          {picks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Waiting for first pick...
            </p>
          ) : (
            [...picks].reverse().map((pick, i) => (
              <div
                key={`${pick.pickNumber}-${i}`}
                className="flex items-center gap-2 p-2 rounded text-sm hover:bg-muted/50"
              >
                <span className="text-xs text-muted-foreground w-6 shrink-0">
                  #{pick.pickNumber}
                </span>
                <div className="relative w-5 h-5 shrink-0">
                  <Image
                    src={pick.teamLogo}
                    alt={pick.teamAbbrev}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="truncate">
                  <span className="font-medium">{pick.userName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    picked {pick.teamName}
                  </span>
                  {pick.isAutoPick && (
                    <span className="text-xs text-yellow-500 ml-1">
                      (auto)
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
