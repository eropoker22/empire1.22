import type { District, DistrictOperationType } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import { resolveDistrictRelation } from "../map/mapRelations";

export const MAJOR_OFFENSE_COOLDOWN_KEY = "offense:global";
export const createSourceConflictLockKey = (districtId: string): string =>
  `conflict:source:${districtId}`;

export const resolveMajorOffenseCooldownTicks = (config?: ConflictBalanceConfig): number =>
  sanitize(config?.concurrency?.offenseGlobalCooldownTicks);

export const resolveSourceConflictLockTicks = (config?: ConflictBalanceConfig): number =>
  sanitize(config?.concurrency?.sourceConflictLockTicks);

export const validateDistrictConflictRevision = (
  district: District,
  expectedConflictRevision: number
): { code: "DISTRICT_CONFLICT_STATE_CHANGED"; message: string } | null =>
  district.conflictRevision !== expectedConflictRevision
    ? {
        code: "DISTRICT_CONFLICT_STATE_CHANGED",
        message: "Situace v districtu se mezitím změnila. Zkontroluj nový stav a potvrď akci znovu."
      }
    : null;

export const resolveMajorOperationBlock = (
  cooldowns: Record<string, number>,
  sourceDistrictId: string,
  tick: number
): { code: "PLAYER_MAJOR_OPERATION_ACTIVE" | "SOURCE_CONFLICT_LOCKED"; untilTick: number } | null => {
  const offenseUntil = Number(cooldowns[MAJOR_OFFENSE_COOLDOWN_KEY] ?? 0);
  if (offenseUntil > tick) return { code: "PLAYER_MAJOR_OPERATION_ACTIVE", untilTick: offenseUntil };
  const sourceUntil = Number(cooldowns[createSourceConflictLockKey(sourceDistrictId)] ?? 0);
  return sourceUntil > tick ? { code: "SOURCE_CONFLICT_LOCKED", untilTick: sourceUntil } : null;
};

export const applyMajorOperationCooldowns = (
  cooldowns: Record<string, number>,
  sourceDistrictId: string,
  tick: number,
  config?: ConflictBalanceConfig
): Record<string, number> => ({
  ...cooldowns,
  [MAJOR_OFFENSE_COOLDOWN_KEY]: tick + resolveMajorOffenseCooldownTicks(config),
  [createSourceConflictLockKey(sourceDistrictId)]: tick + resolveSourceConflictLockTicks(config)
});

export type ConflictAction = "attack" | "heist" | "occupy" | "rob" | "spy";

const CONFLICTING_DISTRICT_OPERATIONS: Record<DistrictOperationType, DistrictOperationType[]> = {
  spy: ["rob"],
  rob: ["spy", "occupy"],
  occupy: ["rob"],
  heist: ["attack"],
  attack: ["heist"]
};

const districtOperationLabel = (action: DistrictOperationType): string => ({
  spy: "špehování",
  rob: "vykradení districtu",
  occupy: "obsazení districtu",
  heist: "vykradení hráče",
  attack: "útok"
}[action]);

export const resolveDistrictOperationBlock = (
  district: District,
  action: DistrictOperationType,
  tick: number
): { code: "DISTRICT_OPERATION_ACTIVE"; message: string; untilTick: number } | null => {
  const operationLocks = district.operationLocks ?? {};
  const blockingOperation = CONFLICTING_DISTRICT_OPERATIONS[action].find(
    (candidate) => Number(operationLocks[candidate] ?? 0) > tick
  );
  if (!blockingOperation) return null;

  return {
    code: "DISTRICT_OPERATION_ACTIVE",
    message: `${districtOperationLabel(blockingOperation)} v tomto districtu ještě probíhá; ${districtOperationLabel(action)} nelze spustit současně.`,
    untilTick: Number(operationLocks[blockingOperation])
  };
};

export const applyDistrictOperationLock = <TDistrict extends District>(
  district: TDistrict,
  action: DistrictOperationType,
  untilTick: number
): TDistrict => ({
  ...district,
  operationLocks: {
    ...district.operationLocks,
    [action]: Math.max(Number(district.operationLocks?.[action] ?? 0), Math.floor(untilTick))
  }
});

export const resolveDistrictActionAvailability = (
  state: CoreGameState,
  actorPlayerId: string,
  targetDistrictId: string,
  action: ConflictAction
): { code: string; message: string } | null => {
  const actor = state.playersById[actorPlayerId];
  const target = state.districtsById[targetDistrictId];
  if (!actor || !target) return error("TARGET_NOT_FOUND", "Cílový district neexistuje.");
  if (target.status === "destroyed") return error("TARGET_DESTROYED", "Zničený district nelze použít pro tuto akci.");
  if (target.status === "locked" || Number(target.lockdownUntilTick ?? 0) > state.root.tick) {
    return error("TARGET_LOCKED", "District je dočasně uzamčený.");
  }

  const relation = resolveDistrictRelation(state, actor, target);
  if (action === "spy") {
    return relation === "enemy" || relation === "empty"
      ? null
      : error(relation === "ally" ? "ALLIANCE_RELATION_CHANGED" : "TARGET_OWNER_CHANGED",
        relation === "ally" ? "District je nyní spojenecký." : "Tento district nelze špehovat.");
  }
  if (action === "occupy" || action === "rob") {
    return relation === "empty"
      ? null
      : error("TARGET_NO_LONGER_NEUTRAL", "District už mezitím není neutrální.");
  }
  if (relation !== "enemy") {
    return error(relation === "ally" ? "ALLIANCE_RELATION_CHANGED" : "TARGET_OWNER_CHANGED",
      relation === "ally" ? "Vztah k vlastníkovi districtu se změnil." : "District mezitím změnil vlastníka.");
  }
  if (action === "attack" && Number(target.stabilizingUntilTick ?? 0) > state.root.tick) {
    return error("TARGET_STABILIZING", "District se po převzetí ještě stabilizuje.");
  }
  if (action === "attack" && Number(target.attackProtectedUntilTick ?? 0) > state.root.tick) {
    const owner = target.ownerPlayerId ? state.playersById[target.ownerPlayerId] : null;
    const lastStand = owner?.lastStandDistrictId === target.id
      && Number(owner.lastStandProtectedUntilTick ?? 0) > state.root.tick;
    return error(
      lastStand ? "LAST_STAND_PROTECTION_ACTIVE" : "TARGET_ATTACK_PROTECTED",
      lastStand
        ? "Poslední bašta hráče je dočasně chráněná."
        : "District se právě vzpamatovává z boje."
    );
  }
  if (action === "heist" && Number(target.heistProtectedUntilTick ?? 0) > state.root.tick) {
    return error("TARGET_HEIST_PROTECTED", "District je po heistu dočasně chráněný.");
  }
  return null;
};

const error = (code: string, message: string): { code: string; message: string } => ({ code, message });

const sanitize = (value: unknown): number => Math.max(0, Math.floor(Number(value ?? 0)));
