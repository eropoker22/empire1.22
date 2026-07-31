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

  snapshot.state.root.tick = scenarioTick;
  snapshot.state.serverInstance.currentTick = scenarioTick;
  snapshot.runtime.commandRateLimitWindow = {
    tick: scenarioTick,
    commandCountsByPlayerId: {}
  };

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
    district.version += 1;
    for (const building of buildings) {
      building.ownerPlayerId = player.id;
      building.status = "active";
      building.actionCooldowns = {};
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
