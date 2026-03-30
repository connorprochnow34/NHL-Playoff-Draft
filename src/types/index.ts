import type {
  User,
  Group,
  GroupMember,
  NhlTeam,
  Series,
  Pick,
  Point,
  DraftStatus,
  SeriesStatus,
} from "@prisma/client";

export type { User, Group, GroupMember, NhlTeam, Series, Pick, Point, DraftStatus, SeriesStatus };

export type GroupWithMembers = Group & {
  members: (GroupMember & { user: User })[];
  commissioner: User;
};

export type GroupMemberWithUser = GroupMember & { user: User };

export type PickWithTeam = Pick & { team: NhlTeam; user: User };

export type SeriesWithTeams = Series & {
  homeTeam: NhlTeam;
  awayTeam: NhlTeam;
  winner: NhlTeam | null;
};

export type PointWithDetails = Point & {
  series: SeriesWithTeams;
  team: NhlTeam;
  user: User;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  teams: (NhlTeam & { isEliminated: boolean; roundReached: number })[];
  pointsByRound: Record<number, number>;
};

export type DraftState = {
  status: DraftStatus;
  currentPickNumber: number;
  currentUserId: string | null;
  picks: PickWithTeam[];
  members: GroupMemberWithUser[];
  timerExpiresAt: string | null;
};
