import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { empireStreetsCityMapManifestHash } from "@empire/game-config";
import {
  createAttackDistrictCommand,
  createOccupyDistrictCommand,
  createPlaceTrapCommand,
  createSpyDistrictCommand
} from "../../../apps/client/src/features";

const createGameplaySliceFixture = ({
  attackEnabled = true,
  spyEnabled = true,
  trapEnabled = true
}: {
  attackEnabled?: boolean;
  spyEnabled?: boolean;
  trapEnabled?: boolean;
} = {}): GameplaySliceView => ({
  server: {
    serverInstanceId: "instance:1",
    mode: "free",
    currentTick: 0,
    stateVersion: 1,
    selectedDistrictId: "district:1",
    mapManifestId: "empire-streets-city",
    mapManifestVersion: 1,
    mapManifestHash: empireStreetsCityMapManifestHash,
    generatedAt: new Date(0).toISOString()
  },
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
  commandHints: {
    selectedDistrictId: "district:1",
    availableBuildingActionCount: 0,
    availableSpyTargetCount: spyEnabled ? 1 : 0,
    availableAttackTargetCount: attackEnabled ? 1 : 0,
    availableOccupyTargetCount: 0,
    cooldowns: [],
    disabledReasons: [
      ...(attackEnabled ? [] : [{
        commandType: "attack-district",
        targetId: "district:2",
        reason: "Attack route is cooling down."
      }]),
      ...(spyEnabled ? [] : [{
        commandType: "spy-district",
        targetId: "district:2",
        reason: "Spy route is cooling down."
      }])
    ]
  },
  districts: [],
  reports: [],
  district: {
    districtId: "district:1",
    conflictRevision: 1,
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
    attackTargets: [
      {
        districtId: "district:2",
        name: "Target District",
        ownerPlayerId: "player:2",
        status: "claimed",
        enabled: attackEnabled,
        expectedConflictRevision: 1,
        disabledReason: attackEnabled ? null : "Attack route is cooling down."
      }
    ],
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
  it("builds the attack command from the current server-fed gameplay slice", () => {
    const slice = createGameplaySliceFixture();
    const command = createAttackDistrictCommand({
      commandId: "command:attack:district:2",
      slice,
      targetDistrictId: "district:2",
      issuedAt: new Date(0).toISOString(),
      weapons: { pistol: 2 }
    });

    expect(command.type).toBe("attack-district");
    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.payload).toEqual({
      districtId: "district:2",
      sourceDistrictId: "district:1",
      weapons: { pistol: 2 },
      expectedConflictRevision: 1
    });
  });

  it("builds the attack command even when target is disabled in server-fed slice", () => {
    const command = createAttackDistrictCommand({
      commandId: "command:attack:district:2",
      slice: createGameplaySliceFixture({ attackEnabled: false }),
      targetDistrictId: "district:2",
      issuedAt: new Date(0).toISOString(),
      weapons: { pistol: 2 }
    });

    expect(command.type).toBe("attack-district");
    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.payload).toEqual({
      districtId: "district:2",
      sourceDistrictId: "district:1",
      weapons: { pistol: 2 },
      expectedConflictRevision: 1
    });
  });

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

  it("builds the spy command even when target is disabled in server-fed slice", () => {
    const command = createSpyDistrictCommand({
      commandId: "command:spy:district:2",
      slice: createGameplaySliceFixture({ spyEnabled: false }),
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
        expectedConflictRevision: 1,
        disabledCode: null,
        disabledReason: null,
        cost: {
          influence: 5,
          population: 50
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
      sourceDistrictId: "district:1",
      expectedConflictRevision: 1
    });
  });

  it("builds the occupy command even when target is disabled in server-fed slice", () => {
    const slice = createGameplaySliceFixture();
    slice.district!.occupyTargets = [
      {
        districtId: "district:3",
        name: "Neutral District",
        ownerPlayerId: null,
        status: "neutral",
        enabled: false,
        expectedConflictRevision: 1,
        disabledCode: "occupy_requires_successful_spy",
        disabledReason: "Successful spy intel is required before occupying this district.",
        cost: {
          influence: 5,
          population: 50
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
      sourceDistrictId: "district:1",
      expectedConflictRevision: 1
    });
  });

  it("builds the trap command when placement is disabled in server-fed slice", () => {
    const command = createPlaceTrapCommand({
      commandId: "command:trap:district:1",
      slice: createGameplaySliceFixture({ trapEnabled: false }),
      issuedAt: new Date(0).toISOString()
    });

    expect(command.type).toBe("place-trap");
    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.payload).toEqual({
      districtId: "district:1"
    });
  });
});
