import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import {
  createOccupyDistrictCommand,
  createPlaceTrapCommand,
  createSpyDistrictCommand
} from "../../../apps/client/src/features";

const createGameplaySliceFixture = ({
  spyEnabled = true,
  trapEnabled = true
}: {
  spyEnabled?: boolean;
  trapEnabled?: boolean;
} = {}): GameplaySliceView => ({
  mode: {
    mode: "free",
    label: "Empire Streets Free",
    matchStyle: "short",
    tickRateMs: 5000,
    sessionKeyPrefix: "empire:free"
  },
  player: {
    playerId: "player:1",
    instanceId: "instance:1",
    mode: "free",
    factionId: "mafian",
    homeDistrictId: "district:1",
    color: "#ef4444",
    serverTime: new Date(0).toISOString(),
    resourceBalances: {},
    economy: {
      cleanCash: 0,
      dirtyCash: 0,
      influence: 0,
      population: 0,
      gangMembers: 0,
      resources: {},
      materials: {},
      drugs: {},
      weapons: {}
    },
    notifications: [],
    victoryState: null
  },
  districts: [],
  reports: [],
  district: {
    districtId: "district:1",
    name: "Owned District",
    zone: "downtown",
    status: "claimed",
    ownerPlayerId: "player:1",
    isOwnedByPlayer: true,
    heat: 0,
    influence: 0,
    slotCount: 0,
    filledSlotCount: 0,
    buildings: [],
    attackTargets: [],
    spyTargets: [
      {
        districtId: "district:2",
        name: "Target District",
        ownerPlayerId: "player:2",
        status: "claimed",
        enabled: spyEnabled,
        disabledReason: spyEnabled ? null : "Spy route is cooling down."
      }
    ],
    occupyTargets: [],
    trap: {
      enabled: trapEnabled,
      disabledReason: trapEnabled ? null : "Only one active trap can be armed at a time.",
      activeTrap: trapEnabled
        ? null
        : {
            trapId: "trap:district:1",
            label: "Hidden trap armed",
            placedAtTick: 3
          }
    },
    slots: []
  }
});

describe("conflict command factories", () => {
  it("builds the spy command from the current server-fed gameplay slice", () => {
    const slice = createGameplaySliceFixture();
    const command = createSpyDistrictCommand({
      commandId: "command:spy:district:2",
      slice,
      targetDistrictId: "district:2",
      issuedAt: new Date(0).toISOString()
    });

    expect(command.type).toBe("spy-district");
    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.payload).toEqual({
      districtId: "district:2",
      sourceDistrictId: "district:1"
    });
  });

  it("rejects spy commands for disabled targets in the current server-fed slice", () => {
    expect(() =>
      createSpyDistrictCommand({
        commandId: "command:spy:district:2",
        slice: createGameplaySliceFixture({ spyEnabled: false }),
        targetDistrictId: "district:2",
        issuedAt: new Date(0).toISOString()
      })
    ).toThrow(
      "Spy commands can only be created from enabled spy targets present in the current server-fed slice."
    );
  });

  it("builds the trap command from the current server-fed gameplay slice", () => {
    const slice = createGameplaySliceFixture();
    const command = createPlaceTrapCommand({
      commandId: "command:trap:district:1",
      slice,
      issuedAt: new Date(0).toISOString()
    });

    expect(command.type).toBe("place-trap");
    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.payload).toEqual({
      districtId: "district:1"
    });
  });

  it("builds the occupy command from an enabled server-fed occupy target", () => {
    const slice = createGameplaySliceFixture();
    slice.district!.occupyTargets = [
      {
        districtId: "district:3",
        name: "Neutral District",
        ownerPlayerId: null,
        status: "neutral",
        enabled: true,
        disabledCode: null,
        disabledReason: null,
        cost: {
          influence: 5
        },
        heatGain: 2,
        cooldownRemainingTicks: 0
      }
    ];
    const command = createOccupyDistrictCommand({
      commandId: "command:occupy:district:3",
      slice,
      targetDistrictId: "district:3",
      issuedAt: new Date(0).toISOString()
    });

    expect(command.type).toBe("occupy-district");
    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.payload).toEqual({
      districtId: "district:3",
      sourceDistrictId: "district:1"
    });
  });

  it("rejects occupy commands for disabled targets in the current server-fed slice", () => {
    const slice = createGameplaySliceFixture();
    slice.district!.occupyTargets = [
      {
        districtId: "district:3",
        name: "Neutral District",
        ownerPlayerId: null,
        status: "neutral",
        enabled: false,
        disabledCode: "occupy_requires_successful_spy",
        disabledReason: "Successful spy intel is required before occupying this district.",
        cost: {
          influence: 5
        },
        heatGain: 2,
        cooldownRemainingTicks: 0
      }
    ];

    expect(() =>
      createOccupyDistrictCommand({
        commandId: "command:occupy:district:3",
        slice,
        targetDistrictId: "district:3",
        issuedAt: new Date(0).toISOString()
      })
    ).toThrow(
      "Occupy commands can only be created from enabled occupy targets present in the current server-fed slice."
    );
  });

  it("rejects trap commands when trap placement is disabled in the current server-fed slice", () => {
    expect(() =>
      createPlaceTrapCommand({
        commandId: "command:trap:district:1",
        slice: createGameplaySliceFixture({ trapEnabled: false }),
        issuedAt: new Date(0).toISOString()
      })
    ).toThrow(
      "Trap commands can only be created from an enabled trap action present in the current server-fed slice."
    );
  });
});
