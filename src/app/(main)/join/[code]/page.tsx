import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinButton } from "@/components/groups/join-button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/join/${code}`);
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: code.toUpperCase() },
    include: {
      commissioner: true,
      members: { include: { user: true } },
    },
  });

  if (!group) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Invalid invite code</h3>
            <p className="text-muted-foreground">
              The code &quot;{code}&quot; doesn&apos;t match any group. Check
              with whoever shared the link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMember = group.members.some((m) => m.userId === user.id);

  if (isMember) {
    redirect(`/groups/${group.id}`);
  }

  if (group.draftStatus === "COMPLETED") {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Draft completed</h3>
            <p className="text-muted-foreground">
              This group&apos;s draft is already finished. Membership is locked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Join {group.name}?</CardTitle>
          <CardDescription>
            Hosted by {group.commissioner.displayName} &middot;{" "}
            {group.members.length} member{group.members.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Members:</p>
            <ul className="mt-1 space-y-1">
              {group.members.map((m) => (
                <li key={m.id}>{m.user.displayName}</li>
              ))}
            </ul>
          </div>
          <JoinButton groupId={group.id} />
        </CardContent>
      </Card>
    </div>
  );
}
