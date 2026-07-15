import type {
  DistrictOccupyTargetView,
  OccupyDistrictCommand
} from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities/game-state";
import {
  createOccupyGlobalCooldownKey,
  createOccupySourceCooldownKey,
  resolveOccupyBalance,
  resolveOccupyInfluenceCost,
  resolveOccupyPopulationCost
} from "../rules";
import { validateOccupy } from "../validation";

/**
 * Responsibility: Builds occupiable neutral district options for one selected source district.
 * Belongs here: server-side read shaping that reuses authoritative occupy validation.
 * Does not belong here: client rendering or hidden intel mutation.
 */
export const createDistrictOccupyTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  conflictConfig?: ConflictBalanceConfig,
  issuedAt = new Date().toISOString()
): DistrictOccupyTargetView[] => {
  const sourceDistrict = state.districtsById[sourceDistrictId];

  if (!sourceDistrict || sourceDistrict.ownerPlayerId !== playerId) {
    return [];
  }

  return sourceDistrict.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((district) => district !== undefined && !district.ownerPlayerId)
    .map((targetDistrict) => {
      const previewCommand: OccupyDistrictCommand = {
        id: `preview:occupy:${sourceDistrict.id}:${targetDistrict.id}`,
        type: "occupy-district",
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt,
        payload: {
          districtId: targetDistrict.id,
          sourceDistrictId: sourceDistrict.id
        },
        clientRequestId: null
      };
      const errors = validateOccupy(state, previewCommand, conflictConfig);
      const balance = resolveOccupyBalance(conflictConfig);
      const populationCost = resolveOccupyPopulationCost(state, playerId, conflictConfig);
      const influenceCost = resolveOccupyInfluenceCost(state, playerId, conflictConfig);
      const cooldowns = state.cooldownStatesById[state.playersById[playerId]?.cooldownStateId ?? ""]
        ?.cooldowns ?? {};
      const cooldownUntilTick = cooldowns[createOccupyGlobalCooldownKey()]
        ?? cooldowns[createOccupySourceCooldownKey(sourceDistrict.id)]
        ?? 0;
      const globalCooldownRemainingTicks = Math.max(
        0,
        Number(cooldowns[createOccupyGlobalCooldownKey()] ?? 0) - state.root.tick
      );
      const sourceCooldownRemainingTicks = Math.max(
        0,
        Number(cooldowns[createOccupySourceCooldownKey(sourceDistrict.id)] ?? 0) - state.root.tick
      );

      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledCode: errors[0]?.code ?? null,
        disabledReason: errors[0]?.message ?? null,
        cost: {
          influence: influenceCost,
          population: populationCost
        },
        heatGain: balance.heatGain,
        cooldownRemainingTicks: Math.max(0, cooldownUntilTick - state.root.tick),
        globalCooldownRemainingTicks,
        sourceCooldownRemainingTicks,
        stabilizingDurationTicks: Math.max(
          0,
          Number(conflictConfig?.captureStabilization?.durationTicks ?? 0)
        )
      };
    });
};
