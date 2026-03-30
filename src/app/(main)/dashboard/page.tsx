import Link from "next/link";
import { redirect } from "next/navigation";
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
import { JoinCodeInput } from "@/components/groups/join-code-input";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          commissioner: true,
          members: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const draftStatusColors: Record<string, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    SCHEDULED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    IN_PROGRESS: "bg-green-500/10 text-green-500 border-green-500/20",
    COMPLETED: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Groups</h1>
          <p className="text-muted-foreground">
            Your playoff draft groups
          </p>
        </div>
        <Link href="/groups/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors">
          Create Group
        </Link>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a group to start your playoff draft, or join one with an
              invite code.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/groups/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/80 transition-colors">
                Create Group
              </Link>
              <JoinCodeInput />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {memberships.map(({ group }) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={draftStatusColors[group.draftStatus]}
                      >
                        {group.draftStatus.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardDescription>
                      Commissioner: {group.commissioner.displayName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {group.members.length} member
                      {group.members.length !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Join another group:
                </p>
                <JoinCodeInput />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
