import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";
import hostedBuildingParityNonSpawnMatrixJson from "./hosted-building-parity-non-spawn-matrix.json";

interface HostedBuildingParityMatrixEntry {
  key: string;
  districtId: string;
  expectedDistrictBuildingTypeIds: string[];
  coveredBuildingTypeIds: string[];
}

const hostedBuildingParityNonSpawnMatrix =
  hostedBuildingParityNonSpawnMatrixJson as HostedBuildingParityMatrixEntry[];
const STATIC_PARITY_GUARD_TICK = 1_000_000_000;
const PORT_PARITY_METAL_PARTS_BALANCE = 20;

export const applyHostedBuildingParityNonSpawnScenario = (
  snapshot: InstanceSnapshotDto
): void => {
  const players = Object.values(snapshot.state.playersById)
    .filter((player) => player.status === "active" && Boolean(player.homeDistrictId));
  if (players.length !== 1) {
    throw new Error("Hosted non-spawn building parity scenario requires exactly one ready active player.");
  }
  const player = players[0];
  const scenarioTick = 5;
  const resourceState = snapshot.state.resourceStatesById[player.resourceStateId];
  if (!resourceState) {
    throw new Error("Hosted non-spawn building parity player resource state is missing.");
  }

  snapshot.state.root.tick = scenarioTick;
  snapshot.state.serverInstance.currentTick = scenarioTick;
  snapshot.runtime.commandRateLimitWindow = {
    tick: scenarioTick,
    commandCountsByPlayerId: {}
  };
  resourceState.balances = {
    ...resourceState.balances,
    "metal-parts": PORT_PARITY_METAL_PARTS_BALANCE
  };
  resourceState.lastUpdatedTick = scenarioTick;
  resourceState.version += 1;

  for (const entry of hostedBuildingParityNonSpawnMatrix) {
    const district = snapshot.state.districtsById[entry.districtId];
    if (!district) {
      throw new Error(`Hosted non-spawn building parity district is missing: ${entry.districtId}.`);
    }
    const buildings = district.buildingIds.map((buildingId) => {
      const building = snapshot.state.buildingsById[buildingId];
      if (!building) {
        throw new Error(`Hosted non-spawn building parity building is missing: ${buildingId}.`);
      }
      return building;
    });
    const actualBuildingTypeIds = buildings
      .map((building) => building.buildingTypeId)
      .sort();
    const expectedBuildingTypeIds = [...entry.expectedDistrictBuildingTypeIds].sort();
    if (JSON.stringify(actualBuildingTypeIds) !== JSON.stringify(expectedBuildingTypeIds)) {
      throw new Error(
        `Hosted non-spawn building parity registry mismatch for ${entry.districtId}: `
        + `${actualBuildingTypeIds.join(",")} != ${expectedBuildingTypeIds.join(",")}.`
      );
    }

    district.ownerPlayerId = player.id;
    district.controllerAllianceId = null;
    district.status = "claimed";
    district.heat = 0;
    district.influence = 10_000;
    district.version += 1;
    for (const building of buildings) {
      building.ownerPlayerId = player.id;
      building.status = "active";
      building.actionCooldowns = {};
      if (building.buildingTypeId === "casino") {
        building.metadata = {
          ...(building.metadata ?? {}),
          casino: {
            launderedEvents: [],
            auditRiskBonuses: [],
            lastAuditCheckTick: STATIC_PARITY_GUARD_TICK,
            auditLog: []
          }
        };
      } else if (building.buildingTypeId === "central_bank") {
        building.metadata = {
          ...(building.metadata ?? {}),
          centralBank: {
            lastInterestTick: scenarioTick,
            lastOversightTick: STATIC_PARITY_GUARD_TICK,
            riskEvents: [],
            currencyInterventions: [],
            oversightEvents: [],
            interestEvents: []
          }
        };
      } else if (building.buildingTypeId === "city_hall") {
        building.metadata = {
          ...(building.metadata ?? {}),
          cityHall: {
            officialCoverByDistrictId: {},
            lastScandalCheckTick: STATIC_PARITY_GUARD_TICK,
            riskEvents: [],
            scandalEvents: []
          }
        };
      } else if (building.buildingTypeId === "lobby_club") {
        building.metadata = {
          ...(building.metadata ?? {}),
          lobbyClub: {
            lastScandalCheckTick: STATIC_PARITY_GUARD_TICK,
            riskEvents: [],
            scandalEvents: []
          }
        };
      }
      building.version += 1;
    }

    for (const buildingTypeId of entry.coveredBuildingTypeIds) {
      if (!buildings.some((building) => building.buildingTypeId === buildingTypeId)) {
        throw new Error(
          `Hosted non-spawn building parity fixture cannot resolve ${entry.key}/${buildingTypeId}.`
        );
      }
    }
  }
};
