import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function RulesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Rules & Scoring
        </h1>
        <p className="text-muted-foreground italic">
          Pick your teams. Own the playoffs. Win the group chat.
        </p>
      </div>

      {/* What is this */}
      <Card>
        <CardHeader>
          <CardTitle>What is this?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            Your team didn&apos;t make the playoffs &mdash; and neither did
            anyone else&apos;s. So instead of watching from the sidelines, we
            draft the playoff teams and compete against each other all the way
            through to the Stanley Cup.
          </p>
          <p>
            You&apos;ll have real skin in the game for every series, every
            overtime, every upset. The person with the most points when the Cup
            is handed out wins.
          </p>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                step: 1,
                title: "Randomize the draft order",
                desc: "Before the draft, everyone\u2019s name goes into a hat. Draw order is random \u2014 no lobbying, no negotiating.",
              },
              {
                step: 2,
                title: "Snake draft your teams",
                desc: "We snake draft the 16 playoff teams. If there are 8 people, everyone gets 2 teams. 5 people = 3 teams each (1 team sits out).",
              },
              {
                step: 3,
                title: "Your teams are yours all playoffs",
                desc: "No re-drafting between rounds. If your team gets bounced, they\u2019re gone. Root for whoever\u2019s still alive.",
              },
              {
                step: 4,
                title: "Earn points when your teams win series",
                desc: "Every series your team wins earns you points. How many depends on whether they were the favorite or underdog going in.",
              },
              {
                step: 5,
                title: "Most points wins",
                desc: "Track the leaderboard through all four rounds. Person with the most points when the Cup is raised wins.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {step}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scoring system */}
      <Card>
        <CardHeader>
          <CardTitle>The scoring system</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Points are awarded for each series win. The round matters &mdash;
            later rounds are worth more. And whether your team was the{" "}
            <span className="text-foreground font-medium">favorite</span> or
            the{" "}
            <span className="text-foreground font-medium">underdog</span> in
            that series matters too. Upsets pay more.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Round</th>
                  <th className="text-center py-2 px-4 font-medium">
                    Favorite wins
                  </th>
                  <th className="text-center py-2 px-4 font-medium">
                    Underdog wins
                  </th>
                  <th className="text-center py-2 pl-4 font-medium">
                    Upset bonus
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { round: "Round 1", fav: 2, dog: 5, bonus: 3 },
                  { round: "Round 2", fav: 3, dog: 7, bonus: 4 },
                  { round: "Conference Final", fav: 5, dog: 10, bonus: 5 },
                  { round: "Stanley Cup Final", fav: 7, dog: 14, bonus: 7 },
                ].map(({ round, fav, dog, bonus }) => (
                  <tr key={round} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{round}</td>
                    <td className="py-2 px-4 text-center">{fav} pts</td>
                    <td className="py-2 px-4 text-center font-semibold text-primary">
                      {dog} pts
                    </td>
                    <td className="py-2 pl-4 text-center text-muted-foreground">
                      +{bonus} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground italic">
            A Cup winner earns their owner 17 points if they were favored every
            round, or up to 36 points if they were the underdog every step of
            the way. The snake draft balances this naturally.
          </p>
        </CardContent>
      </Card>

      {/* Favorite vs underdog */}
      <Card>
        <CardHeader>
          <CardTitle>Favorite vs. underdog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We use the NHL&apos;s official seeding for each series &mdash; no
            custom rankings, no arguments. The team with the{" "}
            <span className="text-foreground font-medium">
              lower seed number
            </span>{" "}
            in each series is the favorite. The team with the higher seed number
            is the underdog. That&apos;s it.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Example</th>
                  <th className="text-left py-2 px-4 font-medium">Series</th>
                  <th className="text-left py-2 px-4 font-medium">
                    If favorite wins
                  </th>
                  <th className="text-left py-2 pl-4 font-medium">
                    If underdog wins
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Round 1</td>
                  <td className="py-2 px-4 text-muted-foreground">
                    1-seed vs. 4-seed
                  </td>
                  <td className="py-2 px-4">2 pts (to 1-seed owner)</td>
                  <td className="py-2 pl-4 text-primary font-medium">
                    5 pts (to 4-seed owner)
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Round 2</td>
                  <td className="py-2 px-4 text-muted-foreground">
                    3-seed vs. 6-seed
                  </td>
                  <td className="py-2 px-4">3 pts (to 3-seed owner)</td>
                  <td className="py-2 pl-4 text-primary font-medium">
                    7 pts (to 6-seed owner)
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Cup Final</td>
                  <td className="py-2 px-4 text-muted-foreground">
                    2-seed vs. 5-seed
                  </td>
                  <td className="py-2 px-4">7 pts (to 2-seed owner)</td>
                  <td className="py-2 pl-4 text-primary font-medium">
                    14 pts (to 5-seed owner)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Draft size guide */}
      <Card>
        <CardHeader>
          <CardTitle>Draft size guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Players</th>
                  <th className="text-center py-2 px-4 font-medium">
                    Teams each
                  </th>
                  <th className="text-center py-2 px-4 font-medium">
                    Teams left out
                  </th>
                  <th className="text-left py-2 pl-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    players: 4,
                    teams: 4,
                    left: 0,
                    note: "Clean \u2014 everyone gets an equal bracket",
                  },
                  {
                    players: 5,
                    teams: 3,
                    left: 1,
                    note: "One team goes undrafted \u2014 agreed before draft",
                  },
                  {
                    players: 6,
                    teams: 2,
                    left: 4,
                    note: "Tight \u2014 pick wisely",
                  },
                  {
                    players: 8,
                    teams: 2,
                    left: 0,
                    note: "Sweet spot \u2014 clean and competitive",
                  },
                  {
                    players: 10,
                    teams: 1,
                    left: 6,
                    note: "Works best with bonus point rules",
                  },
                  {
                    players: 16,
                    teams: 1,
                    left: 0,
                    note: "One person, one team \u2014 pure bracket style",
                  },
                ].map(({ players, teams, left, note }) => (
                  <tr key={players} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{players}</td>
                    <td className="py-2 px-4 text-center">{teams}</td>
                    <td className="py-2 px-4 text-center">{left}</td>
                    <td className="py-2 pl-4 text-muted-foreground">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* The one rule */}
      <Card>
        <CardHeader>
          <CardTitle>The one rule that matters most</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            Once the draft is done, everything is public. Everyone knows who
            owns which team. That&apos;s where the fun lives &mdash; chirping
            someone whose team just blew a 3-1 series lead, rooting against a
            friend&apos;s Cup contender, texting at midnight when an overtime
            goal flips the points standings.
          </p>
          <p>The game runs itself. Just watch the hockey.</p>
          <Separator className="my-4" />
          <p className="text-center italic text-xs">
            Good luck. May your teams be healthy and your friends be sore
            losers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
