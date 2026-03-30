import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Get or create user profile
  let user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user) {
    // Create user from auth metadata
    const displayName =
      authUser.user_metadata?.display_name ||
      authUser.email?.split("@")[0] ||
      "Player";

    user = await prisma.user.create({
      data: {
        id: authUser.id,
        email: authUser.email!,
        displayName,
      },
    });
  }

  // If user has no display name set, redirect to profile setup
  if (!user.displayName || user.displayName === user.email?.split("@")[0]) {
    // Allow profile page access
  }

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
