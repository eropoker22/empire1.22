import type {
  AttackDistrictCommand,
  DistrictAttackTargetView
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import type { ResolvedGameModeConfig } from "../contracts";
import { validateAttack } from "../validation";

/**
 * Responsibility: Builds attack target options for one selected source district.
 * Belongs here: server-side read shaping that reuses authoritative attack validation.
 * Does not belong here: client UI rendering or transport delivery.
 */
export const createDistrictAttackTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  issuedAt = new Date().toISOString(),
  config?: ResolvedGameModeConfig
): DistrictAttackTargetView[] => {
  const sourceDistrict = state.districtsById[sourceDistrictId];

  if (!sourceDistrict || sourceDistrict.ownerPlayerId !== playerId) {
    return [];
  }

  return sourceDistrict.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((district) => district !== undefined)
    .map((targetDistrict) => {
      const previewCommand: AttackDistrictCommand = {
        id: `preview:attack:${sourceDistrict.id}:${targetDistrict.id}`,
        type: "attack-district",
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt,
        payload: {
          districtId: targetDistrict.id,
          sourceDistrictId: sourceDistrict.id,
          weapons: { ...(state.playersById[playerId]?.attackLoadout ?? {}) }
        },
        clientRequestId: null
      };
      const errors = validateAttack(state, previewCommand, config ? { config } : undefined);
      const player = state.playersById[playerId];
      const cooldownUntilTick = player
        ? state.cooldownStatesById[player.cooldownStateId]?.cooldowns?.["attack:global"]
          ?? state.cooldownStatesById[player.cooldownStateId]?.cooldowns?.[`attack:source:${sourceDistrict.id}`]
          ?? targetDistrict.attackProtectedUntilTick
        : 0;
      const cooldownRemainingTicks = Math.max(0, Number(cooldownUntilTick || 0) - state.root.tick);

      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledReason: errors[0]?.message ?? null,
        cooldownRemainingTicks
      };
    });
};
