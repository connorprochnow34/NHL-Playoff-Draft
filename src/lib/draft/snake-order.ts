/**
 * Snake draft order generation.
 *
 * Given a set of members in a fixed draft position order, computes a flat
 * `snakeOrder` array of length `totalPicks` where each element is the userId
 * who picks at that 1-indexed position.
 *
 * Round 1 goes positions 1→N (forward).
 * Round 2 goes positions N→1 (reverse).
 * Round 3 goes positions 1→N (forward).
 * ...alternating.
 *
 * Group sizing:
 *   teamsPerMember = floor(totalTeams / N)
 *   totalPicks     = N * teamsPerMember
 *   undraftedTeams = totalTeams - totalPicks
 *
 * Examples (totalTeams = 16):
 *   N=2  → 8/8/0    (8 rounds)
 *   N=3  → 5/15/1   (5 rounds)
 *   N=8  → 2/16/0   (2 rounds — round 1 fwd, round 2 rev)
 *   N=10 → 1/10/6   (1 round only — no reversal needed)
 */

export interface SnakeOrderInput {
  /** Member user IDs in their draft position order (length = N) */
  memberIdsInDraftPosition: string[];
  /** Total teams available to draft. Defaults to 16 (NHL playoff teams). */
  totalTeams?: number;
}

export interface SnakeOrderResult {
  /** Flat array, length = totalPicks. snakeOrder[i] = userId for pick (i+1). */
  snakeOrder: string[];
  /** Number of teams each member receives. */
  teamsPerMember: number;
  /** Total picks in the draft (= N * teamsPerMember). */
  totalPicks: number;
  /** Number of teams that will go undrafted (totalTeams - totalPicks). */
  undraftedTeams: number;
}

export function buildSnakeOrder({
  memberIdsInDraftPosition,
  totalTeams = 16,
}: SnakeOrderInput): SnakeOrderResult {
  const N = memberIdsInDraftPosition.length;
  if (N < 2 || N > 16) {
    throw new Error(`Invalid member count: ${N}. Must be between 2 and 16.`);
  }
  if (totalTeams < N) {
    throw new Error(
      `totalTeams (${totalTeams}) must be at least member count (${N}).`
    );
  }

  const teamsPerMember = Math.floor(totalTeams / N);
  const totalPicks = N * teamsPerMember;
  const undraftedTeams = totalTeams - totalPicks;

  const snakeOrder: string[] = [];
  for (let round = 1; round <= teamsPerMember; round++) {
    const orderForRound =
      round % 2 === 1
        ? memberIdsInDraftPosition // R1, R3, R5… forward
        : [...memberIdsInDraftPosition].reverse(); // R2, R4… reverse
    snakeOrder.push(...orderForRound);
  }

  return { snakeOrder, teamsPerMember, totalPicks, undraftedTeams };
}

/**
 * Look up who picks at a given pick number from a precomputed snake order.
 */
export function getPickerForPickNumber(
  snakeOrder: string[],
  pickNumber: number,
  memberCount: number
): { userId: string; round: number } {
  if (pickNumber < 1 || pickNumber > snakeOrder.length) {
    throw new Error(
      `Invalid pick number: ${pickNumber}. Must be between 1 and ${snakeOrder.length}.`
    );
  }
  return {
    userId: snakeOrder[pickNumber - 1],
    round: Math.ceil(pickNumber / memberCount),
  };
}

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate input.
 */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
