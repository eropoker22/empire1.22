import type { CoreGameState } from "../../entities";

export type ConflictOriginAction = "spy" | "rob" | "attack" | "heist" | "occupy";

export interface UsableConflictOrigins {
  ownedDistrictIds: string[];
  activeOwnedDistrictIds: string[];
  usableOriginDistrictIds: string[];
  temporarilyBlockedOriginDistrictIds: string[];
  permanentlyInvalidOriginDistrictIds: string[];
}

export const resolveUsableConflictOriginDistricts = (
  state: CoreGameState,
  playerId: string,
  action: ConflictOriginAction
): UsableConflictOrigins => {
  const player = state.playersById[playerId];
  const cooldowns = player ? state.cooldownStatesById[player.cooldownStateId]?.cooldowns ?? {} : {};
  const owned = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const active = owned.filter((district) => district.status !== "destroyed" && district.status !== "locked");
  const usable: string[] = [];
  const temporary: string[] = [];
  const permanent: string[] = [];
  for (const district of owned) {
    if (district.status === "destroyed") {
      permanent.push(district.id);
      continue;
    }
    if (district.status === "locked" && !isFutureTick(district.lockdownUntilTick, state.root.tick)) {
      permanent.push(district.id);
      continue;
    }
    const stabilizationBlocks = ["attack", "heist", "occupy"].includes(action)
      && isFutureTick(district.stabilizingUntilTick, state.root.tick);
    const lockdownBlocks = isFutureTick(district.lockdownUntilTick, state.root.tick);
    const sourceCooldownBlocks = resolveSourceCooldownKeys(action, district.id)
      .some((key) => isFutureTick(cooldowns[key], state.root.tick));
    const globalCooldownBlocks = resolveGlobalCooldownKeys(action)
      .some((key) => isFutureTick(cooldowns[key], state.root.tick));
    if (stabilizationBlocks || lockdownBlocks || sourceCooldownBlocks || globalCooldownBlocks) temporary.push(district.id);
    else usable.push(district.id);
  }
  return {
    ownedDistrictIds: owned.map((district) => district.id),
    activeOwnedDistrictIds: active.map((district) => district.id),
    usableOriginDistrictIds: usable,
    temporarilyBlockedOriginDistrictIds: temporary,
    permanentlyInvalidOriginDistrictIds: permanent
  };
};

export const isFutureTick = (value: unknown, tick: number): boolean =>
  Number.isFinite(Number(value)) && Number(value) > tick;

const resolveSourceCooldownKeys = (action: ConflictOriginAction, districtId: string): string[] =>
  action === "attack" ? [`attack:source:${districtId}`]
    : action === "occupy" ? [`occupy:source:${districtId}`]
      : action === "rob" ? [`rob:source:${districtId}`]
        : [];

const resolveGlobalCooldownKeys = (action: ConflictOriginAction): string[] =>
  action === "attack" ? ["attack:global"]
    : action === "occupy" ? ["occupy:global"]
      : action === "heist" ? ["heist:global"] : [];
