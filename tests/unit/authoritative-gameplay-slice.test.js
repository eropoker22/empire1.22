import { describe, expect, it } from "vitest";
import {
  mergeAuthoritativeGameplaySlice,
  selectAuthoritativePlayerHeat
} from "../../packages/shared-types/src/views/authoritative-gameplay-slice.js";

const slice = (stateVersion, heat, overrides = {}) => ({
  server: { serverInstanceId: "instance:heat", stateVersion },
  player: {
    playerId: "player:heat",
    instanceId: "instance:heat",
    police: heat === undefined ? { wantedLevel: 2 } : { heat, wantedLevel: 2 },
    ...(overrides.player || {})
  },
  district: { districtId: "district:7", heat: 7 },
  ...overrides
});

describe("authoritative gameplay slice merge", () => {
  it("selects raw player Heat instead of Wanted Level, total Heat, or district Heat", () => {
    const model = slice(51, 122, {
      police: { totalHeat: 999 },
      player: {
        police: { heat: 122, wantedLevel: 2, totalHeat: 129 }
      }
    });

    expect(selectAuthoritativePlayerHeat(model)).toBe(122);
    expect(selectAuthoritativePlayerHeat(model.player)).toBe(122);
    expect(selectAuthoritativePlayerHeat({ heat: 0, wantedLevel: 2 })).toBe(0);
    expect(selectAuthoritativePlayerHeat({ wantedLevel: 2 })).toBeNull();
    expect(selectAuthoritativePlayerHeat({ heat: null, wantedLevel: 2 })).toBeNull();
  });

  it("rejects an older response even when it arrives after a newer Heat", () => {
    const current = slice(51, 122, {
      server: { serverInstanceId: "instance:heat", stateVersion: 51, currentTick: 500 },
      elimination: { enabled: true, nextEliminationTick: 800, ticksUntilNextElimination: 300 }
    });
    const stale = slice(50, 2, {
      server: { serverInstanceId: "instance:heat", stateVersion: 50, currentTick: 480 },
      elimination: { enabled: true, nextEliminationTick: 800, ticksUntilNextElimination: 320 }
    });

    const result = mergeAuthoritativeGameplaySlice(current, stale);

    expect(result).toMatchObject({ accepted: false, reason: "stale-version" });
    expect(selectAuthoritativePlayerHeat(result.model)).toBe(122);
    expect(result.model.server.currentTick).toBe(500);
    expect(result.model.elimination.ticksUntilNextElimination).toBe(300);
  });

  it("retains Heat when a same-version partial response omits it", () => {
    const current = slice(51, 122);
    const partial = slice(51, undefined);

    const result = mergeAuthoritativeGameplaySlice(current, partial);

    expect(result.accepted).toBe(true);
    expect(result.model.player.police).toMatchObject({ heat: 122, wantedLevel: 2 });
  });

  it("does not carry Heat across players unless an explicit scope change is authorized", () => {
    const current = slice(51, 122);
    const other = {
      ...slice(1, 15),
      server: { serverInstanceId: "instance:other", stateVersion: 1 },
      player: { ...slice(1, 15).player, playerId: "player:other", instanceId: "instance:other" }
    };

    expect(mergeAuthoritativeGameplaySlice(current, other)).toMatchObject({
      accepted: false,
      reason: "scope-mismatch"
    });
    const switched = mergeAuthoritativeGameplaySlice(current, other, { allowScopeChange: true });
    expect(selectAuthoritativePlayerHeat(switched.model)).toBe(15);
  });
});
