"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinCodeInput() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleJoin() {
    if (code.trim().length === 6) {
      router.push(`/join/${code.trim().toUpperCase()}`);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Invite code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={6}
        className="w-32 uppercase tracking-widest text-center"
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
      />
      <Button variant="outline" onClick={handleJoin} disabled={code.length !== 6}>
        Join
      </Button>
    </div>
  );
}
