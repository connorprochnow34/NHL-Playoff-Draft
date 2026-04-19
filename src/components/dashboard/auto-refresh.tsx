"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Triggers a server-side re-render of the parent server component every
 * `intervalMs` milliseconds. router.refresh() is the Next.js mechanism for
 * refetching server-rendered data without losing client state.
 *
 * Gated on document.visibilityState so hidden tabs don't waste cycles.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  // Also refresh whenever the user comes back to the tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
