import { resolveModeConfig } from "@empire/game-config";
import { resolvePlayerOperationalLiveness } from "@empire/game-core";
import type {
  AdminCommandSummaryView,
  AdminDiagnosticSummaryView,
  AdminEventSummaryView,
  AdminInstanceDetailView,
  AdminInstanceSummaryView
} from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../../runtime/persistence/dto";
import { assertAdminInstanceDetailScope } from "./admin-scope-guard";

export const createAdminDetailFromSnapshot = (input: {
  summary: AdminInstanceSummaryView;
  snapshot: InstanceSnapshotDto | null;
  commands: AdminCommandSummaryView[];
  events: AdminEventSummaryView[];
  diagnostics: AdminDiagnosticSummaryView[];
  generatedAt: string;
}): AdminInstanceDetailView => {
  const { summary, snapshot, generatedAt } = input;
  const id = summary.serverInstanceId;
  const state = snapshot?.state ?? null;
  if (snapshot && snapshot.instanceId !== id) {
    throw new Error("Admin snapshot does not match requested server instance.");
  }
  assertStateScope(id, state);

  const config = snapshot ? resolveModeConfig(snapshot.metadata.mode) : null;
  const players = state ? Object.values(state.playersById).map((player) => {
    const resources = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    const police = state.policeStatesById[player.policeStateId];
    return {
      serverInstanceId: id,
      playerId: player.id,
      displayName: player.name,
      factionId: player.factionId,
      status: player.status,
      homeDistrictId: player.homeDistrictId,
      ownedDistrictCount: Object.values(state.districtsById).filter((district) => district.ownerPlayerId === player.id).length,
      cash: safeNumber(resources.cash),
      dirtyCash: safeNumber(resources["dirty-cash"]),
      population: safeNumber(player.population),
      heat: safeNumber(police?.heat),
      wantedLevel: safeNumber(police?.wantedLevel),
      lastActionAt: player.lastActionAt
    };
  }) : [];
  const districts = state ? Object.values(state.districtsById).map((district) => ({
    serverInstanceId: id,
    districtId: district.id,
    name: district.name,
    zone: district.zone,
    status: district.status,
    ownerPlayerId: district.ownerPlayerId,
    influence: safeNumber(district.influence),
    heat: safeNumber(district.heat),
    buildingCount: district.buildingIds.length
  })) : [];
  const totals: Record<string, number> = {};
  if (state) {
    for (const resourceState of Object.values(state.resourceStatesById)) {
      for (const [key, amount] of Object.entries(resourceState.balances)) {
        totals[key] = safeNumber(totals[key]) + safeNumber(amount);
      }
    }
  }
  const buildings = state ? Object.values(state.buildingsById) : [];
  const productionBuildings = config
    ? buildings.filter((building) => Boolean(config.balance.productionBuildings?.[building.buildingTypeId]))
    : [];
  const readyToCollectCount = config && state ? productionBuildings.filter((building) => {
    const profile = config.balance.productionBuildings?.[building.buildingTypeId];
    return safeNumber(findBuildingResources(state, building.id)?.balances[profile?.resourceKey ?? ""]) > 0;
  }).length : 0;
  const storageFullCount = config && state ? productionBuildings.filter((building) => {
    const profile = config.balance.productionBuildings?.[building.buildingTypeId];
    const stored = safeNumber(findBuildingResources(state, building.id)?.balances[profile?.resourceKey ?? ""]);
    return Boolean(profile && profile.storageCap > 0 && stored >= profile.storageCap);
  }).length : 0;
  const policeStates = state ? Object.values(state.policeStatesById) : [];
  const maxHeat = policeStates.reduce((max, police) => Math.max(max, safeNumber(police.heat)), 0);
  const activePlayers = state ? Object.values(state.playersById).filter((player) => player.status === "active") : [];
  const liveness = state && config ? activePlayers.map((player) =>
    resolvePlayerOperationalLiveness(state, player.id, { config })
  ) : [];

  const detail: AdminInstanceDetailView = {
    serverInstanceId: id,
    generatedAt,
    summary,
    freshness: summary.freshness,
    runtimeAvailable: summary.workerStatus === "live",
    players,
    districts,
    economy: {
      serverInstanceId: id,
      totalCleanCash: safeNumber(totals.cash),
      totalDirtyCash: safeNumber(totals["dirty-cash"]),
      totalResources: totals
    },
    production: {
      serverInstanceId: id,
      productionBuildingCount: productionBuildings.length,
      readyToCollectCount,
      activeCraftCount: buildings.filter((building) => Boolean(building.processing)).length,
      storageFullCount
    },
    police: {
      serverInstanceId: id,
      heatPressure: heatPressure(maxHeat),
      maxPlayerHeat: maxHeat,
      wantedPlayerCount: policeStates.filter((police) => safeNumber(police.wantedLevel) > 0).length,
      pendingRaidCount: policeStates.reduce((count, police) =>
        count + (police.pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged").length, 0)
    },
    liveness: {
      serverInstanceId: id,
      activePlayers: liveness.length,
      playablePlayers: liveness.filter((entry) => entry.canProgressNow).length,
      temporarilySealedPlayers: liveness.filter((entry) => entry.state === "temporarily_sealed").length,
      encircledPlayers: liveness.filter((entry) => entry.state.includes("encircled")).length,
      lastStandPlayers: liveness.filter((entry) => entry.state === "last_stand").length,
      emergencyRecoveryEligiblePlayers: liveness.filter((entry) => entry.emergencyRecovery.canClaim).length,
      invalidSoftlocks: liveness.filter((entry) => entry.invalidInvariant).length
    },
    alliances: state ? Object.values(state.alliancesById).map((alliance) => ({
      serverInstanceId: id,
      allianceId: alliance.id,
      memberCount: alliance.memberIds.length
    })) : [],
    snapshot: {
      serverInstanceId: id,
      snapshotId: snapshot?.snapshotId ?? null,
      createdAt: snapshot?.createdAt ?? null,
      tick: snapshot?.tick ?? null,
      stateVersion: snapshot?.integrity.rootVersion ?? null,
      schemaVersion: snapshot?.version.schemaVersion ?? null,
      stale: summary.snapshotStale
    },
    commands: input.commands,
    events: input.events,
    diagnostics: input.diagnostics
  };
  assertAdminInstanceDetailScope(id, detail);
  return detail;
};

const assertStateScope = (id: string, state: InstanceSnapshotDto["state"] | null): void => {
  if (!state) return;
  const foreign = [
    state.serverInstance,
    ...Object.values(state.playersById),
    ...Object.values(state.districtsById),
    ...Object.values(state.buildingsById),
    ...Object.values(state.alliancesById)
  ].find((entry) => "serverInstanceId" in entry
    ? entry.serverInstanceId !== id
    : "id" in entry && entry === state.serverInstance && entry.id !== id);
  if (foreign) throw new Error("Durable snapshot contains cross-instance entities.");
};

const findBuildingResources = (state: InstanceSnapshotDto["state"], buildingId: string) =>
  Object.values(state.resourceStatesById).find((entry) => entry.ownerType === "building" && entry.ownerId === buildingId);

const safeNumber = (value: unknown): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

const heatPressure = (heat: number): "none" | "low" | "medium" | "high" | "extreme" =>
  heat >= 140 ? "extreme" : heat >= 90 ? "high" : heat >= 40 ? "medium" : heat > 0 ? "low" : "none";
