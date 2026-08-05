import { describe, expect, it } from "vitest";
import {
  copyFreeHostedStartingPlayerState,
  FREE_HOSTED_STARTING_MATERIAL_IDS
} from "@empire/game-config";
import {
  parseHostedStartingPlayerState,
  parsePersistedHostedStartingPlayerState
} from "../../../apps/server/src/admin/hosted/hosted-starting-player-state-policy";

describe("hosted starting player state policy", () => {
  it("defaults only a missing create request", () => {
    expect(parseHostedStartingPlayerState(undefined)).toMatchObject({
      accepted: true,
      data: copyFreeHostedStartingPlayerState()
    });
    expect(parsePersistedHostedStartingPlayerState(undefined).accepted).toBe(false);
    expect(parsePersistedHostedStartingPlayerState(null).accepted).toBe(false);
  });

  it.each([
    ["malformed JSON", "{invalid-json"],
    ["numeric strings", JSON.stringify({
      ...zeroStartingPlayerState(),
      cleanCash: "0"
    })]
  ])("rejects persisted %s", (_label, value) => {
    expect(parsePersistedHostedStartingPlayerState(value).accepted).toBe(false);
  });

  it("accepts shuffled canonical keys and preserves zero values", () => {
    const shuffled = {
      materials: Object.fromEntries(
        [...FREE_HOSTED_STARTING_MATERIAL_IDS].reverse().map((materialId) => [materialId, 0])
      ),
      spySlots: 2,
      influence: 0,
      population: 0,
      dirtyCash: 0,
      cleanCash: 0
    };

    const parsed = parsePersistedHostedStartingPlayerState(JSON.stringify(shuffled));

    expect(parsed).toMatchObject({
      accepted: true,
      data: zeroStartingPlayerState()
    });
    if (!parsed.accepted) throw new Error("Expected the persisted state to be accepted.");
    expect(Object.keys(parsed.data.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);
  });

  it("normalizes a legacy persisted state without influence", () => {
    const legacy = zeroStartingPlayerState() as Record<string, unknown>;
    delete legacy.influence;

    expect(parsePersistedHostedStartingPlayerState(JSON.stringify(legacy))).toMatchObject({
      accepted: true,
      data: { influence: 0 }
    });
  });

  it.each([-1, 1.5, "10", null])("rejects invalid starting influence %s", (influence) => {
    expect(parseHostedStartingPlayerState({
      ...zeroStartingPlayerState(),
      influence
    }).accepted).toBe(false);
  });
});

const zeroStartingPlayerState = () => ({
  cleanCash: 0,
  dirtyCash: 0,
  population: 0,
  influence: 0,
  spySlots: 2,
  materials: Object.fromEntries(
    FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId) => [materialId, 0])
  )
});
