/**
 * Snake Draft Logic
 *
 * Round 1: picks go 1 → N
 * Round 2: picks go N → 1
 * Round 3: picks go 1 → N
 * ...and so on (snake pattern)
 *
 * All logic is server-side to prevent gaming.
 */

/**
 * Given the total number of members and the current overall pick number (1-indexed),
 * returns the draft position (1-indexed) of whose turn it is and which round we're in.
 */
export function getPickInfo(
  totalMembers: number,
  pickNumber: number
): { draftPosition: number; round: number } {
  // pickNumber is 1-indexed
  const zeroIndexedPick = pickNumber - 1;
  const round = Math.floor(zeroIndexedPick / totalMembers) + 1;
  const positionInRound = zeroIndexedPick % totalMembers;

  // Odd rounds (1, 3, 5...) go forward: 1 → N
  // Even rounds (2, 4, 6...) go backward: N → 1
  const isForwardRound = round % 2 === 1;
  const draftPosition = isForwardRound
    ? positionInRound + 1
    : totalMembers - positionInRound;

  return { draftPosition, round };
}

/**
 * Get total number of picks in a draft.
 * Each member gets 16/N teams (rounded down for simplicity),
 * but we draft all 16 teams total.
 */
export function getTotalPicks(totalMembers: number): number {
  return 16; // Always draft all 16 playoff teams
}

/**
 * Find the highest-seed available team for auto-pick.
 * Lower seed number = better team = higher priority.
 */
export function getAutoPickTeamId(
  availableTeams: { id: string; seed: number | null }[]
): string | null {
  if (availableTeams.length === 0) return null;

  // Sort by seed (lowest first), nulls last
  const sorted = [...availableTeams].sort((a, b) => {
    if (a.seed === null && b.seed === null) return 0;
    if (a.seed === null) return 1;
    if (b.seed === null) return -1;
    return a.seed - b.seed;
  });

  return sorted[0].id;
}

/**
 * Validate that a pick is legal:
 * - It's the user's turn
 * - The team hasn't been picked yet
 * - The draft is in progress
 */
export function validatePick(params: {
  currentPickNumber: number;
  totalMembers: number;
  userId: string;
  membersByPosition: Map<number, string>; // draftPosition → userId
  pickedTeamIds: Set<string>;
  teamId: string;
}): { valid: boolean; error?: string } {
  const { currentPickNumber, totalMembers, userId, membersByPosition, pickedTeamIds, teamId } = params;

  const totalPicks = getTotalPicks(totalMembers);
  if (currentPickNumber > totalPicks) {
    return { valid: false, error: "Draft is complete" };
  }

  const { draftPosition } = getPickInfo(totalMembers, currentPickNumber);
  const expectedUserId = membersByPosition.get(draftPosition);

  if (expectedUserId !== userId) {
    return { valid: false, error: "It's not your turn" };
  }

  if (pickedTeamIds.has(teamId)) {
    return { valid: false, error: "Team already picked" };
  }

  return { valid: true };
}
