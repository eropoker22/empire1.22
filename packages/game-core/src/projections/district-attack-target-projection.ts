import type {
  AttackDistrictCommand,
  AttackWeaponId,
  DistrictAttackTargetView
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import type { ResolvedGameModeConfig } from "../contracts";
import { getAttackWeaponInventory, validateAttack } from "../validation";
import { hasValidAttackAuthorization } from "../validation/spyIntel";
import { calculateAttackPopulationRequired } from "../rules";
import { resolvePlayerPopulation } from "../state/playerPopulation";

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
      const player = state.playersById[playerId];
      const attackWeapons = config?.balance.attackWeapons;
      const inventory = player ? getAttackWeaponInventory(state, player) : {};
      const availablePopulation = Math.max(0, Math.floor(resolvePlayerPopulation(state, player)));
      const previewLoadout = resolveSmallestAttackPreviewLoadout(
        inventory,
        availablePopulation,
        attackWeapons
      );
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
          weapons: previewLoadout,
          expectedSourceVersion: sourceDistrict.version,
          expectedTargetVersion: targetDistrict.version,
          expectedConflictRevision: targetDistrict.conflictRevision
        },
        clientRequestId: null
      };
      const errors = validateAttack(state, previewCommand, config ? { config } : undefined);
      const cooldowns = player ? state.cooldownStatesById[player.cooldownStateId]?.cooldowns ?? {} : {};
      const globalCooldownRemainingTicks = remainingTicks(cooldowns["attack:global"], state.root.tick);
      const sourceCooldownRemainingTicks = remainingTicks(cooldowns[`attack:source:${sourceDistrict.id}`], state.root.tick);
      const targetProtectionRemainingTicks = remainingTicks(targetDistrict.attackProtectedUntilTick, state.root.tick);
      const selectedLoadout = { ...(player?.attackLoadout ?? {}) };
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
        sourceDistrictId: sourceDistrict.id,
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledCode: errors[0]?.code ?? null,
        disabledReason: errors[0]?.message ?? null,
        cooldownRemainingTicks,
        globalCooldownRemainingTicks,
        sourceCooldownRemainingTicks,
        targetProtectionRemainingTicks,
        expectedSourceVersion: sourceDistrict.version,
        expectedTargetVersion: targetDistrict.version,
        expectedConflictRevision: targetDistrict.conflictRevision,
        targetSecurityRevision: targetDistrict.securityRevision,
        spyAuthorizationValid: hasValidAttackAuthorization(state, playerId, targetDistrict.id),
        selectedLoadout,
        projectedPopulationCost,
        catastrophePreview: { baseChance, bazookaBonus, finalChance },
        sourceStabilizingUntilTick: sourceDistrict.stabilizingUntilTick ?? null,
        majorOffenseCooldownEndsAtTick: cooldowns["offense:global"] ?? null,
        sourceConflictLockEndsAtTick: cooldowns[`conflict:source:${sourceDistrict.id}`] ?? null
      };
    });
};

const resolveSmallestAttackPreviewLoadout = (
  inventory: Partial<Record<AttackWeaponId, number>>,
  availablePopulation: number,
  attackWeapons: ResolvedGameModeConfig["balance"]["attackWeapons"] | undefined
): Partial<Record<AttackWeaponId, number>> => {
  if (!attackWeapons) return {};
  const candidate = (Object.keys(attackWeapons) as AttackWeaponId[])
    .filter((weaponId) => Number(inventory[weaponId] ?? 0) >= 1)
    .filter((weaponId) => calculateAttackPopulationRequired({ [weaponId]: 1 }, attackWeapons) <= availablePopulation)
    .sort((left, right) =>
      calculateAttackPopulationRequired({ [left]: 1 }, attackWeapons)
      - calculateAttackPopulationRequired({ [right]: 1 }, attackWeapons)
      || left.localeCompare(right)
    )[0];
  return candidate ? { [candidate]: 1 } : {};
};

const remainingTicks = (untilTick: number | null | undefined, tick: number): number =>
  typeof untilTick === "number" ? Math.max(0, untilTick - tick) : 0;
