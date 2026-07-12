import type {
  AttackDistrictCommand,
  BuildStructureCommand,
  CollectProductionCommand,
  CraftItemCommand,
  HeistDistrictCommand,
  OccupyDistrictCommand,
  PlaceDefenseCommand,
  PlaceTrapCommand,
  RemoveDefenseCommand,
  RobDistrictCommand,
  RunBuildingActionCommand,
  SelectSpawnDistrictCommand,
  SpyDistrictCommand,
  UpgradeBuildingCommand
} from "@empire/shared-types";

export const createBuildStructureCommandFixture = (
  overrides: Partial<BuildStructureCommand> = {}
): BuildStructureCommand => ({
  id: "command:1",
  type: "build-structure",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:1",
    buildingTypeId: "safehouse",
    slotIndex: 0
  },
  clientRequestId: null,
  ...overrides
});

export const createAttackDistrictCommandFixture = (
  overrides: Partial<AttackDistrictCommand> = {}
): AttackDistrictCommand => ({
  id: "command:attack:1",
  type: "attack-district",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:2",
    sourceDistrictId: "district:1"
  },
  clientRequestId: null,
  ...overrides
});

export const createCollectProductionCommandFixture = (
  overrides: Partial<CollectProductionCommand> = {}
): CollectProductionCommand => ({
  id: "command:collect:1",
  type: "collect-production",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:1",
    buildingId: "building:pharmacy:1"
  },
  clientRequestId: null,
  ...overrides
});

export const createCraftItemCommandFixture = (
  overrides: Partial<CraftItemCommand> = {}
): CraftItemCommand => {
  const { payload, ...rest } = overrides;
  return {
  id: "command:craft:1",
  type: "craft-item",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:1",
    buildingId: "building:pharmacy:1",
    recipeId: "stim-pack",
    quantity: 1,
    ...payload
  },
  clientRequestId: null,
  ...rest
  };
};

export const createRunBuildingActionCommandFixture = (
  overrides: Partial<RunBuildingActionCommand> = {}
): RunBuildingActionCommand => ({
  id: "command:building-action:1",
  type: "run-building-action",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:1",
    buildingId: "building:district-1:factory:1",
    actionId: "produce_tech_core"
  },
  clientRequestId: null,
  ...overrides
});

export const createUpgradeBuildingCommandFixture = (
  overrides: Partial<UpgradeBuildingCommand> = {}
): UpgradeBuildingCommand => ({
  id: "command:upgrade-building:1",
  type: "upgrade-building",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:1",
    buildingId: "building:district-1:casino:1"
  },
  clientRequestId: null,
  ...overrides
});

export const createSpyDistrictCommandFixture = (
  overrides: Partial<SpyDistrictCommand> = {}
): SpyDistrictCommand => ({
  id: "command:spy:1",
  type: "spy-district",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:2",
    sourceDistrictId: "district:1"
  },
  clientRequestId: null,
  ...overrides
});

export const createOccupyDistrictCommandFixture = (
  overrides: Partial<OccupyDistrictCommand> = {}
): OccupyDistrictCommand => ({
  id: "command:occupy:1",
  type: "occupy-district",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:2",
    sourceDistrictId: "district:1"
  },
  clientRequestId: null,
  ...overrides
});

export const createRobDistrictCommandFixture = (
  overrides: Partial<RobDistrictCommand> = {}
): RobDistrictCommand => ({
  id: "command:rob:1",
  type: "rob-district",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    targetDistrictId: "district:2",
    sourceDistrictId: "district:1"
  },
  clientRequestId: null,
  ...overrides
});

export const createHeistDistrictCommandFixture = (
  overrides: Partial<HeistDistrictCommand> = {}
): HeistDistrictCommand => ({
  id: "command:heist:1",
  type: "heist-district",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    targetDistrictId: "district:2",
    sourceDistrictId: "district:1",
    style: "balanced",
    gangMembersSent: 10
  },
  clientRequestId: null,
  ...overrides
});

export const createPlaceDefenseCommandFixture = (
  overrides: Partial<PlaceDefenseCommand> = {}
): PlaceDefenseCommand => ({
  id: "command:place-defense:1",
  type: "place-defense",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    targetDistrictId: "district:1",
    defenseItemId: "barricades",
    amount: 1
  },
  clientRequestId: null,
  ...overrides
});

export const createRemoveDefenseCommandFixture = (
  overrides: Partial<RemoveDefenseCommand> = {}
): RemoveDefenseCommand => ({
  id: "command:remove-defense:1",
  type: "remove-defense",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    targetDistrictId: "district:1",
    defenseItemId: "barricades",
    amount: 1
  },
  clientRequestId: null,
  ...overrides
});

export const createPlaceTrapCommandFixture = (
  overrides: Partial<PlaceTrapCommand> = {}
): PlaceTrapCommand => ({
  id: "command:trap:1",
  type: "place-trap",
  mode: "free",
  playerId: "player:2",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:2"
  },
  clientRequestId: null,
  ...overrides
});

export const createSelectSpawnDistrictCommandFixture = (
  overrides: Partial<SelectSpawnDistrictCommand> = {}
): SelectSpawnDistrictCommand => ({
  id: "command:select-spawn:1",
  type: "select-spawn-district",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:spawn:1"
  },
  clientRequestId: null,
  ...overrides
});
