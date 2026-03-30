import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            NHL Playoff
            <span className="text-primary"> Draft</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Draft playoff teams with your friends. Earn points as your teams
            advance. Bragging rights all summer.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-6 text-base font-medium hover:bg-primary/80 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground h-10 px-6 text-base font-medium hover:bg-muted transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border max-w-lg mx-auto">
          <div>
            <div className="text-2xl font-bold text-primary">16</div>
            <div className="text-sm text-muted-foreground">Playoff Teams</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">4</div>
            <div className="text-sm text-muted-foreground">Rounds</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">1</div>
            <div className="text-sm text-muted-foreground">Champion</div>
          </div>
        </div>
      </div>
    </div>
  );
}
