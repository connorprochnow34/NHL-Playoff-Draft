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

  const isCommissioner = group.commissionerId === user.id;
  const isDraftReady =
    group.draftStatus === "PENDING" || group.draftStatus === "SCHEDULED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">
            Commissioner: {group.commissioner.displayName}
          </p>
        </div>
        <div className="flex gap-2">
          {isCommissioner && (
            <Link
              href={`/groups/${groupId}/settings`}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground h-8 px-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Settings
            </Link>
          )}
          {(group.draftStatus === "SCHEDULED" ||
            group.draftStatus === "IN_PROGRESS") && (
            <Link
              href={`/groups/${groupId}/draft`}
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors"
            >
              {group.draftStatus === "IN_PROGRESS"
                ? "Join Draft"
                : "Draft Room"}
            </Link>
          )}
        </div>
      </div>

      {isDraftReady && (
        <>
          <InviteCard inviteCode={group.inviteCode} />

          <Card>
            <CardHeader>
              <CardTitle>Members ({group.members.length})</CardTitle>
              <CardDescription>
                {isCommissioner
                  ? "Configure the draft in Settings when everyone has joined."
                  : "Waiting for the commissioner to start the draft."}
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
          <Standings group={group} />
          <Separator />
          <SeriesFeed points={group.points} />
        </>
      )}
    </div>
  );
}
