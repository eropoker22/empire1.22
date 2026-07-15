import type {
  AttackDistrictCommand,
  DistrictAttackTargetView
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import type { ResolvedGameModeConfig } from "../contracts";
import { validateAttack } from "../validation";
import { hasValidAttackAuthorization } from "../validation/spyIntel";
import { calculateAttackPopulationRequired } from "../rules";

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
          weapons: { ...(state.playersById[playerId]?.attackLoadout ?? {}) },
          expectedSourceVersion: sourceDistrict.version,
          expectedTargetVersion: targetDistrict.version
        },
        clientRequestId: null
      };
      const errors = validateAttack(state, previewCommand, config ? { config } : undefined);
      const player = state.playersById[playerId];
      const cooldowns = player ? state.cooldownStatesById[player.cooldownStateId]?.cooldowns ?? {} : {};
      const globalCooldownRemainingTicks = remainingTicks(cooldowns["attack:global"], state.root.tick);
      const sourceCooldownRemainingTicks = remainingTicks(cooldowns[`attack:source:${sourceDistrict.id}`], state.root.tick);
      const targetProtectionRemainingTicks = remainingTicks(targetDistrict.attackProtectedUntilTick, state.root.tick);
      const selectedLoadout = { ...(player?.attackLoadout ?? {}) };
      const attackWeapons = config?.balance.attackWeapons;
      const projectedPopulationCost = attackWeapons
        ? calculateAttackPopulationRequired(selectedLoadout, attackWeapons)
        : 0;
      const baseChance = Math.max(0, Number(config?.balance.conflict?.catastropheChance ?? 0));
      const catastropheConfig = config?.balance.conflict?.catastrophe;
      const bazookaBonus = Math.min(
        Number(catastropheConfig?.bazookaBonusCap ?? 0.12),
        Number(selectedLoadout.bazooka ?? 0) * Number(catastropheConfig?.bazookaBonusPerUnit ?? 0.015)
      );
      const finalChance = Math.min(
        Number(catastropheConfig?.finalChanceCap ?? 0.18),
        baseChance + bazookaBonus
      );
      const cooldownRemainingTicks = Math.max(
        globalCooldownRemainingTicks,
        sourceCooldownRemainingTicks,
        targetProtectionRemainingTicks
      );

      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledReason: errors[0]?.message ?? null,
        cooldownRemainingTicks,
        globalCooldownRemainingTicks,
        sourceCooldownRemainingTicks,
        targetProtectionRemainingTicks,
        expectedSourceVersion: sourceDistrict.version,
        expectedTargetVersion: targetDistrict.version,
        targetSecurityRevision: targetDistrict.securityRevision,
        spyAuthorizationValid: hasValidAttackAuthorization(state, playerId, targetDistrict.id),
        selectedLoadout,
        projectedPopulationCost,
        catastrophePreview: { baseChance, bazookaBonus, finalChance },
        sourceStabilizingUntilTick: sourceDistrict.stabilizingUntilTick ?? null
      };
    });
};

const remainingTicks = (untilTick: number | null | undefined, tick: number): number =>
  typeof untilTick === "number" ? Math.max(0, untilTick - tick) : 0;
