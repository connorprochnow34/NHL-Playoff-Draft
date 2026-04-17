import { describe, it, expect } from "vitest";
import {
  buildSnakeOrder,
  getPickerForPickNumber,
} from "../snake-order";

function makeMembers(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `user${i + 1}`);
}

describe("buildSnakeOrder", () => {
  describe("group sizing math", () => {
    const cases: Array<{
      n: number;
      teamsPerMember: number;
      totalPicks: number;
      undrafted: number;
    }> = [
      { n: 2, teamsPerMember: 8, totalPicks: 16, undrafted: 0 },
      { n: 3, teamsPerMember: 5, totalPicks: 15, undrafted: 1 },
      { n: 4, teamsPerMember: 4, totalPicks: 16, undrafted: 0 },
      { n: 5, teamsPerMember: 3, totalPicks: 15, undrafted: 1 },
      { n: 6, teamsPerMember: 2, totalPicks: 12, undrafted: 4 },
      { n: 7, teamsPerMember: 2, totalPicks: 14, undrafted: 2 },
      { n: 8, teamsPerMember: 2, totalPicks: 16, undrafted: 0 },
      { n: 10, teamsPerMember: 1, totalPicks: 10, undrafted: 6 },
      { n: 12, teamsPerMember: 1, totalPicks: 12, undrafted: 4 },
      { n: 16, teamsPerMember: 1, totalPicks: 16, undrafted: 0 },
    ];

    for (const c of cases) {
      it(`N=${c.n}: ${c.teamsPerMember} teams/member, ${c.totalPicks} picks, ${c.undrafted} undrafted`, () => {
        const result = buildSnakeOrder({
          memberIdsInDraftPosition: makeMembers(c.n),
        });
        expect(result.teamsPerMember).toBe(c.teamsPerMember);
        expect(result.totalPicks).toBe(c.totalPicks);
        expect(result.undraftedTeams).toBe(c.undrafted);
        expect(result.snakeOrder).toHaveLength(c.totalPicks);
      });
    }
  });

  describe("snake direction", () => {
    it("N=8 alternates: R1 forward, R2 reverse", () => {
      const members = makeMembers(8);
      const { snakeOrder } = buildSnakeOrder({
        memberIdsInDraftPosition: members,
      });
      // Round 1: user1, user2, ..., user8
      expect(snakeOrder.slice(0, 8)).toEqual(members);
      // Round 2: user8, user7, ..., user1
      expect(snakeOrder.slice(8, 16)).toEqual([...members].reverse());
    });

    it("N=3 over 5 rounds: alternates correctly", () => {
      const members = makeMembers(3); // [user1, user2, user3]
      const { snakeOrder } = buildSnakeOrder({
        memberIdsInDraftPosition: members,
      });
      // R1 (fwd): user1, user2, user3
      // R2 (rev): user3, user2, user1
      // R3 (fwd): user1, user2, user3
      // R4 (rev): user3, user2, user1
      // R5 (fwd): user1, user2, user3
      expect(snakeOrder).toEqual([
        "user1", "user2", "user3",
        "user3", "user2", "user1",
        "user1", "user2", "user3",
        "user3", "user2", "user1",
        "user1", "user2", "user3",
      ]);
    });

    it("N=10 single round: order is just forward", () => {
      const members = makeMembers(10);
      const { snakeOrder } = buildSnakeOrder({
        memberIdsInDraftPosition: members,
      });
      expect(snakeOrder).toEqual(members);
    });
  });

  describe("each member gets exactly teamsPerMember picks", () => {
    it.each([2, 3, 4, 5, 6, 7, 8, 10, 12, 16])(
      "N=%i",
      (n) => {
        const members = makeMembers(n);
        const { snakeOrder, teamsPerMember } = buildSnakeOrder({
          memberIdsInDraftPosition: members,
        });
        for (const member of members) {
          const count = snakeOrder.filter((u) => u === member).length;
          expect(count).toBe(teamsPerMember);
        }
      }
    );
  });

  describe("validation", () => {
    it("throws for N=1", () => {
      expect(() =>
        buildSnakeOrder({ memberIdsInDraftPosition: ["user1"] })
      ).toThrow();
    });

    it("throws for N=17", () => {
      expect(() =>
        buildSnakeOrder({
          memberIdsInDraftPosition: makeMembers(17),
        })
      ).toThrow();
    });
  });
});

describe("getPickerForPickNumber", () => {
  const members = makeMembers(4); // user1..user4
  const { snakeOrder } = buildSnakeOrder({
    memberIdsInDraftPosition: members,
  }); // 16 picks, 4 rounds

  it("pick 1 = user1 (R1)", () => {
    expect(getPickerForPickNumber(snakeOrder, 1, 4)).toEqual({
      userId: "user1",
      round: 1,
    });
  });

  it("pick 4 = user4 (R1)", () => {
    expect(getPickerForPickNumber(snakeOrder, 4, 4)).toEqual({
      userId: "user4",
      round: 1,
    });
  });

  it("pick 5 = user4 (R2 reversed)", () => {
    expect(getPickerForPickNumber(snakeOrder, 5, 4)).toEqual({
      userId: "user4",
      round: 2,
    });
  });

  it("pick 8 = user1 (R2 reversed)", () => {
    expect(getPickerForPickNumber(snakeOrder, 8, 4)).toEqual({
      userId: "user1",
      round: 2,
    });
  });

  it("pick 9 = user1 (R3 forward)", () => {
    expect(getPickerForPickNumber(snakeOrder, 9, 4)).toEqual({
      userId: "user1",
      round: 3,
    });
  });

  it("throws for pick number out of range", () => {
    expect(() => getPickerForPickNumber(snakeOrder, 0, 4)).toThrow();
    expect(() => getPickerForPickNumber(snakeOrder, 17, 4)).toThrow();
  });
});
