# NHL Playoff Draft

Draft NHL playoff teams with your friends and compete for points throughout the playoffs.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn/UI
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma 5
- **Auth**: Supabase Auth (email/password + magic link)
- **Real-time**: Supabase Realtime (broadcast channels)
- **Deployment**: Vercel

## Local Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Clone and install

```bash
git clone <repo-url>
cd nhl-playoff-draft
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase dashboard > Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same location
- `SUPABASE_SERVICE_ROLE_KEY` — same location (keep secret)
- `DATABASE_URL` — from Supabase dashboard > Settings > Database > Connection string (Transaction pooler)
- `DIRECT_URL` — from Supabase dashboard > Settings > Database > Connection string (Session pooler)
- `CRON_SECRET` — any random string for cron auth

### 3. Set up the database

```bash
npx prisma db push
```

### 4. Seed test data (optional)

```bash
npm run db:seed
```

This creates 8 test users, 1 group with a completed draft, 16 playoff teams, series data, and points. Great for UI development.

### 5. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000

## NHL API

All playoff data comes from the unofficial NHL Stats API at `api-web.nhle.com`. No API key is required.

### Key endpoints

| Endpoint | Purpose |
|----------|---------|
| `/v1/playoff-bracket/{year}` | Full bracket with series, teams, wins |
| `/v1/standings/now` | Current standings with seeds |

The `{year}` parameter is the ending year of the season (e.g., 2025 for 2024-25).

### Sync

- Automatic: Vercel cron runs every 15 minutes (configured in `vercel.json`)
- Manual: Commissioner can click "Sync Now" in group settings
- All sync events are logged in the `sync_log` table

The NHL API is undocumented and may change. All API calls are isolated in `src/lib/nhl/api.ts` — if an endpoint breaks, patch it there.

## Scoring

| Round | Favorite wins | Underdog wins |
|-------|:---:|:---:|
| Round 1 | 2 pts | 5 pts |
| Round 2 | 3 pts | 7 pts |
| Conference Final | 5 pts | 10 pts |
| Stanley Cup Final | 7 pts | 14 pts |

Lower seed number = favorite. Same-seed matchups are treated as favorite wins.

## Draft

- Snake draft: Round 1 goes 1→N, Round 2 goes N→1, alternating
- Commissioner randomizes order (Fisher-Yates shuffle)
- 60-second pick timer (configurable 30-120s)
- Auto-pick on timer expiry (highest available seed)
- Real-time via Supabase broadcast channels

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add all env vars from `.env.example`
4. Deploy

The cron job in `vercel.json` requires Vercel Pro for intervals under 1 hour. On free tier, use the manual sync button.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed test data |
| `npm run db:generate` | Regenerate Prisma client |
