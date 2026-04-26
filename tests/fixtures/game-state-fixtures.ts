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
  version: 1,
  ...overrides
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
    playerBalances?: Record<string, number>;
    productionResourceKey?: string;
    productionStoredAmount?: number;
  } = {}
) => {
  const state = createCoreStateFixture();
  const building = createFixedBuildingFixture(buildingTypeId, options.buildingOverrides);

  state.buildingsById[building.id] = building;
  state.districtsById[building.districtId] = {
    ...state.districtsById[building.districtId],
    buildingIds: [building.id]
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

  return { state, building };
};

export const createCombatStateFixture = (instanceId = "instance:1") => {
  const state = createInitialState(instanceId, "free");
  const attacker = createPlayerFixture({
    serverInstanceId: instanceId,
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
      cash: 1000
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
