import { describe, expect, it } from "vitest";
import {
  empireStreetsCityMapDistrictsById,
  resolveModeConfig
} from "@empire/game-config";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";
import {
  createSharedCityDistrict,
  seedSharedCityDistrictBuildings
} from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-entities";
import {
  createCoreStateFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "../fixtures/game-state-fixtures";
import {
  applyCasinoAuditChecks,
  validateCasinoAction
} from "../../packages/game-core/src/handlers/casinoBuildingActions";
import {
  applyCentralBankPassiveInterestAndOversight,
  validateCentralBankAction
} from "../../packages/game-core/src/handlers/centralBankBuildingActions";
import {
  applyCityHallCorruptionScandals,
  validateCityHallAction
} from "../../packages/game-core/src/handlers/cityHallBuildingActions";
import {
  applyLobbyClubScandalChecks,
  validateLobbyClubAction
} from "../../packages/game-core/src/handlers/lobbyClubBuildingActions";
import { applyHostedE2eScenario } from "../../tools/seed/hosted-e2e-scenarios";
import hostedBuildingActionMatrix from "../../tools/seed/hosted-building-action-matrix.json";
import hostedBuildingParityNonSpawnMatrix
  from "../../tools/seed/hosted-building-parity-non-spawn-matrix.json";

const createSnapshot = (): InstanceSnapshotDto => {
  const state = createCoreStateFixture();
  return {
    snapshotId: "snapshot:instance:1:0:1",
    instanceId: "instance:1",
    createdAt: new Date(0).toISOString(),
    tick: state.root.tick,
    mode: "free",
    metadata: {
      instanceId: "instance:1",
      mode: "free",
      configKey: "mode:free",
      status: "lobby",
      createdAt: new Date(0).toISOString(),
      startedAt: null,
      stoppedAt: null,
      crashCount: 0,
      lastCrashAt: null,
      version: 1
    },
    version: {
      schemaVersion: 1,
      coreVersion: "1",
      configVersion: "free"
    },
    integrity: {
      entityCounts: {
        players: 1,
        alliances: 0,
        districts: 1,
        buildings: 0
      },
      rootVersion: state.root.version
    },
    runtime: {
      processedCommandIds: [],
      commandRateLimitWindow: {
        tick: 0,
        commandCountsByPlayerId: {}
      }
    },
    lobby: {
      displayName: "Fixture",
      region: "eu-central",
      capacity: 20,
      joinPolicy: "open"
    },
    state
  };
};

describe("hosted E2E scenario seeding", () => {
  it("moves the City Events scenario to the canonical 18:00 boundary", () => {
    const source = createSnapshot();
    source.state.playerCityEventStatesByPlayerId = {
      "player:1": {
        version: 1,
        offersByAgent: { victor: [], leon: [], nyra: [] },
        activeRun: null,
        attemptedOfferIds: [],
        pendingRewards: [],
        lastProcessedScheduleWindowByAgent: {}
      }
    };
    const seeded = applyHostedE2eScenario(
      source,
      "city-events",
      "2026-07-29T22:00:00.000Z"
    );
    const at1800 = resolveModeConfig("free").balance.dayNight!.phases.day.durationTicks;

    expect(seeded.tick).toBe(at1800);
    expect(seeded.state.root.tick).toBe(at1800);
    expect(seeded.state.serverInstance.currentTick).toBe(at1800);
    expect(seeded.state.playerCityEventStatesByPlayerId).toEqual({});
    expect(seeded.integrity.rootVersion).toBe(source.integrity.rootVersion + 1);
    expect(source.state.root.tick).toBe(0);
  });

  it("keeps the realistic new-player scenario state intact except for snapshot versioning", () => {
    const source = createSnapshot();
    const seeded = applyHostedE2eScenario(
      source,
      "realistic-new-player",
      "2026-07-29T22:00:00.000Z"
    );

    expect(seeded.state.root.tick).toBe(source.state.root.tick);
    expect(seeded.state.root.version).toBe(source.state.root.version + 1);
    expect(seeded.state.playersById).toEqual(source.state.playersById);
  });

  it.each([
    ["building-actions-day", "day"],
    ["building-actions-night", "night"]
  ] as const)("prepares the guarded %s fixture from canonical map entities", (scenario, phase) => {
    const source = createBuildingActionSnapshot();
    const original = structuredClone(source);
    const seeded = applyHostedE2eScenario(
      source,
      scenario,
      "2026-07-29T22:00:00.000Z"
    );
    const player = Object.values(seeded.state.playersById)[0];
    const expectedTick = phase === "night"
      ? resolveModeConfig("free").balance.dayNight!.phases.day.durationTicks + 5
      : 5;

    expect(source).toEqual(original);
    expect(seeded.state.root.tick).toBe(expectedTick);
    expect(seeded.state.serverInstance.currentTick).toBe(expectedTick);
    expect(seeded.state.resourceStatesById[player.resourceStateId].balances).toMatchObject({
      cash: 1_000_000,
      "dirty-cash": 1_000_000,
      "neon-dust": 100
    });
    expect(player.recoveryPool?.[0]).toMatchObject({
      itemType: "population",
      lostAtTick: expectedTick
    });
    expect(player.salvagePool?.[0]).toMatchObject({
      itemId: "metal-parts",
      lostAtTick: expectedTick
    });
    expect(Object.values(seeded.state.buildingsById)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        buildingTypeId: "warehouse",
        ownerPlayerId: player.id,
        status: "active",
        level: 4
      })
    ]));

    for (const entry of hostedBuildingActionMatrix.filter((candidate) => candidate.phase === phase)) {
      const district = seeded.state.districtsById[entry.districtId];
      const building = district.buildingIds
        .map((buildingId) => seeded.state.buildingsById[buildingId])
        .find((candidate) => candidate.buildingTypeId === entry.buildingTypeId);
      expect(district.ownerPlayerId, entry.actionId).toBe(player.id);
      expect(district.status, entry.actionId).toBe("claimed");
      expect(building, entry.actionId).toMatchObject({
        buildingTypeId: entry.buildingTypeId,
        ownerPlayerId: player.id,
        status: "active",
        actionCooldowns: {}
      });
      if (entry.actionId === "collect_convenience_store_population") {
        const populationCapacity = resolveModeConfig("free").balance.convenienceStore!.basePopulationCapacity;
        expect(building?.metadata?.convenienceStore).toMatchObject({
          storedPopulation: populationCapacity,
          populationCapacity,
          populationWasFull: true
        });
      }
    }
  });

  it("prepares the guarded non-spawn building parity fixture from canonical map entities", () => {
    const source = createNonSpawnBuildingParitySnapshot();
    const sourceBuildings = Object.values(source.state.buildingsById);
    const sourceCasino = sourceBuildings.find((building) => building.buildingTypeId === "casino");
    const sourceCentralBank = sourceBuildings.find((building) => building.buildingTypeId === "central_bank");
    const sourceCityHall = sourceBuildings.find((building) => building.buildingTypeId === "city_hall");
    const sourceLobbyClub = sourceBuildings.find((building) => building.buildingTypeId === "lobby_club");
    if (!sourceCasino || !sourceCentralBank || !sourceCityHall || !sourceLobbyClub) {
      throw new Error("Non-spawn parity passive-risk fixture buildings are missing.");
    }
    sourceCasino.metadata = {
      ...(sourceCasino.metadata ?? {}),
      casino: {
        launderedEvents: [{ tick: 1, amount: 1_000 }],
        auditRiskBonuses: [{ expiresAtTick: 999, riskPct: 100, source: "stale" }],
        vipNightExpiresAtTick: 999,
        bribedInspectorExpiresAtTick: 999,
        incomePenaltyExpiresAtTick: 999,
        incomePenaltyPct: 100,
        launderingBlockedUntilTick: 999,
        vipBlockedUntilTick: 999,
        lastAuditCheckTick: 1,
        auditLog: [{ tick: 1, consequence: "stale" }]
      }
    };
    sourceCentralBank.metadata = {
      ...(sourceCentralBank.metadata ?? {}),
      centralBank: {
        frozenAccountsExpiresAtTick: 999,
        interestDisabledUntilTick: 999,
        liquidityBlockedUntilTick: 999,
        feeReductionDisabledUntilTick: 999,
        lastInterestTick: 1,
        lastOversightTick: 1,
        riskEvents: [{ actionId: "liquidity_injection", riskPct: 100, expiresAtTick: 999, tick: 1 }],
        currencyInterventions: [{ id: "stale" }],
        oversightEvents: [{ type: "stale", tick: 1, label: "Stale", riskPct: 100 }],
        interestEvents: [{ tick: 1, amount: 1, cleanCashBefore: 1, interestPct: 1 }]
      }
    };
    sourceCityHall.metadata = {
      ...(sourceCityHall.metadata ?? {}),
      cityHall: {
        cityContractBlockedUntilTick: 999,
        lastScandalCheckTick: 1,
        riskEvents: [{ actionId: "city_contract", riskPct: 100, expiresAtTick: 999, tick: 1 }],
        scandalEvents: [{ type: "frozen_contract", tick: 1, label: "Zmrazená zakázka", riskPct: 100 }]
      }
    };
    sourceLobbyClub.metadata = {
      ...(sourceLobbyClub.metadata ?? {}),
      lobbyClub: {
        backroomPressureExpiresAtTick: 999,
        mediaScreenExpiresAtTick: 999,
        riskReductionExpiresAtTick: 999,
        nextInfluenceDiscountPct: 100,
        nextInfluenceDiscountExpiresAtTick: 999,
        incomePenaltyUntilTick: 999,
        influenceCostReductionDisabledUntilTick: 999,
        lastScandalCheckTick: 1,
        riskEvents: [{ actionId: "backroom_pressure", riskPct: 100, expiresAtTick: 999, tick: 1 }],
        scandalEvents: [{ type: "stale", tick: 1, label: "Stale", riskPct: 100 }]
      }
    };
    const original = structuredClone(source);
    const seeded = applyHostedE2eScenario(
      source,
      "building-parity-non-spawn",
      "2026-07-29T22:00:00.000Z"
    );
    const player = Object.values(seeded.state.playersById)[0];
    const playerResources = seeded.state.resourceStatesById[player.resourceStateId];

    expect(source).toEqual(original);
    expect(seeded.state.root.tick).toBe(5);
    expect(seeded.state.serverInstance.currentTick).toBe(5);
    expect(playerResources.balances["metal-parts"]).toBe(20);
    const seededBuildings = Object.values(seeded.state.buildingsById);
    const seededCasino = seededBuildings.find((building) => building.buildingTypeId === "casino");
    const seededCentralBank = seededBuildings.find((building) => building.buildingTypeId === "central_bank");
    const seededCityHall = seededBuildings.find((building) => building.buildingTypeId === "city_hall");
    const seededLobbyClub = seededBuildings.find((building) => building.buildingTypeId === "lobby_club");
    expect(seededCasino?.metadata?.casino).toEqual({
      launderedEvents: [],
      auditRiskBonuses: [],
      lastAuditCheckTick: 1_000_000_000,
      auditLog: []
    });
    expect(seededCentralBank?.metadata?.centralBank).toEqual({
      lastInterestTick: 5,
      lastOversightTick: 1_000_000_000,
      riskEvents: [],
      currencyInterventions: [],
      oversightEvents: [],
      interestEvents: []
    });
    expect(seededCityHall?.metadata?.cityHall).toEqual({
      officialCoverByDistrictId: {},
      lastScandalCheckTick: 1_000_000_000,
      riskEvents: [],
      scandalEvents: []
    });
    expect(seededLobbyClub?.metadata?.lobbyClub).toEqual({
      lastScandalCheckTick: 1_000_000_000,
      riskEvents: [],
      scandalEvents: []
    });
    const modeConfig = resolveModeConfig("free");
    const lateParityState = structuredClone(seeded.state);
    lateParityState.root.tick = 122;
    lateParityState.serverInstance.currentTick = 122;
    expect(applyCasinoAuditChecks(
      lateParityState,
      modeConfig.balance.casino!,
      modeConfig.tickRateMs
    )).toBe(lateParityState);
    const postCentralBankState = applyCentralBankPassiveInterestAndOversight(
      lateParityState,
      modeConfig.balance.centralBank!,
      modeConfig.tickRateMs,
      modeConfig.balance.lobbyClub
    );
    expect(postCentralBankState).not.toBe(lateParityState);
    expect(
      seededCentralBank
        ? postCentralBankState.buildingsById[seededCentralBank.id]?.metadata?.centralBank
        : undefined
    ).toMatchObject({
      lastInterestTick: 122,
      lastOversightTick: 1_000_000_000,
      riskEvents: [],
      currencyInterventions: [],
      oversightEvents: [],
      interestEvents: [expect.objectContaining({ tick: 122 })]
    });
    const postScandalCheckState = applyCityHallCorruptionScandals(
      lateParityState,
      modeConfig.balance.cityHall!,
      modeConfig.tickRateMs,
      modeConfig.balance.lobbyClub
    );
    expect(postScandalCheckState).toBe(lateParityState);
    expect(applyLobbyClubScandalChecks(
      lateParityState,
      modeConfig.balance.lobbyClub!,
      modeConfig.tickRateMs
    )).toBe(lateParityState);
    const stableCasino = seededCasino
      ? lateParityState.buildingsById[seededCasino.id]
      : undefined;
    const stableCentralBank = seededCentralBank
      ? lateParityState.buildingsById[seededCentralBank.id]
      : undefined;
    const stableCityHall = seededCityHall
      ? postScandalCheckState.buildingsById[seededCityHall.id]
      : undefined;
    const stableLobbyClub = seededLobbyClub
      ? lateParityState.buildingsById[seededLobbyClub.id]
      : undefined;
    expect(stableCasino).toBeDefined();
    expect(validateCasinoAction({
      state: lateParityState,
      building: stableCasino!,
      actionId: modeConfig.balance.casino!.quietBackroom.actionId,
      balances: { "dirty-cash": 1_000_000 },
      casinoConfig: modeConfig.balance.casino
    })).toBeNull();
    expect(validateCasinoAction({
      state: lateParityState,
      building: stableCasino!,
      actionId: modeConfig.balance.casino!.vipNight.actionId,
      balances: {},
      casinoConfig: modeConfig.balance.casino
    })).toBeNull();
    const centralBankDistrict = stableCentralBank
      ? lateParityState.districtsById[stableCentralBank.districtId]
      : undefined;
    expect(centralBankDistrict).toBeDefined();
    expect(validateCentralBankAction({
      state: lateParityState,
      building: stableCentralBank!,
      actionId: modeConfig.balance.centralBank!.liquidityInjection.actionId,
      balances: {},
      districtInfluence: centralBankDistrict!.influence,
      config: modeConfig.balance.centralBank,
      payload: {
        districtId: centralBankDistrict!.id,
        buildingId: stableCentralBank!.id,
        actionId: modeConfig.balance.centralBank!.liquidityInjection.actionId
      }
    })).toBeNull();
    const cityHallDistrict = stableCityHall
      ? postScandalCheckState.districtsById[stableCityHall.districtId]
      : undefined;
    expect(cityHallDistrict).toBeDefined();
    expect(validateCityHallAction({
      state: postScandalCheckState,
      building: stableCityHall!,
      district: cityHallDistrict!,
      actionId: "city_contract",
      balances: {},
      districtInfluence: cityHallDistrict!.influence,
      config: modeConfig.balance.cityHall,
      payload: {
        districtId: cityHallDistrict!.id,
        buildingId: stableCityHall!.id,
        actionId: "city_contract"
      }
    })).toBeNull();
    const lobbyClubDistrict = stableLobbyClub
      ? lateParityState.districtsById[stableLobbyClub.districtId]
      : undefined;
    expect(lobbyClubDistrict).toBeDefined();
    expect(validateLobbyClubAction({
      state: lateParityState,
      building: stableLobbyClub!,
      actionId: modeConfig.balance.lobbyClub!.backroomPressure.actionId,
      balances: { cash: 1_000_000 },
      districtInfluence: lobbyClubDistrict!.influence,
      config: modeConfig.balance.lobbyClub
    })).toBeNull();
    expect(validateLobbyClubAction({
      state: lateParityState,
      building: stableLobbyClub!,
      actionId: modeConfig.balance.lobbyClub!.mediaScreen.actionId,
      balances: { cash: 1_000_000 },
      districtInfluence: lobbyClubDistrict!.influence,
      config: modeConfig.balance.lobbyClub
    })).toBeNull();
    expect(
      hostedBuildingParityNonSpawnMatrix
        .flatMap((entry) => entry.coveredBuildingTypeIds)
        .sort()
    ).toEqual([
      "airport",
      "casino",
      "central_bank",
      "city_hall",
      "court",
      "lobby_club",
      "parliament",
      "port",
      "power_station",
      "recycling_center",
      "stock_exchange",
      "vip_lounge",
      "warehouse"
    ]);

    for (const entry of hostedBuildingParityNonSpawnMatrix) {
      const district = seeded.state.districtsById[entry.districtId];
      const buildings = district.buildingIds
        .map((buildingId) => seeded.state.buildingsById[buildingId]);
      expect(district.ownerPlayerId, entry.key).toBe(player.id);
      expect(district.status, entry.key).toBe("claimed");
      expect(
        buildings.map((building) => building.buildingTypeId).sort(),
        entry.key
      ).toEqual([...entry.expectedDistrictBuildingTypeIds].sort());
      for (const building of buildings) {
        expect(building, entry.key).toMatchObject({
          ownerPlayerId: player.id,
          status: "active",
          actionCooldowns: {}
        });
      }
    }
  });

  it("prepares three canonical players for cross-client P0 flows", () => {
    const source = createMultiplayerSnapshot();
    const original = structuredClone(source);
    const seeded = applyHostedE2eScenario(
      source,
      "multiplayer-core",
      "2026-07-29T22:00:00.000Z"
    );
    const [creator, target, hunter] = Object.values(seeded.state.playersById)
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(source).toEqual(original);
    expect(seeded.state.root.tick).toBe(20);
    expect(seeded.state.serverInstance.currentTick).toBe(20);
    expect(creator.homeDistrictId).toBe("district:1");
    expect(target.homeDistrictId).toBe("district:2");
    expect(hunter.homeDistrictId).toBe("district:25");
    expect(seeded.state.districtsById["district:1"].ownerPlayerId).toBe(creator.id);
    expect(seeded.state.districtsById["district:1"].influence).toBe(10_000);
    expect(seeded.state.districtsById["district:2"].ownerPlayerId).toBe(target.id);
    expect(seeded.state.districtsById["district:26"].ownerPlayerId).toBe(hunter.id);
    expect(seeded.state.districtsById["district:6"]).toMatchObject({
      ownerPlayerId: null,
      status: "neutral"
    });
    expect(seeded.state.resourceStatesById[creator.resourceStateId].balances).toMatchObject({
      cash: 1_000_000,
      chemicals: 100
    });
    expect(creator.population).toBe(500);
    expect(seeded.state.resourceStatesById[hunter.resourceStateId].balances).toMatchObject({
      cash: 1_000_000,
      bazooka: 20
    });
    expect(hunter.population).toBe(500);
    expect(Object.values(seeded.state.notificationsById)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipientId: creator.id,
        category: "report.spy",
        payload: expect.objectContaining({
          targetDistrictId: "district:6",
          purpose: "occupy_empty_district",
          result: "success"
        })
      }),
      expect.objectContaining({
        recipientId: hunter.id,
        category: "report.spy",
        payload: expect.objectContaining({
          targetDistrictId: "district:2",
          purpose: "attack_owned_district",
          result: "success"
        })
      })
    ]));
  });

  it("prepares five canonical players for guarded social races", () => {
    const source = createSocialConcurrencySnapshot();
    const original = structuredClone(source);
    const seeded = applyHostedE2eScenario(
      source,
      "social-concurrency-privacy",
      "2026-07-29T22:00:00.000Z"
    );
    const [creator, target, hunterA, hunterB, hunterC] = Object.values(seeded.state.playersById)
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(source).toEqual(original);
    expect(seeded.state.root.tick).toBe(20);
    expect(seeded.state.root.playerIds).toHaveLength(5);
    expect(seeded.state.districtsById["district:2"].ownerPlayerId).toBe(target.id);
    expect(seeded.state.districtsById["district:4"].ownerPlayerId).toBe(target.id);
    expect(seeded.state.districtsById["district:25"].ownerPlayerId).toBe(hunterA.id);
    expect(seeded.state.districtsById["district:26"].ownerPlayerId).toBe(hunterB.id);
    expect(seeded.state.districtsById["district:24"].ownerPlayerId).toBe(hunterC.id);
    expect(seeded.state.resourceStatesById[creator.resourceStateId].balances.chemicals)
      .toBe(100);
    expect(seeded.state.resourceStatesById[hunterA.resourceStateId].balances.bazooka)
      .toBe(20);
    expect(seeded.state.resourceStatesById[hunterB.resourceStateId].balances.bazooka)
      .toBe(20);
    expect(seeded.state.resourceStatesById[hunterC.resourceStateId].balances.cash)
      .toBe(1_000_000);
    expect(Object.values(seeded.state.notificationsById)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipientId: hunterA.id,
        payload: expect.objectContaining({ targetDistrictId: "district:2" })
      }),
      expect.objectContaining({
        recipientId: hunterB.id,
        payload: expect.objectContaining({ targetDistrictId: "district:2" })
      })
    ]));
  });
});

const createBuildingActionSnapshot = (): InstanceSnapshotDto => {
  const snapshot = createSnapshot();
  const districtIds = Array.from(new Set(
    [...hostedBuildingActionMatrix.map((entry) => entry.districtId), "district:16"]
  ));
  seedCanonicalDistricts(snapshot, districtIds);
  return snapshot;
};

const createNonSpawnBuildingParitySnapshot = (): InstanceSnapshotDto => {
  const snapshot = createSnapshot();
  seedCanonicalDistricts(
    snapshot,
    hostedBuildingParityNonSpawnMatrix.map((entry) => entry.districtId)
  );
  return snapshot;
};

const createMultiplayerSnapshot = (): InstanceSnapshotDto => {
  const snapshot = createSnapshot();
  const firstPlayer = snapshot.state.playersById["player:1"];
  firstPlayer.name = "HostedCoreA";
  firstPlayer.homeDistrictId = "district:1";
  const extraPlayers = [
    createPlayerFixture({
      id: "player:2",
      accountId: "account:2",
      serverInstanceId: snapshot.instanceId,
      name: "HostedCoreB",
      homeDistrictId: "district:2",
      resourceStateId: "resource:2",
      cooldownStateId: "cooldown:2",
      effectStateId: "effect:2",
      policeStateId: "police:2"
    }),
    createPlayerFixture({
      id: "player:3",
      accountId: "account:3",
      serverInstanceId: snapshot.instanceId,
      name: "HostedCoreC",
      homeDistrictId: "district:3",
      resourceStateId: "resource:3",
      cooldownStateId: "cooldown:3",
      effectStateId: "effect:3",
      policeStateId: "police:3"
    })
  ];
  for (const player of extraPlayers) {
    snapshot.state.playersById[player.id] = player;
    snapshot.state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({
      id: player.resourceStateId,
      ownerType: "player",
      ownerId: player.id
    });
    snapshot.state.root.playerIds.push(player.id);
  }
  seedCanonicalDistricts(snapshot, [
    "district:1",
    "district:2",
    "district:3",
    "district:4",
    "district:5",
    "district:6",
    "district:24",
    "district:25",
    "district:26"
  ]);
  snapshot.integrity.entityCounts.players = 3;
  return snapshot;
};

const createSocialConcurrencySnapshot = (): InstanceSnapshotDto => {
  const snapshot = createMultiplayerSnapshot();
  for (const [index, name] of [[4, "HostedCoreD"], [5, "HostedCoreE"]] as const) {
    const player = createPlayerFixture({
      id: `player:${index}`,
      accountId: `account:${index}`,
      serverInstanceId: snapshot.instanceId,
      name,
      homeDistrictId: `district:${index}`,
      resourceStateId: `resource:${index}`,
      cooldownStateId: `cooldown:${index}`,
      effectStateId: `effect:${index}`,
      policeStateId: `police:${index}`
    });
    snapshot.state.playersById[player.id] = player;
    snapshot.state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({
      id: player.resourceStateId,
      ownerType: "player",
      ownerId: player.id
    });
    snapshot.state.root.playerIds.push(player.id);
  }
  snapshot.integrity.entityCounts.players = 5;
  return snapshot;
};

const seedCanonicalDistricts = (
  snapshot: InstanceSnapshotDto,
  districtIds: string[]
): void => {
  for (const districtId of districtIds) {
    const manifestDistrict = empireStreetsCityMapDistrictsById.get(districtId);
    if (!manifestDistrict) throw new Error(`Missing canonical district ${districtId}.`);
    const district = createSharedCityDistrict({
      instanceId: snapshot.instanceId,
      districtId,
      name: manifestDistrict.name,
      ownerPlayerId: null,
      slotCount: 4,
      zone: manifestDistrict.zone,
      buildingSetKey: manifestDistrict.buildingSetKey,
      adjacentDistrictIds: manifestDistrict.neighborIds
    });
    snapshot.state.districtsById[district.id] = district;
    seedSharedCityDistrictBuildings(snapshot.state, snapshot.instanceId, district, {});
  }
  snapshot.state.root.districtIds = Object.keys(snapshot.state.districtsById);
  snapshot.integrity.entityCounts.districts = Object.keys(snapshot.state.districtsById).length;
  snapshot.integrity.entityCounts.buildings = Object.keys(snapshot.state.buildingsById).length;
};
