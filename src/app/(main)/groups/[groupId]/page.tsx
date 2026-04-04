import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Standings } from "@/components/leaderboard/standings";
import { SeriesFeed } from "@/components/leaderboard/series-feed";
import { InviteCard } from "@/components/groups/invite-card";
import { ChirpCard } from "@/components/groups/chirp-card";
import { DraftTime } from "@/components/groups/draft-time";
import {
  LockButton,
  UnlockButton,
  StartDraftButton,
} from "@/components/groups/group-actions";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });

  if (!membership) notFound();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      commissioner: true,
      members: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
      picks: {
        include: { team: true, user: true },
        orderBy: { createdAt: "asc" },
      },
      points: {
        include: {
          user: true,
          team: true,
          series: {
            include: { homeTeam: true, awayTeam: true, winner: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) notFound();

  // Get the latest chirp
  const latestChirp = await prisma.chirp.findFirst({
    where: { groupId },
    orderBy: { generatedAt: "desc" },
  });

  const isCommissioner = group.commissionerId === user.id;
  const isPreDraft =
    group.draftStatus === "OPEN" || group.draftStatus === "LOCKED";

  const draftStatusLabels: Record<string, string> = {
    OPEN: "Open",
    LOCKED: "Locked",
    IN_PROGRESS: "Draft in progress",
    COMPLETED: "Completed",
  };

  const draftStatusColors: Record<string, string> = {
    OPEN: "text-green-500 border-green-500/30",
    LOCKED: "text-blue-500 border-blue-500/30",
    IN_PROGRESS: "text-yellow-500 border-yellow-500/30",
    COMPLETED: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">
            Commissioner: {group.commissioner.displayName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={draftStatusColors[group.draftStatus]}
          >
            {draftStatusLabels[group.draftStatus]}
          </Badge>
          {isCommissioner && isPreDraft && (
            <Link
              href={`/groups/${groupId}/settings`}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground h-8 px-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Settings
            </Link>
          )}
          {group.draftStatus === "IN_PROGRESS" && (
            <Link
              href={`/groups/${groupId}/draft`}
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors"
            >
              Join Draft
            </Link>
          )}
        </div>
      </div>

      {isPreDraft && (
        <>
          {/* Draft time */}
          {group.draftScheduledAt && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Draft:</span>
              <DraftTime iso={group.draftScheduledAt.toISOString()} />
            </div>
          )}

          {/* Invite card - only when OPEN */}
          {group.draftStatus === "OPEN" && (
            <InviteCard inviteCode={group.inviteCode} />
          )}

          {/* Commissioner actions */}
          {isCommissioner && (
            <div className="flex items-center gap-2">
              {group.draftStatus === "OPEN" && (
                <LockButton
                  groupId={groupId}
                  memberCount={group.members.length}
                />
              )}
              {group.draftStatus === "LOCKED" && (
                <>
                  <UnlockButton groupId={groupId} />
                  <StartDraftButton groupId={groupId} />
                </>
              )}
            </div>
          )}

          {/* Locked state info */}
          {group.draftStatus === "LOCKED" && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm text-muted-foreground">
                  Group is locked. Draft order has been randomized.
                  {isCommissioner
                    ? " You can start the draft or unlock to re-open invites."
                    : " Waiting for the commissioner to start the draft."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle>
                Members ({group.members.length}
                {group.maxPlayers ? ` of ${group.maxPlayers}` : ""})
              </CardTitle>
              <CardDescription>
                {group.draftStatus === "OPEN"
                  ? isCommissioner
                    ? "Lock the group when everyone has joined to randomize draft order."
                    : "Waiting for more members to join."
                  : "Draft order is set."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {group.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span>{m.user.displayName}</span>
                      {m.userId === group.commissionerId && (
                        <Badge variant="outline" className="text-xs">
                          Commissioner
                        </Badge>
                      )}
                    </div>
                    {m.draftPosition && (
                      <span className="text-sm text-muted-foreground">
                        Pick #{m.draftPosition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {group.draftNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Draft Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {group.draftNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {group.draftStatus === "COMPLETED" && (
        <>
          {latestChirp && (
            <ChirpCard
              chirp={{
                text: latestChirp.text,
                generatedAt: latestChirp.generatedAt.toISOString(),
              }}
            />
          )}
          <Standings group={group} />
          <Separator />
          <SeriesFeed points={group.points} />
        </>
      )}
    </div>
  );
}
