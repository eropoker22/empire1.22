import { DEFAULT_PLAYER_COLOR, type Alliance, type Building, type District, type Player, type ResourceState } from "@empire/shared-types";
import { createInitialState } from "@empire/game-core";

export const createPlayerFixture = (overrides: Partial<Player> = {}): Player => ({
  id: "player:1",
  accountId: "account:1",
  serverInstanceId: "instance:1",
  name: "Test Player",
  factionId: "mafian",
  color: DEFAULT_PLAYER_COLOR,
  status: "active",
  allianceId: null,
  homeDistrictId: "district:1",
  attackLoadout: {},
  resourceStateId: "resource:1",
  cooldownStateId: "cooldown:1",
  effectStateId: "effect:1",
  policeStateId: "police:1",
  createdAt: new Date(0).toISOString(),
  lastActionAt: null,
  version: 1,
  ...overrides
});

export const createDistrictFixture = (overrides: Partial<District> = {}): District => ({
  id: "district:1",
  serverInstanceId: "instance:1",
  templateId: "template:1",
  name: "Starter District",
  zone: "starter",
  adjacentDistrictIds: [],
  ownerPlayerId: "player:1",
  controllerAllianceId: null,
  heat: 0,
  influence: 0,
  buildingIds: [],
  defenseLoadout: {},
  slotCount: 3,
  status: "claimed",
  resourceModifiers: {},
  securityRevision: 1,
  version: 1,
  ...overrides,
  conflictRevision: overrides.conflictRevision ?? 1
});

export const createAllianceFixture = (overrides: Partial<Alliance> = {}): Alliance => ({
  id: "alliance:1",
  serverInstanceId: "instance:1",
  name: "Alliance",
  tag: "AL",
  ownerPlayerId: "player:1",
  memberIds: ["player:1"],
  status: "active",
  createdAt: new Date(0).toISOString(),
  version: 1,
  ...overrides
});

export const createCoreStateFixture = (instanceId = "instance:1") => {
  const state = createInitialState(instanceId, "free");
  const player = createPlayerFixture({
    serverInstanceId: instanceId
  });
  const district = createDistrictFixture({
    serverInstanceId: instanceId
  });
  const playerResources = createResourceStateFixture({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {
      cash: 1000
    }
  });

  state.playersById[player.id] = player;
  state.districtsById[district.id] = district;
  state.resourceStatesById[playerResources.id] = playerResources;
  state.root.playerIds.push(player.id);
  state.root.districtIds.push(district.id);

  return state;
};

export const createFixedBuildingFixture = (
  buildingTypeId = "pharmacy",
  overrides: Partial<Building> = {}
): Building => ({
  id: `building:district-1:${buildingTypeId}:1`,
  serverInstanceId: "instance:1",
  districtId: "district:1",
  ownerPlayerId: "player:1",
  buildingTypeId,
  level: 1,
  status: "active",
  processing: null,
  actionCooldowns: {},
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(0).toISOString(),
  version: 1,
  ...overrides
});

export const createCoreStateWithFixedBuildingFixture = (
  buildingTypeId = "pharmacy",
  options: {
    buildingOverrides?: Partial<Building>;
    includeWarehouse?: boolean;
    playerBalances?: Record<string, number>;
    productionResourceKey?: string;
    productionStoredAmount?: number;
  } = {}
) => {
  const state = createCoreStateFixture();
  const building = createFixedBuildingFixture(buildingTypeId, options.buildingOverrides);
  const warehouse = options.includeWarehouse && buildingTypeId !== "warehouse"
    ? createFixedBuildingFixture("warehouse", {
        id: "building:district-1:warehouse:1"
      })
    : null;

  state.buildingsById[building.id] = building;
  if (warehouse) {
    state.buildingsById[warehouse.id] = warehouse;
  }
  state.districtsById[building.districtId] = {
    ...state.districtsById[building.districtId],
    buildingIds: warehouse ? [building.id, warehouse.id] : [building.id]
  };

  if (options.playerBalances) {
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: options.playerBalances
    };
  }

  if (options.productionResourceKey) {
    const resourceStateId = `resource:${building.id}`;
    state.resourceStatesById[resourceStateId] = createResourceStateFixture({
      id: resourceStateId,
      ownerType: "building",
      ownerId: building.id,
      balances: {
        [options.productionResourceKey]: options.productionStoredAmount ?? 0
      },
      lastUpdatedTick: state.root.tick
    });
  }

  return { state, building, warehouse };
};

export const createCombatStateFixture = (instanceId = "instance:1") => {
  const state = createInitialState(instanceId, "free");
  const attacker = createPlayerFixture({
    serverInstanceId: instanceId,
    population: 100,
    attackLoadout: {
      "baseball-bat": 1,
      pistol: 1,
      grenade: 1,
      smg: 1,
      bazooka: 1
    }
  });
  const defender = createPlayerFixture({
    id: "player:2",
    accountId: "account:2",
    serverInstanceId: instanceId,
    name: "Defender",
    homeDistrictId: "district:2",
    attackLoadout: {}
  });
  const ownedDistrict = createDistrictFixture({
    id: "district:1",
    serverInstanceId: instanceId,
    adjacentDistrictIds: ["district:2"],
    ownerPlayerId: attacker.id
  });
  const defendedDistrict = createDistrictFixture({
    id: "district:2",
    serverInstanceId: instanceId,
    adjacentDistrictIds: ["district:1", "district:3"],
    ownerPlayerId: defender.id,
    defenseLoadout: {
      vest: 2,
      barricades: 1,
      cameras: 5,
      "defense-tower": 1,
      alarm: 5
    }
  });

  state.playersById[attacker.id] = attacker;
  state.playersById[defender.id] = defender;
  state.districtsById[ownedDistrict.id] = ownedDistrict;
  state.districtsById[defendedDistrict.id] = defendedDistrict;
  state.resourceStatesById[attacker.resourceStateId] = createResourceStateFixture({
    id: attacker.resourceStateId,
    ownerType: "player",
    ownerId: attacker.id,
    balances: {
      cash: 1000,
      population: 100
    }
  });
  state.resourceStatesById[defender.resourceStateId] = createResourceStateFixture({
    id: defender.resourceStateId,
    ownerType: "player",
    ownerId: defender.id,
    balances: {
      cash: 1000
    }
  });
  seedSuccessfulSpyIntel(state, attacker.id, ownedDistrict.id, defendedDistrict.id, defender.id);
  state.root.playerIds.push(attacker.id, defender.id);
  state.root.districtIds.push(ownedDistrict.id, defendedDistrict.id);

  return state;
};

export const createResourceStateFixture = (
  overrides: Partial<ResourceState> & Pick<ResourceState, "id" | "ownerType" | "ownerId">,
): ResourceState => ({
  id: overrides.id,
  ownerType: overrides.ownerType,
  ownerId: overrides.ownerId,
  balances: overrides.balances ?? {},
  incomeModifiers: overrides.incomeModifiers ?? {},
  lastUpdatedTick: overrides.lastUpdatedTick ?? 0,
  version: overrides.version ?? 1
});

export const seedSuccessfulSpyIntel = (
  state: ReturnType<typeof createInitialState>,
  playerId: string,
  sourceDistrictId: string,
  targetDistrictId: string,
  targetOwnerPlayerId: string | null = state.districtsById[targetDistrictId]?.ownerPlayerId ?? null
): void => {
  const notificationId = `notification:spy-success:${playerId}:${targetDistrictId}`;
  state.notificationsById[notificationId] = {
    id: notificationId,
    recipientType: "player",
    recipientId: playerId,
    category: "report.spy",
    title: `Spy report: ${targetDistrictId}`,
    bodyKey: "report.spy",
    payload: {
      reportId: `report:spy-success:${playerId}:${targetDistrictId}`,
      reportType: "spy",
      actionType: "spy-district",
      playerId,
      attackerPlayerId: playerId,
      sourceDistrictId,
      targetDistrictId,
      targetOwnerPlayerId,
      targetStateAtSpy: targetOwnerPlayerId ? "owned" : "empty",
      targetSecurityRevision: state.districtsById[targetDistrictId]?.securityRevision ?? 1,
      purpose: targetOwnerPlayerId ? "attack_owned_district" : "occupy_empty_district",
      result: "success",
      detectedDefense: {},
      trapDetected: false,
      authorizationScope: targetOwnerPlayerId ? "attack_owned_district" : "occupy_empty_district",
      issuedAtTick: state.root.tick,
      authorizationExpiresAtTick: state.root.tick + 120,
      tick: state.root.tick,
      createdAt: new Date(0).toISOString(),
      eventId: null
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  };
  if (!state.root.notificationIds.includes(notificationId)) {
    state.root.notificationIds.push(notificationId);
  }
};
