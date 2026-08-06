import { createAllianceBoardReadModel, createBountyReadModel, createCityChatReadModel, createCityFeedProjection, createConflictReportViews, createGameplayEconomyRatesView, createLeaderboardReadModel, createOnboardingReadModel, createOwnedDistrictBuildingIndexViews, createPlayerFrontierSummaryView, createPoliceReadModel, getMarketViewModel } from "@empire/game-core";
import {
  empireStreetsCityMapManifestHash,
  empireStreetsCityMapManifestId,
  empireStreetsCityMapManifestVersion,
  getPublicBuildingCatalog,
  toPublicModeConfig
} from "@empire/game-config";
import {
  SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
  type DistrictId,
  type GameplayModeView,
  type GameplayMapEffectView,
  type GameplaySliceSpawnSelectionView,
  type GameplaySliceView
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { createDistrictPanelProjection } from "./district-panel-projection-service";
import { createDistrictListProjection } from "./district-list-projection-service";
import { createPlayerProjection } from "./player-projection-service";
import { createGameplaySliceCommandHints } from "./gameplay-slice-command-hints";
import { sharedCitySpawnPool } from "../../bootstrap/gameplay-slice-shared-city-seed";
/**
 * Responsibility: Aggregates the minimal read model for the first migrated gameplay slice.
 * Belongs here: server-side composition of player and district projections.
 * Does not belong here: command handling or transport concerns.
 */
export const createGameplaySliceProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  districtId?: string | null
): GameplaySliceView => {
  const publicMode = toPublicModeConfig(runtime.config);
  const mode: GameplayModeView = {
    mode: publicMode.mode,
    label: publicMode.label,
    matchStyle: publicMode.matchStyle,
    tickRateMs: publicMode.tickRateMs,
    sessionKeyPrefix: publicMode.sessionKeyPrefix
  };
  const basePlayer = createPlayerProjection(runtime, playerId);
  const selectedDistrictId = resolveSelectedDistrictId(runtime, playerId, districtId);
  const police = createPoliceReadModel(runtime.state, playerId, { config: runtime.config, clock: runtime.clock },
    { ...(selectedDistrictId ? { selectedDistrictId } : {}) });
  const player = {
    ...basePlayer,
    police
  };
  const district = selectedDistrictId ? createDistrictPanelProjection(runtime, playerId, selectedDistrictId) : null;
  const districts = createDistrictListProjection(runtime, playerId);
  const ownedDistricts = createOwnedDistrictBuildingIndexViews(
    runtime.state,
    playerId,
    districts,
    getPublicBuildingCatalog(runtime.record.mode)
  );

  return {
    server: {
      serverInstanceId: runtime.record.id,
      mode: runtime.record.mode,
      status: runtime.record.status,
      currentTick: runtime.state.root.tick,
      stateVersion: runtime.state.root.version,
      maxPlayersPerServer: runtime.config.balance.maxPlayersPerServer,
      selectedDistrictId: district?.districtId ?? null,
      mapManifestId: empireStreetsCityMapManifestId,
      mapManifestVersion: empireStreetsCityMapManifestVersion,
      mapManifestHash: empireStreetsCityMapManifestHash,
      generatedAt: runtime.clock.nowIso()
    },
    mode,
    economyRates: createGameplayEconomyRatesView(runtime.state, playerId, district?.districtId ?? null, {
      config: runtime.config, clock: runtime.clock
    }),
    player,
    commandHints: createGameplaySliceCommandHints(district),
    spawnSelection: createSpawnSelectionView(runtime, playerId),
    frontier: createPlayerFrontierSummaryView(runtime.state, playerId),
    dayNight: player.dayNight ?? null,
    elimination: player.elimination ?? null,
    onboarding: createOnboardingReadModel(runtime.state, playerId, { config: runtime.config, clock: runtime.clock }),
    police,
    allianceBoard: createAllianceBoardReadModel(runtime.state, playerId, { config: runtime.config, clock: runtime.clock }),
    market: getMarketViewModel(
      runtime.state,
      runtime.state.playersById[playerId] ?? {},
      runtime.clock.now().getTime(),
      { config: runtime.config }
    ),
    leaderboard: createLeaderboardReadModel(runtime.state, playerId, { config: runtime.config, clock: runtime.clock }),
    bounty: createBountyReadModel(runtime.state, playerId, {
      nowTick: runtime.state.root.tick,
      tickRateMs: runtime.config.tickRateMs
    }),
    cityFeed: createCityFeedProjection(runtime.state, {
      playerId,
      ...(selectedDistrictId ? { selectedDistrictId } : {}),
      factionId: player.factionId,
      allianceId: runtime.state.playersById[playerId]?.allianceId ?? null,
      limit: 50
    }),
    cityChat: createCityChatReadModel(runtime.state, playerId),
    districts,
    district,
    ownedDistricts,
    mapEffects: [
      ...createPendingConflictMapEffects(runtime, playerId),
      ...createPublicConflictMapEffects(runtime)
    ],
    reports: createConflictReportViews(runtime.state, {
      playerId,
      limit: runtime.config.balance.conflict?.reportsLimit ?? 6
    })
  };
};

const createPendingConflictMapEffects = (
  runtime: ServerInstanceRuntime,
  playerId: string
): GameplayMapEffectView[] => {
  const nowMs = runtime.clock.now().getTime();
  return runtime.state.root.notificationIds.flatMap((notificationId) => {
    const notification = runtime.state.notificationsById[notificationId];
    if (!notification || notification.recipientId !== playerId) return [];

    const type = notification.category === "report.spy"
      ? "spy"
      : notification.category === "report.rob"
        ? "robbery"
        : null;
    const payload = notification.payload;
    const expiresAtTick = Number(payload.resolveAtTick);
    if (!type || !Number.isFinite(expiresAtTick) || expiresAtTick <= runtime.state.root.tick) return [];

    const startedAtTick = Number.isFinite(Number(payload.issuedAtTick))
      ? Number(payload.issuedAtTick)
      : Number(payload.tick ?? runtime.state.root.tick);
    const remainingTicks = expiresAtTick - runtime.state.root.tick;
    const expiresAt = new Date(nowMs + remainingTicks * runtime.config.tickRateMs).toISOString();

    return [{
      effectId: notification.id,
      type,
      source: "server-pending-operation",
      playerId,
      districtId: String(payload.targetDistrictId || ""),
      startedAt: String(payload.createdAt || notification.createdAt),
      expiresAt,
      startedAtTick,
      expiresAtTick
    } satisfies GameplayMapEffectView];
  });
};

const createPublicConflictMapEffects = (
  runtime: ServerInstanceRuntime
): GameplayMapEffectView[] => {
  const currentTick = runtime.state.root.tick;
  const tickRateMs = runtime.config.tickRateMs;
  const nowMs = runtime.clock.now().getTime();
  const cityFeedEvents = Object.values(runtime.state.cityFeedEventsById ?? {});

  return Object.values(runtime.state.districtsById).flatMap((district) => {
    const operationLocks = district.operationLocks ?? {};
    return (["attack", "occupy"] as const).flatMap((type) => {
      const expiresAtTick = Number(operationLocks[type] ?? 0);
      if (expiresAtTick <= currentTick) return [];

      const sourceType = type === "attack" ? "attack" : "district_occupy";
      const pendingOccupy = type === "occupy"
        ? Object.values(runtime.state.pendingOccupyOperationsById ?? {})
          .filter((operation) => operation.targetDistrictId === district.id && operation.resolveAtTick > currentTick)
          .sort((left, right) => right.issuedAtTick - left.issuedAtTick)[0]
        : null;
      const sourceEvent = cityFeedEvents
        .filter((event) => (
          event.sourceType === sourceType
          && event.districtId === district.id
          && event.createdAtTick <= currentTick
        ))
        .sort((left, right) => right.createdAtTick - left.createdAtTick)[0];
      const playerId = String(
        pendingOccupy?.playerId
        || sourceEvent?.playerId
        || (type === "occupy" ? district.ownerPlayerId : "")
        || ""
      );
      const startedAtTick = Math.max(0, Number(pendingOccupy?.issuedAtTick ?? sourceEvent?.createdAtTick ?? currentTick));
      const player = playerId ? runtime.state.playersById[playerId] : undefined;
      const playerColor = player?.color;
      const playerName = String(
        player?.metadata?.gangName
        || player?.metadata?.displayName
        || player?.name
        || ""
      ).trim();

      return [{
        effectId: `public-operation:${type}:${district.id}:${startedAtTick}`,
        type,
        source: "server-public-operation",
        playerId,
        ...(playerName ? { playerName } : {}),
        ...(playerColor ? { playerColor } : {}),
        districtId: district.id,
        startedAt: new Date(nowMs - Math.max(0, currentTick - startedAtTick) * tickRateMs).toISOString(),
        expiresAt: new Date(nowMs + Math.max(0, expiresAtTick - currentTick) * tickRateMs).toISOString(),
        startedAtTick,
        expiresAtTick
      } satisfies GameplayMapEffectView];
    });
  });
};

const createSpawnSelectionView = (
  runtime: ServerInstanceRuntime,
  playerId: string
): GameplaySliceSpawnSelectionView => {
  const player = runtime.state.playersById[playerId];

  return {
    status: player?.homeDistrictId ? "ready_to_play" : "awaiting_spawn_selection",
    districts: sharedCitySpawnPool.map((candidate) => {
      const district = runtime.state.districtsById[candidate.districtId];
      const owner = district?.ownerPlayerId ? runtime.state.playersById[district.ownerPlayerId] : null;
      const firstBuilding = district?.buildingIds
        .map((buildingId) => runtime.state.buildingsById[buildingId])
        .find((building) => building !== undefined);

      return {
        districtId: candidate.districtId,
        districtName: district?.name ?? candidate.districtId,
        districtType: district?.zone ?? "unknown",
        buildingType: firstBuilding?.buildingTypeId ?? null,
        spawnZones: [...candidate.zones],
        neighborCount: district?.adjacentDistrictIds.length ?? 0,
        status: resolveSpawnDistrictStatus(
          candidate.enabled,
          district,
          playerId,
          Object.values(runtime.state.pendingOccupyOperationsById ?? {}).some((operation) =>
            operation.targetDistrictId === candidate.districtId
            && operation.resolveAtTick > runtime.state.root.tick
          ),
          runtime.state.root.tick
        ),
        ownerPublicName: owner?.name ?? null,
        ownerPlayerId: owner?.id ?? null,
        version: district?.version ?? 0
      };
    })
  };
};

const resolveSpawnDistrictStatus = (
  enabled: boolean,
  district: ServerInstanceRuntime["state"]["districtsById"][string] | undefined,
  playerId: string,
  occupationInProgress = false,
  currentTick = 0
): GameplaySliceSpawnSelectionView["districts"][number]["status"] => {
  if (!enabled || !district) return "disabled";
  if (district.status === "locked" || district.status === "destroyed" || district.lockdownUntilTick) {
    return "locked";
  }
  if (district.ownerPlayerId === playerId) return "selected_by_me";
  if (district.ownerPlayerId) return "occupied";
  if (occupationInProgress || Number(district.operationLocks?.occupy ?? 0) > currentTick) return "occupied";
  return "available";
};

const resolveSelectedDistrictId = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  requestedDistrictId?: string | null
): DistrictId | null => {
  const playerHomeDistrictId = runtime.state.playersById[playerId]?.homeDistrictId;

  if (
    requestedDistrictId &&
    requestedDistrictId !== SERVER_ASSIGNED_FOCUS_DISTRICT_ID &&
    runtime.state.districtsById[requestedDistrictId]
  ) {
    return requestedDistrictId;
  }

  return playerHomeDistrictId && runtime.state.districtsById[playerHomeDistrictId]
    ? playerHomeDistrictId
    : null;
};
