import { describe, expect, it } from "vitest";
import { compareEliminationScores, type PlayerEliminationScore } from "@empire/game-core";

const baseScore = (overrides: Partial<PlayerEliminationScore>): PlayerEliminationScore => ({
  playerId: "player:base",
  playerName: "Base",
  gangName: "Base",
  avatarSrc: null,
  score: 0,
  controlledDistricts: 0,
  totalOwnedDistrictInfluence: 0,
  activeBuildingCount: 0,
  cleanCash: 0,
  dirtyCash: 0,
  totalResourceValue: 0,
  population: 0,
  recentActivityBonus: 0,
  lastActionAt: "2026-01-01T12:00:00.000Z",
  ...overrides
});

const weakestFirst = (...scores: PlayerEliminationScore[]): string[] =>
  [...scores].sort(compareEliminationScores).map((score) => score.playerId);

describe("compareEliminationScores", () => {
  it("does not rank a player weaker only because they control fewer districts", () => {
    const compactEmpire = baseScore({
      playerId: "player:compact",
      score: 30_000,
      controlledDistricts: 2,
      totalOwnedDistrictInfluence: 700,
      activeBuildingCount: 8,
      cleanCash: 20_000,
      totalResourceValue: 5_000,
      population: 1_500
    });
    const wideWeakEmpire = baseScore({
      playerId: "player:wide",
      score: 12_000,
      controlledDistricts: 5,
      totalOwnedDistrictInfluence: 10,
      activeBuildingCount: 0,
      cleanCash: 100,
      totalResourceValue: 0,
      population: 20
    });

    expect(weakestFirst(compactEmpire, wideWeakEmpire)).toEqual(["player:wide", "player:compact"]);
  });

  it("can rank a player with more districts weaker when their total score is lower", () => {
    const valuableSmallEmpire = baseScore({
      playerId: "player:valuable",
      score: 25_000,
      controlledDistricts: 3,
      totalOwnedDistrictInfluence: 650,
      activeBuildingCount: 6,
      cleanCash: 15_000,
      totalResourceValue: 3_000,
      population: 1_000
    });
    const emptyWideEmpire = baseScore({
      playerId: "player:empty-wide",
      score: 10_500,
      controlledDistricts: 7,
      totalOwnedDistrictInfluence: 0,
      activeBuildingCount: 0,
      cleanCash: 0,
      totalResourceValue: 0,
      population: 0
    });

    expect(weakestFirst(valuableSmallEmpire, emptyWideEmpire)).toEqual(["player:empty-wide", "player:valuable"]);
  });

  it("uses controlled districts as the tie-breaker when scores are effectively equal", () => {
    const fewerDistricts = baseScore({
      playerId: "player:fewer",
      score: 20_000,
      controlledDistricts: 2
    });
    const moreDistricts = baseScore({
      playerId: "player:more",
      score: 20_000.00005,
      controlledDistricts: 4
    });

    expect(weakestFirst(moreDistricts, fewerDistricts)).toEqual(["player:fewer", "player:more"]);
  });

  it("uses older or missing activity as the tie-breaker after score and districts", () => {
    const inactive = baseScore({
      playerId: "player:inactive",
      score: 20_000,
      controlledDistricts: 3,
      lastActionAt: null
    });
    const older = baseScore({
      playerId: "player:older",
      score: 20_000,
      controlledDistricts: 3,
      lastActionAt: "2026-01-01T08:00:00.000Z"
    });
    const newer = baseScore({
      playerId: "player:newer",
      score: 20_000,
      controlledDistricts: 3,
      lastActionAt: "2026-01-01T09:00:00.000Z"
    });

    expect(weakestFirst(newer, inactive, older)).toEqual(["player:inactive", "player:older", "player:newer"]);
  });

  it("uses playerId as the final deterministic tie-breaker", () => {
    const playerB = baseScore({
      playerId: "player:b",
      playerName: "B",
      score: 20_000,
      controlledDistricts: 3
    });
    const playerA = baseScore({
      playerId: "player:a",
      playerName: "A",
      score: 20_000,
      controlledDistricts: 3
    });

    expect(weakestFirst(playerB, playerA)).toEqual(["player:a", "player:b"]);
  });
});
