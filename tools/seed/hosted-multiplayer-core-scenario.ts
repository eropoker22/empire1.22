import type { Notification } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";

const scenarioTick = 20;
const roleDistricts = Object.freeze({
  creator: Object.freeze(["district:1", "district:5"]),
  target: Object.freeze(["district:2", "district:3"]),
  hunter: Object.freeze(["district:4", "district:25", "district:26"]),
  neutral: Object.freeze(["district:6", "district:24"])
});

export const applyHostedMultiplayerCoreScenario = (
  snapshot: InstanceSnapshotDto,
  createdAt: string
): void => {
  const players = Object.values(snapshot.state.playersById)
    .filter((player) => player.status === "active" && Boolean(player.homeDistrictId))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (players.length !== 3) {
    throw new Error("Hosted multiplayer scenario requires exactly three ready active players.");
  }
  const [creator, target, hunter] = players;

  snapshot.state.root.tick = scenarioTick;
  snapshot.state.serverInstance.currentTick = scenarioTick;
  snapshot.runtime.commandRateLimitWindow = {
    tick: scenarioTick,
    commandCountsByPlayerId: {}
  };
  snapshot.state.bountiesById = {};
  snapshot.state.alliancesById = {};
  snapshot.state.allianceInvitesById = {};
  snapshot.state.allianceChatMessagesById = {};
  snapshot.state.root.allianceIds = [];

  preparePlayer(snapshot, creator, roleDistricts.creator[0], {
    chemicals: 100
  });
  preparePlayer(snapshot, target, roleDistricts.target[0], {});
  preparePlayer(snapshot, hunter, roleDistricts.hunter[1], {
    bazooka: 20
  });
  hunter.attackLoadout = { bazooka: 20 };

  claimDistricts(snapshot, roleDistricts.creator, creator.id);
  claimDistricts(snapshot, roleDistricts.target, target.id);
  claimDistricts(snapshot, roleDistricts.hunter, hunter.id);
  claimDistricts(snapshot, roleDistricts.neutral, null);

  seedSuccessfulSpyIntel(snapshot, {
    playerId: creator.id,
    sourceDistrictId: "district:5",
    targetDistrictId: "district:6",
    targetOwnerPlayerId: null,
    createdAt
  });
  seedSuccessfulSpyIntel(snapshot, {
    playerId: hunter.id,
    sourceDistrictId: "district:26",
    targetDistrictId: "district:2",
    targetOwnerPlayerId: target.id,
    createdAt
  });
};

const preparePlayer = (
  snapshot: InstanceSnapshotDto,
  player: InstanceSnapshotDto["state"]["playersById"][string],
  homeDistrictId: string,
  roleBalances: Record<string, number>
): void => {
  const resourceState = snapshot.state.resourceStatesById[player.resourceStateId];
  if (!resourceState) throw new Error(`Hosted multiplayer resource state is missing for ${player.id}.`);
  resourceState.balances = {
    ...resourceState.balances,
    cash: 1_000_000,
    "dirty-cash": 1_000_000,
    population: 500,
    "gang-members": 500,
    chemicals: 0,
    biomass: 0,
    "metal-parts": 0,
    bazooka: 0,
    ...roleBalances
  };
  resourceState.lastUpdatedTick = scenarioTick;
  resourceState.version += 1;

  player.homeDistrictId = homeDistrictId;
  player.population = 500;
  player.allianceId = null;
  player.lastActionAt = null;
  player.version += 1;

  const cooldownState = snapshot.state.cooldownStatesById[player.cooldownStateId];
  snapshot.state.cooldownStatesById[player.cooldownStateId] = cooldownState
    ? {
        ...cooldownState,
        cooldowns: {},
        version: cooldownState.version + 1
      }
    : {
        id: player.cooldownStateId,
        ownerType: "player",
        ownerId: player.id,
        cooldowns: {},
        version: 1
      };
  if (snapshot.state.playerSpyOperationStatesByPlayerId) {
    delete snapshot.state.playerSpyOperationStatesByPlayerId[player.id];
  }
};

const claimDistricts = (
  snapshot: InstanceSnapshotDto,
  districtIds: readonly string[],
  ownerPlayerId: string | null
): void => {
  for (const districtId of districtIds) {
    const district = snapshot.state.districtsById[districtId];
    if (!district) throw new Error(`Hosted multiplayer district is missing: ${districtId}.`);
    district.ownerPlayerId = ownerPlayerId;
    district.controllerAllianceId = null;
    district.status = ownerPlayerId ? "claimed" : "neutral";
    district.heat = 0;
    district.influence = ownerPlayerId ? 10_000 : 0;
    district.defenseLoadout = {};
    district.operationLocks = {};
    district.lockdownUntilTick = null;
    district.heistProtectedUntilTick = null;
    district.attackProtectedUntilTick = null;
    district.stabilizingUntilTick = null;
    district.neutralLootPool = null;
    district.version += 1;

    for (const buildingId of district.buildingIds) {
      const building = snapshot.state.buildingsById[buildingId];
      if (!building) continue;
      building.ownerPlayerId = ownerPlayerId as typeof building.ownerPlayerId;
      building.status = ownerPlayerId ? "active" : "disabled";
      building.actionCooldowns = {};
      building.version += 1;
    }
  }
};

const seedSuccessfulSpyIntel = (
  snapshot: InstanceSnapshotDto,
  input: {
    playerId: string;
    sourceDistrictId: string;
    targetDistrictId: string;
    targetOwnerPlayerId: string | null;
    createdAt: string;
  }
): void => {
  const targetDistrict = snapshot.state.districtsById[input.targetDistrictId];
  if (!targetDistrict) throw new Error(`Hosted multiplayer intel target is missing: ${input.targetDistrictId}.`);
  const notificationId = `notification:hosted-multiplayer:${input.playerId}:${input.targetDistrictId}`;
  const notification: Notification = {
    id: notificationId,
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.spy",
    title: `Spy report: ${input.targetDistrictId}`,
    bodyKey: "report.spy",
    payload: {
      reportId: `report:hosted-multiplayer:${input.playerId}:${input.targetDistrictId}`,
      reportType: "spy",
      actionType: "spy-district",
      playerId: input.playerId,
      attackerPlayerId: input.playerId,
      sourceDistrictId: input.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      targetOwnerPlayerId: input.targetOwnerPlayerId,
      targetStateAtSpy: input.targetOwnerPlayerId ? "owned" : "empty",
      targetSecurityRevision: targetDistrict.securityRevision,
      purpose: input.targetOwnerPlayerId ? "attack_owned_district" : "occupy_empty_district",
      result: "success",
      authorizationScope: input.targetOwnerPlayerId ? "attack_owned_district" : "occupy_empty_district",
      issuedAtTick: scenarioTick,
      authorizationExpiresAtTick: scenarioTick + 120,
      tick: scenarioTick,
      createdAt: input.createdAt
    },
    createdAt: input.createdAt,
    readAt: null
  };
  snapshot.state.notificationsById[notification.id] = notification;
  if (!snapshot.state.root.notificationIds.includes(notification.id)) {
    snapshot.state.root.notificationIds.push(notification.id);
  }
};
