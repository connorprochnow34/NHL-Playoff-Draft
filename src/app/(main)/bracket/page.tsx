import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BracketPage() {
  const allSeries = await prisma.series.findMany({
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: [{ round: "asc" }, { seriesLetter: "asc" }],
  });

  const roundNames: Record<number, string> = {
    1: "First Round",
    2: "Second Round",
    3: "Conference Finals",
    4: "Stanley Cup Final",
  };

  // Group round 1 series by conference (A-D = Eastern, E-H = Western)
  const easternLetters = ["A", "B", "C", "D"];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          NHL Playoff Bracket
        </h1>
        <p className="text-muted-foreground">
          2025-26 Stanley Cup Playoffs
        </p>
      </div>

      {allSeries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Playoff bracket data is not yet available. Check back once the
              NHL playoff matchups are set.
            </p>
          </CardContent>
        </Card>
      ) : (
        [1, 2, 3, 4].map((round) => {
          const roundSeries = allSeries.filter((s) => s.round === round);
          if (roundSeries.length === 0) return null;

          // For round 1, split by conference
          const hasConferences =
            round === 1 &&
            roundSeries.some((s) => easternLetters.includes(s.seriesLetter));

          return (
            <div key={round} className="space-y-4">
              <h2 className="text-xl font-bold">{roundNames[round]}</h2>

              {hasConferences ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {["Eastern Conference", "Western Conference"].map((conf) => {
                    const confLetters =
                      conf === "Eastern Conference"
                        ? easternLetters
                        : ["E", "F", "G", "H"];
                    const confSeries = roundSeries.filter((s) =>
                      confLetters.includes(s.seriesLetter)
                    );

                    return (
                      <div key={conf}>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          {conf}
                        </h3>
                        <div className="space-y-3">
                          {confSeries.map((series) => (
                            <SeriesCard key={series.id} series={series} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roundSeries.map((series) => (
                    <SeriesCard key={series.id} series={series} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

type SeriesWithTeams = {
  id: string;
  seriesLetter: string;
  round: number;
  homeSeed: number;
  awaySeed: number;
  homeWins: number;
  awayWins: number;
  status: string;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string;
    darkLogoUrl: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string;
    darkLogoUrl: string | null;
  };
  winner: {
    id: string;
    name: string;
    abbreviation: string;
  } | null;
};

function SeriesCard({ series }: { series: SeriesWithTeams }) {
  const homeWon = series.winner?.id === series.homeTeam.id;
  const awayWon = series.winner?.id === series.awayTeam.id;
  const isLive = series.status === "IN_PROGRESS";
  const isDone = series.status === "COMPLETED";

  return (
    <Card
      className={
        isLive ? "border-green-500/30" : isDone ? "opacity-80" : ""
      }
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Series {series.seriesLetter}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              isDone
                ? "text-muted-foreground"
                : isLive
                ? "text-green-500 border-green-500/30"
                : "text-yellow-500 border-yellow-500/30"
            }`}
          >
            {isDone
              ? `${series.winner?.abbreviation} wins`
              : isLive
              ? "In Progress"
              : "Upcoming"}
          </Badge>
        </div>

        {/* Home team row */}
        <div
          className={`flex items-center justify-between py-1.5 ${
            homeWon ? "font-bold" : awayWon ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-4 text-right">
              {series.homeSeed}
            </span>
            <div className="relative w-6 h-6">
              <Image
                src={series.homeTeam.darkLogoUrl || series.homeTeam.logoUrl}
                alt={series.homeTeam.abbreviation}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="text-sm">{series.homeTeam.name}</span>
          </div>
          <span className="text-lg font-mono font-bold">
            {series.homeWins}
          </span>
        </div>

        {/* Away team row */}
        <div
          className={`flex items-center justify-between py-1.5 ${
            awayWon ? "font-bold" : homeWon ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-4 text-right">
              {series.awaySeed}
            </span>
            <div className="relative w-6 h-6">
              <Image
                src={series.awayTeam.darkLogoUrl || series.awayTeam.logoUrl}
                alt={series.awayTeam.abbreviation}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="text-sm">{series.awayTeam.name}</span>
          </div>
          <span className="text-lg font-mono font-bold">
            {series.awayWins}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
