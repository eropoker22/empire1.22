import { describe, expect, it } from "vitest";
import { createInitialState } from "@empire/game-core";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { SHARED_CITY_TOTAL_DISTRICT_COUNT } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

describe("gameplay slice session membership", () => {
  it("advances the snapshot version once for an idempotent player join", () => {
    const state = createInitialState("instance:membership-version", "free");
    const initialVersion = state.root.version;
    const request = {
      serverInstanceId: "instance:membership-version",
      playerId: "player:membership-version",
      factionId: "mafian",
      mode: "free"
    } as const;

    const firstJoin = ensureGameplaySliceMembershipInState(state, request);
    expect(firstJoin.accepted).toBe(true);
    expect(firstJoin.joinedPlayer).toBe(true);
    expect(firstJoin.stateChanged).toBe(true);
    expect(firstJoin.state.root.version).toBe(initialVersion + 1);

    const repeatedJoin = ensureGameplaySliceMembershipInState(firstJoin.state, request);
    expect(repeatedJoin.accepted).toBe(true);
    expect(repeatedJoin.joinedPlayer).toBe(false);
    expect(repeatedJoin.stateChanged).toBe(false);
    expect(repeatedJoin.state.root.version).toBe(initialVersion + 1);
  });

  it("repairs partial shared city entities and indexes before returning an existing membership", () => {
    const state = createInitialState("instance:membership-map-repair", "free");
    const request = {
      serverInstanceId: "instance:membership-map-repair",
      playerId: "player:membership-map-repair",
      factionId: "mafian",
      mode: "free"
    } as const;
    const firstJoin = ensureGameplaySliceMembershipInState(state, request);
    const versionBeforeRepair = firstJoin.state.root.version;
    const missingEntityId = firstJoin.state.root.districtIds[0]!;
    const missingIndexId = firstJoin.state.root.districtIds[1]!;

    delete firstJoin.state.districtsById[missingEntityId];
    firstJoin.state.root.districtIds = firstJoin.state.root.districtIds
      .filter((districtId) => districtId !== missingIndexId);

    const repairedJoin = ensureGameplaySliceMembershipInState(firstJoin.state, request);

    expect(repairedJoin.accepted).toBe(true);
    expect(repairedJoin.joinedPlayer).toBe(false);
    expect(repairedJoin.stateChanged).toBe(true);
    expect(repairedJoin.state.root.districtIds).toHaveLength(SHARED_CITY_TOTAL_DISTRICT_COUNT);
    expect(repairedJoin.state.districtsById[missingEntityId]).toBeDefined();
    expect(repairedJoin.state.root.districtIds).toContain(missingIndexId);
    expect(repairedJoin.state.root.version).toBe(versionBeforeRepair + 1);

    const repeatedJoin = ensureGameplaySliceMembershipInState(repairedJoin.state, request);
    expect(repeatedJoin.stateChanged).toBe(false);
    expect(repeatedJoin.state.root.version).toBe(versionBeforeRepair + 1);
  });
});
