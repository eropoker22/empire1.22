import {
  createCityFeedProjection,
  createConflictReportViews,
  createOnboardingReadModel,
  createPoliceReadModel
} from "@empire/game-core";
import { toPublicModeConfig } from "@empire/game-config";
import type { GameplayModeView, GameplaySliceView } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { createDistrictPanelProjection } from "./district-panel-projection-service";
import { createDistrictListProjection } from "./district-list-projection-service";
import { createPlayerProjection } from "./player-projection-service";

/**
 * Responsibility: Aggregates the minimal read model for the first migrated gameplay slice.
 * Belongs here: server-side composition of player and district projections.
 * Does not belong here: command handling or transport concerns.
 */
export const createGameplaySliceProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  districtId: string
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
  const selectedDistrictId = runtime.state.districtsById[districtId]
    ? districtId
    : runtime.state.playersById[playerId]?.homeDistrictId ?? districtId;
  const police = createPoliceReadModel(runtime.state, playerId, { config: runtime.config }, {
    selectedDistrictId
  });
  const player = {
    ...basePlayer,
    police
  };

  return {
    mode,
    player,
    dayNight: player.dayNight ?? null,
    elimination: player.elimination ?? null,
    onboarding: createOnboardingReadModel(runtime.state, playerId, {
      config: runtime.config
    }),
    police,
    cityFeed: createCityFeedProjection(runtime.state, {
      playerId,
      selectedDistrictId,
      factionId: player.factionId,
      limit: 50
    }),
    districts: createDistrictListProjection(runtime, playerId),
    district: createDistrictPanelProjection(runtime, playerId, selectedDistrictId),
    reports: createConflictReportViews(runtime.state, {
      playerId,
      limit: runtime.config.balance.conflict?.reportsLimit ?? 6
    })
  };
};
