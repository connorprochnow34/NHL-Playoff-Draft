import { describe, it, expect } from "vitest";
import { calculatePoints } from "./engine";

describe("calculatePoints", () => {
  describe("Round 1", () => {
    it("awards 2 points when favorite wins", () => {
      const result = calculatePoints(1, 1, 4);
      expect(result.points).toBe(2);
      expect(result.wasUnderdog).toBe(false);
    });

    it("awards 5 points when underdog wins", () => {
      const result = calculatePoints(1, 4, 1);
      expect(result.points).toBe(5);
      expect(result.wasUnderdog).toBe(true);
    });

    it("seed 2 beating seed 3 is treated as favorite", () => {
      const result = calculatePoints(1, 2, 3);
      expect(result.points).toBe(2);
      expect(result.wasUnderdog).toBe(false);
    });

    it("seed 3 beating seed 2 is treated as underdog", () => {
      const result = calculatePoints(1, 3, 2);
      expect(result.points).toBe(5);
      expect(result.wasUnderdog).toBe(true);
    });
  });

  describe("Round 2", () => {
    it("awards 3 points when favorite wins", () => {
      const result = calculatePoints(2, 1, 3);
      expect(result.points).toBe(3);
      expect(result.wasUnderdog).toBe(false);
    });

    it("awards 7 points when underdog wins", () => {
      const result = calculatePoints(2, 3, 1);
      expect(result.points).toBe(7);
      expect(result.wasUnderdog).toBe(true);
    });
  });

  describe("Conference Finals (Round 3)", () => {
    it("awards 5 points when favorite wins", () => {
      const result = calculatePoints(3, 1, 2);
      expect(result.points).toBe(5);
      expect(result.wasUnderdog).toBe(false);
    });

    it("awards 10 points when underdog wins", () => {
      const result = calculatePoints(3, 2, 1);
      expect(result.points).toBe(10);
      expect(result.wasUnderdog).toBe(true);
    });
  });

  describe("Stanley Cup Final (Round 4)", () => {
    it("awards 7 points when favorite wins", () => {
      const result = calculatePoints(4, 1, 2);
      expect(result.points).toBe(7);
      expect(result.wasUnderdog).toBe(false);
    });

    it("awards 14 points when underdog wins", () => {
      const result = calculatePoints(4, 4, 1);
      expect(result.points).toBe(14);
      expect(result.wasUnderdog).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("same-seed matchup treats winner as favorite (not underdog)", () => {
      const result = calculatePoints(1, 3, 3);
      expect(result.points).toBe(2);
      expect(result.wasUnderdog).toBe(false);
    });

    it("same-seed matchup in round 4", () => {
      const result = calculatePoints(4, 2, 2);
      expect(result.points).toBe(7);
      expect(result.wasUnderdog).toBe(false);
    });

    it("throws for invalid round", () => {
      expect(() => calculatePoints(0, 1, 2)).toThrow("Invalid round");
      expect(() => calculatePoints(5, 1, 2)).toThrow("Invalid round");
    });
  });
});
